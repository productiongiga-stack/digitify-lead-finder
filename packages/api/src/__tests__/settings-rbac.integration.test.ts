import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { assertCanManageSettingKey, canManageSettingKey } from "../lib/permissions";
import { settingsRouter } from "../routers/settings.router";

describe("settings RBAC matrix", () => {
  it("VIEWER cannot manage owner-only booking keys", () => {
    expect(canManageSettingKey("VIEWER", "bookings.webhook_secret")).toBe(false);
    expect(() => assertCanManageSettingKey("VIEWER", "bookings.webhook_secret")).toThrow(TRPCError);
  });

  it("OWNER can manage owner-only booking keys", () => {
    expect(canManageSettingKey("OWNER", "bookings.webhook_secret")).toBe(true);
  });

  it("settings.update rejects VIEWER on owner integration keys", async () => {
    const caller = settingsRouter.createCaller({
      db: {
        setting: {
          findUnique: async () => null,
          upsert: async () => {
            throw new Error("should not reach db");
          },
          create: async () => {
            throw new Error("should not reach db");
          },
        },
        activity: { create: async () => ({}) },
        $transaction: async () => [],
      } as never,
      user: {
        id: "viewer-1",
        email: "viewer@test.local",
        name: "Viewer",
        role: "VIEWER",
        workspaceRole: "VIEWER",
        workspaceId: "owner-1",
        isPersonalWorkspace: false,
      },
      requestId: "settings-rbac-test",
      clientIp: "127.0.0.1",
    });

    await expect(caller.update({ key: "openclaw.api_key", value: "secret" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
