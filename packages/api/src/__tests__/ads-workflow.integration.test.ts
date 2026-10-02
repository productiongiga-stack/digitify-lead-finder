import { describe, expect, it } from "vitest";
import { PrismaClient, setWorkspaceRlsContext } from "@digitify/db";

const enabled = process.env.RUN_DB_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);
describe.skipIf(!enabled)("advertentie-workspace-isolatie (PostgreSQL)", () => {
  it("schermt alle zes workflowtabellen af tussen twee workspaces", async () => {
    const db = new PrismaClient();
    const rollback = new Error("ROLLBACK_ADS_PROBE");
    try {
      await db.$transaction(async (tx) => {
        const role = await tx.$queryRaw<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
        expect(role[0].rolsuper || role[0].rolbypassrls).toBe(false);
        const ownerA = await tx.user.create({ data: { email: "ads-rls-a-" + Date.now() + "@digitify.local", passwordHash: "probe-no-login", role: "OWNER" } });
        const ownerB = await tx.user.create({ data: { email: "ads-rls-b-" + Date.now() + "@digitify.local", passwordHash: "probe-no-login", role: "OWNER" } });
        await setWorkspaceRlsContext(tx, ownerA.id, ownerA.id);
        const version = await tx.adVersion.create({ data: { createdById: ownerA.id, provider: "GOOGLE", accountId: "account", campaignId: "123", fingerprint: "hash", snapshot: {} } });
        const change = await tx.adChangeSet.create({ data: { createdById: ownerA.id, authorId: ownerA.id, provider: "GOOGLE", accountId: "account", campaignId: "123",
          baseVersionId: version.id, beforeHash: "before", afterHash: "after", before: {}, after: {}, reason: "probe", checks: {} } });
        const approval = await tx.adApprovalRequest.create({ data: { createdById: ownerA.id, changeSetId: change.id, versionHash: "after" } });
        const operation = await tx.adSyncOperation.create({ data: { createdById: ownerA.id, provider: "GOOGLE", changeSetId: change.id, idempotencyKey: change.id, resourceKey: change.id } });
        const run = await tx.aiOptimizationRun.create({ data: { createdById: ownerA.id, provider: "GOOGLE", periodStart: new Date(), periodEnd: new Date(), promptVersion: "probe", input: {} } });
        const job = await tx.adBackgroundJob.create({ data: { createdById: ownerA.id, provider: "GOOGLE", kind: "SYNC", dedupeKey: ownerA.id + ":probe" } });
        await setWorkspaceRlsContext(tx, ownerB.id, ownerB.id);
        expect(await tx.adVersion.findUnique({ where: { id: version.id } })).toBeNull();
        expect(await tx.adChangeSet.findUnique({ where: { id: change.id } })).toBeNull();
        expect(await tx.adApprovalRequest.findUnique({ where: { id: approval.id } })).toBeNull();
        expect(await tx.adSyncOperation.findUnique({ where: { id: operation.id } })).toBeNull();
        expect(await tx.aiOptimizationRun.findUnique({ where: { id: run.id } })).toBeNull();
        expect(await tx.adBackgroundJob.findUnique({ where: { id: job.id } })).toBeNull();
        expect((await tx.adBackgroundJob.updateMany({ where: { id: job.id }, data: { status: "RUNNING" } })).count).toBe(0);
        expect((await tx.adChangeSet.updateMany({ where: { id: change.id }, data: { status: "APPROVED" } })).count).toBe(0);
        throw rollback;
      });
    } catch (error) { if (error !== rollback) throw error; }
    finally { await db.$disconnect(); }
  });
  it.each(["version", "job"])("weigert %s-writes in de tenantcontext van een andere owner", async (kind) => {
    const db = new PrismaClient();
    try {
      await expect(db.$transaction(async (tx) => {
        const ownerA = await tx.user.create({ data: { email: "ads-write-a-" + Date.now() + "@digitify.local", passwordHash: "probe-no-login", role: "OWNER" } });
        const ownerB = await tx.user.create({ data: { email: "ads-write-b-" + Date.now() + "@digitify.local", passwordHash: "probe-no-login", role: "OWNER" } });
        await setWorkspaceRlsContext(tx, ownerB.id, ownerB.id);
        if (kind === "job") await tx.adBackgroundJob.create({ data: { createdById: ownerA.id, provider: "META", kind: "SYNC", dedupeKey: ownerA.id + ":illegal" } });
        else await tx.adVersion.create({ data: { createdById: ownerA.id, provider: "META", accountId: "account", campaignId: "123", fingerprint: "hash", snapshot: {} } });
      })).rejects.toThrow(/row.level.security|policy|permission/i);
    } finally { await db.$disconnect(); }
  });
});
