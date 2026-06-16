import { describe, expect, it } from "vitest";
import { canAccessNavItem } from "../permissions";

describe("canAccessNavItem", () => {
  it("hides compose paths for VIEWER", () => {
    expect(canAccessNavItem("VIEWER", "/contacts/compose")).toBe(false);
    expect(canAccessNavItem("VIEWER", "/leads")).toBe(true);
  });

  it("hides owner settings paths for TESTER and TRIAL", () => {
    expect(canAccessNavItem("TESTER", "/settings/branding")).toBe(false);
    expect(canAccessNavItem("TRIAL", "/settings/team")).toBe(false);
    expect(canAccessNavItem("TESTER", "/settings/display")).toBe(true);
  });
});
