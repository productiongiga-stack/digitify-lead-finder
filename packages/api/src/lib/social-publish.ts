import { TRPCError } from "@trpc/server";
import { type PrismaClient, Prisma } from "@digitify/db";
import { z } from "zod";
import { validateSocialImageForPublish, validateSocialVideoForPublish } from "./social-image";
import { prepareSocialPostAssetsForPublish } from "./social-prepare-assets";
import {
  loadMetaWorkspaceConfig,
  publishFacebookCarouselPost,
  publishFacebookImagePost,
  publishFacebookImageStory,
  publishFacebookVideoPost,
  publishInstagramCarouselPost,
  publishInstagramImagePost,
  publishInstagramImageStory,
  publishInstagramReel,
  publishInstagramVideoPost,
  resolveSocialPublishTarget,
  type SocialPublishedRef,
} from "./social-meta";
import {
  CAROUSEL_MAX_SLIDES,
  CAROUSEL_MIN_SLIDES,
  normalizeCarousel,
  normalizeCarouselMetadata,
  normalizeFeedFormat,
  normalizePlacementAssets,
  normalizePlacements,
  probeFormatForPlacement,
  resolveFeedPublishKind,
  resolvePlacementImageUrl,
  type SocialCarouselSlide,
  type SocialPlacement,
} from "./social-placements";

const socialPostFormatEnum = z.enum(["SQUARE", "PORTRAIT", "LANDSCAPE", "STORY"]);
const socialPlacementEnum = z.enum(["FEED", "STORY", "REEL"]);
const socialFeedFormatEnum = z.enum(["SQUARE", "PORTRAIT", "LANDSCAPE"]);

const socialImageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) =>
      value.startsWith("data:image/") ||
      value.startsWith("/uploads/") ||
      z.string().url().safeParse(value).success,
    { message: "Gebruik een publieke https-URL of upload een JPG, PNG of WebP." },
  );

const socialVideoUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => /^https:\/\//i.test(value), {
    message: "Reel-video moet een publieke https-URL zijn (MP4).",
  });

const socialPlacementAssetSchema = z.object({
  imageUrl: socialImageUrlSchema.optional(),
  videoUrl: socialVideoUrlSchema.optional(),
});

const socialCarouselSlideSchema = z.object({
  id: z.string().max(64).optional(),
  mediaType: z.enum(["IMAGE", "VIDEO"]),
  imageUrl: z.union([socialImageUrlSchema, z.literal("")]).optional(),
  videoUrl: z.union([socialVideoUrlSchema, z.literal("")]).optional(),
});

const socialCarouselSchema = z.object({
  enabled: z.boolean(),
  slides: z.array(socialCarouselSlideSchema).max(CAROUSEL_MAX_SLIDES),
});

export const socialPostMetadataSchema = z
  .object({
    headline: z.string().max(160).optional(),
    cta: z.string().max(160).optional(),
    hashtags: z.string().max(500).optional(),
    linkUrl: z.union([z.string().url(), z.literal("")]).optional(),
    firstComment: z.string().max(1000).optional(),
    altText: z.string().max(500).optional(),
    brandSignature: z.string().max(240).optional(),
    brandKitId: z.string().max(80).optional(),
    postFormat: socialPostFormatEnum.default("SQUARE").optional(),
    placements: z.array(socialPlacementEnum).min(1).max(3).optional(),
    feedFormat: socialFeedFormatEnum.optional(),
    publisherPageId: z.string().max(64).optional(),
    publisherPageName: z.string().max(160).optional(),
    publisherInstagramUsername: z.string().max(80).optional(),
    assets: z
      .object({
        FEED: socialPlacementAssetSchema.optional(),
        STORY: socialPlacementAssetSchema.optional(),
        REEL: socialPlacementAssetSchema.optional(),
      })
      .optional(),
    carousel: socialCarouselSchema.optional(),
  })
  .optional();

export { socialImageUrlSchema, socialPostFormatEnum };

function computeRetryDelayMs(retryCount: number) {
  const baseMs = 5 * 60 * 1000;
  return baseMs * 2 ** Math.max(0, retryCount);
}

function cleanOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function normalizeHashtags(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return "";
  return raw
    .split(/[\s,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag.replace(/^#+/, "")}`))
    .join(" ");
}

export function normalizeSocialMetadata(metadata?: z.infer<typeof socialPostMetadataSchema>) {
  if (!metadata) return {};
  const placements = normalizePlacements(metadata);
  const feedFormat = normalizeFeedFormat(metadata);
  const assets = normalizePlacementAssets(metadata);
  const carousel = normalizeCarouselMetadata({ ...metadata, assets, placements, feedFormat });
  return {
    headline: cleanOptionalText(metadata.headline),
    cta: cleanOptionalText(metadata.cta),
    hashtags: normalizeHashtags(metadata.hashtags) || undefined,
    linkUrl: cleanOptionalText(metadata.linkUrl),
    firstComment: cleanOptionalText(metadata.firstComment),
    altText: cleanOptionalText(metadata.altText),
    brandSignature: cleanOptionalText(metadata.brandSignature),
    brandKitId: cleanOptionalText(metadata.brandKitId),
    postFormat: metadata.postFormat || feedFormat,
    placements,
    feedFormat,
    publisherPageId: cleanOptionalText(metadata.publisherPageId),
    publisherPageName: cleanOptionalText(metadata.publisherPageName),
    publisherInstagramUsername: cleanOptionalText(metadata.publisherInstagramUsername),
    assets,
    carousel,
  };
}

function buildPublishedCaption(caption: string, rawMetadata?: unknown, placement?: SocialPlacement) {
  const metadata = normalizeSocialMetadata((rawMetadata || undefined) as z.infer<typeof socialPostMetadataSchema>);
  if (placement === "STORY") return "";

  const parts = [
    metadata.headline,
    caption.trim(),
    metadata.cta,
    metadata.linkUrl,
    metadata.brandSignature,
    metadata.hashtags,
  ].filter(Boolean);

  return parts.join("\n\n").trim();
}

function placementLabel(placement: SocialPlacement) {
  if (placement === "FEED") return "Feed post";
  if (placement === "STORY") return "Story";
  return "Reel";
}

async function ensurePostCanPublish(
  post: { imageUrl: string; targetPlatforms: string[]; metadata?: unknown },
  publishTarget?: { pageId: string; pageAccessToken: string; instagramBusinessId: string },
) {
  const metadata = normalizeSocialMetadata((post.metadata || undefined) as z.infer<typeof socialPostMetadataSchema>);
  const placements = metadata.placements || ["FEED"];
  const assets = metadata.assets || normalizePlacementAssets(metadata);

  if (!placements.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Kies minstens één publicatietype (Feed, Story of Reel)." });
  }

  if (!publishTarget?.pageId || !publishTarget.pageAccessToken) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Geen Facebook-pagina geselecteerd. Kies een account in de Social Planner.",
    });
  }

  const needsInstagram =
    post.targetPlatforms.includes("INSTAGRAM") || placements.some((placement) => placement === "STORY" || placement === "REEL");
  if (needsInstagram && !publishTarget.instagramBusinessId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Het geselecteerde account heeft geen gekoppeld Instagram Business-profiel.",
    });
  }

  if (placements.includes("REEL") && !post.targetPlatforms.includes("INSTAGRAM")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Reels worden alleen naar Instagram gepubliceerd. Schakel Instagram in of verwijder Reel.",
    });
  }

  for (const placement of placements) {
    if (placement === "FEED") {
      const feedKind = resolveFeedPublishKind(metadata);
      if (feedKind === "CAROUSEL") {
        const carousel = normalizeCarousel(metadata);
        if (!carousel.enabled || carousel.slides.length < CAROUSEL_MIN_SLIDES) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Carousel vereist minstens ${CAROUSEL_MIN_SLIDES} volledige slides met foto of video.`,
          });
        }
        for (const slide of carousel.slides) {
          if (slide.mediaType === "IMAGE" && slide.imageUrl) {
            await validateSocialImageForPublish({
              imageUrl: slide.imageUrl,
              targetPlatforms: post.targetPlatforms,
              placement: "FEED",
            });
          }
          if (slide.mediaType === "VIDEO" && slide.videoUrl) {
            try {
              await validateSocialVideoForPublish(slide.videoUrl);
            } catch (error) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: error instanceof Error ? error.message : "Carousel-video is ongeldig.",
              });
            }
          }
        }
        continue;
      }

      if (feedKind === "VIDEO") {
        const videoUrl = assets.FEED?.videoUrl?.trim();
        if (!videoUrl) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Feed-video vereist een publieke MP4-video-URL.",
          });
        }
        try {
          await validateSocialVideoForPublish(videoUrl);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Feed-video is ongeldig.",
          });
        }
        continue;
      }
    }

    if (placement === "REEL") {
      const videoUrl = assets.REEL?.videoUrl?.trim();
      if (!videoUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Reel vereist een publieke MP4-video-URL.",
        });
      }
      try {
        await validateSocialVideoForPublish(videoUrl);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Reel-video is ongeldig.",
        });
      }
      const coverUrl = resolvePlacementImageUrl("REEL", metadata, post.imageUrl);
      if (coverUrl) {
        await validateSocialImageForPublish({
          imageUrl: coverUrl,
          targetPlatforms: post.targetPlatforms,
          placement: "REEL",
        });
      }
      continue;
    }

    const imageUrl = resolvePlacementImageUrl(placement, metadata, post.imageUrl);
    if (!imageUrl) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Afbeelding ontbreekt voor ${placementLabel(placement)}.`,
      });
    }

    await validateSocialImageForPublish({
      imageUrl,
      targetPlatforms: post.targetPlatforms,
      placement: probeFormatForPlacement(placement),
    });
  }
}

