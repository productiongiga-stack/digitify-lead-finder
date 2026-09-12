import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@digitify/db";
import { resolveSessionIdentity } from "../lib/session-identity";

function database(overrides: Record<string, unknown> = {}, membership: unknown = { role: "VIEWER", status: "ACTIVE" }) {
  return {
    user: { findUnique: vi.fn().mockResolvedValue({
      id: "member", email: "member@example.test", name: "Member", role: "ADMIN",
      emailVerified: new Date(), sessionVersion: 2, activeWorkspaceId: "owner", workspaceOwnerId: "owner", ...overrides,
    }) },
    workspaceMembership: { findUnique: vi.fn().mockResolvedValue(membership) },
    setting: { findUnique: vi.fn().mockResolvedValue({ value: "social, creativeStudio" }) },
  };
}

describe("session authority", () => {
  it("uses current membership role and module restrictions instead of stale global authority", async () => {
    const identity = await resolveSessionIdentity(database() as unknown as PrismaClient, "member", 2);
    expect(identity).toMatchObject({ workspaceRole: "VIEWER", disabledModules: ["social", "creativeStudio"] });
  });
  it.each([undefined, null, "2", 1, 3])("rejects missing or revoked version %s", async (version) => {
    expect(await resolveSessionIdentity(database() as unknown as PrismaClient, "member", version)).toBeNull();
  });
  it.each([null, { role: "ADMIN", status: "DECLINED" }, { role: "ADMIN", status: "INVITED" }])("does not revive removed membership through legacy ownership", async (membership) => {
    expect(await resolveSessionIdentity(database({}, membership) as unknown as PrismaClient, "member", 2)).toBeNull();
  });
  it("rejects deleted and unverified accounts", async () => {
    const db = database();
    db.user.findUnique.mockResolvedValue(null);
    expect(await resolveSessionIdentity(db as unknown as PrismaClient, "member", 2)).toBeNull();
    expect(await resolveSessionIdentity(database({ emailVerified: null }) as unknown as PrismaClient, "member", 2)).toBeNull();
  });
});
