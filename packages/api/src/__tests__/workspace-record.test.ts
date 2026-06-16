import { describe, it, expect } from "vitest";
import { assertWorkspaceRecord } from "../lib/workspace-record";

describe("assertWorkspaceRecord", () => {
  it("returns record when tenant matches", () => {
    const row = assertWorkspaceRecord({ id: "1", createdById: "ws_a" }, "ws_a", "Lead");
    expect(row.id).toBe("1");
  });

  it("throws NOT_FOUND for cross-tenant access", () => {
    expect(() =>
      assertWorkspaceRecord({ id: "1", createdById: "ws_b" }, "ws_a", "Lead"),
    ).toThrow(/niet gevonden/);
  });
});
