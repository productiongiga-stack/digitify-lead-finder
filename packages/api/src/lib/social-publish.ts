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
  publishFacebookVideoStory,
  publishInstagramCarouselPost,
  publishInstagramImagePost,
  publishInstagramImageStory,
  publishInstagramVideoStory,
  publishInstagramReel,
  publishInstagramVideoPost,
  resolveSocialPublishTarget,
  fetchMetaPagePublishCapability,
  fetchMetaTokenDebugInfo,
  resolveMetaOAuthScopeSummary,
  resolveMetaPublishReadiness,
  type SocialPublishedRef,
  type SocialPublishTarget,
} from "./social-meta";
import {
  CAROUSEL_MAX_SLIDES,
  CAROUSEL_MIN_SLIDES,
  STORY_MAX_ITEMS,
  normalizeCarousel,
  normalizeCarouselMetadata,
  normalizeFeedFormat,
  normalizePlacementAssets,
  normalizePlatformAssets,
  normalizePlatformFeedFormats,
  normalizePlacements,
  normalizeStoryItems,
  normalizeStoryItemsMetadata,
  probeFormatForPlacement,
  resolveFeedPublishKind,
  resolvePlacementImageUrl,
  resolvePlatformFeedImageUrl,
  type SocialCarouselSlide,
  type SocialPlacement,
  type SocialPlatform,
  type SocialStoryItem,
} from "./social-placements";

const socialPostFormatEnum = z.enum(["SQUARE", "PORTRAIT", "PORTRAIT_34", "LANDSCAPE", "STORY"]);
const socialPlacementEnum = z.enum(["FEED", "STORY", "REEL"]);
const socialFeedFormatEnum = z.enum(["SQUARE", "PORTRAIT", "PORTRAIT_34", "LANDSCAPE"]);

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

