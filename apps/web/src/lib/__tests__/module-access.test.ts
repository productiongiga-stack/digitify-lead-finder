import { describe, expect, it } from "vitest";
import { isModuleDisabled, resolveModuleIdForPath } from "../module-access";

describe("module access guard", () => {
  it("resolves social module for /social paths", () => {
    expect(resolveModuleIdForPath("/social")).toBe("social");
    expect(resolveModuleIdForPath("/social/planner")).toBe("social");
  });

  it("blocks disabled modules", () => {
    const disabled = new Set(["social"]);
    expect(isModuleDisabled("/social", disabled)).toBe(true);
    expect(isModuleDisabled("/dashboard", disabled)).toBe(false);
  });
});
