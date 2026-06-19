import { describe, expect, it, vi, beforeEach } from "vitest";

const mockedMeta = vi.hoisted(() => ({
  clearMetaSettings: vi.fn(),
  loadMetaManagedPages: vi.fn(),
  loadMetaWorkspaceConfig: vi.fn(),
  fetchMetaTokenDebugInfo: vi.fn(),
  resolveRequiredMetaPublishScopes: vi.fn((platforms: string[]) => {
    const scopes = ["pages_show_list"];
    if (platforms.includes("FACEBOOK")) scopes.push("pages_manage_posts");
    if (platforms.includes("INSTAGRAM")) scopes.push("instagram_basic", "instagram_content_publish");
    return scopes;
  }),
  missingMetaPublishScopes: vi.fn(() => []),
  missingMetaGranularTargetScopes: vi.fn(() => []),
  buildMetaPublishScopeError: vi.fn(() => null),
  buildMetaGranularScopeError: vi.fn(() => null),
  publishFacebookCarouselPost: vi.fn(),
  publishFacebookImagePost: vi.fn(),
  publishFacebookImageStory: vi.fn(),
  publishFacebookVideoPost: vi.fn(),
  publishFacebookVideoStory: vi.fn(),
  publishInstagramCarouselPost: vi.fn(),
  publishInstagramImagePost: vi.fn(),
  publishInstagramImageStory: vi.fn(),
  publishInstagramReel: vi.fn(),
  publishInstagramVideoPost: vi.fn(),
  publishInstagramVideoStory: vi.fn(),
  resolveSocialPublishTarget: vi.fn(),
  upsertMetaSettings: vi.fn(),
  verifyFacebookPublishedPost: vi.fn(),
  verifyInstagramPublishedMedia: vi.fn(),
  workspaceScopeFromAuthenticatedUser: vi.fn((user: { id: string; workspaceId?: string }) => ({
    workspaceId: user.workspaceId || user.id,
    memberId: user.id,
  })),
}));

vi.mock("../lib/social-meta", () => mockedMeta);
vi.mock("../lib/social-image", () => ({
  validateSocialImageForPublish: vi.fn().mockResolvedValue({
    width: 1080,
    height: 1080,
    aspectRatio: 1,
    contentType: "image/jpeg",
    byteLength: 1000,
  }),
  validateSocialVideoForPublish: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../lib/social-prepare-assets", () => ({
  prepareSocialPostAssetsForPublish: vi.fn(async (input: {
    imageUrl: string;
    metadata?: Record<string, unknown>;
  }) => ({
    imageUrl: input.imageUrl,
    metadata: input.metadata || {},
    changed: false,
  })),
}));

import { socialRouter } from "../routers/social.router";
import { runDueSocialPostsWorker } from "../lib/social-publish";

const TEST_USER_ID = "user_owner";

