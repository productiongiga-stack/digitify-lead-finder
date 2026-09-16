import { afterEach, describe, expect, it, vi } from "vitest";
import { analyticsRouter } from "../routers/analytics.router";
import { bookingRouter } from "../routers/booking.router";
import { registrationRouter } from "../routers/registration.router";
import { userRouter } from "../routers/user.router";
import { startAccountView } from "../lib/account-view";

const originalPlatformOwners = process.env.PLATFORM_OWNER_EMAILS;

afterEach(() => {
  if (originalPlatformOwners === undefined) delete process.env.PLATFORM_OWNER_EMAILS;
  else process.env.PLATFORM_OWNER_EMAILS = originalPlatformOwners;
});

function viewedOwnerContext() {
  return {
    db: {} as never,
    user: {
      id: "viewed-owner",
      email: "owner@example.com",
      name: "Viewed owner",
      role: "OWNER",
      workspaceRole: "OWNER",
      workspaceId: "workspace-owner",
      isPersonalWorkspace: false,
      isViewingAs: true,
    },
    requestId: "account-view-sensitive-actions-test",
  };
}

describe("account view sensitive owner actions", () => {
  it("blocks team, registration, analytics and booking administration", async () => {
    await expect(
      userRouter.createCaller(viewedOwnerContext()).updateRole({ userId: "member-1", role: "ADMIN" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      registrationRouter.createCaller(viewedOwnerContext()).approve({ requestId: "registration-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      analyticsRouter.createCaller(viewedOwnerContext()).purgeOldEvents({ days: 90 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      bookingRouter.createCaller(viewedOwnerContext()).syncHostTimezone({ timezone: "Europe/Brussels" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks the registration queue itself while viewing another account", async () => {
    await expect(registrationRouter.createCaller(viewedOwnerContext()).listRequests()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("workspace-aware account view", () => {
  it("allows an allowlisted platform owner to choose an account workspace", async () => {
    process.env.PLATFORM_OWNER_EMAILS = "test@digitify.be";
    const db = {
      workspace: { findUnique: vi.fn().mockResolvedValue({ ownerUserId: "workspace-owner" }) },
      workspaceMembership: { findUnique: vi.fn().mockResolvedValue({ role: "MEMBER", status: "ACTIVE" }) },
      accountViewSession: { create: vi.fn().mockResolvedValue({ id: "view_1", expiresAt: new Date("2030-01-01") }) },
      securityAuditEvent: { create: vi.fn().mockResolvedValue({ id: "audit_1" }) },
    } as any;

    const result = await startAccountView(
      db,
      { id: "platform-owner", email: "test@digitify.be", role: "OWNER", workspaceRole: "OWNER", workspaceId: "personal" },
      "target-user",
      "target-workspace",
      "request-1",
    );

    expect(result.sessionId).toBe("view_1");
    expect(db.workspaceMembership.findUnique).toHaveBeenCalledWith({
      where: { workspaceId_userId: { workspaceId: "target-workspace", userId: "target-user" } },
      select: { role: true, status: true },
    });
    expect(db.accountViewSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ workspaceId: "target-workspace", targetUserId: "target-user" }),
    }));
  });

  it("keeps an ordinary owner inside the active workspace", async () => {
    const db = { workspace: { findUnique: vi.fn() }, workspaceMembership: { findUnique: vi.fn() } } as any;

    await expect(startAccountView(
      db,
      { id: "workspace-owner", email: "owner@example.com", role: "OWNER", workspaceRole: "OWNER", workspaceId: "workspace-1" },
      "target-user",
      "workspace-2",
      "request-2",
    )).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: "workspace-1" },
      select: { ownerUserId: true },
    });
  });
});
