import { describe, expect, it, vi, beforeEach } from "vitest";

const mockedMeta = vi.hoisted(() => ({
  clearMetaSettings: vi.fn(),
  loadMetaWorkspaceConfig: vi.fn(),
  publishFacebookImagePost: vi.fn(),
  publishInstagramImagePost: vi.fn(),
  workspaceScopeFromAuthenticatedUser: vi.fn((user: { id: string; workspaceId?: string }) => ({
    workspaceId: user.workspaceId || user.id,
    memberId: user.id,
  })),
}));

vi.mock("../lib/social-meta", () => mockedMeta);

import { socialRouter, runDueSocialPostsWorker } from "../routers/social.router";

const TEST_USER_ID = "user_owner";

function makeCtx(db: Record<string, unknown>, role: string = "OWNER") {
  return {
    db: {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: TEST_USER_ID, role, workspaceOwnerId: null }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      ...db,
    } as any,
    user: {
      id: TEST_USER_ID,
      email: "owner@example.com",
      name: "Owner",
      role,
      workspaceId: TEST_USER_ID,
    },
    requestId: "req_social_test",
  };
}

describe("social router flow", () => {
  it("creates draft, submits approval and schedules", async () => {
    const row = {
      id: "sp_1",
      createdById: TEST_USER_ID,
      caption: "Hallo",
      imageUrl: "https://example.com/a.jpg",
      targetPlatforms: ["FACEBOOK", "INSTAGRAM"],
      status: "DRAFT",
      retryCount: 0,
      approvedById: null,
      scheduledFor: null,
    };

    const socialPostCreate = vi.fn().mockResolvedValue(row);
    const socialPostFindUnique = vi
      .fn()
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce({ ...row, status: "PENDING_APPROVAL" });
    const socialPostUpdate = vi
      .fn()
      .mockResolvedValueOnce({ ...row, status: "PENDING_APPROVAL" })
      .mockResolvedValueOnce({ ...row, status: "SCHEDULED", approvedById: TEST_USER_ID });

    const caller = socialRouter.createCaller(
      makeCtx({
        socialPost: {
          create: socialPostCreate,
          findUnique: socialPostFindUnique,
          update: socialPostUpdate,
        },
        activity: { create: vi.fn().mockResolvedValue({ id: "act_1" }) },
      }),
    );

    const created = await caller.createDraft({
      caption: "Hallo",
      imageUrl: "https://example.com/a.jpg",
      targetPlatforms: ["FACEBOOK", "INSTAGRAM"],
    });
    expect(created.id).toBe("sp_1");

    const pending = await caller.submitForApproval({ id: "sp_1" });
    expect(pending.status).toBe("PENDING_APPROVAL");

    const scheduled = await caller.approveAndSchedule({
      id: "sp_1",
      scheduledFor: new Date(Date.now() + 5 * 60 * 1000),
    });
    expect(scheduled.status).toBe("SCHEDULED");
  });
});

describe("social publish worker", () => {
  beforeEach(() => {
    mockedMeta.loadMetaWorkspaceConfig.mockReset();
    mockedMeta.publishFacebookImagePost.mockReset();
    mockedMeta.publishInstagramImagePost.mockReset();
  });

  it("retries failed post with exponential backoff", async () => {
    const post = {
      id: "sp_fail",
      createdById: TEST_USER_ID,
      approvedById: TEST_USER_ID,
      caption: "Caption",
      imageUrl: "https://example.com/x.jpg",
      targetPlatforms: ["FACEBOOK"],
      status: "SCHEDULED",
      scheduledFor: new Date(Date.now() - 1_000),
      retryCount: 1,
    };

    const socialPostFindMany = vi.fn().mockResolvedValue([post]);
    const socialPostUpdate = vi.fn().mockResolvedValue({});

    mockedMeta.loadMetaWorkspaceConfig.mockResolvedValue({
      appId: "1",
      appSecret: "2",
      pageId: "123",
      instagramBusinessId: "",
      accessToken: "user-token",
      refreshMeta: "",
      pageAccessToken: "page-token",
      tokenExpiresAt: "",
      autopostEnabled: true,
    });
    mockedMeta.publishFacebookImagePost.mockRejectedValue(new Error("Meta publish failed"));

    const result = await runDueSocialPostsWorker({
      socialPost: {
        findMany: socialPostFindMany,
        update: socialPostUpdate,
      },
      activity: { create: vi.fn().mockResolvedValue({ id: "act_2" }) },
    } as any);

    expect(result.due).toBe(1);
    expect(result.failed).toBe(1);
    expect(socialPostUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SCHEDULED",
          retryCount: 2,
        }),
      }),
    );
  });
});
