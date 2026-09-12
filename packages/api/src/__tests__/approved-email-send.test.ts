import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@digitify/db";
import { sendApprovedDraft } from "../lib/approved-email-send";

function fixture(overrides: Record<string, unknown> = {}) {
  let status = "APPROVED";
  const draft = {
    id: "draft", status, updatedAt: new Date(), approvedAt: new Date(), approverId: "owner",
    sentAt: null, type: "LEAD_CONTACT", leadId: "lead", toEmail: "lead@example.test",
    lead: { id: "lead", createdById: "owner", companyName: "Lead", doNotContact: false, status: "NEW" },
    ...overrides,
  };
  const db = {
    emailDraft: {
      updateMany: vi.fn().mockImplementation(async ({ where, data }) => {
        if (data.status === "SENT" && (db.emailDraft as any).failFinalize) throw new Error("database unavailable");
        if (where.status !== status) return { count: 0 };
        status = data.status;
        return { count: 1 };
      }),
      findFirst: vi.fn().mockImplementation(async () => ({ ...draft, status })),
    },
  };
  return { db, client: db as unknown as PrismaClient, status: () => status };
}

describe("approved email delivery", () => {
  it("allows only one sender when two requests read the same approved draft", async () => {
    const { client, status } = fixture();
    const send = vi.fn().mockResolvedValue({ success: true, messageId: "mail-1" });
    const results = await Promise.allSettled([
      sendApprovedDraft(client, "draft", "owner", send), sendApprovedDraft(client, "draft", "owner", send),
    ]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(status()).toBe("SENT");
  });
  it("never sends without approval or to a suppressed lead", async () => {
    for (const overrides of [{ approverId: null }, { approvedAt: null }, { sentAt: new Date() }, { lead: { doNotContact: true } }]) {
      const { client } = fixture(overrides);
      const send = vi.fn();
      await expect(sendApprovedDraft(client, "draft", "owner", send)).rejects.toBeDefined();
      expect(send).not.toHaveBeenCalled();
    }
  });
  it("requires an unchanged snapshot when claiming", async () => {
    const { client, db } = fixture();
    db.emailDraft.updateMany.mockResolvedValueOnce({ count: 0 });
    const send = vi.fn();
    await expect(sendApprovedDraft(client, "draft", "owner", send)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(send).not.toHaveBeenCalled();
    expect(db.emailDraft.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ updatedAt: expect.any(Date), approvedAt: expect.any(Date) }) }));
  });
  it("blocks retries after an ambiguous provider timeout", async () => {
    const { client, status } = fixture();
    const send = vi.fn().mockRejectedValue(new Error("timeout after DATA"));
    await expect(sendApprovedDraft(client, "draft", "owner", send)).rejects.toBeDefined();
    expect(status()).toBe("DELIVERY_UNKNOWN");
    await expect(sendApprovedDraft(client, "draft", "owner", send)).rejects.toBeDefined();
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("allows retries only when the provider confirms nothing was sent", async () => {
    const { client, status } = fixture();
    const send = vi.fn().mockResolvedValueOnce({ success: false, delivery: "not_sent" }).mockResolvedValueOnce({ success: true });
    await expect(sendApprovedDraft(client, "draft", "owner", send)).rejects.toBeDefined();
    expect(status()).toBe("FAILED");
    await sendApprovedDraft(client, "draft", "owner", send);
    expect(status()).toBe("SENT");
  });
  it("does not resend when persistence fails after SMTP acceptance", async () => {
    const { client, db, status } = fixture();
    (db.emailDraft as any).failFinalize = true;
    const send = vi.fn().mockResolvedValue({ success: true, messageId: "accepted" });
    await expect(sendApprovedDraft(client, "draft", "owner", send)).rejects.toBeDefined();
    expect(status()).toBe("DELIVERY_UNKNOWN");
    await expect(sendApprovedDraft(client, "draft", "owner", send)).rejects.toBeDefined();
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("cannot load a draft belonging to another tenant", async () => {
    const { client, db } = fixture();
    db.emailDraft.findFirst.mockResolvedValue(null);
    const send = vi.fn();
    await expect(sendApprovedDraft(client, "draft", "other", send)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.emailDraft.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "draft", lead: { createdById: "other" } } }));
    expect(send).not.toHaveBeenCalled();
  });
});
