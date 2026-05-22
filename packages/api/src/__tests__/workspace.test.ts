import { describe, expect, it } from "vitest";
import { isWorkspaceOwner } from "../lib/workspace";

describe("workspace", () => {
  it("treats owner account as workspace owner", () => {
    expect(isWorkspaceOwner({ id: "owner-1", role: "OWNER" }, "owner-1")).toBe(true);
  });

  it("treats member as non-owner of workspace", () => {
    expect(isWorkspaceOwner({ id: "member-1", role: "MEMBER", workspaceOwnerId: "owner-1" }, "owner-1")).toBe(
      false,
    );
  });
});
