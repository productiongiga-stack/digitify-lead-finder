import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@digitify/db";
import { OpenClawClient } from "@digitify/openclaw";
import { z } from "zod";
import { adminProcedure, protectedProcedure, aiRateLimitedProcedure, router, mutationProcedure } from "../trpc";
import { loadAiProviderConfig } from "../lib/ai-provider-config";
import { probeSocialImage } from "../lib/social-image";
import {
  clearMetaSettings,
  fetchMetaPagePublishCapability,
  fetchMetaTokenDebugInfo,
  loadMetaManagedPages,
  loadMetaWorkspaceConfig,
  metaPageTasksAllowContentPublishing,
  missingMetaGranularTargetScopes,
  missingMetaPublishScopes,
  resolveMetaPublishReadiness,
  resolveMetaOAuthScopeSummary,
  resolveRequiredMetaPublishScopes,
  resolveSocialPublishTarget,
  type SocialPublishedRef,
  upsertMetaSettings,
  verifyFacebookPublishedPost,
  verifyInstagramPublishedMedia,
  workspaceScopeFromAuthenticatedUser,
} from "../lib/social-meta";
import { resolvePrimaryImageUrl } from "../lib/social-placements";
import {
  deleteSocialBrandKit,
  getSocialBrandKitById,
  listSocialBrandKits,
  setDefaultSocialBrandKit,
  upsertSocialBrandKit,
} from "../lib/social-brand-kits";
import { findWorkspaceRecord } from "../lib/workspace-record";
import {
  createSocialActivity,
  finalizePublishedPost,
  hasCompletedExternalPublish,
  hasPublishedExternally,
  normalizeSocialMetadata,
  parseStoredExternalIds,
  prepareAndValidatePostForPublish,
  recoverStuckPublishingPosts,
  runDueSocialPostsWorker,
  socialImageUrlSchema,
  socialPostFormatEnum,
  socialPostMetadataSchema,
} from "../lib/social-publish";

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

const listInputSchema = z
  .object({
    status: socialStatusEnum.optional(),
    page: z.number().min(1).default(1),
    pageSize: z.number().min(1).max(100).default(25),
  })
  .optional();