export async function prepareAndValidatePostForPublish(
  db: PrismaClient,
  post: { id: string; imageUrl: string; targetPlatforms: string[]; metadata?: unknown },
  scope: { workspaceId: string; memberId: string },
  publishTarget?: { pageId: string; pageAccessToken: string; instagramBusinessId: string },
) {
  const prepared = await prepareSocialPostAssetsForPublish({
    imageUrl: post.imageUrl,
    targetPlatforms: post.targetPlatforms,
    metadata: (post.metadata || undefined) as z.infer<typeof socialPostMetadataSchema>,
    workspaceId: scope.workspaceId,
    userId: scope.memberId,
  });

  const normalizedMetadata = normalizeSocialMetadata(
    prepared.metadata as z.infer<typeof socialPostMetadataSchema>,
  );

  if (prepared.changed) {
    await db.socialPost.update({
      where: { id: post.id },
      data: {
        imageUrl: prepared.imageUrl,
        metadata: normalizedMetadata,
      },
    });
  }

  await ensurePostCanPublish(
    {
      imageUrl: prepared.imageUrl,
      targetPlatforms: post.targetPlatforms,
      metadata: normalizedMetadata,
    },
    publishTarget,
  );

  return {
    imageUrl: prepared.imageUrl,
    metadata: normalizedMetadata,
  };
}

export async function createSocialActivity(
  db: PrismaClient,
  input: { userId: string; type: Prisma.ActivityCreateInput["type"]; title: string; metadata?: Record<string, unknown> },
) {
  await db.activity
    .create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        metadata: (input.metadata || {}) as Prisma.InputJsonValue,
      },
    })
    .catch(() => null);
}

type SocialPostRecord = {
  id: string;
  createdById: string;
  approvedById?: string | null;
  caption: string;
  imageUrl: string;
  targetPlatforms: string[];
  metadata?: unknown;
  retryCount?: number | null;
  status: string;
  externalPostIds?: unknown;
  publishedAt?: Date | string | null;
  lastError?: string | null;
  scheduledFor?: Date | string | null;
};

export function parseStoredExternalIds(raw: unknown): Record<string, SocialPublishedRef> {
  if (!raw || typeof raw !== "object") return {};
  const result: Record<string, SocialPublishedRef> = {};

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim()) {
      result[key] = { id: value.trim(), verified: true };
      continue;
    }
    if (value && typeof value === "object" && "id" in value) {
      const ref = value as SocialPublishedRef;
      if (ref.id?.trim()) {
        result[key] = {
          id: ref.id.trim(),
          permalink: ref.permalink,
          verified: ref.verified !== false,
        };
      }
    }
  }

  return result;
}

