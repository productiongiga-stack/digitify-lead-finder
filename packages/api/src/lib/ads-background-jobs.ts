import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@digitify/db";
import { adJson, loadOptimizationSettings, optimizeAds, safeAdError, syncAdAccount } from "./ads-workflow";
import { adProviderConfig, readAdAccount } from "./ads-workflow-providers";
import { AD_CAPABILITIES, type AdProvider } from "./ads-workflow-policy";

type JobKind = "SYNC" | "OPTIMIZE" | "REMINDERS" | "RECOVERY" | "PROVIDER_CHECK";
export async function enqueueAdsJobs(db: PrismaClient, workspaceId: string, provider: AdProvider, now = new Date()) {
  const settings = await loadOptimizationSettings(db, workspaceId, provider);
  const hour = now.toISOString().slice(0, 13), day = hour.slice(0, 10);
  const enqueue = (kind: JobKind, period: string, dependencyId?: string) => db.adBackgroundJob.upsert({
    where: { dedupeKey: [workspaceId, provider, kind, period].join(":") }, update: {},
    create: { createdById: workspaceId, provider, kind, dedupeKey: [workspaceId, provider, kind, period].join(":"), dependencyId, runAt: now },
  });
  await enqueue("RECOVERY", hour);
  await enqueue("REMINDERS", day);
  if (settings.enabled) {
    await enqueue("PROVIDER_CHECK", day);
    const sync = await enqueue("SYNC", day);
    await enqueue("OPTIMIZE", day, sync.id);
  }
}

export async function recoverAdsJobLeases(db: PrismaClient, workspaceId: string, now = new Date()) {
  const expired = await db.adBackgroundJob.findMany({ where: { createdById: workspaceId, status: "RUNNING", leasedUntil: { lt: now } }, take: 50 });
  for (const job of expired) {
    // AI may already have saved proposals. Never blindly replay a lost AI lease.
    const status = job.kind === "OPTIMIZE" ? "NEEDS_REVIEW" : job.attempts >= 3 ? "FAILED" : "PENDING";
    await db.adBackgroundJob.updateMany({ where: { id: job.id, createdById: workspaceId, status: "RUNNING", leaseToken: job.leaseToken },
      data: { status, leaseToken: null, leasedUntil: null, runAt: now, lastError: "Taak onderbroken; " + (status === "PENDING" ? "veilige leestaak wordt hervat." : "controle vereist.") } });
  }
}

async function executeJob(db: PrismaClient, workspaceId: string, provider: AdProvider, job: { id: string; kind: string; dedupeKey: string }) {
  if (["SYNC", "OPTIMIZE", "PROVIDER_CHECK"].includes(job.kind) && !(await loadOptimizationSettings(db, workspaceId, provider)).enabled) return { cancelled: true };
  if (job.kind === "SYNC") {
    const result = await syncAdAccount(db, workspaceId, provider);
    if (result.errors.length) throw new Error("Synchronisatie onvolledig: " + result.errors[0]!.message);
    return { snapshots: result.versions.length, truncated: result.truncated };
  }
  if (job.kind === "OPTIMIZE") {
    const prior = await db.aiOptimizationRun.findFirst({ where: { createdById: workspaceId, runKey: job.dedupeKey } });
    if (prior) {
      if (prior.status === "COMPLETED") return { runId: prior.id, reused: true };
      throw new Error("Bestaande AI-run vereist controle; geen automatische herhaling.");
    }
    const run = await optimizeAds(db, workspaceId, workspaceId, provider, job.dedupeKey);
    return { runId: run.id };
  }
  if (job.kind === "PROVIDER_CHECK") {
    const config = await adProviderConfig(db, workspaceId, provider);
    await readAdAccount(db, workspaceId, provider);
    return { accountId: config.accountId, canRead: true, capabilities: AD_CAPABILITIES[provider] };
  }
  if (job.kind === "RECOVERY") {
    const result = await db.adSyncOperation.updateMany({ where: { createdById: workspaceId, provider, status: "RUNNING", startedAt: { lt: new Date(Date.now() - 15 * 60000) } },
      data: { status: "RECONCILE_REQUIRED", errorCode: "INTERRUPTED", lastError: "Publicatie onderbroken; controleer de externe campagne." } });
    return { interrupted: result.count };
  }
  if (job.kind !== "REMINDERS") throw new Error("Onbekend achtergrondtaaktype.");
  const changes = await db.adChangeSet.findMany({ where: { createdById: workspaceId, provider, status: "PENDING_APPROVAL" }, select: { id: true }, take: 100 });
  const pending = await db.adApprovalRequest.findMany({ where: { createdById: workspaceId, status: "PENDING", remindedAt: null,
    changeSetId: { in: changes.map((c) => c.id) }, createdAt: { lt: new Date(Date.now() - 24 * 3600000) } }, take: 50 });
  for (const approval of pending) await db.$transaction(async (tx) => {
    const claimed = await tx.adApprovalRequest.updateMany({ where: { id: approval.id, createdById: workspaceId, remindedAt: null }, data: { remindedAt: new Date() } });
    if (claimed.count) await tx.activity.create({ data: { userId: workspaceId, type: provider === "GOOGLE" ? "GOOGLE_AD_SUBMITTED" : "META_AD_SUBMITTED",
      title: "Advertentiewijziging wacht op je goedkeuring", metadata: { changeSetId: approval.changeSetId } } });
  });
  return { reminders: pending.length };
}

