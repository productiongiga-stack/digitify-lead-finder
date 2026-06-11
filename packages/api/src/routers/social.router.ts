import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@digitify/db";
import { OpenClawClient } from "@digitify/openclaw";
import { z } from "zod";
import { adminProcedure, protectedProcedure, aiRateLimitedProcedure, router, mutationProcedure } from "../trpc";
import { loadAiProviderConfig } from "../lib/ai-provider-config";
import { probeSocialImage, validateSocialImageForPublish, validateSocialVideoForPublish } from "../lib/social-image";
import { prepareSocialPostAssetsForPublish } from "../lib/social-prepare-assets";
import {
  clearMetaSettings,
  loadMetaManagedPages,
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
  resolveMetaOAuthScopeSummary,
  resolveSocialPublishTarget,
  type SocialPublishedRef,
  upsertMetaSettings,
  verifyFacebookPublishedPost,
  verifyInstagramPublishedMedia,
  workspaceScopeFromAuthenticatedUser,
} from "../lib/social-meta";
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
  resolvePrimaryImageUrl,
  type SocialCarouselSlide,
  type SocialPlacement,
} from "../lib/social-placements";
import {
  deleteSocialBrandKit,
  getSocialBrandKitById,
  listSocialBrandKits,
  setDefaultSocialBrandKit,
  upsertSocialBrandKit,
} from "../lib/social-brand-kits";

const SOCIAL_PLATFORM = ["FACEBOOK", "INSTAGRAM"] as const;
const SOCIAL_STATUS = [
  "DRAFT",
  "PENDING_APPROVAL",
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED",
  "CANCELLED",
] as const;

const socialPlatformEnum = z.enum(SOCIAL_PLATFORM);
const socialStatusEnum = z.enum(SOCIAL_STATUS);
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

const socialPostMetadataSchema = z
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

const listInputSchema = z
  .object({
    status: socialStatusEnum.optional(),
    page: z.number().min(1).default(1),
    pageSize: z.number().min(1).max(100).default(25),
  })
  .optional();

function ensureWorkspaceAccess(post: { createdById: string }, workspaceId: string) {
  if (post.createdById !== workspaceId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Geen toegang tot deze social post." });
  }
}

function computeRetryDelayMs(retryCount: number) {
  const baseMs = 5 * 60 * 1000;
  return baseMs * 2 ** Math.max(0, retryCount);
}