export function hasPublishedExternally(externalIds: Record<string, SocialPublishedRef>) {
  return Object.keys(externalIds).length > 0;
}

function normalizePublishedRefs(externalIds: Record<string, SocialPublishedRef>) {
  return Object.fromEntries(
    Object.entries(externalIds).map(([key, ref]) => [
      key,
      {
        ...ref,
        verified: Boolean(ref.id),
      },
    ]),
  );
}

async function persistPartialExternalIds(
  db: PrismaClient,
  postId: string,
  externalIds: Record<string, SocialPublishedRef>,
) {
  await db.socialPost.update({
    where: { id: postId },
    data: { externalPostIds: externalIds },
  });
}

export async function finalizePublishedPost(
  db: PrismaClient,
  post: SocialPostRecord,
  externalIds: Record<string, SocialPublishedRef>,
) {
  const normalized = normalizePublishedRefs(externalIds);

  await db.socialPost.update({
    where: { id: post.id },
    data: {
      status: "PUBLISHED",
      publishedAt: post.publishedAt ? new Date(post.publishedAt) : new Date(),
      lastError: null,
      externalPostIds: normalized,
      retryCount: 0,
    },
  });

  await createSocialActivity(db, {
    userId: post.approvedById || post.createdById,
    type: "SOCIAL_POST_PUBLISHED",
    title: "Social post live op Meta",
    metadata: { socialPostId: post.id, platforms: post.targetPlatforms, externalIds: normalized },
  });

  return normalized;
}

async function acquirePublishLock(db: PrismaClient, postId: string) {
  const result = await db.socialPost.updateMany({
    where: {
      id: postId,
      status: { in: ["SCHEDULED", "FAILED"] },
    },
    data: {
      status: "PUBLISHING",
      lastError: null,
    },
  });

  return result.count === 1;
}

