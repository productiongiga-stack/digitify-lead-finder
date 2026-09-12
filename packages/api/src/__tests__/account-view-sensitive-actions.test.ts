import { describe, expect, it } from "vitest";
import { analyticsRouter } from "../routers/analytics.router";
import { bookingRouter } from "../routers/booking.router";
import { registrationRouter } from "../routers/registration.router";
import { userRouter } from "../routers/user.router";

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
