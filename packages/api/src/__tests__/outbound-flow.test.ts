import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { contactRouter } from "../routers/contact.router";

const OWNER_ID = "user_owner";
const MEMBER_ID = "user_member";
const WORKSPACE_ID = OWNER_ID;
const LEAD_ID = "lead_1";

function makeCtx(db: Record<string, unknown>, user: { id: string; role: string }) {
  return {
    db: {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: user.id,
          role: user.role,
          workspaceOwnerId: user.id === OWNER_ID ? null : OWNER_ID,
        }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      ...db,
    } as any,
    user: {
      id: user.id,
      email: `${user.id}@example.com`,
      name: user.role,
      role: user.role,
      workspaceId: WORKSPACE_ID,
    },
    requestId: "req_outbound",
  };
}

describe("outbound approval flow", () => {
  beforeEach(() => {
    vi.stubEnv("EMAIL_PROVIDER", "console");
  });

  it("creates draft in DRAFT status", async () => {
    const emailDraftCreate = vi.fn().mockResolvedValue({
      id: "draft_1",
      status: "DRAFT",
      authorId: MEMBER_ID,
    });
    const activityCreate = vi.fn().mockResolvedValue({ id: "act_1" });

    const caller = contactRouter.createCaller(
      makeCtx(
        {
          lead: { findFirst: vi.fn().mockResolvedValue({ id: LEAD_ID }) },
          emailDraft: { create: emailDraftCreate, findFirst: vi.fn(), update: vi.fn() },
          activity: { create: activityCreate },
        },
        { id: MEMBER_ID, role: "MEMBER" },
      ),
    );

    const draft = await caller.createDraft({
      leadId: LEAD_ID,
      toEmail: "lead@example.com",
      subject: "Hello",
      body: "Body",
    });

    expect(draft.status).toBe("DRAFT");
    expect(emailDraftCreate).toHaveBeenCalled();
  });

  it("approve moves PENDING_APPROVAL to APPROVED without sending", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({
        id: "draft_1",
        status: "PENDING_APPROVAL",
        leadId: LEAD_ID,
        lead: { createdById: WORKSPACE_ID },
      })
      .mockResolvedValueOnce({
        id: "draft_1",
        status: "PENDING_APPROVAL",
        leadId: LEAD_ID,
      });

    const emailDraftUpdate = vi.fn().mockResolvedValue({
      id: "draft_1",
      status: "APPROVED",
      approverId: OWNER_ID,
    });
    const activityCreate = vi.fn().mockResolvedValue({ id: "act_1" });

    const caller = contactRouter.createCaller(
      makeCtx(
        {
          emailDraft: { findFirst, update: emailDraftUpdate },
          activity: { create: activityCreate },
        },
        { id: OWNER_ID, role: "OWNER" },
      ),
    );

    const updated = await caller.approve({ id: "draft_1" });
    expect(updated.status).toBe("APPROVED");
    expect(emailDraftUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "APPROVED" }),
      }),
    );
  });

  it("sendEmail rejects draft that is not approved", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "draft_1",
      status: "PENDING_APPROVAL",
      lead: { id: LEAD_ID, companyName: "Acme", createdById: WORKSPACE_ID },
    });

    const caller = contactRouter.createCaller(
      makeCtx(
        {
          emailDraft: { findFirst, update: vi.fn() },
        },
        { id: OWNER_ID, role: "OWNER" },
      ),
    );

    await expect(caller.sendEmail({ id: "draft_1" })).rejects.toBeInstanceOf(TRPCError);
  });
});