function socialPostDb(delegate: Record<string, unknown>) {
  const findUnique = delegate.findUnique as ReturnType<typeof vi.fn> | undefined;
  return {
    ...delegate,
    findFirst: delegate.findFirst ?? findUnique,
  };
}

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
  beforeEach(() => {
    mockedMeta.fetchMetaTokenDebugInfo.mockResolvedValue({
      isValid: true,
      scopes: [
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_posts",
        "instagram_basic",
        "instagram_content_publish",
      ],
      granularScopes: [],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      type: "USER",
      userId: "meta-user",
      appId: "1",
      application: "Digitify",
      error: null,
    });
    mockedMeta.loadMetaWorkspaceConfig.mockResolvedValue({
      appId: "1",
      appSecret: "2",
      pageId: "123",
      instagramBusinessId: "ig_123",
      accessToken: "user-token",
      refreshMeta: "",
      pageAccessToken: "page-token",
      tokenExpiresAt: "",
      autopostEnabled: true,
    });
    mockedMeta.verifyFacebookPublishedPost.mockReset();
    mockedMeta.verifyInstagramPublishedMedia.mockReset();
    mockedMeta.resolveSocialPublishTarget.mockResolvedValue({
      pageId: "123",
      pageAccessToken: "page-token",
      pageName: "Digitify",
      instagramBusinessId: "ig_123",
      instagramUsername: "digitify.be",
      pageTasks: ["CREATE_CONTENT", "MANAGE"],
    });
  });

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
        socialPost: socialPostDb({
          create: socialPostCreate,
          findUnique: socialPostFindUnique,
          update: socialPostUpdate,
        }),
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

  it("updates scheduledFor when post is already scheduled", async () => {
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);
    const row = {
      id: "sp_scheduled",
      createdById: TEST_USER_ID,
      caption: "Hallo",
      imageUrl: "https://example.com/a.jpg",
      targetPlatforms: ["FACEBOOK"],
      status: "SCHEDULED",
      scheduledFor: scheduledAt,
      retryCount: 0,
      approvedById: TEST_USER_ID,
    };

    const socialPostFindUnique = vi.fn().mockResolvedValue(row);
    const socialPostUpdate = vi.fn().mockResolvedValue({
      ...row,
      scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    const caller = socialRouter.createCaller(
      makeCtx({
        socialPost: socialPostDb({
          findUnique: socialPostFindUnique,
          update: socialPostUpdate,
        }),
        activity: { create: vi.fn().mockResolvedValue({ id: "act_2" }) },
      }),
    );

    const rescheduled = await caller.approveAndSchedule({
      id: "sp_scheduled",
      scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    expect(rescheduled.status).toBe("SCHEDULED");
    expect(socialPostUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sp_scheduled" },
        data: expect.objectContaining({ scheduledFor: expect.any(Date) }),
      }),
    );
    expect(socialPostUpdate.mock.calls[0]?.[0]?.data).not.toHaveProperty("status");
  });

  it("deletes a published queue post locally without touching Meta", async () => {
    const socialPostFindMany = vi.fn().mockResolvedValue([
      {
        id: "sp_live",
        status: "PUBLISHED",
        externalPostIds: {
          facebook: { id: "fb_1", permalink: "https://facebook.com/post/1" },
        },
      },
    ]);
    const socialPostDeleteMany = vi.fn().mockResolvedValue({ count: 1 });

    const caller = socialRouter.createCaller(
      makeCtx({
        socialPost: socialPostDb({
          findMany: socialPostFindMany,
          deleteMany: socialPostDeleteMany,
        }),
      }),
    );

    const result = await caller.deletePosts({ ids: ["sp_live"] });

    expect(result).toEqual({
      deleted: 1,
      skippedPublishing: 0,
      missing: 0,
      publishedLocalOnly: 1,
    });
    expect(socialPostDeleteMany).toHaveBeenCalledWith({
      where: {
        createdById: TEST_USER_ID,
        id: { in: ["sp_live"] },
        status: { not: "PUBLISHING" },
      },
    });
    expect(mockedMeta.verifyFacebookPublishedPost).not.toHaveBeenCalled();
    expect(mockedMeta.verifyInstagramPublishedMedia).not.toHaveBeenCalled();
  });

  it("bulk deletes queue posts and skips in-progress publishing rows", async () => {
    const socialPostFindMany = vi.fn().mockResolvedValue([
      { id: "sp_draft", status: "DRAFT", externalPostIds: null },
      { id: "sp_publishing", status: "PUBLISHING", externalPostIds: null },
      { id: "sp_failed", status: "FAILED", externalPostIds: null },
    ]);
    const socialPostDeleteMany = vi.fn().mockResolvedValue({ count: 2 });

    const caller = socialRouter.createCaller(
      makeCtx({
        socialPost: socialPostDb({
          findMany: socialPostFindMany,
          deleteMany: socialPostDeleteMany,
        }),
      }),
    );

    const result = await caller.deletePosts({ all: true });

    expect(result).toEqual({
      deleted: 2,
      skippedPublishing: 1,
      missing: 0,
      publishedLocalOnly: 0,
    });
    expect(socialPostDeleteMany).toHaveBeenCalledWith({
      where: {
        createdById: TEST_USER_ID,
        id: { in: ["sp_draft", "sp_failed"] },
        status: { not: "PUBLISHING" },
      },
    });
  });
});

function makePublishWorkerDb(post: Record<string, unknown>, options?: { lockFails?: boolean }) {
  const socialPostUpdate = vi.fn().mockResolvedValue({});
  const socialPostUpdateMany = vi.fn(async (args: { data?: { status?: string } }) => {
    if (args?.data?.status === "PUBLISHING") {
      return { count: options?.lockFails ? 0 : 1 };
    }
    return { count: 0 };
  });
  const socialPostFindUnique = vi.fn(async () => {
    const publishing = socialPostUpdateMany.mock.calls.some(
      (call) => call[0]?.data?.status === "PUBLISHING",
    );
    return publishing ? { ...post, status: "PUBLISHING" } : post;
  });
  const socialPostFindMany = vi.fn(async (args: { where?: { status?: string } }) => {
    if (args?.where?.status === "PUBLISHING") return [];
    return [post];
  });

  return {
    db: {
      socialPost: socialPostDb({
        findMany: socialPostFindMany,
        findUnique: socialPostFindUnique,
        update: socialPostUpdate,
        updateMany: socialPostUpdateMany,
      }),
      activity: { create: vi.fn().mockResolvedValue({ id: "act_worker" }) },
    },
    socialPostUpdate,
  };
}

