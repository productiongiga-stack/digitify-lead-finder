import { describe, expect, it } from "vitest";
import { canManageIntegrations } from "../integration-access";

describe("canManageIntegrations", () => {
  it("allows workspace OWNER and ADMIN via workspaceRole", () => {
    expect(canManageIntegrations({ role: "MEMBER", workspaceRole: "ADMIN" })).toBe(true);
    expect(canManageIntegrations({ role: "MEMBER", workspaceRole: "OWNER" })).toBe(true);
  });

  it("denies workspace MEMBER even when global role is OWNER-shaped legacy data", () => {
    expect(canManageIntegrations({ role: "OWNER", workspaceRole: "MEMBER" })).toBe(false);
    expect(canManageIntegrations({ role: "MEMBER", workspaceRole: "MEMBER" })).toBe(false);
    expect(canManageIntegrations({ role: "VIEWER", workspaceRole: "VIEWER" })).toBe(false);
  });
});