const socialStoryItemSchema = z.object({
  id: z.string().max(64).optional(),
  mediaType: z.enum(["IMAGE", "VIDEO"]),
  imageUrl: z.union([socialImageUrlSchema, z.literal("")]).optional(),
  videoUrl: z.union([socialVideoUrlSchema, z.literal("")]).optional(),
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
    feedFormats: z
      .object({
        FACEBOOK: socialFeedFormatEnum.optional(),
        INSTAGRAM: socialFeedFormatEnum.optional(),
      })
      .optional(),
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
    platformAssets: z
      .object({
        FACEBOOK: z
          .object({
            FEED: socialPlacementAssetSchema.optional(),
            STORY: socialPlacementAssetSchema.optional(),
            REEL: socialPlacementAssetSchema.optional(),
          })
          .optional(),
        INSTAGRAM: z
          .object({
            FEED: socialPlacementAssetSchema.optional(),
            STORY: socialPlacementAssetSchema.optional(),
            REEL: socialPlacementAssetSchema.optional(),
          })
          .optional(),
      })
      .optional(),
    storyItems: z.array(socialStoryItemSchema).max(STORY_MAX_ITEMS).optional(),
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
  const feedFormats = normalizePlatformFeedFormats(metadata);
  const platformAssets = normalizePlatformAssets(metadata);
  const storyItems = normalizeStoryItemsMetadata(metadata);
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
    feedFormats,
    publisherPageId: cleanOptionalText(metadata.publisherPageId),
    publisherPageName: cleanOptionalText(metadata.publisherPageName),
    publisherInstagramUsername: cleanOptionalText(metadata.publisherInstagramUsername),
    assets,
    platformAssets,
    storyItems,
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

function storyItemHasPublishMedia(item: SocialStoryItem) {
  return item.mediaType === "VIDEO" ? Boolean(item.videoUrl?.trim()) : Boolean(item.imageUrl?.trim());
}

function formatPlatformBlockingMessage(platform: "Facebook" | "Instagram", reasons: string[]) {
  const list = reasons.length ? reasons.join(" ") : "Onbekende Meta-rechtenfout.";
  return `${platform} publicatie is geblokkeerd vóór upload: ${list} Koppel Meta opnieuw via Integraties en controleer de Meta Developer checklist.`;
}

async function ensurePostCanPublish(
  post: { imageUrl: string; targetPlatforms: string[]; metadata?: unknown },
  publishTarget?: Pick<
    SocialPublishTarget,
    "pageId" | "pageAccessToken" | "instagramBusinessId" | "pageTasks"
  >,
  metaConfig?: { accessToken: string; appId: string; appSecret: string },
) {
  const metadata = normalizeSocialMetadata((post.metadata || undefined) as z.infer<typeof socialPostMetadataSchema>);
  const placements = metadata.placements || ["FEED"];
  const assets = metadata.assets || normalizePlacementAssets(metadata);
  let targetPlatforms = post.targetPlatforms.filter(
    (platform): platform is SocialPlatform => platform === "FACEBOOK" || platform === "INSTAGRAM",
  );

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
    post.targetPlatforms.includes("INSTAGRAM") || placements.some((placement) => placement === "REEL");

  if (!metaConfig?.accessToken || !metaConfig.appId || !metaConfig.appSecret) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Meta app-credentials of user-token ontbreken. Vul App ID + Secret in en koppel Meta opnieuw via Integraties.",
    });
  }

  if (metaConfig?.accessToken && metaConfig.appId && metaConfig.appSecret) {
    const debug = await fetchMetaTokenDebugInfo({
      inputToken: metaConfig.accessToken,
      appId: metaConfig.appId,
      appSecret: metaConfig.appSecret,
    });
    if (!debug.isValid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          debug.error ||
          "Meta access token is ongeldig. Ga naar Instellingen → Integraties → Opnieuw koppelen.",
      });
    }

    const pageDebug = await fetchMetaTokenDebugInfo({
      inputToken: publishTarget.pageAccessToken,
      appId: metaConfig.appId,
      appSecret: metaConfig.appSecret,
    });

    if (!pageDebug.isValid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          pageDebug.error ||
          "De Facebook Page-token is ongeldig of verouderd. Koppel Meta opnieuw via Integraties en kies de juiste Page opnieuw.",
      });
    }

    const pageCapability = await fetchMetaPagePublishCapability({
      pageId: publishTarget.pageId,
      pageAccessToken: publishTarget.pageAccessToken,
    });

    const readiness = resolveMetaPublishReadiness({
      pageId: publishTarget.pageId,
      instagramBusinessId: publishTarget.instagramBusinessId,
      userDebug: debug,
      pageDebug,
      pageTasks: publishTarget.pageTasks,
      pageCapability,
      oauthScopes: resolveMetaOAuthScopeSummary(),
    });

    if (post.targetPlatforms.includes("FACEBOOK") && !readiness.facebookPublishReady) {
      targetPlatforms = targetPlatforms.filter((platform) => platform !== "FACEBOOK");
      if (!post.targetPlatforms.includes("INSTAGRAM") || !readiness.instagramPublishReady) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: formatPlatformBlockingMessage("Facebook", readiness.facebookBlockingReasons),
        });
      }
    }

    if (post.targetPlatforms.includes("INSTAGRAM") && !readiness.instagramPublishReady) {
      targetPlatforms = targetPlatforms.filter((platform) => platform !== "INSTAGRAM");
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: formatPlatformBlockingMessage("Instagram", readiness.instagramBlockingReasons),
      });
    }
  }

  if (!targetPlatforms.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Geen publish-ready platform over. Controleer Meta Integraties en koppel opnieuw.",
    });
  }

  if (needsInstagram && targetPlatforms.includes("INSTAGRAM") && !publishTarget.instagramBusinessId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Het geselecteerde account heeft geen gekoppeld Instagram Business-profiel.",
    });
  }

  if (placements.includes("REEL") && !targetPlatforms.includes("INSTAGRAM")) {
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
        const carouselPlatforms = targetPlatforms.filter(
          (platform) => platform === "INSTAGRAM" || platform === "FACEBOOK",
        );
        if (carouselPlatforms.length && (!carousel.enabled || carousel.slides.length < CAROUSEL_MIN_SLIDES)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Multi-upload vereist minstens ${CAROUSEL_MIN_SLIDES} volledige items met foto of video.`,
          });
        }
        for (const slide of carousel.slides) {
          if (slide.mediaType === "IMAGE" && slide.imageUrl) {
            await validateSocialImageForPublish({
              imageUrl: slide.imageUrl,
              targetPlatforms: carouselPlatforms,
              placement: "FEED",
            });
          }
          if (slide.mediaType === "VIDEO" && slide.videoUrl) {
            try {
              await validateSocialVideoForPublish(slide.videoUrl);
            } catch (error) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: error instanceof Error ? error.message : "Multi-upload video is ongeldig.",
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
          targetPlatforms,
          placement: "REEL",
        });
      }
      continue;
    }

    if (placement === "STORY") {
      const explicitStoryItems = normalizeStoryItemsMetadata(metadata);
      const storyItems = explicitStoryItems.length ? explicitStoryItems : normalizeStoryItems(metadata, post.imageUrl);
      if (!storyItems.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Voeg minstens één story-foto of story-video toe.",
        });
      }
      for (const [index, item] of storyItems.entries()) {
        if (!storyItemHasPublishMedia(item)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              item.mediaType === "VIDEO"
                ? `Story ${index + 1}: voeg een video toe of verwijder dit story-item.`
                : `Story ${index + 1}: voeg een afbeelding toe of verwijder dit story-item.`,
          });
        }
        if (item.mediaType === "VIDEO") {
          if (!item.videoUrl) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Story-video vereist een publieke MP4-video-URL.",
            });
          }
          try {
            await validateSocialVideoForPublish(item.videoUrl);
          } catch (error) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: error instanceof Error ? error.message : "Story-video is ongeldig.",
            });
          }
          continue;
        }

        if (!item.imageUrl) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Story-afbeelding ontbreekt.",
          });
        }
        await validateSocialImageForPublish({
          imageUrl: item.imageUrl,
          targetPlatforms,
          placement: "STORY",
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
      targetPlatforms,
      placement: probeFormatForPlacement(placement),
    });
  }

  return targetPlatforms;
}

export async function prepareAndValidatePostForPublish(
  db: PrismaClient,
  post: { id: string; imageUrl: string; targetPlatforms: string[]; metadata?: unknown },
  scope: { workspaceId: string; memberId: string },
  publishTarget?: Pick<
    SocialPublishTarget,
    "pageId" | "pageAccessToken" | "instagramBusinessId" | "pageTasks"
  >,
  metaConfig?: { accessToken: string; appId: string; appSecret: string },
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

  const targetPlatforms = await ensurePostCanPublish(
    {
      imageUrl: prepared.imageUrl,
      targetPlatforms: post.targetPlatforms,
      metadata: normalizedMetadata,
    },
    publishTarget,
    metaConfig,
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

  return {
    imageUrl: prepared.imageUrl,
    metadata: normalizedMetadata,
    targetPlatforms,
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

export type SocialPublishOptions = {
  failImmediately?: boolean;
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

function expectedFacebookFeedKey(metadata: z.infer<typeof socialPostMetadataSchema>) {
  const feedKind = resolveFeedPublishKind(metadata);
  if (feedKind !== "CAROUSEL") return "facebook";
  return "facebook";
}

function facebookCarouselExternalKey(index: number) {
  return index === 0 ? "facebook" : `facebookCarousel_${index + 1}`;
}

function facebookCarouselExpectedKeys(metadata: z.infer<typeof socialPostMetadataSchema>) {
  const carousel = normalizeCarousel(metadata);
  if (!carousel.slides.some((slide) => slide.mediaType === "VIDEO")) return ["facebook"];
  return carousel.slides.map((_, index) => facebookCarouselExternalKey(index));
}

function storyExternalKey(platform: "facebook" | "instagram", index: number, total: number) {
  if (total <= 1) return `${platform}Story`;
  return `${platform}Story_${index + 1}`;
}

function expectedStoryItemCount(metadata: z.infer<typeof socialPostMetadataSchema>) {
  const items = normalizeStoryItemsMetadata(metadata).filter((item) =>
    item.mediaType === "VIDEO" ? Boolean(item.videoUrl?.trim()) : Boolean(item.imageUrl?.trim()),
  );
  return Math.max(1, items.length);
}

export function expectedSocialPublishKeys(post: { targetPlatforms: string[]; metadata?: unknown }) {
  const metadata = normalizeSocialMetadata(
    (post.metadata || undefined) as z.infer<typeof socialPostMetadataSchema>,
  );
  const placements = metadata.placements || ["FEED"];
  const keys = new Set<string>();

  for (const placement of placements) {
    if (placement === "FEED") {
      const feedKind = resolveFeedPublishKind(metadata);
      if (post.targetPlatforms.includes("FACEBOOK")) {
        for (const key of feedKind === "CAROUSEL" ? facebookCarouselExpectedKeys(metadata) : [expectedFacebookFeedKey(metadata)]) {
          keys.add(key);
        }
      }
      if (post.targetPlatforms.includes("INSTAGRAM")) {
        keys.add(feedKind === "CAROUSEL" ? "instagramCarousel" : "instagram");
      }
    }

    if (placement === "STORY") {
      const storyCount = expectedStoryItemCount(metadata);
      for (let index = 0; index < storyCount; index += 1) {
        if (post.targetPlatforms.includes("FACEBOOK")) keys.add(storyExternalKey("facebook", index, storyCount));
        if (post.targetPlatforms.includes("INSTAGRAM")) keys.add(storyExternalKey("instagram", index, storyCount));
      }
    }

    if (placement === "REEL" && post.targetPlatforms.includes("INSTAGRAM")) {
      keys.add("instagramReel");
    }
  }

  return [...keys];
}

export function hasCompletedExternalPublish(
  post: { targetPlatforms: string[]; metadata?: unknown },
  externalIds: Record<string, SocialPublishedRef>,
) {
  const expectedKeys = expectedSocialPublishKeys(post);
  return expectedKeys.length > 0 && expectedKeys.every((key) => Boolean(externalIds[key]?.id?.trim()));
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

async function publishMetaStep<T>(label: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label}: ${message}`);
  }
}