export async function publishSocialPostRecord(db: PrismaClient, post: SocialPostRecord) {
  const existingExternalIds = parseStoredExternalIds(post.externalPostIds);

  if (post.status === "PUBLISHED" || hasPublishedExternally(existingExternalIds)) {
    return finalizePublishedPost(db, post, existingExternalIds);
  }

  const locked = await acquirePublishLock(db, post.id);
  if (!locked) {
    const current = await db.socialPost.findUnique({ where: { id: post.id } });
    if (current?.status === "PUBLISHED") {
      return parseStoredExternalIds(current.externalPostIds);
    }
    if (current?.status === "PUBLISHING") {
      throw new Error("Deze post wordt al gepubliceerd. Even geduld.");
    }
    throw new Error("Post kan niet meer gepubliceerd worden.");
  }

  const scope = { workspaceId: post.createdById, memberId: post.createdById };
  const config = await loadMetaWorkspaceConfig(db, scope);

  if (!config.pageId || !config.pageAccessToken) {
    throw new Error("Meta is niet gekoppeld. Ga naar Instellingen → Integraties en koppel je Facebook-pagina.");
  }

  const publishTarget = await resolveSocialPublishTarget({
    config,
    publisherPageId: normalizeSocialMetadata(
      (post.metadata || undefined) as z.infer<typeof socialPostMetadataSchema>,
    ).publisherPageId,
  });

  const prepared = await prepareAndValidatePostForPublish(db, post, scope, publishTarget);
  const metadata = prepared.metadata;
  const primaryImageUrl = prepared.imageUrl;

  const externalIds: Record<string, SocialPublishedRef> = { ...existingExternalIds };
  const placements = metadata.placements || ["FEED"];
  const assets = metadata.assets || normalizePlacementAssets(metadata);

  for (const placement of placements) {
    if (placement === "FEED") {
      const publishCaption = buildPublishedCaption(post.caption, metadata, "FEED");
      const feedKind = resolveFeedPublishKind(metadata);
      const carouselSlides = normalizeCarousel(metadata).slides as SocialCarouselSlide[];

      if (feedKind === "CAROUSEL") {
        if (!carouselSlides.length || carouselSlides.length < CAROUSEL_MIN_SLIDES) {
          throw new Error(`Carousel vereist minstens ${CAROUSEL_MIN_SLIDES} volledige slides.`);
        }
        if (post.targetPlatforms.includes("FACEBOOK") && !externalIds.facebookCarousel) {
          externalIds.facebookCarousel = await publishFacebookCarouselPost({
            pageId: publishTarget.pageId,
            pageAccessToken: publishTarget.pageAccessToken,
            caption: publishCaption,
            slides: carouselSlides,
          });
          await persistPartialExternalIds(db, post.id, externalIds);
        }
        if (post.targetPlatforms.includes("INSTAGRAM") && !externalIds.instagramCarousel) {
          externalIds.instagramCarousel = await publishInstagramCarouselPost({
            instagramBusinessId: publishTarget.instagramBusinessId,
            pageAccessToken: publishTarget.pageAccessToken,
            caption: publishCaption,
            slides: carouselSlides,
          });
          await persistPartialExternalIds(db, post.id, externalIds);
        }
      } else if (feedKind === "VIDEO") {
        const videoUrl = assets.FEED?.videoUrl?.trim() || "";
        if (!videoUrl) throw new Error("Feed-video ontbreekt.");
        if (post.targetPlatforms.includes("FACEBOOK") && !externalIds.facebook) {
          externalIds.facebook = await publishFacebookVideoPost({
            pageId: publishTarget.pageId,
            pageAccessToken: publishTarget.pageAccessToken,
            caption: publishCaption,
            videoUrl,
          });
          await persistPartialExternalIds(db, post.id, externalIds);
        }
        if (post.targetPlatforms.includes("INSTAGRAM") && !externalIds.instagram) {
          externalIds.instagram = await publishInstagramVideoPost({
            instagramBusinessId: publishTarget.instagramBusinessId,
            pageAccessToken: publishTarget.pageAccessToken,
            caption: publishCaption,
            videoUrl,
          });
          await persistPartialExternalIds(db, post.id, externalIds);
        }
      } else {
        const imageUrl = resolvePlacementImageUrl("FEED", metadata, primaryImageUrl);
        if (post.targetPlatforms.includes("FACEBOOK") && !externalIds.facebook) {
          externalIds.facebook = await publishFacebookImagePost({
            pageId: publishTarget.pageId,
            pageAccessToken: publishTarget.pageAccessToken,
            caption: publishCaption,
            imageUrl,
          });
          await persistPartialExternalIds(db, post.id, externalIds);
        }
        if (post.targetPlatforms.includes("INSTAGRAM") && !externalIds.instagram) {
          externalIds.instagram = await publishInstagramImagePost({
            instagramBusinessId: publishTarget.instagramBusinessId,
            pageAccessToken: publishTarget.pageAccessToken,
            caption: publishCaption,
            imageUrl,
          });
          await persistPartialExternalIds(db, post.id, externalIds);
        }
      }
    }

    if (placement === "STORY") {
      const imageUrl = resolvePlacementImageUrl("STORY", metadata, primaryImageUrl);
      if (post.targetPlatforms.includes("FACEBOOK") && !externalIds.facebookStory) {
        externalIds.facebookStory = await publishFacebookImageStory({
          pageId: publishTarget.pageId,
          pageAccessToken: publishTarget.pageAccessToken,
          imageUrl,
        });
        await persistPartialExternalIds(db, post.id, externalIds);
      }
      if (post.targetPlatforms.includes("INSTAGRAM") && !externalIds.instagramStory) {
        externalIds.instagramStory = await publishInstagramImageStory({
          instagramBusinessId: publishTarget.instagramBusinessId,
          pageAccessToken: publishTarget.pageAccessToken,
          imageUrl,
        });
        await persistPartialExternalIds(db, post.id, externalIds);
      }
    }

    if (placement === "REEL") {
      const videoUrl = assets.REEL?.videoUrl?.trim();
      if (!videoUrl) throw new Error("Reel-video ontbreekt.");
      if (!externalIds.instagramReel) {
        const coverUrl = resolvePlacementImageUrl("REEL", metadata, primaryImageUrl);
        const publishCaption = buildPublishedCaption(post.caption, metadata, "REEL");
        externalIds.instagramReel = await publishInstagramReel({
          instagramBusinessId: publishTarget.instagramBusinessId,
          pageAccessToken: publishTarget.pageAccessToken,
          caption: publishCaption,
          videoUrl,
          coverUrl: coverUrl || undefined,
        });
        await persistPartialExternalIds(db, post.id, externalIds);
      }
    }
  }

  if (!hasPublishedExternally(externalIds)) {
    throw new Error("Geen Meta publicatie-ID ontvangen.");
  }

  return finalizePublishedPost(db, post, externalIds);
}

