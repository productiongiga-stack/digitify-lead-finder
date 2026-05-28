import { describe, expect, it, afterEach } from "vitest";
import { isWorkspaceRlsEnabled } from "@digitify/db";

describe("workspace RLS", () => {
  afterEach(() => {
    delete process.env.ENABLE_WORKSPACE_RLS;
  });

  it("is disabled unless ENABLE_WORKSPACE_RLS=true", () => {
    expect(isWorkspaceRlsEnabled()).toBe(false);
    process.env.ENABLE_WORKSPACE_RLS = "true";
    expect(isWorkspaceRlsEnabled()).toBe(true);
    process.env.ENABLE_WORKSPACE_RLS = "0";
    expect(isWorkspaceRlsEnabled()).toBe(false);
  });
});