async function publishFacebookCarouselSlidesAsFeedBatch(params: {
  db: PrismaClient;
  postId: string;
  pageId: string;
  pageAccessToken: string;
  caption: string;
  slides: SocialCarouselSlide[];
  externalIds: Record<string, SocialPublishedRef>;
}) {
  for (const [index, slide] of params.slides.entries()) {
    const key = facebookCarouselExternalKey(index);
    if (params.externalIds[key]) continue;

    const caption = index === 0 ? params.caption : "";
    if (slide.mediaType === "VIDEO") {
      const videoUrl = slide.videoUrl?.trim();
      if (!videoUrl) throw new Error(`Facebook multi-upload item ${index + 1}: video ontbreekt.`);
      params.externalIds[key] = await publishMetaStep(`Facebook multi-upload item ${index + 1} video`, () =>
        publishFacebookVideoPost({
          pageId: params.pageId,
          pageAccessToken: params.pageAccessToken,
          caption,
          videoUrl,
        }),
      );
      await persistPartialExternalIds(params.db, params.postId, params.externalIds);
      continue;
    }

    const imageUrl = slide.imageUrl?.trim();
    if (!imageUrl) throw new Error(`Facebook multi-upload item ${index + 1}: foto ontbreekt.`);
    params.externalIds[key] = await publishMetaStep(`Facebook multi-upload item ${index + 1} foto`, () =>
      publishFacebookImagePost({
        pageId: params.pageId,
        pageAccessToken: params.pageAccessToken,
        caption,
        imageUrl,
      }),
    );
    await persistPartialExternalIds(params.db, params.postId, params.externalIds);
  }
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

export function isSocialPublishInProgressError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /wordt al gepubliceerd|even geduld/i.test(message);
}

