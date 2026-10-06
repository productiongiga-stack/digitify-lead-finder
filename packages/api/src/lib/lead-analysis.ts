import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@digitify/db";
import { OpenClawClient } from "@digitify/openclaw";
import { loadAiProviderConfig } from "./ai-provider-config";
import { businessProfileToContext, loadAiBusinessProfile } from "./ai-business-profile";
import { resolveLeadOwnerId } from "./tenant";

export const LEAD_ANALYSIS_PROMPT_VERSION = "lead-analysis-v2";

export async function enqueueLeadAnalysis(
  db: PrismaClient,
  input: { workspaceId: string; leadId: string; createdById: string; force?: boolean },
) {
  const profile = await loadAiBusinessProfile(db, input.workspaceId);
  const idempotencyKey = input.force
    ? `${input.leadId}:${profile.hash}:${Date.now()}`
    : `${input.leadId}:${profile.hash}`;
  if (!input.force) {
    const existing = await db.leadAnalysisRun.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;
  }
  const leadOwnerId = await resolveLeadOwnerId(db, input.workspaceId);
  const lead = await db.lead.findFirst({
    where: { id: input.leadId, createdById: leadOwnerId },
    select: { id: true, companyName: true, website: true, city: true, industry: true, overallScore: true, scorePriority: true, gmbRating: true, gmbReviewCount: true },
  });
  if (!lead) throw new Error("Lead niet gevonden in deze workspace.");
  return db.leadAnalysisRun.create({
    data: {
      workspaceId: input.workspaceId,
      leadId: lead.id,
      createdById: input.createdById,
      status: "PENDING",
      profileHash: profile.hash,
      profileVersion: profile.version,
      idempotencyKey,
      inputSnapshot: {
        lead,
        businessProfile: businessProfileToContext(profile),
      } as Prisma.InputJsonValue,
    },
  });
}

export async function claimLeadAnalysisRun(db: PrismaClient, workspaceId: string) {
  const now = new Date();
  const run = await db.leadAnalysisRun.findFirst({
    where: {
      workspaceId,
      OR: [
        { status: "PENDING" },
        { status: "RUNNING", leaseUntil: { lt: now } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  if (!run) return null;
  const claimed = await db.leadAnalysisRun.updateMany({
    where: {
      id: run.id,
      OR: [{ status: "PENDING" }, { status: "RUNNING", leaseUntil: { lt: now } }],
    },
    data: { status: "RUNNING", attempts: { increment: 1 }, leaseUntil: new Date(Date.now() + 5 * 60_000), startedAt: run.startedAt || now },
  });
  return claimed.count ? db.leadAnalysisRun.findUnique({ where: { id: run.id } }) : null;
}

export async function processLeadAnalysisRun(db: PrismaClient, runId: string) {
  const run = await db.leadAnalysisRun.findUnique({ where: { id: runId }, include: { lead: { include: { scoringFactors: { include: { scoringWeight: true } }, enrichmentData: true } } } });
  if (!run) return { status: "missing" as const };
  const { client, model } = await loadAiProviderConfig(db, run.workspaceId).then(({ provider, model, apiKey }) => ({ client: apiKey ? new OpenClawClient({ apiKey, model, provider }) : null, model }));
  if (!client) {
    await db.leadAnalysisRun.update({ where: { id: run.id }, data: { status: "BLOCKED", error: "AI-provider is niet geconfigureerd.", leaseUntil: null } });
    return { status: "blocked" as const };
  }
  try {
    const profile = await loadAiBusinessProfile(db, run.workspaceId);
    const painPoints = run.lead.scoringFactors.filter((f) => f.rawValue >= 6).map((f) => f.explanation).filter((value): value is string => Boolean(value));
    const suggestedServices = run.lead.scoringFactors.filter((f) => f.rawValue >= 6).map((f) => f.scoringWeight?.label || "").filter(Boolean);
    const analysis = await client.analyzeLead({
      businessContext: businessProfileToContext(profile),
      leadData: {
        companyName: run.lead.companyName,
        website: run.lead.website,
        city: run.lead.city,
        industry: run.lead.industry,
        overallScore: run.lead.overallScore,
        scorePriority: run.lead.scorePriority,
        gmbRating: run.lead.gmbRating,
        gmbReviewCount: run.lead.gmbReviewCount,
        painPoints,
        suggestedServices,
      },
    });
    const result = { ...analysis, confidence: analysis.confidence <= 1 ? analysis.confidence * 100 : analysis.confidence };
    await db.$transaction([
      db.leadAnalysisRun.update({ where: { id: run.id }, data: { status: "COMPLETED", result: result as Prisma.InputJsonValue, model, leaseUntil: null, completedAt: new Date(), error: null } }),
      db.openClawSuggestion.create({ data: { leadId: run.leadId, type: "OPPORTUNITY_ANALYSIS", title: `Analyse: ${run.lead.companyName}`, content: result.summary, confidence: result.confidence, status: "PENDING", metadata: { ...result, profileHash: profile.hash, profileVersion: profile.version, runId: run.id } as Prisma.InputJsonValue } }),
      db.activity.create({ data: { leadId: run.leadId, userId: run.createdById, type: "OPENCLAW_SUGGESTION", title: `AI-analyse afgerond voor ${run.lead.companyName}`, metadata: { runId: run.id, profileHash: profile.hash } } }),
    ]);
    return { status: "completed" as const, result };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "AI-analyse mislukt.";
    const retry = run.attempts < 3;
    await db.leadAnalysisRun.update({ where: { id: run.id }, data: { status: retry ? "PENDING" : "FAILED", error: message, leaseUntil: null } });
    return { status: retry ? "retry" as const : "failed" as const, error: message };
  }
}

export function analysisProfileHash(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 32);
}