export async function markSocialPostPublishFailure(db: PrismaClient, post: SocialPostRecord, error: unknown) {
  const refreshed = await db.socialPost.findUnique({ where: { id: post.id } });
  const partialIds = parseStoredExternalIds(refreshed?.externalPostIds);

  if (hasPublishedExternally(partialIds)) {
    await finalizePublishedPost(db, { ...post, publishedAt: refreshed?.publishedAt }, partialIds);
    return;
  }

  const currentRetries = Number(post.retryCount || 0);
  const canRetry = currentRetries < 3;
  const nextRetryAt = canRetry ? new Date(Date.now() + computeRetryDelayMs(currentRetries)) : null;
  const message = error instanceof Error ? error.message : "Onbekende publicatiefout";

  await db.socialPost.update({
    where: { id: post.id },
    data: {
      status: canRetry ? "SCHEDULED" : "FAILED",
      retryCount: currentRetries + 1,
      scheduledFor: nextRetryAt,
      lastError: message,
    },
  });

  await createSocialActivity(db, {
    userId: post.approvedById || post.createdById,
    type: "SOCIAL_POST_FAILED",
    title: canRetry ? "Social post retry ingepland" : "Social post gefaald",
    metadata: { socialPostId: post.id, retries: currentRetries + 1, error: message, nextRetryAt },
  });
}

export async function recoverStuckPublishingPosts(db: PrismaClient) {
  const stuckThreshold = new Date(Date.now() - 10 * 60 * 1000);
  const stuckPosts = await db.socialPost.findMany({
    where: {
      status: "PUBLISHING",
      updatedAt: { lt: stuckThreshold },
    },
    take: 50,
  });

  for (const stuck of stuckPosts) {
    const partialIds = parseStoredExternalIds(stuck.externalPostIds);
    if (hasPublishedExternally(partialIds)) {
      await finalizePublishedPost(db, stuck, partialIds);
      continue;
    }

    await db.socialPost.update({
      where: { id: stuck.id },
      data: {
        status: "FAILED",
        lastError: "Publicatie onderbroken. Controleer Meta of gebruik opnieuw publiceren.",
      },
    });
  }
}

export async function runDueSocialPostsWorker(
  db: PrismaClient,
  options?: { postId?: string; workspaceId?: string },
) {
  const now = new Date();

  await recoverStuckPublishingPosts(db);

  const where: Record<string, unknown> = options?.postId
    ? { id: options.postId, status: { in: ["SCHEDULED", "PUBLISHING"] } }
    : {
        status: "SCHEDULED",
        scheduledFor: { lte: now },
      };
  if (options?.workspaceId) {
    where.createdById = options.workspaceId;
  }

  const duePosts = await db.socialPost.findMany({
    where,
    orderBy: { scheduledFor: "asc" },
    take: options?.postId ? 1 : 100,
  });

  let published = 0;
  let failed = 0;
  let skipped = 0;

  for (const post of duePosts) {
    if (!options?.postId && post.scheduledFor && new Date(post.scheduledFor).getTime() > now.getTime()) {
      skipped += 1;
      continue;
    }

    try {
      await publishSocialPostRecord(db, post);
      published += 1;
    } catch (error) {
      await markSocialPostPublishFailure(db, post, error);
      failed += 1;
    }
  }

  return {
    due: duePosts.length,
    published,
    failed,
    skipped,
  };
}
