import { describe, expect, it, vi } from "vitest";
import { inboxRouter } from "../routers/inbox.router";

const WORKSPACE_ID = "workspace_inbox";
const USER_ID = "member_inbox";

function makeCtx(db: Record<string, unknown>) {
  return {
    db: {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      workspace: {
        findUnique: vi.fn().mockResolvedValue({ ownerUserId: "owner_inbox" }),
      },
      ...db,
    } as any,
    user: {
      id: USER_ID,
      email: "member@example.com",
      name: "Member",
      role: "MEMBER",
      workspaceId: WORKSPACE_ID,
      ownerUserId: "owner_inbox",
      workspaceRole: "MEMBER",
    },
    requestId: "req_inbox",
  };
}

describe("Inbox draft flow", () => {
  it("reuses a draft when the idempotency read races the unique insert", async () => {
    const existing = {
      id: "draft_existing",
      workspaceId: WORKSPACE_ID,
      idempotencyKey: "compose-1",
      status: "PENDING_APPROVAL",
      toEmail: "person@example.com",
      lead: null,
    };
    const findFirstDraft = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    const createDraft = vi.fn().mockRejectedValue({ code: "P2002" });
    const caller = inboxRouter.createCaller(makeCtx({
      lead: { findFirst: vi.fn().mockResolvedValue(null) },
      leadContact: { findFirst: vi.fn().mockResolvedValue(null) },
      emailDraft: { findFirst: findFirstDraft, create: createDraft },
    }));

    const result = await caller.send({
      to: " Person@Example.com ",
      subject: "Hallo",
      body: "Bericht",
      idempotencyKey: "compose-1",
    });

    expect(result).toMatchObject({ reused: true, draft: existing });
    expect(createDraft).toHaveBeenCalledTimes(1);
  });
});
