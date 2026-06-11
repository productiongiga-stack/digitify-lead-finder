import { describe, expect, it, vi, beforeEach } from "vitest";

const mockedMeta = vi.hoisted(() => ({
  clearMetaSettings: vi.fn(),
  loadMetaManagedPages: vi.fn(),
  loadMetaWorkspaceConfig: vi.fn(),
  publishFacebookCarouselPost: vi.fn(),
  publishFacebookImagePost: vi.fn(),
  publishFacebookImageStory: vi.fn(),
  publishFacebookVideoPost: vi.fn(),
  publishInstagramCarouselPost: vi.fn(),
  publishInstagramImagePost: vi.fn(),
  publishInstagramImageStory: vi.fn(),
  publishInstagramReel: vi.fn(),
  publishInstagramVideoPost: vi.fn(),
  resolveSocialPublishTarget: vi.fn(),
  upsertMetaSettings: vi.fn(),
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
  beforeEach(() => {
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
        socialPost: {
          findUnique: socialPostFindUnique,
          update: socialPostUpdate,
        },
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
});

describe("social publish worker", () => {
  beforeEach(() => {
    mockedMeta.loadMetaWorkspaceConfig.mockReset();
    mockedMeta.resolveSocialPublishTarget.mockReset();
    mockedMeta.publishFacebookImagePost.mockReset();
    mockedMeta.publishFacebookImageStory.mockReset();
    mockedMeta.publishInstagramImagePost.mockReset();
    mockedMeta.publishInstagramImageStory.mockReset();
    mockedMeta.publishInstagramReel.mockReset();
    mockedMeta.publishFacebookCarouselPost.mockReset();
    mockedMeta.publishInstagramCarouselPost.mockReset();
    mockedMeta.publishFacebookVideoPost.mockReset();
    mockedMeta.publishInstagramVideoPost.mockReset();
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
    mockedMeta.resolveSocialPublishTarget.mockResolvedValue({
      pageId: "123",
      pageAccessToken: "page-token",
      pageName: "Digitify",
      instagramBusinessId: "",
      instagramUsername: "",
    });
    mockedMeta.publishFacebookImagePost.mockRejectedValue(new Error("Meta publish failed"));

    const result = await runDueSocialPostsWorker({
      socialPost: {
        findMany: socialPostFindMany,
        update: socialPostUpdate,
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
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

    const socialPostFindMany = vi.fn().mockResolvedValue([post]);
    const socialPostUpdate = vi.fn().mockResolvedValue({});

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

    const result = await runDueSocialPostsWorker({
      socialPost: {
        findMany: socialPostFindMany,
        update: socialPostUpdate,
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      activity: { create: vi.fn().mockResolvedValue({ id: "act_feed" }) },
    } as any);

    expect(result.published).toBe(1);
    expect(mockedMeta.publishFacebookImagePost).toHaveBeenCalledWith(
      expect.objectContaining({ pageId: "123", imageUrl: post.imageUrl, caption: "Feed caption" }),
    );
    expect(mockedMeta.publishInstagramImagePost).toHaveBeenCalledWith(
      expect.objectContaining({ instagramBusinessId: "ig_123", imageUrl: post.imageUrl }),
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

    const socialPostFindMany = vi.fn().mockResolvedValue([post]);
    const socialPostUpdate = vi.fn().mockResolvedValue({});

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

    const result = await runDueSocialPostsWorker({
      socialPost: {
        findMany: socialPostFindMany,
        update: socialPostUpdate,
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      activity: { create: vi.fn().mockResolvedValue({ id: "act_reel" }) },
    } as any);

    expect(result.published).toBe(1);
    expect(mockedMeta.publishInstagramReel).toHaveBeenCalledWith(
      expect.objectContaining({
        instagramBusinessId: "ig_123",
        videoUrl: "https://example.com/reel.mp4",
        caption: "Reel caption",
      }),
    );
    expect(mockedMeta.publishFacebookImagePost).not.toHaveBeenCalled();
    expect(mockedMeta.publishInstagramImagePost).not.toHaveBeenCalled();
  });

  it("publishes carousel feed posts through carousel endpoints", async () => {
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

    const socialPostFindMany = vi.fn().mockResolvedValue([post]);
    const socialPostUpdate = vi.fn().mockResolvedValue({});

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

    const result = await runDueSocialPostsWorker({
      socialPost: {
        findMany: socialPostFindMany,
        update: socialPostUpdate,
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      activity: { create: vi.fn().mockResolvedValue({ id: "act_carousel" }) },
    } as any);

    expect(result.published).toBe(1);
    expect(mockedMeta.publishFacebookCarouselPost).toHaveBeenCalledWith(
      expect.objectContaining({
        pageId: "123",
        slides: expect.arrayContaining([
          expect.objectContaining({ mediaType: "IMAGE" }),
          expect.objectContaining({ mediaType: "VIDEO" }),
        ]),
      }),
    );
    expect(mockedMeta.publishInstagramCarouselPost).toHaveBeenCalled();
    expect(mockedMeta.publishFacebookImagePost).not.toHaveBeenCalled();
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

    const socialPostFindMany = vi.fn().mockResolvedValue([post]);
    const socialPostUpdate = vi.fn().mockResolvedValue({});

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

    const result = await runDueSocialPostsWorker({
      socialPost: {
        findMany: socialPostFindMany,
        update: socialPostUpdate,
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      activity: { create: vi.fn().mockResolvedValue({ id: "act_feed_video" }) },
    } as any);

    expect(result.published).toBe(1);
    expect(mockedMeta.publishFacebookVideoPost).toHaveBeenCalledWith(
      expect.objectContaining({ videoUrl: "https://example.com/feed.mp4" }),
    );
    expect(mockedMeta.publishInstagramVideoPost).toHaveBeenCalledWith(
      expect.objectContaining({ videoUrl: "https://example.com/feed.mp4" }),
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

    const socialPostFindMany = vi.fn().mockResolvedValue([post]);
    const socialPostUpdate = vi.fn().mockResolvedValue({});

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

    const result = await runDueSocialPostsWorker({
      socialPost: {
        findMany: socialPostFindMany,
        update: socialPostUpdate,
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      activity: { create: vi.fn().mockResolvedValue({ id: "act_story" }) },
    } as any);

    expect(result.published).toBe(1);
    expect(mockedMeta.publishFacebookImagePost).not.toHaveBeenCalled();
    expect(mockedMeta.publishInstagramImagePost).not.toHaveBeenCalled();
    expect(mockedMeta.publishFacebookImageStory).toHaveBeenCalledWith(
      expect.objectContaining({ pageId: "123", imageUrl: post.imageUrl }),
    );
    expect(mockedMeta.publishInstagramImageStory).toHaveBeenCalledWith(
      expect.objectContaining({ instagramBusinessId: "ig_123", imageUrl: post.imageUrl }),
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
});
