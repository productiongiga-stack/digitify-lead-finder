import { describe, expect, it, vi } from "vitest";
import { seoRouter } from "../routers/seo.router";

describe("SEO workspace persistence", () => {
  it("stores clusters in the active technical workspace", async () => {
    const clusterCreate = vi.fn().mockResolvedValue({ id: "cluster-1", workspaceId: "team-1" });
    const caller = seoRouter.createCaller({
      db: {
        seoKeywordIdea: { findMany: vi.fn().mockResolvedValue([{ id: "idea-1", keyword: "software" }]) },
        seoKeywordCluster: { create: clusterCreate },
        seoKeyword: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      } as any,
      user: { id: "member-1", workspaceId: "team-1", ownerUserId: "owner-1", isViewingAs: false, role: "MEMBER", workspaceRole: "MEMBER" },
      requestId: "seo-test",
    } as any);

    await caller.createCluster({ name: "Software zoekintentie", keywordIds: ["idea-1"] });

    expect(clusterCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ workspaceId: "team-1", createdById: "member-1" }),
    }));
  });
});
