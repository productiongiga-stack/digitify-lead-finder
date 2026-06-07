import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@digitify/db";
import { OpenClawClient } from "@digitify/openclaw";
import { z } from "zod";
import { adminProcedure, protectedProcedure, aiRateLimitedProcedure, router, mutationProcedure } from "../trpc";
import { loadAiProviderConfig } from "../lib/ai-provider-config";
import { probeSocialImage, validateSocialImageForPublish } from "../lib/social-image";
import {
  clearMetaSettings,
  loadMetaWorkspaceConfig,
  publishFacebookImagePost,
  publishFacebookImageStory,
  publishInstagramImagePost,
  publishInstagramImageStory,
  publishInstagramReel,
  resolveMetaOAuthScopeSummary,
  workspaceScopeFromAuthenticatedUser,
} from "../lib/social-meta";
import {
  normalizeFeedFormat,
  normalizePlacementAssets,
  normalizePlacements,
  probeFormatForPlacement,
  resolvePlacementImageUrl,
  resolvePrimaryImageUrl,
  type SocialPlacement,
} from "../lib/social-placements";

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

const socialPostMetadataSchema = z
  .object({
    headline: z.string().max(160).optional(),
    cta: z.string().max(160).optional(),
    hashtags: z.string().max(500).optional(),
    linkUrl: z.union([z.string().url(), z.literal("")]).optional(),
    firstComment: z.string().max(1000).optional(),
    altText: z.string().max(500).optional(),
    brandSignature: z.string().max(240).optional(),
    postFormat: socialPostFormatEnum.default("SQUARE").optional(),
    placements: z.array(socialPlacementEnum).min(1).max(3).optional(),
    feedFormat: socialFeedFormatEnum.optional(),
    assets: z
      .object({
        FEED: socialPlacementAssetSchema.optional(),
        STORY: socialPlacementAssetSchema.optional(),
        REEL: socialPlacementAssetSchema.optional(),
      })
      .optional(),
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
  return {
    headline: cleanOptionalText(metadata.headline),
    cta: cleanOptionalText(metadata.cta),
    hashtags: normalizeHashtags(metadata.hashtags) || undefined,
    linkUrl: cleanOptionalText(metadata.linkUrl),
    firstComment: cleanOptionalText(metadata.firstComment),
    altText: cleanOptionalText(metadata.altText),
    brandSignature: cleanOptionalText(metadata.brandSignature),
    postFormat: metadata.postFormat || feedFormat,
    placements,
    feedFormat,
    assets,
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

async function ensurePostCanPublish(post: { imageUrl: string; targetPlatforms: string[]; metadata?: unknown }) {
  const metadata = normalizeSocialMetadata((post.metadata || undefined) as z.infer<typeof socialPostMetadataSchema>);
  const placements = metadata.placements || ["FEED"];
  const assets = metadata.assets || normalizePlacementAssets(metadata);

  if (!placements.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Kies minstens één publicatietype (Feed, Story of Reel)." });
  }

  if (placements.includes("REEL") && !post.targetPlatforms.includes("INSTAGRAM")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Reels worden alleen naar Instagram gepubliceerd. Schakel Instagram in of verwijder Reel.",
    });
  }

  for (const placement of placements) {
    if (placement === "REEL") {
      const videoUrl = assets.REEL?.videoUrl?.trim();
      if (!videoUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Reel vereist een publieke MP4-video-URL.",
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
  input: { template: string; campaignName?: string; tone?: string },
) {
  const template = input.template.trim();
  const tone = input.tone?.trim() || "professioneel";
  const campaignHint = input.campaignName ? `Campagne: ${input.campaignName}.` : "";

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
          `Maak een social caption in het Nederlands (max 180 woorden). ${campaignHint} Toon een heldere CTA en behoud de templateboodschap. Toon enkel de caption, zonder extra uitleg.\n\nTemplate:\n${template}\n\nTone of voice: ${tone}`,
      },
    ],
    {
      currentPage: "/social",
      settings: {
        aggressiveness: "balanced",
        tone,
        language: "nl",
        companyName: "Digitify",
      },
    },
  );

  return {
    caption: (response || fallback).trim(),
    provider,
    model,
  };
}

export async function runDueSocialPostsWorker(db: PrismaClient) {
  const now = new Date();
  const socialDb = db as any;
  const duePosts = await socialDb.socialPost.findMany({
    where: {
      status: "SCHEDULED",
      scheduledFor: { lte: now },
    },
    orderBy: { scheduledFor: "asc" },
    take: 100,
  });

  let published = 0;
  let failed = 0;
  let skipped = 0;

  for (const post of duePosts) {
    try {
      const scope = { workspaceId: post.createdById, memberId: post.createdById };
      const config = await loadMetaWorkspaceConfig(db, scope);
      if (!config.autopostEnabled) {
        skipped += 1;
        continue;
      }

      if (!config.pageId || !config.pageAccessToken) {
        throw new Error("Meta Page is niet verbonden (pageId/token ontbreekt).");
      }

      await socialDb.socialPost.update({
        where: { id: post.id },
        data: {
          status: "PUBLISHING",
          lastError: null,
        },
      });

      const externalIds: Record<string, string> = {};
      const metadata = normalizeSocialMetadata(post.metadata);
      const placements = metadata.placements || ["FEED"];
      const assets = metadata.assets || normalizePlacementAssets(metadata);

      await ensurePostCanPublish({
        imageUrl: post.imageUrl,
        targetPlatforms: post.targetPlatforms,
        metadata,
      });

      if (post.targetPlatforms.includes("INSTAGRAM") && placements.some((p) => p === "STORY" || p === "REEL")) {
        if (!config.instagramBusinessId) {
          throw new Error("Instagram Business-account ontbreekt voor deze workspace.");
        }
      }

      for (const placement of placements) {
        if (placement === "FEED") {
          const imageUrl = resolvePlacementImageUrl("FEED", metadata, post.imageUrl);
          const publishCaption = buildPublishedCaption(post.caption, metadata, "FEED");
          if (post.targetPlatforms.includes("FACEBOOK")) {
            externalIds.facebook = await publishFacebookImagePost({
              pageId: config.pageId,
              pageAccessToken: config.pageAccessToken,
              caption: publishCaption,
              imageUrl,
            });
          }
          if (post.targetPlatforms.includes("INSTAGRAM")) {
            externalIds.instagram = await publishInstagramImagePost({
              instagramBusinessId: config.instagramBusinessId!,
              pageAccessToken: config.pageAccessToken,
              caption: publishCaption,
              imageUrl,
            });
          }
        }

        if (placement === "STORY") {
          const imageUrl = resolvePlacementImageUrl("STORY", metadata, post.imageUrl);
          if (post.targetPlatforms.includes("FACEBOOK")) {
            externalIds.facebookStory = await publishFacebookImageStory({
              pageId: config.pageId,
              pageAccessToken: config.pageAccessToken,
              imageUrl,
            });
          }
          if (post.targetPlatforms.includes("INSTAGRAM")) {
            externalIds.instagramStory = await publishInstagramImageStory({
              instagramBusinessId: config.instagramBusinessId!,
              pageAccessToken: config.pageAccessToken,
              imageUrl,
            });
          }
        }

        if (placement === "REEL") {
          const videoUrl = assets.REEL?.videoUrl?.trim();
          if (!videoUrl) throw new Error("Reel-video ontbreekt.");
          const coverUrl = resolvePlacementImageUrl("REEL", metadata, post.imageUrl);
          const publishCaption = buildPublishedCaption(post.caption, metadata, "REEL");
          externalIds.instagramReel = await publishInstagramReel({
            instagramBusinessId: config.instagramBusinessId!,
            pageAccessToken: config.pageAccessToken,
            caption: publishCaption,
            videoUrl,
            coverUrl: coverUrl || undefined,
          });
        }
      }

      await socialDb.socialPost.update({
        where: { id: post.id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          lastError: null,
          externalPostIds: externalIds,
        },
      });

      await createSocialActivity(db, {
        userId: post.approvedById || post.createdById,
        type: "SOCIAL_POST_PUBLISHED",
        title: "Social post gepubliceerd",
        metadata: { socialPostId: post.id, platforms: post.targetPlatforms, externalIds },
      });

      published += 1;
    } catch (error) {
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
      await ensurePostCanPublish({
        imageUrl: row.imageUrl,
        targetPlatforms: row.targetPlatforms,
        metadata: row.metadata,
      });

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
      ensureSchedulableStatus(row.status);
      await ensurePostCanPublish({
        imageUrl: row.imageUrl,
        targetPlatforms: row.targetPlatforms,
        metadata: row.metadata,
      });

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
      });
    }),

  connectionStatus: protectedProcedure.query(async ({ ctx }) => {
    const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    const config = await loadMetaWorkspaceConfig(ctx.db, scope);
    const oauthScopes = resolveMetaOAuthScopeSummary();

    return {
      hasAppCredentials: Boolean(config.appId && config.appSecret),
      connected: Boolean(config.pageId && config.pageAccessToken),
      pageId: config.pageId || null,
      instagramBusinessId: config.instagramBusinessId || null,
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
