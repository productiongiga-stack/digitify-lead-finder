import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { PrismaClient, createWorkspaceRlsClient } from "@digitify/db";
import { importLeadRecords } from "../lib/lead-import";
import { createPublicFormSubmission } from "../lib/public-form-submission";
import { sendApprovedDraft } from "../lib/approved-email-send";
import { runLegacyImportOnce } from "../lib/legacy-import-once";

const enabled = process.env.RUN_DB_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);
describe.skipIf(!enabled)("audit database concurrency", () => {
  const db = new PrismaClient();
  afterAll(() => db.$disconnect());
  async function owner() {
    return db.user.create({ data: { email: `audit-${randomUUID()}@example.test`, role: "OWNER" } });
  }
  it("runs with real RLS enforcement, not a superuser or BYPASSRLS connection", async () => {
    const roles = await db.$queryRaw<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    expect(roles[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });
  it("serializes parallel imports and allows the same business in another tenant", async () => {
    const [a, b] = await Promise.all([owner(), owner()]);
    const aDb = createWorkspaceRlsClient(db, a.id);
    const bDb = createWorkspaceRlsClient(db, b.id);
    const input = { companyName: "Parallel import", gmbPlaceId: "provider-1", createdById: a.id };
    const results = await Promise.all(Array.from({ length: 5 }, () => importLeadRecords(aDb, a.id, [input])));
    expect(results.reduce((count, result) => count + result.created.length, 0)).toBe(1);
    expect((await importLeadRecords(bDb, b.id, [input])).created).toHaveLength(1);
    expect(await aDb.lead.count()).toBe(1);
    expect(await bDb.lead.count()).toBe(1);
  });
  it("serializes parallel public form submissions before creating a lead", async () => {
    const user = await owner();
    const form = await db.leadForm.create({
      data: { createdById: user.id, name: "Concurrency form", status: "PUBLISHED", fields: [] },
      select: { id: true, publicKey: true },
    });
    const input = {
      formId: form.id,
      formPublicKey: form.publicKey,
      workspaceId: user.id,
      fingerprint: "same-public-submission",
      data: { name: "Parallel visitor", company: "Parallel form company", email: "visitor@example.test", phone: "", message: "" },
    };

    const results = await Promise.all(Array.from({ length: 5 }, () => createPublicFormSubmission(db, input)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter((result) => result === null)).toHaveLength(4);
    expect(await db.lead.count({ where: { createdById: user.id, companyName: "Parallel form company" } })).toBe(1);
    expect(await db.formSubmission.count({ where: { formId: form.id } })).toBe(1);
  });
  it("prevents overlapping workers from sending the same email", async () => {
    const user = await owner();
    const scoped = createWorkspaceRlsClient(db, user.id);
    const lead = await scoped.lead.create({ data: { companyName: "Mail test", createdById: user.id } });
    const draft = await scoped.emailDraft.create({ data: {
      leadId: lead.id, authorId: user.id, approverId: user.id, approvedAt: new Date(),
      status: "APPROVED", toEmail: "recipient@example.test", subject: "Approved", body: "Approved body",
    } });
    const send = vi.fn().mockResolvedValue({ success: true, messageId: "captured-locally" });
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => sendApprovedDraft(scoped, draft.id, user.id, send)));
    expect(send).toHaveBeenCalledTimes(1);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await scoped.emailDraft.findUnique({ where: { id: draft.id } }))?.status).toBe("SENT");
  });
  it("preserves transaction isolation and rejects nested workspace changes", async () => {
    const [a, b] = await Promise.all([owner(), owner()]);
    const aDb = createWorkspaceRlsClient(db, a.id);
    const bDb = createWorkspaceRlsClient(db, b.id);
    await aDb.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ transaction_isolation: string }>>`SHOW transaction_isolation`;
      expect(rows[0]?.transaction_isolation).toBe("serializable");
      await expect(bDb.lead.count()).rejects.toThrow("cannot switch workspace");
    }, { isolationLevel: "Serializable" });
  });
  it("does not resurrect imported data after every row is deleted", async () => {
    const user = await owner();
    const scoped = createWorkspaceRlsClient(db, user.id);
    const importer = vi.fn(async (tx: PrismaClient) => {
      await tx.workspaceTask.create({ data: { createdById: user.id, title: "Legacy" } });
      return { imported: 1 };
    });
    await runLegacyImportOnce(scoped, user.id, "test-tasks", importer);
    await scoped.workspaceTask.deleteMany({});
    expect(await runLegacyImportOnce(scoped, user.id, "test-tasks", importer)).toEqual({ imported: 0 });
    expect(importer).toHaveBeenCalledTimes(1);
    expect(await scoped.workspaceTask.count()).toBe(0);
  });
});
