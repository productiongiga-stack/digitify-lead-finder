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
    const dbMock = {
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
    };

    const caller = settingsRouter.createCaller({
      db: {
        ...dbMock,
        $extends: () => dbMock,
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

  it("blocks sensitive settings and connector actions while viewing an owner account", async () => {
    const upsert = async () => {
      throw new Error("should not reach db");
    };
    const db = {
      setting: { findUnique: async () => null, upsert, deleteMany: async () => ({ count: 0 }) },
      activity: { create: async () => ({}) },
      workspace: { findUnique: async () => ({ ownerUserId: "owner-1" }) },
      $transaction: async () => [],
    } as any;
    db.$extends = () => db;
    const caller = settingsRouter.createCaller({
      db,
      user: {
        id: "target-owner-1",
        email: "owner@test.local",
        name: "Viewed owner",
        role: "OWNER",
        workspaceRole: "OWNER",
        workspaceId: "owner-1",
        isPersonalWorkspace: false,
        isViewingAs: true,
      },
      requestId: "settings-view-as-test",
      clientIp: "127.0.0.1",
    });

    await expect(caller.update({ key: "integrations.stripe_secret_key", value: "secret" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.batchUpdate([{ key: "api.openai_key", value: "secret" }])).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.removeSettings({ keys: ["bookings.webhook_secret"] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.testConnector({ connectorId: "smtp" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps ordinary company settings editable while viewing an account", async () => {
    const upsert = async ({ create }: { create: { key: string; value: unknown } }) => create;
    const db = {
      setting: { upsert },
      activity: { create: async () => ({}) },
    } as any;
    db.$extends = () => db;
    const caller = settingsRouter.createCaller({
      db,
      user: {
        id: "target-owner-1",
        email: "owner@test.local",
        name: "Viewed owner",
        role: "OWNER",
        workspaceRole: "OWNER",
        workspaceId: "owner-1",
        isPersonalWorkspace: false,
        isViewingAs: true,
      },
      requestId: "settings-view-as-normal-setting-test",
      clientIp: "127.0.0.1",
    });

    await expect(caller.update({ key: "company.name", value: "Digitify" })).resolves.toMatchObject({ value: "Digitify" });
  });
});