export async function publishSocialPostRecord(
  db: PrismaClient,
  post: SocialPostRecord,
  options?: SocialPublishOptions,
) {
  const existingExternalIds = parseStoredExternalIds(post.externalPostIds);

  if (post.status === "PUBLISHED" || hasCompletedExternalPublish(post, existingExternalIds)) {
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

  try {
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

    const prepared = await prepareAndValidatePostForPublish(db, post, scope, publishTarget, {
      accessToken: config.accessToken,
      appId: config.appId,
      appSecret: config.appSecret,
    });
    const metadata = prepared.metadata;
    const primaryImageUrl = prepared.imageUrl;
    const targetPlatforms = prepared.targetPlatforms;
    const effectivePost = { ...post, targetPlatforms };
    const instagramAccessToken = publishTarget.pageAccessToken;

    if (JSON.stringify(targetPlatforms) !== JSON.stringify(post.targetPlatforms)) {
      await db.socialPost.update({
        where: { id: post.id },
        data: { targetPlatforms },
      });
    }

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
        if (targetPlatforms.includes("FACEBOOK")) {
          const containsVideoSlides = carouselSlides.some((slide) => slide.mediaType === "VIDEO");
          if (containsVideoSlides) {
            await publishFacebookCarouselSlidesAsFeedBatch({
              db,
              postId: post.id,
              pageId: publishTarget.pageId,
              pageAccessToken: publishTarget.pageAccessToken,
              caption: publishCaption,
              slides: carouselSlides,
              externalIds,
            });
          } else if (!externalIds.facebook) {
            externalIds.facebook = await publishFacebookCarouselPost({
              pageId: publishTarget.pageId,
              pageAccessToken: publishTarget.pageAccessToken,
              caption: publishCaption,
              slides: carouselSlides,
            });
            await persistPartialExternalIds(db, post.id, externalIds);
          }
        }
        if (targetPlatforms.includes("INSTAGRAM") && !externalIds.instagramCarousel) {
          externalIds.instagramCarousel = await publishMetaStep("Instagram carousel", () =>
            publishInstagramCarouselPost({
              instagramBusinessId: publishTarget.instagramBusinessId,
              pageAccessToken: instagramAccessToken,
              caption: publishCaption,
              slides: carouselSlides,
            }),
          );
          await persistPartialExternalIds(db, post.id, externalIds);
        }
      } else if (feedKind === "VIDEO") {
        const videoUrl = assets.FEED?.videoUrl?.trim() || "";
        if (!videoUrl) throw new Error("Feed-video ontbreekt.");
        if (targetPlatforms.includes("FACEBOOK") && !externalIds.facebook) {
          externalIds.facebook = await publishMetaStep("Facebook feed video", () =>
            publishFacebookVideoPost({
              pageId: publishTarget.pageId,
              pageAccessToken: publishTarget.pageAccessToken,
              caption: publishCaption,
              videoUrl,
            }),
          );
          await persistPartialExternalIds(db, post.id, externalIds);
        }
        if (targetPlatforms.includes("INSTAGRAM") && !externalIds.instagram) {
          externalIds.instagram = await publishMetaStep("Instagram feed video", () =>
            publishInstagramVideoPost({
              instagramBusinessId: publishTarget.instagramBusinessId,
              pageAccessToken: instagramAccessToken,
              caption: publishCaption,
              videoUrl,
            }),
          );
          await persistPartialExternalIds(db, post.id, externalIds);
        }
      } else {
        if (targetPlatforms.includes("FACEBOOK") && !externalIds.facebook) {
          const imageUrl = resolvePlatformFeedImageUrl("FACEBOOK", metadata, primaryImageUrl);
          externalIds.facebook = await publishMetaStep("Facebook feed afbeelding", () =>
            publishFacebookImagePost({
              pageId: publishTarget.pageId,
              pageAccessToken: publishTarget.pageAccessToken,
              caption: publishCaption,
              imageUrl,
            }),
          );
          await persistPartialExternalIds(db, post.id, externalIds);
        }
        if (targetPlatforms.includes("INSTAGRAM") && !externalIds.instagram) {
          const imageUrl = resolvePlatformFeedImageUrl("INSTAGRAM", metadata, primaryImageUrl);
          externalIds.instagram = await publishMetaStep("Instagram feed afbeelding", () =>
            publishInstagramImagePost({
              instagramBusinessId: publishTarget.instagramBusinessId,
              pageAccessToken: instagramAccessToken,
              caption: publishCaption,
              imageUrl,
            }),
          );
          await persistPartialExternalIds(db, post.id, externalIds);
        }
      }
    }

    if (placement === "STORY") {
      const storyItems = normalizeStoryItems(metadata, primaryImageUrl);
      if (!storyItems.length) throw new Error("Story-media ontbreekt.");
      const storyPublishOrder = storyItems
        .map((item, index) => ({ item, index }))
        .reverse();
      for (const { item, index } of storyPublishOrder) {
        const facebookKey = storyExternalKey("facebook", index, storyItems.length);
        const instagramKey = storyExternalKey("instagram", index, storyItems.length);
        if (item.mediaType === "VIDEO") {
          const videoUrl = item.videoUrl?.trim();
          if (!videoUrl) throw new Error(`Story ${index + 1}: video ontbreekt.`);
          if (targetPlatforms.includes("FACEBOOK") && !externalIds[facebookKey]) {
            externalIds[facebookKey] = await publishMetaStep(`Facebook Story ${index + 1} video`, () =>
              publishFacebookVideoStory({
                pageId: publishTarget.pageId,
                pageAccessToken: publishTarget.pageAccessToken,
                videoUrl,
              }),
            );
            await persistPartialExternalIds(db, post.id, externalIds);
          }
          if (targetPlatforms.includes("INSTAGRAM") && !externalIds[instagramKey]) {
            externalIds[instagramKey] = await publishMetaStep(`Instagram Story ${index + 1} video`, () =>
              publishInstagramVideoStory({
                instagramBusinessId: publishTarget.instagramBusinessId,
                pageAccessToken: instagramAccessToken,
                videoUrl,
              }),
            );
            await persistPartialExternalIds(db, post.id, externalIds);
          }
          continue;
        }

        const imageUrl = item.imageUrl?.trim();
        if (!imageUrl) throw new Error(`Story ${index + 1}: afbeelding ontbreekt.`);
        if (targetPlatforms.includes("FACEBOOK") && !externalIds[facebookKey]) {
          externalIds[facebookKey] = await publishMetaStep(`Facebook Story ${index + 1}`, () =>
            publishFacebookImageStory({
              pageId: publishTarget.pageId,
              pageAccessToken: publishTarget.pageAccessToken,
              imageUrl,
            }),
          );
          await persistPartialExternalIds(db, post.id, externalIds);
        }
        if (targetPlatforms.includes("INSTAGRAM") && !externalIds[instagramKey]) {
          externalIds[instagramKey] = await publishMetaStep(`Instagram Story ${index + 1}`, () =>
            publishInstagramImageStory({
              instagramBusinessId: publishTarget.instagramBusinessId,
              pageAccessToken: instagramAccessToken,
              imageUrl,
            }),
          );
          await persistPartialExternalIds(db, post.id, externalIds);
        }
      }
    }

    if (placement === "REEL") {
      const videoUrl = assets.REEL?.videoUrl?.trim();
      if (!videoUrl) throw new Error("Reel-video ontbreekt.");
      if (targetPlatforms.includes("INSTAGRAM") && !externalIds.instagramReel) {
        const coverUrl = resolvePlacementImageUrl("REEL", metadata, primaryImageUrl);
        const publishCaption = buildPublishedCaption(post.caption, metadata, "REEL");
        externalIds.instagramReel = await publishMetaStep("Instagram Reel", () =>
          publishInstagramReel({
            instagramBusinessId: publishTarget.instagramBusinessId,
            pageAccessToken: instagramAccessToken,
            caption: publishCaption,
            videoUrl,
            coverUrl: coverUrl || undefined,
          }),
        );
        await persistPartialExternalIds(db, post.id, externalIds);
      }
    }
  }

    if (!hasPublishedExternally(externalIds)) {
      throw new Error("Geen Meta publicatie-ID ontvangen.");
    }
    if (!hasCompletedExternalPublish(effectivePost, externalIds)) {
      throw new Error(
        "Niet alle geselecteerde social kanalen zijn gepubliceerd. De gelukt-gepubliceerde IDs zijn bewaard; gebruik opnieuw publiceren om de ontbrekende kanalen af te werken.",
      );
    }

    return finalizePublishedPost(db, effectivePost, externalIds);
  } catch (error) {
    if (!isSocialPublishInProgressError(error)) {
      await markSocialPostPublishFailure(db, post, error, options);
    }
    throw error;
  }
}