describe("social publish worker", () => {
  beforeEach(() => {
    mockedMeta.fetchMetaTokenDebugInfo.mockResolvedValue({
      isValid: true,
      scopes: [
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_posts",
        "instagram_basic",
        "instagram_content_publish",
      ],
      granularScopes: [],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      type: "USER",
      userId: "meta-user",
      appId: "1",
      application: "Digitify",
      error: null,
    });
    mockedMeta.loadMetaWorkspaceConfig.mockReset();
    mockedMeta.resolveSocialPublishTarget.mockReset();
    mockedMeta.publishFacebookImagePost.mockReset();
    mockedMeta.publishFacebookImageStory.mockReset();
    mockedMeta.publishFacebookVideoStory.mockReset();
    mockedMeta.publishInstagramImagePost.mockReset();
    mockedMeta.publishInstagramImageStory.mockReset();
    mockedMeta.publishInstagramVideoStory.mockReset();
    mockedMeta.publishInstagramReel.mockReset();
    mockedMeta.publishFacebookCarouselPost.mockReset();
    mockedMeta.publishInstagramCarouselPost.mockReset();
    mockedMeta.publishFacebookVideoPost.mockReset();
    mockedMeta.publishInstagramVideoPost.mockReset();
    mockedMeta.verifyFacebookPublishedPost.mockReset();
    mockedMeta.verifyInstagramPublishedMedia.mockReset();
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

    const { db, socialPostUpdate } = makePublishWorkerDb(post);

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
    mockedMeta.resolveSocialPublishTarget.mockResolvedValue({
      pageId: "123",
      pageAccessToken: "page-token",
      pageName: "Digitify",
      instagramBusinessId: "",
      instagramUsername: "",
    });
    mockedMeta.publishFacebookImagePost.mockRejectedValue(new Error("Meta publish failed"));

    const result = await runDueSocialPostsWorker(db as any);

    expect(result.due).toBe(1);
    expect(result.failed).toBe(1);
    expect(socialPostUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SCHEDULED",
          retryCount: 2,
          lastError: "Facebook feed afbeelding: Meta publish failed",
        }),
      }),
    );
  });

  it("marks manual publish failures as FAILED instead of scheduling retry", async () => {
    const post = {
      id: "sp_manual_fail",
      createdById: TEST_USER_ID,
      approvedById: TEST_USER_ID,
      caption: "Caption",
      imageUrl: "https://example.com/x.jpg",
      targetPlatforms: ["FACEBOOK"],
      status: "SCHEDULED",
      scheduledFor: new Date(Date.now() - 1_000),
      retryCount: 0,
    };

    const { db, socialPostUpdate } = makePublishWorkerDb(post);

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
    mockedMeta.resolveSocialPublishTarget.mockResolvedValue({
      pageId: "123",
      pageAccessToken: "page-token",
      pageName: "Digitify",
      instagramBusinessId: "",
      instagramUsername: "",
    });
    mockedMeta.publishFacebookImagePost.mockRejectedValue(new Error("Meta publish failed"));

    const result = await runDueSocialPostsWorker(db as any, { postId: post.id, failImmediately: true });

    expect(result.failed).toBe(1);
    expect(socialPostUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          retryCount: 1,
          lastError: "Facebook feed afbeelding: Meta publish failed",
        }),
      }),
    );
  });

  it("publishes feed posts through feed endpoints", async () => {
    const post = {
      id: "sp_feed",
      createdById: TEST_USER_ID,
      approvedById: TEST_USER_ID,
      caption: "Feed caption",
      imageUrl: "https://example.com/feed.jpg",
      targetPlatforms: ["FACEBOOK", "INSTAGRAM"],
      status: "SCHEDULED",
      scheduledFor: new Date(Date.now() - 1_000),
      retryCount: 0,
      metadata: { placements: ["FEED"], feedFormat: "SQUARE" },
    };

    const { db, socialPostUpdate } = makePublishWorkerDb(post);

    mockedMeta.loadMetaWorkspaceConfig.mockResolvedValue({
      appId: "1",
      appSecret: "2",
      pageId: "123",
      instagramBusinessId: "ig_123",
      accessToken: "user-token",
      refreshMeta: "",
      pageAccessToken: "page-token",
      tokenExpiresAt: "",
      autopostEnabled: true,
    });
    mockedMeta.resolveSocialPublishTarget.mockResolvedValue({
      pageId: "123",
      pageAccessToken: "page-token",
      pageName: "Digitify",
      instagramBusinessId: "ig_123",
      instagramUsername: "digitify.be",
    });
    mockedMeta.publishFacebookImagePost.mockResolvedValue({
      id: "fb_feed_1",
      permalink: "https://facebook.com/post/1",
      verified: true,
    });
    mockedMeta.publishInstagramImagePost.mockResolvedValue({
      id: "ig_feed_1",
      permalink: "https://instagram.com/p/feed1",
      verified: true,
    });

    const result = await runDueSocialPostsWorker(db as any);

    expect(result.published).toBe(1);
    expect(mockedMeta.publishFacebookImagePost).toHaveBeenCalledWith(
      expect.objectContaining({ pageId: "123", imageUrl: post.imageUrl, caption: "Feed caption" }),
    );
    expect(mockedMeta.publishInstagramImagePost).toHaveBeenCalledWith(
      expect.objectContaining({ instagramBusinessId: "ig_123", pageAccessToken: "user-token", imageUrl: post.imageUrl }),
    );
    expect(mockedMeta.publishFacebookImageStory).not.toHaveBeenCalled();
    expect(mockedMeta.publishInstagramReel).not.toHaveBeenCalled();
  });

  it("publishes reel posts through the reel endpoint", async () => {
    const post = {
      id: "sp_reel",
      createdById: TEST_USER_ID,
      approvedById: TEST_USER_ID,
      caption: "Reel caption",
      imageUrl: "https://example.com/reel.mp4",
      targetPlatforms: ["INSTAGRAM"],
      status: "SCHEDULED",
      scheduledFor: new Date(Date.now() - 1_000),
      retryCount: 0,
      metadata: {
        placements: ["REEL"],
        assets: {
          REEL: { videoUrl: "https://example.com/reel.mp4" },
        },
      },
    };

    const { db } = makePublishWorkerDb(post);

    mockedMeta.loadMetaWorkspaceConfig.mockResolvedValue({
      appId: "1",
      appSecret: "2",
      pageId: "123",
      instagramBusinessId: "ig_123",
      accessToken: "user-token",
      refreshMeta: "",
      pageAccessToken: "page-token",
      tokenExpiresAt: "",
      autopostEnabled: true,
    });
    mockedMeta.resolveSocialPublishTarget.mockResolvedValue({
      pageId: "123",
      pageAccessToken: "page-token",
      pageName: "Digitify",
      instagramBusinessId: "ig_123",
      instagramUsername: "digitify.be",
    });
    mockedMeta.publishInstagramReel.mockResolvedValue({
      id: "ig_reel_1",
      permalink: "https://instagram.com/reel/1",
      verified: true,
    });

    const result = await runDueSocialPostsWorker(db as any);

    expect(result.published).toBe(1);
    expect(mockedMeta.publishInstagramReel).toHaveBeenCalledWith(
      expect.objectContaining({
        instagramBusinessId: "ig_123",
        pageAccessToken: "user-token",
        videoUrl: "https://example.com/reel.mp4",
        caption: "Reel caption",
      }),
    );
    expect(mockedMeta.publishFacebookImagePost).not.toHaveBeenCalled();
    expect(mockedMeta.publishInstagramImagePost).not.toHaveBeenCalled();
  });

  it("publishes multi-upload to Instagram carousel and Facebook multi-photo post", async () => {
    const post = {
      id: "sp_carousel_images",
      createdById: TEST_USER_ID,
      approvedById: TEST_USER_ID,
      caption: "Carousel caption",
      imageUrl: "https://example.com/slide1.jpg",
      targetPlatforms: ["FACEBOOK", "INSTAGRAM"],
      status: "SCHEDULED",
      scheduledFor: new Date(Date.now() - 1_000),
      retryCount: 0,
      metadata: {
        placements: ["FEED"],
        feedFormat: "SQUARE",
        carousel: {
          enabled: true,
          slides: [
            { id: "s1", mediaType: "IMAGE", imageUrl: "https://example.com/slide1.jpg" },
            { id: "s2", mediaType: "IMAGE", imageUrl: "https://example.com/slide2.jpg" },
          ],
        },
      },
    };

    const { db } = makePublishWorkerDb(post);

    mockedMeta.loadMetaWorkspaceConfig.mockResolvedValue({
      appId: "1",
      appSecret: "2",
      pageId: "123",
      instagramBusinessId: "ig_123",
      accessToken: "user-token",
      refreshMeta: "",
      pageAccessToken: "page-token",
      tokenExpiresAt: "",
      autopostEnabled: true,
    });
    mockedMeta.resolveSocialPublishTarget.mockResolvedValue({
      pageId: "123",
      pageAccessToken: "page-token",
      pageName: "Digitify",
      instagramBusinessId: "ig_123",
      instagramUsername: "digitify.be",
    });
    mockedMeta.publishFacebookCarouselPost.mockResolvedValue({
      id: "fb_carousel_1",
      permalink: "https://facebook.com/post/carousel",
      verified: true,
    });
    mockedMeta.publishInstagramCarouselPost.mockResolvedValue({
      id: "ig_carousel_1",
      permalink: "https://instagram.com/p/carousel",
      verified: true,
    });

    const result = await runDueSocialPostsWorker(db as any);

    expect(result.published).toBe(1);
    expect(mockedMeta.publishFacebookCarouselPost).toHaveBeenCalledWith(
      expect.objectContaining({
        pageId: "123",
        caption: "Carousel caption",
        slides: expect.arrayContaining([
          expect.objectContaining({ imageUrl: "https://example.com/slide1.jpg" }),
          expect.objectContaining({ imageUrl: "https://example.com/slide2.jpg" }),
        ]),
      }),
    );
    expect(mockedMeta.publishFacebookImagePost).not.toHaveBeenCalled();
    expect(mockedMeta.publishFacebookVideoPost).not.toHaveBeenCalled();
    expect(mockedMeta.publishInstagramCarouselPost).toHaveBeenCalledWith(
      expect.objectContaining({ pageAccessToken: "user-token" }),
    );
  });

  it("publishes multi-upload with mixed photo and video slides", async () => {
    const post = {
      id: "sp_carousel",
      createdById: TEST_USER_ID,
      approvedById: TEST_USER_ID,
      caption: "Carousel caption",
      imageUrl: "https://example.com/slide1.jpg",
      targetPlatforms: ["FACEBOOK", "INSTAGRAM"],
      status: "SCHEDULED",
      scheduledFor: new Date(Date.now() - 1_000),
      retryCount: 0,
      metadata: {
        placements: ["FEED"],
        feedFormat: "SQUARE",
        carousel: {
          enabled: true,
          slides: [
            { id: "s1", mediaType: "IMAGE", imageUrl: "https://example.com/slide1.jpg" },
            { id: "s2", mediaType: "VIDEO", videoUrl: "https://example.com/slide2.mp4" },
          ],
        },
      },
    };

    const { db } = makePublishWorkerDb(post);

    mockedMeta.loadMetaWorkspaceConfig.mockResolvedValue({
      appId: "1",
      appSecret: "2",
      pageId: "123",
      instagramBusinessId: "ig_123",
      accessToken: "user-token",
      refreshMeta: "",
      pageAccessToken: "page-token",
      tokenExpiresAt: "",
      autopostEnabled: true,
    });
    mockedMeta.resolveSocialPublishTarget.mockResolvedValue({
      pageId: "123",
      pageAccessToken: "page-token",
      pageName: "Digitify",
      instagramBusinessId: "ig_123",
      instagramUsername: "digitify.be",
    });
    mockedMeta.publishFacebookCarouselPost.mockResolvedValue({
      id: "fb_carousel_1",
      permalink: "https://facebook.com/post/carousel",
      verified: true,
    });
    mockedMeta.publishInstagramCarouselPost.mockResolvedValue({
      id: "ig_carousel_1",
      permalink: "https://instagram.com/p/carousel",
      verified: true,
    });

    const result = await runDueSocialPostsWorker(db as any);

    expect(result.published).toBe(1);
    expect(mockedMeta.publishFacebookCarouselPost).toHaveBeenCalledWith(
      expect.objectContaining({
        pageId: "123",
        pageAccessToken: "page-token",
        caption: "Carousel caption",
      }),
    );
    expect(mockedMeta.publishInstagramCarouselPost).toHaveBeenCalledWith(
      expect.objectContaining({ pageAccessToken: "user-token" }),
    );
    expect(mockedMeta.publishFacebookImagePost).not.toHaveBeenCalled();
    expect(mockedMeta.publishFacebookVideoPost).not.toHaveBeenCalled();
  });

  it("fails clearly when multi-upload has fewer than 2 items", async () => {
    const post = {
      id: "sp_carousel_missing_fb",
      createdById: TEST_USER_ID,
      approvedById: TEST_USER_ID,
      caption: "Carousel caption",
      imageUrl: "https://example.com/slide1.jpg",
      targetPlatforms: ["FACEBOOK", "INSTAGRAM"],
      status: "SCHEDULED",
      scheduledFor: new Date(Date.now() - 1_000),
      retryCount: 0,
      metadata: {
        placements: ["FEED"],
        carousel: {
          enabled: true,
          slides: [{ id: "s1", mediaType: "IMAGE", imageUrl: "https://example.com/slide1.jpg" }],
        },
      },
    };

    const { db, socialPostUpdate } = makePublishWorkerDb(post);

    mockedMeta.loadMetaWorkspaceConfig.mockResolvedValue({
      appId: "1",
      appSecret: "2",
      pageId: "123",
      instagramBusinessId: "ig_123",
      accessToken: "user-token",
      refreshMeta: "",
      pageAccessToken: "page-token",
      tokenExpiresAt: "",
      autopostEnabled: true,
    });
    mockedMeta.resolveSocialPublishTarget.mockResolvedValue({
      pageId: "123",
      pageAccessToken: "page-token",
      pageName: "Digitify",
      instagramBusinessId: "ig_123",
      instagramUsername: "digitify.be",
    });

    const result = await runDueSocialPostsWorker(db as any, { postId: post.id, failImmediately: true });

    expect(result.failed).toBe(1);
    expect(mockedMeta.publishFacebookImagePost).not.toHaveBeenCalled();
    expect(mockedMeta.publishInstagramCarouselPost).not.toHaveBeenCalled();
    expect(socialPostUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          lastError: expect.stringContaining("Multi-upload vereist minstens 2"),
        }),
      }),
    );
  });

  it("publishes feed video posts through video endpoints", async () => {
    const post = {
      id: "sp_feed_video",
      createdById: TEST_USER_ID,
      approvedById: TEST_USER_ID,
      caption: "Video caption",
      imageUrl: "https://example.com/feed.mp4",
      targetPlatforms: ["FACEBOOK", "INSTAGRAM"],
      status: "SCHEDULED",
      scheduledFor: new Date(Date.now() - 1_000),
      retryCount: 0,
      metadata: {
        placements: ["FEED"],
        assets: {
          FEED: { videoUrl: "https://example.com/feed.mp4" },
        },
      },
    };

    const { db } = makePublishWorkerDb(post);

    mockedMeta.loadMetaWorkspaceConfig.mockResolvedValue({
      appId: "1",
      appSecret: "2",
      pageId: "123",
      instagramBusinessId: "ig_123",
      accessToken: "user-token",
      refreshMeta: "",
      pageAccessToken: "page-token",
      tokenExpiresAt: "",
      autopostEnabled: true,
    });
    mockedMeta.resolveSocialPublishTarget.mockResolvedValue({
      pageId: "123",
      pageAccessToken: "page-token",
      pageName: "Digitify",
      instagramBusinessId: "ig_123",
      instagramUsername: "digitify.be",
    });
    mockedMeta.publishFacebookVideoPost.mockResolvedValue({ id: "fb_video_1", verified: true });
    mockedMeta.publishInstagramVideoPost.mockResolvedValue({
      id: "ig_video_1",
      permalink: "https://instagram.com/p/video",
      verified: true,
    });

    const result = await runDueSocialPostsWorker(db as any);

    expect(result.published).toBe(1);
    expect(mockedMeta.publishFacebookVideoPost).toHaveBeenCalledWith(
      expect.objectContaining({ videoUrl: "https://example.com/feed.mp4" }),
    );
    expect(mockedMeta.publishInstagramVideoPost).toHaveBeenCalledWith(
      expect.objectContaining({ pageAccessToken: "user-token", videoUrl: "https://example.com/feed.mp4" }),
    );
  });

  it("publishes story posts through story endpoints", async () => {
    const post = {
      id: "sp_story",
      createdById: TEST_USER_ID,
      approvedById: TEST_USER_ID,
      caption: "Interne story notitie",
      imageUrl: "https://example.com/story.jpg",
      targetPlatforms: ["FACEBOOK", "INSTAGRAM"],
      status: "SCHEDULED",
      scheduledFor: new Date(Date.now() - 1_000),
      retryCount: 0,
      metadata: { postFormat: "STORY" },
    };

    const { db, socialPostUpdate } = makePublishWorkerDb(post);

    mockedMeta.loadMetaWorkspaceConfig.mockResolvedValue({
      appId: "1",
      appSecret: "2",
      pageId: "123",
      instagramBusinessId: "ig_123",
      accessToken: "user-token",
      refreshMeta: "",
      pageAccessToken: "page-token",
      tokenExpiresAt: "",
      autopostEnabled: true,
    });
    mockedMeta.resolveSocialPublishTarget.mockResolvedValue({
      pageId: "123",
      pageAccessToken: "page-token",
      pageName: "Digitify",
      instagramBusinessId: "ig_123",
      instagramUsername: "digitify.be",
    });
    mockedMeta.publishFacebookImageStory.mockResolvedValue({
      id: "fb_story_1",
      permalink: "https://facebook.com/story/1",
      verified: true,
    });
    mockedMeta.publishInstagramImageStory.mockResolvedValue({
      id: "ig_story_1",
      permalink: "https://instagram.com/p/1",
      verified: true,
    });

    const result = await runDueSocialPostsWorker(db as any);

    expect(result.published).toBe(1);
    expect(mockedMeta.publishFacebookImagePost).not.toHaveBeenCalled();
    expect(mockedMeta.publishInstagramImagePost).not.toHaveBeenCalled();
    expect(mockedMeta.publishFacebookImageStory).toHaveBeenCalledWith(
      expect.objectContaining({ pageId: "123", imageUrl: post.imageUrl }),
    );
    expect(mockedMeta.publishInstagramImageStory).toHaveBeenCalledWith(
      expect.objectContaining({ instagramBusinessId: "ig_123", pageAccessToken: "user-token", imageUrl: post.imageUrl }),
    );
    expect(socialPostUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PUBLISHED",
          externalPostIds: {
            facebookStory: { id: "fb_story_1", permalink: "https://facebook.com/story/1", verified: true },
            instagramStory: { id: "ig_story_1", permalink: "https://instagram.com/p/1", verified: true },
          },
        }),
      }),
    );
  });

  it("publishes multiple story items in reverse order with indexed external ids", async () => {
    const post = {
      id: "sp_multi_story",
      createdById: TEST_USER_ID,
      approvedById: TEST_USER_ID,
      caption: "Story sequence",
      imageUrl: "https://example.com/story-1.jpg",
      targetPlatforms: ["FACEBOOK", "INSTAGRAM"],
      status: "SCHEDULED",
      scheduledFor: new Date(Date.now() - 1_000),
      retryCount: 0,
      metadata: {
        placements: ["STORY"],
        storyItems: [
          { id: "s1", mediaType: "IMAGE", imageUrl: "https://example.com/story-1.jpg" },
          { id: "s2", mediaType: "VIDEO", videoUrl: "https://example.com/story-2.mp4" },
          { id: "s3", mediaType: "IMAGE", imageUrl: "https://example.com/story-3.jpg" },
        ],
      },
    };

    const { db, socialPostUpdate } = makePublishWorkerDb(post);

    mockedMeta.loadMetaWorkspaceConfig.mockResolvedValue({
      appId: "1",
      appSecret: "2",
      pageId: "123",
      instagramBusinessId: "ig_123",
      accessToken: "user-token",
      refreshMeta: "",
      pageAccessToken: "page-token",
      tokenExpiresAt: "",
      autopostEnabled: true,
    });
    mockedMeta.resolveSocialPublishTarget.mockResolvedValue({
      pageId: "123",
      pageAccessToken: "page-token",
      pageName: "Digitify",
      instagramBusinessId: "ig_123",
      instagramUsername: "digitify.be",
    });
    mockedMeta.publishFacebookImageStory
      .mockResolvedValueOnce({ id: "fb_story_3", verified: true })
      .mockResolvedValueOnce({ id: "fb_story_1", verified: true });
    mockedMeta.publishInstagramImageStory
      .mockResolvedValueOnce({ id: "ig_story_3", verified: true })
      .mockResolvedValueOnce({ id: "ig_story_1", verified: true });
    mockedMeta.publishFacebookVideoStory.mockResolvedValue({ id: "fb_story_2", verified: true });
    mockedMeta.publishInstagramVideoStory.mockResolvedValue({ id: "ig_story_2", verified: true });

    const result = await runDueSocialPostsWorker(db as any);

    expect(result.published).toBe(1);
    expect(mockedMeta.publishFacebookImageStory).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ imageUrl: "https://example.com/story-3.jpg" }),
    );
    expect(mockedMeta.publishFacebookVideoStory).toHaveBeenCalledWith(
      expect.objectContaining({ videoUrl: "https://example.com/story-2.mp4" }),
    );
    expect(mockedMeta.publishFacebookImageStory).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ imageUrl: "https://example.com/story-1.jpg" }),
    );
    expect(socialPostUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PUBLISHED",
          externalPostIds: expect.objectContaining({
            facebookStory_1: { id: "fb_story_1", verified: true },
            facebookStory_2: { id: "fb_story_2", verified: true },
            facebookStory_3: { id: "fb_story_3", verified: true },
            instagramStory_1: { id: "ig_story_1", verified: true },
            instagramStory_2: { id: "ig_story_2", verified: true },
            instagramStory_3: { id: "ig_story_3", verified: true },
          }),
        }),
      }),
    );
  });

  it("does not republish already stored story items on retry", async () => {
    const post = {
      id: "sp_multi_story_retry",
      createdById: TEST_USER_ID,
      approvedById: TEST_USER_ID,
      caption: "Story retry",
      imageUrl: "https://example.com/story-1.jpg",
      targetPlatforms: ["FACEBOOK", "INSTAGRAM"],
      status: "FAILED",
      scheduledFor: new Date(Date.now() - 1_000),
      retryCount: 1,
      metadata: {
        placements: ["STORY"],
        storyItems: [
          { id: "s1", mediaType: "IMAGE", imageUrl: "https://example.com/story-1.jpg" },
          { id: "s2", mediaType: "IMAGE", imageUrl: "https://example.com/story-2.jpg" },
        ],
      },
      externalPostIds: {
        facebookStory_2: { id: "fb_story_2", verified: true },
        instagramStory_2: { id: "ig_story_2", verified: true },
      },
    };

    const { db, socialPostUpdate } = makePublishWorkerDb(post);

    mockedMeta.loadMetaWorkspaceConfig.mockResolvedValue({
      appId: "1",
      appSecret: "2",
      pageId: "123",
      instagramBusinessId: "ig_123",
      accessToken: "user-token",
      refreshMeta: "",
      pageAccessToken: "page-token",
      tokenExpiresAt: "",
      autopostEnabled: true,
    });
    mockedMeta.resolveSocialPublishTarget.mockResolvedValue({
      pageId: "123",
      pageAccessToken: "page-token",
      pageName: "Digitify",
      instagramBusinessId: "ig_123",
      instagramUsername: "digitify.be",
    });
    mockedMeta.publishFacebookImageStory.mockResolvedValue({ id: "fb_story_1", verified: true });
    mockedMeta.publishInstagramImageStory.mockResolvedValue({ id: "ig_story_1", verified: true });

    const result = await runDueSocialPostsWorker(db as any, { postId: post.id, failImmediately: true });

    expect(result.published).toBe(1);
    expect(mockedMeta.publishFacebookImageStory).toHaveBeenCalledTimes(1);
    expect(mockedMeta.publishFacebookImageStory).toHaveBeenCalledWith(
      expect.objectContaining({ imageUrl: "https://example.com/story-1.jpg" }),
    );
    expect(socialPostUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PUBLISHED",
          externalPostIds: expect.objectContaining({
            facebookStory_1: { id: "fb_story_1", verified: true },
            facebookStory_2: { id: "fb_story_2", verified: true },
            instagramStory_1: { id: "ig_story_1", verified: true },
            instagramStory_2: { id: "ig_story_2", verified: true },
          }),
        }),
      }),
    );
  });

  it("does not republish when external ids already exist", async () => {
    const post = {
      id: "sp_locked",
      createdById: TEST_USER_ID,
      approvedById: TEST_USER_ID,
      caption: "Already live",
      imageUrl: "https://example.com/x.jpg",
      targetPlatforms: ["FACEBOOK"],
      status: "FAILED",
      scheduledFor: new Date(Date.now() - 1_000),
      retryCount: 1,
      externalPostIds: {
        facebook: { id: "fb_existing", verified: true },
      },
    };

    const { db } = makePublishWorkerDb(post);
    const result = await runDueSocialPostsWorker(db as any);

    expect(result.published).toBe(1);
    expect(mockedMeta.publishFacebookImagePost).not.toHaveBeenCalled();
  });

  it("publishes missing channels when a previous attempt partially succeeded", async () => {
    const post = {
      id: "sp_partial",
      createdById: TEST_USER_ID,
      approvedById: TEST_USER_ID,
      caption: "Finish partial",
      imageUrl: "https://example.com/x.jpg",
      targetPlatforms: ["FACEBOOK", "INSTAGRAM"],
      status: "FAILED",
      scheduledFor: new Date(Date.now() - 1_000),
      retryCount: 1,
      metadata: { placements: ["FEED"], feedFormat: "SQUARE" },
      externalPostIds: {
        facebook: { id: "fb_existing", verified: true },
      },
    };

    const { db, socialPostUpdate } = makePublishWorkerDb(post);

    mockedMeta.loadMetaWorkspaceConfig.mockResolvedValue({
      appId: "1",
      appSecret: "2",
      pageId: "123",
      instagramBusinessId: "ig_123",
      accessToken: "user-token",
      refreshMeta: "",
      pageAccessToken: "page-token",
      tokenExpiresAt: "",
      autopostEnabled: true,
    });
    mockedMeta.resolveSocialPublishTarget.mockResolvedValue({
      pageId: "123",
      pageAccessToken: "page-token",
      pageName: "Digitify",
      instagramBusinessId: "ig_123",
      instagramUsername: "digitify.be",
    });
    mockedMeta.publishInstagramImagePost.mockResolvedValue({
      id: "ig_new",
      permalink: "https://instagram.com/p/new",
      verified: true,
    });

    const result = await runDueSocialPostsWorker(db as any, { postId: post.id, failImmediately: true });

    expect(result.published).toBe(1);
    expect(mockedMeta.publishFacebookImagePost).not.toHaveBeenCalled();
    expect(mockedMeta.publishInstagramImagePost).toHaveBeenCalledWith(
      expect.objectContaining({ instagramBusinessId: "ig_123", pageAccessToken: "user-token", imageUrl: post.imageUrl }),
    );
    expect(socialPostUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PUBLISHED",
          externalPostIds: {
            facebook: { id: "fb_existing", verified: true },
            instagram: { id: "ig_new", permalink: "https://instagram.com/p/new", verified: true },
          },
        }),
      }),
    );
  });

  it("keeps partial publishes retryable when a remaining channel fails", async () => {
    const post = {
      id: "sp_partial_fail",
      createdById: TEST_USER_ID,
      approvedById: TEST_USER_ID,
      caption: "Finish partial",
      imageUrl: "https://example.com/x.jpg",
      targetPlatforms: ["FACEBOOK", "INSTAGRAM"],
      status: "SCHEDULED",
      scheduledFor: new Date(Date.now() - 1_000),
      retryCount: 0,
      metadata: { placements: ["FEED"], feedFormat: "SQUARE" },
      externalPostIds: {
        facebook: { id: "fb_existing", verified: true },
      },
    };

    const { db, socialPostUpdate } = makePublishWorkerDb(post);

    mockedMeta.loadMetaWorkspaceConfig.mockResolvedValue({
      appId: "1",
      appSecret: "2",
      pageId: "123",
      instagramBusinessId: "ig_123",
      accessToken: "user-token",
      refreshMeta: "",
      pageAccessToken: "page-token",
      tokenExpiresAt: "",
      autopostEnabled: true,
    });
    mockedMeta.resolveSocialPublishTarget.mockResolvedValue({
      pageId: "123",
      pageAccessToken: "page-token",
      pageName: "Digitify",
      instagramBusinessId: "ig_123",
      instagramUsername: "digitify.be",
    });
    mockedMeta.publishInstagramImagePost.mockRejectedValue(new Error("Instagram publish failed"));

    const result = await runDueSocialPostsWorker(db as any, { postId: post.id, failImmediately: true });

    expect(result.failed).toBe(1);
    expect(mockedMeta.publishFacebookImagePost).not.toHaveBeenCalled();
    expect(socialPostUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          lastError: "Instagram feed afbeelding: Instagram publish failed",
        }),
      }),
    );
  });

  it("scopes due posts to workspaceId when provided", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = {
      socialPost: socialPostDb({
        findMany,
        update: vi.fn(),
        findUnique: vi.fn(),
      }),
    };

    await runDueSocialPostsWorker(db as any, { workspaceId: TEST_USER_ID });

    const scheduledCalls = findMany.mock.calls.filter(
      (call) => call[0]?.where?.status === "SCHEDULED",
    );
    expect(scheduledCalls.length).toBeGreaterThan(0);
    expect(scheduledCalls[0][0].where.createdById).toBe(TEST_USER_ID);
  });
});
