import { describe, expect, it, vi } from "vitest";
import { assertWorkspaceFileRelation } from "../lib/file-relations";

describe("workspace file relations", () => {
  it("checks legacy quotes and projects through the workspace owner", async () => {
    const quoteFindFirst = vi.fn().mockResolvedValue({ id: "quote-1" });
    const projectFindFirst = vi.fn().mockResolvedValue({ id: "project-1" });
    const db = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      workspace: { findUnique: vi.fn().mockResolvedValue({ ownerUserId: "owner-1" }) },
      lead: { findFirst: vi.fn() },
      quote: { findFirst: quoteFindFirst },
      project: { findFirst: projectFindFirst },
    } as any;

    await assertWorkspaceFileRelation(db, "team-1", "QUOTE", "quote-1");
    await assertWorkspaceFileRelation(db, "team-1", "PROJECT", "project-1");

    expect(quoteFindFirst).toHaveBeenCalledWith({ where: { id: "quote-1", createdById: "owner-1" }, select: { id: true } });
    expect(projectFindFirst).toHaveBeenCalledWith({ where: { id: "project-1", createdById: "owner-1" }, select: { id: true } });
  });

  it("rejects an incomplete relation", async () => {
    await expect(assertWorkspaceFileRelation({} as any, "team-1", "LEAD", undefined)).rejects.toThrow("onvolledig");
  });
});