export async function processAdsJobs(db: PrismaClient, workspaceId: string, deadline: number, limit = 8) {
  await recoverAdsJobLeases(db, workspaceId);
  const jobs = await db.adBackgroundJob.findMany({ where: { createdById: workspaceId, status: "PENDING", runAt: { lte: new Date() }, attempts: { lt: 3 } }, orderBy: { createdAt: "asc" }, take: limit });
  const results: Array<{ id: string; status: string }> = [];
  for (const job of jobs) {
    if (Date.now() + 60000 > deadline) break;
    if (job.dependencyId) {
      const parent = await db.adBackgroundJob.findFirst({ where: { id: job.dependencyId, createdById: workspaceId } });
      if (parent?.status !== "SUCCEEDED") {
        if (!parent || ["FAILED", "CANCELLED", "NEEDS_REVIEW", "BLOCKED"].includes(parent.status)) await db.adBackgroundJob.updateMany({ where: { id: job.id, createdById: workspaceId, status: "PENDING" }, data: { status: "BLOCKED", lastError: "Vereiste synchronisatie is niet geslaagd." } });
        continue;
      }
    }
    const leaseToken = randomUUID();
    const claimed = await db.adBackgroundJob.updateMany({ where: { id: job.id, createdById: workspaceId, status: "PENDING", attempts: job.attempts },
      data: { status: "RUNNING", attempts: { increment: 1 }, leaseToken, leasedUntil: new Date(Date.now() + 5 * 60000) } });
    if (!claimed.count) continue;
    const where = { id: job.id, createdById: workspaceId, status: "RUNNING", leaseToken };
    try {
      const result = await executeJob(db, workspaceId, job.provider as AdProvider, job);
      const status = "cancelled" in result && result.cancelled ? "CANCELLED" : "SUCCEEDED";
      await db.adBackgroundJob.updateMany({ where, data: { status, result: adJson(result), lastError: null, leaseToken: null, leasedUntil: null } });
      results.push({ id: job.id, status });
    } catch (error) {
      const message = safeAdError(error);
      const transient = /429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|network|fetch failed|timed?\s*out/i.test(message);
      const retry = job.kind !== "OPTIMIZE" && transient && job.attempts < 2;
      const status = retry ? "PENDING" : "FAILED";
      await db.adBackgroundJob.updateMany({ where, data: { status, lastError: message, leaseToken: null, leasedUntil: null,
        runAt: new Date(Date.now() + (job.attempts === 0 ? 60000 : 5 * 60000)) } });
      results.push({ id: job.id, status });
    }
  }
  return results;
}
