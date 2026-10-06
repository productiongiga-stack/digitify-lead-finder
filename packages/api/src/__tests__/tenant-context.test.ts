import { describe, expect, it } from "vitest";
import { isReadOnlyTenant, isTrialExpired } from "../lib/tenant-context";

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
});
