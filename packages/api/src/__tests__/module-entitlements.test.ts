import { describe, expect, it, vi } from "vitest";
import { assertModuleEntitlement, ensureDefaultModuleEntitlements } from "../lib/module-entitlements";

describe("workspace module entitlements", () => {
  it("seeds the free modules idempotently", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 6 });
    await ensureDefaultModuleEntitlements({ workspaceModuleEntitlement: { createMany } } as any, "workspace-1");
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: expect.arrayContaining([
        { workspaceId: "workspace-1", moduleId: "leads", status: "ACTIVE", source: "FREE" },
        { workspaceId: "workspace-1", moduleId: "crm", status: "ACTIVE", source: "FREE" },
      ]),
    }));
  });

  it("blocks locked entitlements and permits active ones", async () => {
    const findUnique = vi.fn()
      .mockResolvedValueOnce({ status: "LOCKED", startsAt: new Date(0), endsAt: null })
      .mockResolvedValueOnce({ status: "ACTIVE", startsAt: new Date(0), endsAt: null });
    const db = { workspaceModuleEntitlement: { findUnique } } as any;
    await expect(assertModuleEntitlement(db, "workspace-1", "googleAds")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertModuleEntitlement(db, "workspace-1", "leads")).resolves.toBeUndefined();
  });

  it("keeps legacy deployments usable while the new table is absent", async () => {
    const findUnique = vi.fn().mockRejectedValue({ code: "P2021" });
    await expect(assertModuleEntitlement({ workspaceModuleEntitlement: { findUnique } } as any, "workspace-1", "leads")).resolves.toBeUndefined();
  });
});