function ensureSchedulableStatus(status: string) {
  if (!["PENDING_APPROVAL", "DRAFT", "FAILED"].includes(status)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Post met status ${status} kan niet ingepland worden.`,
    });
  }
}

async function preparePostForPublishValidation(
  db: PrismaClient,
  scope: { workspaceId: string; memberId: string },
  row: SocialPostRecord,
) {
  const config = await loadMetaWorkspaceConfig(db, scope);
  const normalized = normalizeSocialMetadata((row.metadata || undefined) as z.infer<typeof socialPostMetadataSchema>);
  let publishTarget: Awaited<ReturnType<typeof resolveSocialPublishTarget>>;

  try {
    publishTarget = await resolveSocialPublishTarget({
      config,
      publisherPageId: normalized.publisherPageId,
    });
  } catch (error) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: error instanceof Error ? error.message : "Publicatie-account kon niet worden opgelost.",
    });
  }

  const prepared = await prepareAndValidatePostForPublish(db, row, scope, publishTarget, {
    accessToken: config.accessToken,
    appId: config.appId,
    appSecret: config.appSecret,
  });

  if (JSON.stringify(prepared.targetPlatforms) !== JSON.stringify(row.targetPlatforms)) {
    await db.socialPost.update({
      where: { id: row.id },
      data: { targetPlatforms: prepared.targetPlatforms },
    });
  }
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
  status: string;
  externalPostIds?: unknown;
  publishedAt?: Date | string | null;
  lastError?: string | null;
  scheduledFor?: Date | string | null;
};

async function requireSocialPost(db: PrismaClient, workspaceId: string, id: string) {
  return findWorkspaceRecord<SocialPostRecord>(db.socialPost, workspaceId, id, "Social post");
}

export const socialRouter = router({
  list: protectedProcedure.input(listInputSchema).query(async ({ ctx, input }) => {
    const workspaceId = ctx.user.workspaceId!;
    const page = input?.page ?? 1;
    const pageSize = input?.pageSize ?? 25;
    const where: Record<string, unknown> = { createdById: workspaceId };
    if (input?.status) where.status = input.status;

    const [items, total] = await Promise.all([
      ctx.db.socialPost.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          caption: true,
          imageUrl: true,
          scheduledFor: true,
          status: true,
          targetPlatforms: true,
          retryCount: true,
          publishedAt: true,
          lastError: true,
          externalPostIds: true,
          updatedAt: true,
          createdAt: true,
        },
      }),
      ctx.db.socialPost.count({ where }),
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

      const [scheduled, unscheduled] = await Promise.all([
        ctx.db.socialPost.findMany({
          where: {
            createdById: workspaceId,
            OR: [
              { scheduledFor: { gte: input.from, lte: input.to } },
              { publishedAt: { gte: input.from, lte: input.to } },
            ],
          },
          orderBy: [{ scheduledFor: "asc" }, { publishedAt: "asc" }],
        }),
        ctx.db.socialPost.findMany({
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

      const row = await requireSocialPost(ctx.db, ctx.user.workspaceId!, input.id);
      if (row.status !== "SCHEDULED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Alleen ingeplande posts kunnen verplaatst worden.",
        });
      }

      const updated = await ctx.db.socialPost.update({
        where: { id: input.id },
        data: { scheduledFor: input.scheduledFor },
      });

      await createSocialActivity(ctx.db, {
        userId: ctx.user.id,
        type: "SOCIAL_POST_SUBMITTED",
        title: "Social post opnieuw ingepland",
        metadata: { socialPostId: input.id, scheduledFor: input.scheduledFor.toISOString() },
      });

      return updated;
    }),

  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const row = await requireSocialPost(ctx.db, ctx.user.workspaceId!, input.id);
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
      const row = await ctx.db.socialPost.create({
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
      const row = await requireSocialPost(ctx.db, ctx.user.workspaceId!, input.id);
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

      return ctx.db.socialPost.update({
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
      const row = await requireSocialPost(ctx.db, ctx.user.workspaceId!, input.id);

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

      const updated = await ctx.db.socialPost.update({
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
      const row = await requireSocialPost(ctx.db, ctx.user.workspaceId!, input.id);
      if (!["DRAFT", "FAILED", "CANCELLED"].includes(row.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Deze post kan niet ter goedkeuring worden aangeboden." });
      }
      const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
      await preparePostForPublishValidation(ctx.db, scope, row);

      const updated = await ctx.db.socialPost.update({
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

      const row = await requireSocialPost(ctx.db, ctx.user.workspaceId!, input.id);

      if (row.status === "SCHEDULED") {
        const updated = await ctx.db.socialPost.update({
          where: { id: input.id },
          data: { scheduledFor: input.scheduledFor },
        });

        await createSocialActivity(ctx.db, {
          userId: ctx.user.id,
          type: "SOCIAL_POST_SUBMITTED",
          title: "Social post opnieuw ingepland",
          metadata: { socialPostId: input.id, scheduledFor: input.scheduledFor.toISOString() },
        });

        return updated;
      }

      ensureSchedulableStatus(row.status);
      const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
      await preparePostForPublishValidation(ctx.db, scope, row);

      const updated = await ctx.db.socialPost.update({
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
        await runDueSocialPostsWorker(ctx.db, {
          postId: input.id,
          workspaceId: ctx.user.workspaceId!,
        });
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
      const row = await requireSocialPost(ctx.db, ctx.user.workspaceId!, input.id);

      const reason = input.reason?.trim();
      const updated = await ctx.db.socialPost.update({
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
      const row = await requireSocialPost(ctx.db, ctx.user.workspaceId!, input.id);
      if (row.status !== "FAILED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Alleen FAILED posts kunnen opnieuw ingepland worden." });
      }

      const externalIds = parseStoredExternalIds(row.externalPostIds);
      if (hasCompletedExternalPublish(row, externalIds)) {
        return finalizePublishedPost(ctx.db, row, externalIds);
      }

      return ctx.db.socialPost.update({
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
      const row = await requireSocialPost(ctx.db, ctx.user.workspaceId!, input.id);
      if (!["SCHEDULED", "PENDING_APPROVAL"].includes(row.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Alleen pending/scheduled posts kunnen geannuleerd worden." });
      }

      return ctx.db.socialPost.update({
        where: { id: input.id },
        data: { status: "CANCELLED", scheduledFor: null },
      });
    }),

  deletePosts: mutationProcedure
    .input(
      z
        .object({
          ids: z.array(z.string().min(1)).min(1).max(100).optional(),
          status: socialStatusEnum.optional(),
          all: z.boolean().optional(),
        })
        .refine((input) => input.all || input.status || input.ids?.length, {
          message: "Kies minstens één post, statusfilter of all=true.",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      const targetWhere: Record<string, unknown> = { createdById: workspaceId };
      if (input.ids?.length) {
        targetWhere.id = { in: input.ids };
      } else if (input.status) {
        targetWhere.status = input.status;
      }

      const candidates = await ctx.db.socialPost.findMany({
        where: targetWhere,
        select: {
          id: true,
          status: true,
          externalPostIds: true,
        },
      });
      const deletable = candidates.filter((row) => row.status !== "PUBLISHING");
      const deletableIds = deletable.map((row) => row.id);
      const skippedPublishing = candidates.length - deletable.length;
      const publishedLocalOnly = deletable.filter((row) =>
        hasPublishedExternally(parseStoredExternalIds(row.externalPostIds)),
      ).length;
      const missing = input.ids?.length ? Math.max(0, input.ids.length - candidates.length) : 0;

      if (!deletableIds.length) {
        return {
          deleted: 0,
          skippedPublishing,
          missing,
          publishedLocalOnly,
        };
      }

      const deleted = await ctx.db.socialPost.deleteMany({
        where: {
          createdById: workspaceId,
          id: { in: deletableIds },
          status: { not: "PUBLISHING" },
        },
      });

      return {
        deleted: deleted.count,
        skippedPublishing,
        missing,
        publishedLocalOnly,
      };
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
        const row = await ctx.db.campaign.findFirst({
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
        pageAccessToken: z.string().min(1).optional(),
        instagramBusinessId: z.string().optional(),
        instagramUsername: z.string().max(80).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
      const config = await loadMetaWorkspaceConfig(ctx.db, scope);
      if (!config.accessToken) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Koppel Meta eerst via Integraties." });
      }

      const pages = await loadMetaManagedPages(config.accessToken);
      const selectedPage = pages.find((page) => page.id === input.pageId);
      if (!selectedPage) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Deze Facebook-pagina staat niet meer tussen je gekoppelde Meta-accounts. Koppel Meta opnieuw.",
        });
      }

      await upsertMetaSettings(ctx.db, scope, [
        { key: "social.meta_page_id", value: selectedPage.id },
        { key: "social.meta_page_access_token", value: selectedPage.accessToken },
        { key: "social.meta_instagram_business_id", value: selectedPage.instagramBusinessId || "" },
      ]);

      return {
        pageId: selectedPage.id,
        pageName: selectedPage.name || input.pageName || null,
        instagramBusinessId: selectedPage.instagramBusinessId || input.instagramBusinessId || null,
        instagramUsername: selectedPage.instagramUsername || input.instagramUsername || null,
      };
    }),

  connectionStatus: protectedProcedure.query(async ({ ctx }) => {
    const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
    const config = await loadMetaWorkspaceConfig(ctx.db, scope);
    const oauthScopes = resolveMetaOAuthScopeSummary();
    let pageName: string | null = null;
    let instagramUsername: string | null = null;
    let pages: Awaited<ReturnType<typeof loadMetaManagedPages>> = [];
    let selectedPageTasks: string[] = [];

    if (config.accessToken) {
      pages = await loadMetaManagedPages(config.accessToken).catch(() => []);
      const selectedPage = config.pageId ? pages.find((page) => page.id === config.pageId) : null;
      pageName = selectedPage?.name || null;
      instagramUsername = selectedPage?.instagramUsername || null;
      selectedPageTasks = selectedPage?.tasks || [];
    }

    let grantedTokenScopes: string[] = [];
    let missingPublishScopes: string[] = [];
    let missingGranularPublishScopes: string[] = [];
    let tokenValid = false;
    let tokenDebugError: string | null = null;
    let tokenAppId: string | null = null;
    let tokenApplication: string | null = null;
    let pageTokenValid: boolean | null = null;
    let pageTokenDebugError: string | null = null;
    let pageTokenScopes: string[] = [];
    let missingPageTokenPublishScopes: string[] = [];
    let userDebug: Awaited<ReturnType<typeof fetchMetaTokenDebugInfo>> | null = null;
    let pageDebug: Awaited<ReturnType<typeof fetchMetaTokenDebugInfo>> | null = null;
    let pageCapability: Awaited<ReturnType<typeof fetchMetaPagePublishCapability>> | null = null;

    if (config.accessToken && config.appId && config.appSecret) {
      const debug = await fetchMetaTokenDebugInfo({
        inputToken: config.accessToken,
        appId: config.appId,
        appSecret: config.appSecret,
      });
      userDebug = debug;
      grantedTokenScopes = debug.scopes;
      tokenValid = debug.isValid;
      tokenDebugError = debug.error;
      tokenAppId = debug.appId;
      tokenApplication = debug.application;
      missingPublishScopes = missingMetaPublishScopes(
        debug.scopes,
        resolveRequiredMetaPublishScopes(["FACEBOOK", "INSTAGRAM"]),
      );
      missingGranularPublishScopes = [
        ...(config.pageId
          ? missingMetaGranularTargetScopes(
              debug.granularScopes,
              ["pages_read_engagement", "pages_manage_posts"],
              config.pageId,
            )
          : []),
        ...(config.instagramBusinessId
          ? missingMetaGranularTargetScopes(
              debug.granularScopes,
              ["instagram_content_publish"],
              config.instagramBusinessId,
            )
          : []),
      ];
    }

    if (config.pageAccessToken && config.appId && config.appSecret) {
      pageDebug = await fetchMetaTokenDebugInfo({
        inputToken: config.pageAccessToken,
        appId: config.appId,
        appSecret: config.appSecret,
      });
      pageTokenValid = pageDebug.isValid;
      pageTokenDebugError = pageDebug.error;
      pageTokenScopes = pageDebug.scopes;
      missingPageTokenPublishScopes = pageDebug.scopes.length
        ? missingMetaPublishScopes(pageDebug.scopes, [
            "pages_read_engagement",
            "pages_manage_posts",
            "instagram_content_publish",
          ])
        : [];
    }

    if (config.pageId && config.pageAccessToken) {
      pageCapability = await fetchMetaPagePublishCapability({
        pageId: config.pageId,
        pageAccessToken: config.pageAccessToken,
      });
    }

    const publishReadiness = resolveMetaPublishReadiness({
      pageId: config.pageId,
      instagramBusinessId: config.instagramBusinessId,
      userDebug,
      pageDebug,
      pageTasks: selectedPageTasks,
      pageCapability,
      oauthScopes,
    });

    return {
      hasAppCredentials: Boolean(config.appId && config.appSecret),
      connected: Boolean(config.pageId && config.pageAccessToken),
      pageId: config.pageId || null,
      pageName,
      pages,
      selectedPageId: config.pageId || null,
      selectedPageTasks,
      selectedPageCanPublish: metaPageTasksAllowContentPublishing(selectedPageTasks),
      selectedPageCapabilityCanPost: pageCapability?.canPost ?? null,
      selectedPageCapabilityTasks: pageCapability?.tasks ?? [],
      selectedPageCapabilityError: pageCapability?.error ?? null,
      facebookPublishReady: publishReadiness.facebookPublishReady,
      instagramPublishReady: publishReadiness.instagramPublishReady,
      facebookBlockingReasons: publishReadiness.facebookBlockingReasons,
      instagramBlockingReasons: publishReadiness.instagramBlockingReasons,
      instagramBusinessId: config.instagramBusinessId || null,
      instagramUsername,
      autopostEnabled: config.autopostEnabled,
      tokenExpiresAt: config.tokenExpiresAt || null,
      grantedTokenScopes,
      missingPublishScopes,
      missingGranularPublishScopes,
      tokenValid,
      tokenDebugError,
      tokenAppId,
      tokenApplication,
      pageTokenValid,
      pageTokenDebugError,
      pageTokenScopes,
      missingPageTokenPublishScopes,
      oauthLoginMode: oauthScopes.loginMode,
      oauthScopeLevel: oauthScopes.scopeLevel,
      oauthScopes: oauthScopes.scopes,
      oauthIncludeAds: oauthScopes.includeAds,
      oauthScopesOverridden: oauthScopes.overridden,
      oauthUsesLegacyEnvOverride: oauthScopes.usesLegacyEnvOverride,
      oauthHasDeprecatedScopes: oauthScopes.hasDeprecatedInstagramBusinessScopes,
    };
  }),

  publishDuePosts: adminProcedure.mutation(async ({ ctx }) =>
    runDueSocialPostsWorker(ctx.db, { workspaceId: ctx.user.workspaceId! }),
  ),

  publishPostNow: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await recoverStuckPublishingPosts(ctx.db, { postId: input.id, maxAgeMs: 3 * 60 * 1000 });

      const row = await requireSocialPost(ctx.db, ctx.user.workspaceId!, input.id);

      if (row.status === "PUBLISHED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Deze post is al live op Meta.",
        });
      }

      if (row.status === "PUBLISHING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Deze post wordt al gepubliceerd. Wacht tot de huidige poging klaar is (max. enkele minuten) en vernieuw daarna de pagina.",
        });
      }

      const externalIds = parseStoredExternalIds(row.externalPostIds);
      if (hasCompletedExternalPublish(row, externalIds)) {
        return finalizePublishedPost(ctx.db, row, externalIds);
      }

      if (!["SCHEDULED", "FAILED"].includes(row.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Alleen ingeplande of mislukte posts kunnen nu gepubliceerd worden.",
        });
      }

      if (row.status === "SCHEDULED") {
        await ctx.db.socialPost.update({
          where: { id: input.id },
          data: { scheduledFor: new Date() },
        });
      } else {
        await ctx.db.socialPost.update({
          where: { id: input.id },
          data: { status: "SCHEDULED", scheduledFor: new Date(), lastError: null },
        });
      }

      const summary = await runDueSocialPostsWorker(ctx.db, {
        postId: input.id,
        workspaceId: ctx.user.workspaceId!,
        failImmediately: true,
      });
      const refreshed = await requireSocialPost(ctx.db, ctx.user.workspaceId!, input.id);

      if (refreshed?.status === "PUBLISHED") {
        return refreshed;
      }

      if (summary.published === 0) {
        if (refreshed?.status === "PUBLISHING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Publicatie naar Meta duurt langer dan verwacht. Vernieuw de pagina over een minuut; bij aanhoudende problemen controleer je Meta-koppeling.",
          });
        }
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
      const row = await requireSocialPost(ctx.db, ctx.user.workspaceId!, input.id);

      if (row.status !== "PUBLISHED") {
        return { status: row.status, verified: false, links: [] as Array<{ key: string; url: string; verified: boolean }> };
      }

      const scope = workspaceScopeFromAuthenticatedUser({ id: ctx.user.id, workspaceId: ctx.user.workspaceId });
      const config = await loadMetaWorkspaceConfig(ctx.db, scope);
      const metadata = normalizeSocialMetadata(
        row.metadata as Parameters<typeof normalizeSocialMetadata>[0],
      );
      const publishTarget = await resolveSocialPublishTarget({
        config,
        publisherPageId: metadata.publisherPageId,
      });
      const instagramAccessToken = config.accessToken || publishTarget.pageAccessToken;

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
              pageAccessToken: instagramAccessToken,
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
