import { describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  assertWorkspaceMember,
  workspaceMemberWhere,
} from "../lib/workspace-members";

describe("workspaceMemberWhere", () => {
  it("matches owner id and team members", () => {
    expect(workspaceMemberWhere("ws-owner")).toEqual({
      OR: [{ id: "ws-owner" }, { workspaceOwnerId: "ws-owner" }],
    });
  });
});

describe("assertWorkspaceMember", () => {
  it("throws when user is outside workspace", async () => {
    const db = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    await expect(assertWorkspaceMember(db as any, "ws-1", "other-user")).rejects.toMatchObject({
      code: "NOT_FOUND",
    } satisfies Partial<TRPCError>);
  });

  it("returns member when found", async () => {
    const db = {
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: "u2", role: "ADMIN" }),
      },
    };
    const member = await assertWorkspaceMember(db as any, "ws-1", "u2");
    expect(member.role).toBe("ADMIN");
  });
});
