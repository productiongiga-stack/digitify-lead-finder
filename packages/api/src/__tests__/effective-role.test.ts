import { describe, it, expect } from "vitest";
import { effectiveWorkspaceRole } from "../lib/effective-role";

describe("effectiveWorkspaceRole", () => {
  it("prefers workspaceRole over global role", () => {
    expect(
      effectiveWorkspaceRole({
        user: {
          id: "u1",
          email: "a@test.local",
          name: null,
          role: "MEMBER",
          workspaceRole: "VIEWER",
        },
      }),
    ).toBe("VIEWER");
  });

  it("falls back to global role", () => {
    expect(
      effectiveWorkspaceRole({
        user: {
          id: "u1",
          email: "a@test.local",
          name: null,
          role: "ADMIN",
        },
      }),
    ).toBe("ADMIN");
  });
});
