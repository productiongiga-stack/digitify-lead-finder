import { describe, expect, it, vi } from "vitest";
import { isReadOnlyTenant, isTrialExpired, resolveTenantContext } from "../lib/tenant-context";

describe("tenant account policy", () => {
  it("expires a trial after its explicit 14-day deadline", () => {
    expect(isTrialExpired({ accountClass: "TRIAL", trialEndsAt: new Date(Date.now() - 1) })).toBe(true);
    expect(isTrialExpired({ accountClass: "TRIAL", trialEndsAt: new Date(Date.now() + 60_000) })).toBe(false);
  });

  it("keeps testers, viewers and suspended accounts read-only", () => {
    expect(isReadOnlyTenant({ accountClass: "TESTER", accountStatus: "ACTIVE", workspaceRole: "MEMBER", trialEndsAt: null })).toBe(true);
    expect(isReadOnlyTenant({ accountClass: "CLIENT_MEMBER", accountStatus: "ACTIVE", workspaceRole: "VIEWER", trialEndsAt: null })).toBe(true);
    expect(isReadOnlyTenant({ accountClass: "CLIENT_MEMBER", accountStatus: "SUSPENDED", workspaceRole: "ADMIN", trialEndsAt: null })).toBe(true);
  });

  it("keeps legacy personal users usable before their Workspace row is backfilled", async () => {
    const db = {
      workspace: { findUnique: vi.fn().mockResolvedValue(null) },
      workspaceMembership: { findUnique: vi.fn().mockResolvedValue(null) },
      user: { findUnique: vi.fn().mockResolvedValue({ email: "owner@example.com", role: "OWNER", accountClass: "CLIENT_OWNER", accountStatus: "ACTIVE", platformRole: null, trialEndsAt: null }) },
    } as any;
    const context = await resolveTenantContext(db, { id: "owner-1", workspaceId: "owner-1", role: "OWNER" });
    expect(context).toMatchObject({ workspaceId: "owner-1", ownerUserId: "owner-1", memberId: "owner-1" });
  });
});