function ensureSchedulableStatus(status: string) {
  if (!["PENDING_APPROVAL", "DRAFT", "FAILED"].includes(status)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Post met status ${status} kan niet ingepland worden.`,
    });
  }
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

function normalizeSocialMetadata(metadata?: z.infer<typeof socialPostMetadataSchema>) {
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

async function prepareAndValidatePostForPublish(
  socialDb: any,
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
    await socialDb.socialPost.update({
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

async function resolvePostPublishTarget(
  db: PrismaClient,
  scope: { workspaceId: string; memberId: string },
  metadata?: unknown,
) {
  const config = await loadMetaWorkspaceConfig(db, scope);
  const normalized = normalizeSocialMetadata((metadata || undefined) as z.infer<typeof socialPostMetadataSchema>);
  try {
    return await resolveSocialPublishTarget({
      config,
      publisherPageId: normalized.publisherPageId,
    });
  } catch (error) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: error instanceof Error ? error.message : "Publicatie-account kon niet worden opgelost.",
    });
  }
}

async function createSocialActivity(
  db: PrismaClient,
  input: { userId: string; type: string; title: string; metadata?: Record<string, unknown> },
) {
  await (db as any).activity
    .create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        metadata: input.metadata || {},
      },
    })
    .catch(() => null);
}

async function renderCaptionSuggestion(
  db: PrismaClient,
  workspaceId: string,
  input: { template: string; campaignName?: string; tone?: string; brandKitId?: string },
) {
  const template = input.template.trim();
  const brandKit = await getSocialBrandKitById(db, workspaceId, input.brandKitId);
  const tone = input.tone?.trim() || brandKit?.defaultTone?.trim() || brandKit?.brandVoice?.trim() || "professioneel";
  const campaignHint = input.campaignName ? `Campagne: ${input.campaignName}.` : "";
  const brandHints = [
    brandKit?.companyName ? `Merk: ${brandKit.companyName}.` : "",
    brandKit?.brandSummary ? `Merkcontext: ${brandKit.brandSummary}.` : "",
    brandKit?.brandKeywords ? `Keywords: ${brandKit.brandKeywords}.` : "",
    brandKit?.brandAvoid ? `Vermijd: ${brandKit.brandAvoid}.` : "",
    brandKit?.defaultCta ? `Voorkeur-CTA: ${brandKit.defaultCta}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const fallback = `${template}\n\n#marketing #digitalegroei`;
  const { provider, model, apiKey } = await loadAiProviderConfig(db, workspaceId);
  if (!apiKey) {
    return { caption: fallback, provider: "fallback", model: "none" };
  }

  const client = new OpenClawClient({ provider, model, apiKey, maxTokens: 300 });
  const response = await client.chat(
    [
      {
        role: "user",
        content:
          `Maak een social caption in het Nederlands (max 180 woorden). ${campaignHint} ${brandHints} Toon een heldere CTA en behoud de templateboodschap. Toon enkel de caption, zonder extra uitleg.\n\nTemplate:\n${template}\n\nTone of voice: ${tone}`,
      },
    ],
    {
      currentPage: "/social",
      settings: {
        aggressiveness: "balanced",
        tone,
        language: "nl",
        companyName: brandKit?.companyName?.trim() || "Digitify",
      },
    },
  );

  return {
    caption: (response || fallback).trim(),
    provider,
    model,
  };
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
  status?: string;
  externalPostIds?: unknown;
  publishedAt?: Date | string | null;
};

function parseStoredExternalIds(raw: unknown): Record<string, SocialPublishedRef> {
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

function hasPublishedExternally(externalIds: Record<string, SocialPublishedRef>) {
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
  socialDb: { socialPost: { update: (...args: unknown[]) => Promise<unknown> } },
  postId: string,
  externalIds: Record<string, SocialPublishedRef>,
) {
  await socialDb.socialPost.update({
    where: { id: postId },
    data: { externalPostIds: externalIds },
  });
}

async function finalizePublishedPost(
  db: PrismaClient,
  post: SocialPostRecord,
  externalIds: Record<string, SocialPublishedRef>,
) {
  const socialDb = db as any;
  const normalized = normalizePublishedRefs(externalIds);

  await socialDb.socialPost.update({
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

async function acquirePublishLock(socialDb: any, postId: string) {
  const result = await socialDb.socialPost.updateMany({
    where: {
      id: postId,
      status: { in: ["SCHEDULED", "FAILED"] },
    },
    data: {
      status: "PUBLISHING",
      lastError: null,
    },
  });

  return Number(result.count || 0) === 1;
}

async function publishSocialPostRecord(db: PrismaClient, post: SocialPostRecord) {
  const socialDb = db as any;
  const existingExternalIds = parseStoredExternalIds(post.externalPostIds);

  if (post.status === "PUBLISHED" || hasPublishedExternally(existingExternalIds)) {
    return finalizePublishedPost(db, post, existingExternalIds);
  }

  const locked = await acquirePublishLock(socialDb, post.id);
  if (!locked) {
    const current = await socialDb.socialPost.findUnique({ where: { id: post.id } });
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

  const prepared = await prepareAndValidatePostForPublish(
    socialDb,
    post,
    scope,
    publishTarget,
  );
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
          await persistPartialExternalIds(socialDb, post.id, externalIds);
        }
        if (post.targetPlatforms.includes("INSTAGRAM") && !externalIds.instagramCarousel) {
          externalIds.instagramCarousel = await publishInstagramCarouselPost({
            instagramBusinessId: publishTarget.instagramBusinessId,
            pageAccessToken: publishTarget.pageAccessToken,
            caption: publishCaption,
            slides: carouselSlides,
          });
          await persistPartialExternalIds(socialDb, post.id, externalIds);
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
          await persistPartialExternalIds(socialDb, post.id, externalIds);
        }
        if (post.targetPlatforms.includes("INSTAGRAM") && !externalIds.instagram) {
          externalIds.instagram = await publishInstagramVideoPost({
            instagramBusinessId: publishTarget.instagramBusinessId,
            pageAccessToken: publishTarget.pageAccessToken,
            caption: publishCaption,
            videoUrl,
          });
          await persistPartialExternalIds(socialDb, post.id, externalIds);
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
          await persistPartialExternalIds(socialDb, post.id, externalIds);
        }
        if (post.targetPlatforms.includes("INSTAGRAM") && !externalIds.instagram) {
          externalIds.instagram = await publishInstagramImagePost({
            instagramBusinessId: publishTarget.instagramBusinessId,
            pageAccessToken: publishTarget.pageAccessToken,
            caption: publishCaption,
            imageUrl,
          });
          await persistPartialExternalIds(socialDb, post.id, externalIds);
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
        await persistPartialExternalIds(socialDb, post.id, externalIds);
      }
      if (post.targetPlatforms.includes("INSTAGRAM") && !externalIds.instagramStory) {
        externalIds.instagramStory = await publishInstagramImageStory({
          instagramBusinessId: publishTarget.instagramBusinessId,
          pageAccessToken: publishTarget.pageAccessToken,
          imageUrl,
        });
        await persistPartialExternalIds(socialDb, post.id, externalIds);
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
        await persistPartialExternalIds(socialDb, post.id, externalIds);
      }
    }
  }

  if (!hasPublishedExternally(externalIds)) {
    throw new Error("Geen Meta publicatie-ID ontvangen.");
  }

  return finalizePublishedPost(db, post, externalIds);
}

async function markSocialPostPublishFailure(db: PrismaClient, post: SocialPostRecord, error: unknown) {
  const socialDb = db as any;
  const refreshed = await socialDb.socialPost.findUnique({ where: { id: post.id } });
  const partialIds = parseStoredExternalIds(refreshed?.externalPostIds);

  if (hasPublishedExternally(partialIds)) {
    await finalizePublishedPost(db, { ...post, publishedAt: refreshed?.publishedAt }, partialIds);
    return;
  }

  const currentRetries = Number(post.retryCount || 0);
  const canRetry = currentRetries < 3;
  const nextRetryAt = canRetry ? new Date(Date.now() + computeRetryDelayMs(currentRetries)) : null;
  const message = error instanceof Error ? error.message : "Onbekende publicatiefout";

  await socialDb.socialPost.update({
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

async function recoverStuckPublishingPosts(db: PrismaClient) {
  const socialDb = db as any;
  const stuckThreshold = new Date(Date.now() - 10 * 60 * 1000);
  const stuckPosts = await socialDb.socialPost.findMany({
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

    await socialDb.socialPost.update({
      where: { id: stuck.id },
      data: {
        status: "FAILED",
        lastError: "Publicatie onderbroken. Controleer Meta of gebruik opnieuw publiceren.",
      },
    });
  }
}

export async function runDueSocialPostsWorker(db: PrismaClient, options?: { postId?: string }) {
  const now = new Date();
  const socialDb = db as any;

  await recoverStuckPublishingPosts(db);

  const duePosts = await socialDb.socialPost.findMany({
    where: options?.postId
      ? { id: options.postId, status: { in: ["SCHEDULED", "PUBLISHING"] } }
      : {
          status: "SCHEDULED",
          scheduledFor: { lte: now },
        },
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

export const socialRouter = router({
  list: protectedProcedure.input(listInputSchema).query(async ({ ctx, input }) => {
    const workspaceId = ctx.user.workspaceId!;
    const page = input?.page ?? 1;
    const pageSize = input?.pageSize ?? 25;
    const where: Record<string, unknown> = { createdById: workspaceId };
    if (input?.status) where.status = input.status;

    const socialDb = ctx.db as any;
    const [items, total] = await Promise.all([
      socialDb.socialPost.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      socialDb.socialPost.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }),

  getAgenda: protectedProcedure
    .input(
      z.object({
        from: z.coerce.date(),
        to: z.coerce.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      const socialDb = ctx.db as any;

      const [scheduled, unscheduled] = await Promise.all([
        socialDb.socialPost.findMany({
          where: {
            createdById: workspaceId,
            OR: [
              { scheduledFor: { gte: input.from, lte: input.to } },
              { publishedAt: { gte: input.from, lte: input.to } },
            ],
          },
          orderBy: [{ scheduledFor: "asc" }, { publishedAt: "asc" }],
        }),
        socialDb.socialPost.findMany({
          where: {
            createdById: workspaceId,
            scheduledFor: null,
            status: { in: ["DRAFT", "PENDING_APPROVAL", "FAILED"] },
          },
          orderBy: { updatedAt: "desc" },
          take: 50,
        }),
      ]);

      return {
        items: scheduled,
        unscheduled,
        from: input.from.toISOString(),
        to: input.to.toISOString(),
      };
    }),

  reschedulePost: adminProcedure
    .input(
      z.object({
        id: z.string(),
        scheduledFor: z.coerce.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.scheduledFor.getTime() < Date.now() - 30_000) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Geplande tijd moet in de toekomst liggen." });
      }

      const socialDb = ctx.db as any;
      const row = await socialDb.socialPost.findUnique({ where: { id: input.id } });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Social post niet gevonden." });
      ensureWorkspaceAccess(row, ctx.user.workspaceId!);
      if (row.status !== "SCHEDULED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Alleen ingeplande posts kunnen verplaatst worden.",
        });
      }

      const updated = await socialDb.socialPost.update({
        where: { id: input.id },
        data: { scheduledFor: input.scheduledFor },
      });

      await createSocialActivity(ctx.db, {
        userId: ctx.user.id,
        type: "SOCIAL_POST_RESCHEDULED",
        title: "Social post opnieuw ingepland",
        metadata: { socialPostId: input.id, scheduledFor: input.scheduledFor.toISOString() },
      });

      return updated;
    }),

  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const row = await (ctx.db as any).socialPost.findUnique({ where: { id: input.id } });
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Social post niet gevonden." });
    ensureWorkspaceAccess(row, ctx.user.workspaceId!);
    return row;
  }),

  probeImage: protectedProcedure
    .input(
      z.object({
        imageUrl: z
          .string()
          .trim()
          .max(12_000)
          .url()
          .refine((value) => /^https:\/\//i.test(value), {
            message: "Gebruik een publieke https-URL.",
          }),
        postFormat: socialPostFormatEnum.optional(),
      }),
    )
    .query(async ({ input }) => {
      return probeSocialImage(input.imageUrl);
    }),

  createDraft: mutationProcedure
    .input(
      z.object({
        caption: z.string().min(1).max(6000),
        imageUrl: socialImageUrlSchema,
        targetPlatforms: z.array(socialPlatformEnum).min(1).max(2).default(["FACEBOOK", "INSTAGRAM"]),
        metadata: socialPostMetadataSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const metadata = normalizeSocialMetadata(input.metadata);
      const primaryImage = resolvePrimaryImageUrl(metadata, input.imageUrl.trim()) || input.imageUrl.trim();
      const row = await (ctx.db as any).socialPost.create({
        data: {
          createdById: ctx.user.workspaceId!,
          caption: input.caption.trim(),
          imageUrl: primaryImage,
          targetPlatforms: input.targetPlatforms,
          metadata,
          status: "DRAFT",
        },
      });

      await createSocialActivity(ctx.db, {
        userId: ctx.user.id,
        type: "SOCIAL_POST_CREATED",
        title: "Social draft aangemaakt",
        metadata: { socialPostId: row.id },
      });

      return row;
    }),

  updateDraft: mutationProcedure
    .input(
      z.object({
        id: z.string(),
        caption: z.string().min(1).max(6000).optional(),
        imageUrl: socialImageUrlSchema.optional(),
        targetPlatforms: z.array(socialPlatformEnum).min(1).max(2).optional(),
        metadata: socialPostMetadataSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const socialDb = ctx.db as any;
      const row = await socialDb.socialPost.findUnique({ where: { id: input.id } });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Social post niet gevonden." });
      ensureWorkspaceAccess(row, ctx.user.workspaceId!);
      if (!["DRAFT", "FAILED", "CANCELLED"].includes(row.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Alleen drafts, failed of cancelled posts kunnen aangepast worden.",
        });
      }

      const metadata = input.metadata === undefined ? undefined : normalizeSocialMetadata(input.metadata);
      const nextImageUrl =
        metadata && input.imageUrl !== undefined
          ? resolvePrimaryImageUrl(metadata, input.imageUrl.trim()) || input.imageUrl.trim()
          : input.imageUrl?.trim();

      return socialDb.socialPost.update({
        where: { id: input.id },
        data: {
          caption: input.caption?.trim(),
          imageUrl: nextImageUrl,
          targetPlatforms: input.targetPlatforms,
          metadata,
          status: "DRAFT",
          lastError: null,
        },
      });
    }),

  updateQueuedPost: mutationProcedure
    .input(
      z.object({
        id: z.string(),
        caption: z.string().min(1).max(6000).optional(),
        imageUrl: socialImageUrlSchema.optional(),
        targetPlatforms: z.array(socialPlatformEnum).min(1).max(2).optional(),
        metadata: socialPostMetadataSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const socialDb = ctx.db as any;
      const row = await socialDb.socialPost.findUnique({ where: { id: input.id } });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Social post niet gevonden." });
      ensureWorkspaceAccess(row, ctx.user.workspaceId!);

      if (!["SCHEDULED", "PENDING_APPROVAL"].includes(row.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Alleen ingeplande of wachtende posts kunnen bewerkt worden.",
        });
      }

      if (hasPublishedExternally(parseStoredExternalIds(row.externalPostIds))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Deze post is al live op Meta en kan niet meer bewerkt worden.",
        });
      }

      const metadata = input.metadata === undefined ? undefined : normalizeSocialMetadata(input.metadata);
      const nextImageUrl =
        metadata && input.imageUrl !== undefined
          ? resolvePrimaryImageUrl(metadata, input.imageUrl.trim()) || input.imageUrl.trim()
          : input.imageUrl?.trim();

      const updated = await socialDb.socialPost.update({
        where: { id: input.id },
        data: {
          caption: input.caption?.trim(),
          imageUrl: nextImageUrl,
          targetPlatforms: input.targetPlatforms,
          metadata,
          lastError: null,
        },
      });

      return updated;
    }),

  submitForApproval: mutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const socialDb = ctx.db as any;
      const row = await socialDb.socialPost.findUnique({ where: { id: input.id } });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Social post niet gevonden." });
      ensureWorkspaceAccess(row, ctx.user.workspaceId!);
      if (!["DRAFT", "FAILED", "CANCELLED"].includes(row.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Deze post kan niet ter goedkeuring worden aangeboden." });
      }
      const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
      const publishTarget = await resolvePostPublishTarget(ctx.db, scope, row.metadata);
      await prepareAndValidatePostForPublish(
        socialDb,
        row,
        scope,
        publishTarget,
      );

      const updated = await socialDb.socialPost.update({
        where: { id: input.id },
        data: { status: "PENDING_APPROVAL", lastError: null },
      });

      await createSocialActivity(ctx.db, {
        userId: ctx.user.id,
        type: "SOCIAL_POST_SUBMITTED",
        title: "Social post wacht op goedkeuring",
        metadata: { socialPostId: input.id },
      });

      return updated;
    }),

  approveAndSchedule: adminProcedure
    .input(
      z.object({
        id: z.string(),
        scheduledFor: z.coerce.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.scheduledFor.getTime() < Date.now() - 30_000) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Geplande tijd moet in de toekomst liggen." });
      }

      const socialDb = ctx.db as any;
      const row = await socialDb.socialPost.findUnique({ where: { id: input.id } });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Social post niet gevonden." });
      ensureWorkspaceAccess(row, ctx.user.workspaceId!);

      if (row.status === "SCHEDULED") {
        const updated = await socialDb.socialPost.update({
          where: { id: input.id },
          data: { scheduledFor: input.scheduledFor },
        });

        await createSocialActivity(ctx.db, {
          userId: ctx.user.id,
          type: "SOCIAL_POST_RESCHEDULED",
          title: "Social post opnieuw ingepland",
          metadata: { socialPostId: input.id, scheduledFor: input.scheduledFor.toISOString() },
        });

        return updated;
      }

      ensureSchedulableStatus(row.status);
      const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
      const publishTarget = await resolvePostPublishTarget(ctx.db, scope, row.metadata);
      await prepareAndValidatePostForPublish(
        socialDb,
        row,
        scope,
        publishTarget,
      );

      const updated = await socialDb.socialPost.update({
        where: { id: input.id },
        data: {
          status: "SCHEDULED",
          scheduledFor: input.scheduledFor,
          approvedById: ctx.user.id,
          approvedAt: new Date(),
          lastError: null,
          retryCount: 0,
        },
      });

      await createSocialActivity(ctx.db, {
        userId: ctx.user.id,
        type: "SOCIAL_POST_APPROVED",
        title: "Social post goedgekeurd en ingepland",
        metadata: { socialPostId: input.id, scheduledFor: input.scheduledFor.toISOString() },
      });

      if (input.scheduledFor.getTime() <= Date.now() + 2 * 60 * 1000) {
        void runDueSocialPostsWorker(ctx.db, { postId: input.id }).catch(() => null);
      }

      return updated;
    }),

  reject: adminProcedure
    .input(
      z.object({
        id: z.string(),
        reason: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const socialDb = ctx.db as any;
      const row = await socialDb.socialPost.findUnique({ where: { id: input.id } });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Social post niet gevonden." });
      ensureWorkspaceAccess(row, ctx.user.workspaceId!);

      const reason = input.reason?.trim();
      const updated = await socialDb.socialPost.update({
        where: { id: input.id },
        data: {
          status: "DRAFT",
          scheduledFor: null,
          lastError: reason ? `Afgekeurd: ${reason}` : "Afgekeurd",
          approvedById: null,
          approvedAt: null,
        },
      });

      await createSocialActivity(ctx.db, {
        userId: ctx.user.id,
        type: "SOCIAL_POST_REJECTED",
        title: "Social post afgekeurd",
        metadata: { socialPostId: input.id, reason: reason || null },
      });

      return updated;
    }),

  retryFailed: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const socialDb = ctx.db as any;
      const row = await socialDb.socialPost.findUnique({ where: { id: input.id } });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Social post niet gevonden." });
      ensureWorkspaceAccess(row, ctx.user.workspaceId!);
      if (row.status !== "FAILED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Alleen FAILED posts kunnen opnieuw ingepland worden." });
      }

      if (hasPublishedExternally(parseStoredExternalIds(row.externalPostIds))) {
        return finalizePublishedPost(ctx.db, row, parseStoredExternalIds(row.externalPostIds));
      }

      return socialDb.socialPost.update({
        where: { id: input.id },
        data: {
          status: "SCHEDULED",
          scheduledFor: new Date(Date.now() + 2 * 60 * 1000),
          lastError: null,
          retryCount: 0,
        },
      });
    }),

  cancelScheduled: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const socialDb = ctx.db as any;
      const row = await socialDb.socialPost.findUnique({ where: { id: input.id } });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Social post niet gevonden." });
      ensureWorkspaceAccess(row, ctx.user.workspaceId!);
      if (!["SCHEDULED", "PENDING_APPROVAL"].includes(row.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Alleen pending/scheduled posts kunnen geannuleerd worden." });
      }

      return socialDb.socialPost.update({
        where: { id: input.id },
        data: { status: "CANCELLED", scheduledFor: null },
      });
    }),

  generateSuggestion: aiRateLimitedProcedure
    .input(
      z.object({
        template: z.string().min(1).max(3000),
        campaignId: z.string().optional(),
        tone: z.string().max(60).optional(),
        brandKitId: z.string().max(80).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let campaignName = "";
      if (input.campaignId) {
        const row = await (ctx.db as any).campaign.findFirst({
          where: { id: input.campaignId, createdById: ctx.user.workspaceId! },
          select: { name: true },
        });
        campaignName = row?.name || "";
      }

      return renderCaptionSuggestion(ctx.db, ctx.user.workspaceId!, {
        template: input.template,
        campaignName,
        tone: input.tone,
        brandKitId: input.brandKitId,
      });
    }),

  listBrandKits: protectedProcedure.query(async ({ ctx }) =>
    listSocialBrandKits(ctx.db, ctx.user.workspaceId!),
  ),

  upsertBrandKit: mutationProcedure
    .input(
      z.object({
        id: z.string().max(80).optional(),
        name: z.string().min(1).max(120),
        companyName: z.string().max(160).optional(),
        slogan: z.string().max(200).optional(),
        primaryColor: z.string().max(32).optional(),
        logoUrl: z.string().max(500).optional(),
        website: z.string().max(500).optional(),
        brandVoice: z.string().max(500).optional(),
        brandKeywords: z.string().max(500).optional(),
        brandAvoid: z.string().max(500).optional(),
        brandSummary: z.string().max(2000).optional(),
        brandSignature: z.string().max(240).optional(),
        defaultHashtags: z.string().max(500).optional(),
        defaultTone: z.string().max(80).optional(),
        defaultCta: z.string().max(160).optional(),
        defaultLinkUrl: z.string().max(500).optional(),
        includeLogo: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => upsertSocialBrandKit(ctx.db, ctx.user.workspaceId!, input)),

  deleteBrandKit: mutationProcedure
    .input(z.object({ id: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => deleteSocialBrandKit(ctx.db, ctx.user.workspaceId!, input.id)),

  setDefaultBrandKit: mutationProcedure
    .input(z.object({ id: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => setDefaultSocialBrandKit(ctx.db, ctx.user.workspaceId!, input.id)),

  listManagedPages: protectedProcedure.query(async ({ ctx }) => {
    const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    const config = await loadMetaWorkspaceConfig(ctx.db, scope);
    if (!config.accessToken) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Koppel Meta eerst via Integraties." });
    }

    const pages = await loadMetaManagedPages(config.accessToken);
    const selectedPage = pages.find((page) => page.id === config.pageId) || null;

    return {
      pages,
      selectedPageId: config.pageId || null,
      selectedPageName: selectedPage?.name || null,
      selectedInstagramUsername: selectedPage?.instagramUsername || null,
    };
  }),

  selectPublishingPage: adminProcedure
    .input(
      z.object({
        pageId: z.string().min(1),
        pageName: z.string().max(160).optional(),
        pageAccessToken: z.string().min(1),
        instagramBusinessId: z.string().optional(),
        instagramUsername: z.string().max(80).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
      await upsertMetaSettings(ctx.db, scope, [
        { key: "social.meta_page_id", value: input.pageId },
        { key: "social.meta_page_access_token", value: input.pageAccessToken },
        { key: "social.meta_instagram_business_id", value: input.instagramBusinessId || "" },
      ]);

      return {
        pageId: input.pageId,
        pageName: input.pageName || null,
        instagramBusinessId: input.instagramBusinessId || null,
        instagramUsername: input.instagramUsername || null,
      };
    }),

  connectionStatus: protectedProcedure.query(async ({ ctx }) => {
    const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    const config = await loadMetaWorkspaceConfig(ctx.db, scope);
    const oauthScopes = resolveMetaOAuthScopeSummary();
    let pageName: string | null = null;
    let instagramUsername: string | null = null;

    if (config.accessToken && config.pageId) {
      const pages = await loadMetaManagedPages(config.accessToken).catch(() => []);
      const selectedPage = pages.find((page) => page.id === config.pageId);
      pageName = selectedPage?.name || null;
      instagramUsername = selectedPage?.instagramUsername || null;
    }

    return {
      hasAppCredentials: Boolean(config.appId && config.appSecret),
      connected: Boolean(config.pageId && config.pageAccessToken),
      pageId: config.pageId || null,
      pageName,
      instagramBusinessId: config.instagramBusinessId || null,
      instagramUsername,
      autopostEnabled: config.autopostEnabled,
      tokenExpiresAt: config.tokenExpiresAt || null,
      oauthLoginMode: oauthScopes.loginMode,
      oauthScopeLevel: oauthScopes.scopeLevel,
      oauthScopes: oauthScopes.scopes,
      oauthIncludeAds: oauthScopes.includeAds,
      oauthScopesOverridden: oauthScopes.overridden,
      oauthUsesLegacyEnvOverride: oauthScopes.usesLegacyEnvOverride,
      oauthHasDeprecatedScopes: oauthScopes.hasDeprecatedInstagramBusinessScopes,
    };
  }),

  publishDuePosts: adminProcedure.mutation(async ({ ctx }) => runDueSocialPostsWorker(ctx.db)),

  publishPostNow: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const socialDb = ctx.db as any;
      const row = await socialDb.socialPost.findUnique({ where: { id: input.id } });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Social post niet gevonden." });
      ensureWorkspaceAccess(row, ctx.user.workspaceId!);

      if (row.status === "PUBLISHED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Deze post is al live op Meta.",
        });
      }

      if (row.status === "PUBLISHING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Deze post wordt al gepubliceerd. Even geduld.",
        });
      }

      if (hasPublishedExternally(parseStoredExternalIds(row.externalPostIds))) {
        return finalizePublishedPost(ctx.db, row, parseStoredExternalIds(row.externalPostIds));
      }

      if (!["SCHEDULED", "FAILED"].includes(row.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Alleen ingeplande of mislukte posts kunnen nu gepubliceerd worden.",
        });
      }

      if (row.status === "SCHEDULED") {
        await socialDb.socialPost.update({
          where: { id: input.id },
          data: { scheduledFor: new Date() },
        });
      } else {
        await socialDb.socialPost.update({
          where: { id: input.id },
          data: { status: "SCHEDULED", scheduledFor: new Date(), lastError: null },
        });
      }

      const summary = await runDueSocialPostsWorker(ctx.db, { postId: input.id });
      const refreshed = await socialDb.socialPost.findUnique({ where: { id: input.id } });

      if (refreshed?.status === "PUBLISHED") {
        return refreshed;
      }

      if (summary.published === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: refreshed?.lastError || "Publicatie naar Meta is niet gelukt.",
        });
      }

      return refreshed;
    }),

  verifyPostOnMeta: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const socialDb = ctx.db as any;
      const row = await socialDb.socialPost.findUnique({ where: { id: input.id } });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Social post niet gevonden." });
      ensureWorkspaceAccess(row, ctx.user.workspaceId!);

      if (row.status !== "PUBLISHED") {
        return { status: row.status, verified: false, links: [] as Array<{ key: string; url: string; verified: boolean }> };
      }

      const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
      const config = await loadMetaWorkspaceConfig(ctx.db, scope);
      const metadata = normalizeSocialMetadata(row.metadata);
      const publishTarget = await resolveSocialPublishTarget({
        config,
        publisherPageId: metadata.publisherPageId,
      });

      const externalPostIds = (row.externalPostIds || {}) as Record<string, SocialPublishedRef | string>;
      const links: Array<{ key: string; url: string; verified: boolean }> = [];

      for (const [key, value] of Object.entries(externalPostIds)) {
        const ref =
          typeof value === "string"
            ? { id: value, verified: false }
            : { id: value.id, permalink: value.permalink, verified: value.verified };

        if (!ref.id) continue;

        try {
          if (key.startsWith("facebook")) {
            const verified = await verifyFacebookPublishedPost({
              postId: ref.id,
              pageAccessToken: publishTarget.pageAccessToken,
            });
            links.push({
              key,
              url: verified.permalink || ref.permalink || "",
              verified: verified.verified,
            });
          } else if (key.startsWith("instagram")) {
            const verified = await verifyInstagramPublishedMedia({
              mediaId: ref.id,
              pageAccessToken: publishTarget.pageAccessToken,
            });
            links.push({
              key,
              url: verified.permalink || ref.permalink || "",
              verified: verified.verified,
            });
          }
        } catch {
          links.push({ key, url: ref.permalink || "", verified: false });
        }
      }

      return {
        status: row.status,
        verified: links.length > 0 && links.every((link) => link.verified),
        links,
        publishedAt: row.publishedAt,
      };
    }),

  disconnect: adminProcedure.mutation(async ({ ctx }) => {
    const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    await clearMetaSettings(ctx.db, scope);

    await createSocialActivity(ctx.db, {
      userId: ctx.user.id,
      type: "LEAD_UPDATED",
      title: "Meta koppeling verwijderd",
      metadata: { source: "social.disconnect" },
    });

    return { success: true };
  }),
});