export async function markSocialPostPublishFailure(
  db: PrismaClient,
  post: SocialPostRecord,
  error: unknown,
  options?: SocialPublishOptions,
) {
  if (isSocialPublishInProgressError(error)) return;

  const refreshed = await db.socialPost.findUnique({ where: { id: post.id } });
  if (!refreshed || refreshed.status === "PUBLISHED") return;

  const partialIds = parseStoredExternalIds(refreshed.externalPostIds);

  if (hasCompletedExternalPublish(refreshed, partialIds)) {
    await finalizePublishedPost(db, { ...post, publishedAt: refreshed.publishedAt }, partialIds);
    return;
  }

  if (refreshed.status !== "PUBLISHING") return;

  const currentRetries = Number(refreshed.retryCount ?? post.retryCount ?? 0);
  const canRetry = !options?.failImmediately && currentRetries < 3;
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

export async function recoverStuckPublishingPosts(
  db: PrismaClient,
  options?: { postId?: string; maxAgeMs?: number },
) {
  const maxAgeMs = options?.maxAgeMs ?? 10 * 60 * 1000;
  const stuckThreshold = new Date(Date.now() - maxAgeMs);
  const where: Record<string, unknown> = {
    status: "PUBLISHING",
    updatedAt: { lt: stuckThreshold },
  };
  if (options?.postId) where.id = options.postId;

  const stuckPosts = await db.socialPost.findMany({
    where,
    take: options?.postId ? 1 : 50,
  });

  for (const stuck of stuckPosts) {
    const partialIds = parseStoredExternalIds(stuck.externalPostIds);
    if (hasCompletedExternalPublish(stuck, partialIds)) {
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
  options?: { postId?: string; workspaceId?: string; failImmediately?: boolean },
) {
  const now = new Date();

  await recoverStuckPublishingPosts(db);

  const where: Record<string, unknown> = options?.postId
    ? { id: options.postId, status: { in: ["SCHEDULED", "FAILED"] } }
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
      await publishSocialPostRecord(db, post, { failImmediately: options?.failImmediately });
      published += 1;
    } catch (error) {
      if (isSocialPublishInProgressError(error)) {
        skipped += 1;
        continue;
      }
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
