import { TRPCError } from "@trpc/server";
import { type MediaGenerationType, type Prisma, type PrismaClient } from "@digitify/db";
import {
  MuapiError,
  MODEL_COST_USD,
  aspectRatioForPlacement,
  buildImagePayload,
  buildLipSyncPayload,
  formatModelCostDetail,
  formatModelCostEur,
  getModelById,
  getUserBalance,
  listAllModels,
  fetchMuapiResultOnce,
  isTerminalFailure,
  isTerminalSuccess,
  submitMuapiJob,
  uploadFileToMuapi,
  type SocialPlacementFormat,
} from "@digitify/media-studio";
import { z } from "zod";
import { aiRateLimitedProcedure, mutationProcedure, protectedProcedure, router } from "../trpc";
import {
  enrichGenerationWithBrand,
  loadCreativeBrandContext,
  saveCreativeAutoImport,
  saveCreativeBrandKit,
} from "../lib/creative-brand";
import { loadCreativeBrandContextForKit } from "../lib/social-brand-kits";
import {
  addReferenceUpload,
  loadReferenceLibrary,
  removeReferenceUpload,
} from "../lib/creative-references";
import { clearUserMuapiKey, loadUserMuapiKey, requireUserMuapiKey, saveUserMuapiKey } from "../lib/muapi-key";
import { importRemoteMediaToBlob } from "../lib/import-media-to-blob";

const mediaTypeEnum = z.enum(["IMAGE", "VIDEO", "MARKETING_AD", "LIP_SYNC"]);
const placementFormatEnum = z.enum(["SQUARE", "PORTRAIT", "LANDSCAPE", "STORY"]);
const MAX_REFERENCE_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_MEDIA_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_REFERENCE_UPLOAD_BASE64_LENGTH = Math.ceil((MAX_REFERENCE_UPLOAD_BYTES * 4) / 3) + 16;
const MAX_MEDIA_UPLOAD_BASE64_LENGTH = Math.ceil((MAX_MEDIA_UPLOAD_BYTES * 4) / 3) + 16;

const NEW_MODEL_IDS = new Set([
  "sd-2-t2v",
  "grok-imagine-t2v",
  "grok-imagine-i2v",
  "kling-v3-t2v",
  "sd-2-i2v-multi",
  "flux-2-flex-edit",
  "flux-2-pro-edit",
  "infinitetalk-image-to-video",
  "ltx-2.3-lipsync",
]);

const startLipSyncInput = z.object({
  prompt: z.string().trim().max(4000).optional(),
  model: z.string().trim().min(1),
  resolution: z.string().trim().optional(),
  imageUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  audioUrl: z.string().url().min(1),
  socialPostId: z.string().optional(),
});

const startImageInput = z.object({
  prompt: z.string().trim().min(1).max(4000),
  model: z.string().trim().min(1),
  aspectRatio: z.string().trim().optional(),
  placementFormat: placementFormatEnum.optional(),
  resolution: z.string().trim().optional(),
  quality: z.string().trim().optional(),
  imageUrl: z.string().url().optional(),
  imagesList: z.array(z.string().url()).max(14).optional(),
  socialPostId: z.string().optional(),
  brandKitId: z.string().max(80).optional(),
});

const startVideoInput = z.object({
  prompt: z.string().trim().max(4000).optional(),
  model: z.string().trim().min(1),
  aspectRatio: z.string().trim().optional(),
  placementFormat: placementFormatEnum.optional(),
  duration: z.number().int().min(1).max(60).optional(),
  resolution: z.string().trim().optional(),
  quality: z.string().trim().optional(),
  imageUrl: z.string().url().optional(),
  socialPostId: z.string().optional(),
});

const startMarketingAdInput = z.object({
  prompt: z.string().trim().min(1).max(4000),
  model: z.string().trim().min(1).optional(),
  aspectRatio: z.string().trim().optional(),
  duration: z.number().int().min(4).max(15).optional(),
  resolution: z.enum(["720p", "1080p"]).optional(),
  imagesList: z.array(z.string().url()).min(1).max(8),
  videoFiles: z.array(z.string().url()).max(2).optional(),
  socialPostId: z.string().optional(),
});

function resolveAspectRatio(input: { aspectRatio?: string; placementFormat?: SocialPlacementFormat }) {
  if (input.aspectRatio?.trim()) return input.aspectRatio.trim();
  if (input.placementFormat) return aspectRatioForPlacement(input.placementFormat);
  return undefined;
}

function mapMuapiAuthError(error: unknown): never {
  if (error instanceof MuapiError && (error.status === 401 || error.status === 403)) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "MuAPI API-key is ongeldig of verlopen. Controleer je sleutel in Instellingen.",
    });
  }
  if (error instanceof MuapiError && error.status === 402) {
    throw new TRPCError({
      code: "PAYMENT_REQUIRED",
      message: "MuAPI-saldo is onvoldoende. Waardeer je MuAPI-account op en probeer opnieuw.",
    });
  }
  if (error instanceof Error) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Media-generatie mislukt." });
}

function toInputJsonObject(metadata?: Record<string, unknown>): Prisma.InputJsonObject | undefined {
  if (!metadata) return undefined;
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  ) as Prisma.InputJsonObject;
}

async function createGenerationJob(params: {
  db: PrismaClient;
  workspaceId: string;
  userId: string;
  type: MediaGenerationType;
  model: string;
  prompt: string;
  metadata?: Record<string, unknown>;
  socialPostId?: string;
}) {
  return params.db.mediaGeneration.create({
    data: {
      workspaceId: params.workspaceId,
      userId: params.userId,
      type: params.type,
      model: params.model,
      prompt: params.prompt,
      status: "PENDING",
      metadata: toInputJsonObject(params.metadata),
      socialPostId: params.socialPostId,
    },
  });
}

export const mediaRouter = router({
  getMuapiKeyStatus: protectedProcedure.query(async ({ ctx }) => {
    const apiKey = await loadUserMuapiKey(ctx.db, ctx.user.id);
    return { hasKey: Boolean(apiKey) };
  }),

  setMuapiKey: mutationProcedure
    .input(z.object({ apiKey: z.string().trim().min(8).max(500) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await getUserBalance(input.apiKey);
      } catch (error) {
        mapMuapiAuthError(error);
      }
      await saveUserMuapiKey(ctx.db, ctx.user.id, input.apiKey);
      return { ok: true as const };
    }),

  clearMuapiKey: mutationProcedure.mutation(async ({ ctx }) => {
    await clearUserMuapiKey(ctx.db, ctx.user.id);
    return { ok: true as const };
  }),

  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const apiKey = await requireUserMuapiKey(ctx.db, ctx.user.id).catch((error) => {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: error instanceof Error ? error.message : "MuAPI API-key ontbreekt.",
      });
    });
    try {
      const result = await getUserBalance(apiKey);
      return { balance: result.balance ?? null };
    } catch (error) {
      mapMuapiAuthError(error);
    }
  }),

  listModels: protectedProcedure.query(() => {
    return listAllModels().map((model) => {
      const costUnit =
        model.type === "IMAGE" || model.type === "IMAGE_I2I"
          ? "beeld"
          : model.type === "VIDEO" || model.type === "VIDEO_I2V" || model.type === "LIP_SYNC"
            ? "video"
            : "generatie";

      return {
        id: model.id,
        label: model.label,
        type: model.type,
        description: model.description,
        costUsd: model.costUsd ?? null,
        costLabel: formatModelCostEur(model.costUsd) || null,
        costDetail: formatModelCostDetail(model.costUsd, costUnit) || null,
        aspectRatios: model.aspectRatios ?? [],
        resolutions: model.resolutions ?? [],
        durations: model.durations ?? [],
        qualities: model.qualities ?? [],
        defaultAspectRatio: model.defaultAspectRatio,
        maxReferenceImages: model.maxReferenceImages ?? null,
        lipSyncMode: model.lipSyncMode ?? null,
        isNew: NEW_MODEL_IDS.has(model.id),
      };
    });
  }),

  getUsageStats: protectedProcedure.query(async ({ ctx }) => {
    const workspaceId = ctx.user.workspaceId!;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const items = await ctx.db.mediaGeneration.findMany({
      where: { workspaceId, createdAt: { gte: startOfMonth } },
      select: { model: true, status: true, metadata: true },
    });

    let estimatedUsd = 0;
    for (const item of items) {
      const model = getModelById(item.model);
      const endpoint = (item.metadata as { endpoint?: string } | null)?.endpoint || model?.endpoint;
      const cost = model?.costUsd ?? (endpoint ? MODEL_COST_USD[endpoint] : undefined);
      if (typeof cost === "number") estimatedUsd += cost;
    }

    return {
      monthGenerations: items.length,
      failedJobs: items.filter((item) => item.status === "FAILED").length,
      monthSpendEur: formatModelCostEur(estimatedUsd) || "€0,0000",
    };
  }),

  getRegeneratePayload: protectedProcedure
    .input(z.object({ jobId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.db.mediaGeneration.findFirst({
        where: { id: input.jobId, workspaceId: ctx.user.workspaceId! },
      });
      if (!job) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Generatie niet gevonden." });
      }
      const metadata =
        job.metadata && typeof job.metadata === "object" && !Array.isArray(job.metadata)
          ? (job.metadata as Record<string, unknown>)
          : {};
      return {
        jobId: job.id,
        type: job.type,
        prompt: job.prompt,
        model: job.model,
        metadata,
        socialPostId: job.socialPostId,
      };
    }),

  listReferenceUploads: protectedProcedure.query(async ({ ctx }) => {
    const workspaceId = ctx.user.workspaceId;
    if (!workspaceId) return { items: [] as const };
    const items = await loadReferenceLibrary(ctx.db, workspaceId);
    return { items };
  }),

  removeReferenceUpload: mutationProcedure
    .input(z.object({ referenceId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId;
      if (!workspaceId) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Workspace ontbreekt." });
      }
      const items = await removeReferenceUpload(ctx.db, workspaceId, input.referenceId);
      return { items };
    }),

  getBrandKit: protectedProcedure.query(async ({ ctx }) => {
    const workspaceId = ctx.user.workspaceId;
    if (!workspaceId) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Workspace ontbreekt." });
    }
    return loadCreativeBrandContext(ctx.db, workspaceId);
  }),

  saveBrandKit: mutationProcedure
    .input(
      z.object({
        brandEnabled: z.boolean(),
        includeLogo: z.boolean(),
        brandVoice: z.string().max(500).optional(),
        brandKeywords: z.string().max(500).optional(),
        brandAvoid: z.string().max(500).optional(),
        brandSummary: z.string().max(4000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId;
      if (!workspaceId) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Workspace ontbreekt." });
      }
      await saveCreativeBrandKit(ctx.db, workspaceId, input);
      return { ok: true as const };
    }),

  saveCreativeSettings: mutationProcedure
    .input(z.object({ autoImport: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId;
      if (!workspaceId) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Workspace ontbreekt." });
      }
      await saveCreativeAutoImport(ctx.db, workspaceId, input.autoImport);
      return { ok: true as const };
    }),

  listHistory: protectedProcedure
    .input(
      z
        .object({
          type: mediaTypeEnum.optional(),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(50).default(20),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 20;
      const where = {
        workspaceId: ctx.user.workspaceId!,
        ...(input?.type ? { type: input.type } : {}),
      };
      const [items, total] = await Promise.all([
        ctx.db.mediaGeneration.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        ctx.db.mediaGeneration.count({ where }),
      ]);
      return { items, total, page, pageSize };
    }),

  startImageGeneration: aiRateLimitedProcedure.input(startImageInput).mutation(async ({ ctx, input }) => {
    const apiKey = await requireUserMuapiKey(ctx.db, ctx.user.id).catch((error) => {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: error instanceof Error ? error.message : "MuAPI API-key ontbreekt.",
      });
    });

    const model = getModelById(input.model);
    if (!model || (model.type !== "IMAGE" && model.type !== "IMAGE_I2I")) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Onbekend afbeeldingsmodel." });
    }
    if (model.type === "IMAGE_I2I" && !input.imageUrl && !input.imagesList?.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Voeg minstens één referentie-afbeelding toe voor dit image-to-image model.",
      });
    }

    const aspectRatio = resolveAspectRatio(input);
    const brand = await loadCreativeBrandContextForKit(ctx.db, ctx.user.workspaceId!, input.brandKitId);
    const enriched = enrichGenerationWithBrand(brand, {
      prompt: input.prompt,
      modelType: model.type,
      imageUrl: input.imageUrl,
      imagesList: input.imagesList,
    });

    const job = await createGenerationJob({
      db: ctx.db,
      workspaceId: ctx.user.workspaceId!,
      userId: ctx.user.id,
      type: "IMAGE",
      model: input.model,
      prompt: input.prompt,
      socialPostId: input.socialPostId,
      metadata: {
        aspectRatio,
        resolution: input.resolution,
        quality: input.quality,
        imageUrl: enriched.imageUrl ?? input.imageUrl,
        imagesList: enriched.imagesList ?? input.imagesList,
        brandApplied: enriched.brandApplied,
        enrichedPrompt: enriched.prompt,
      },
    });

    try {
      const submit = await submitMuapiJob(apiKey, model.endpoint, buildImagePayload({
        model: input.model,
        prompt: enriched.prompt,
        aspect_ratio: aspectRatio,
        resolution: input.resolution,
        quality: input.quality,
        image_url: enriched.imageUrl,
        images_list: enriched.imagesList,
      }));

      if (!submit.requestId && submit.immediateUrl) {
        const completed = await ctx.db.mediaGeneration.update({
          where: { id: job.id },
          data: {
            status: "COMPLETED",
            outputUrl: submit.immediateUrl,
          },
        });
        return { jobId: completed.id, status: completed.status, outputUrl: completed.outputUrl };
      }

      const updated = await ctx.db.mediaGeneration.update({
        where: { id: job.id },
        data: {
          status: "PROCESSING",
          requestId: submit.requestId,
        },
      });
      return { jobId: updated.id, status: updated.status, requestId: updated.requestId };
    } catch (error) {
      await ctx.db.mediaGeneration.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Generatie mislukt",
        },
      });
      mapMuapiAuthError(error);
    }
  }),

  startVideoGeneration: aiRateLimitedProcedure.input(startVideoInput).mutation(async ({ ctx, input }) => {
    const apiKey = await requireUserMuapiKey(ctx.db, ctx.user.id).catch((error) => {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: error instanceof Error ? error.message : "MuAPI API-key ontbreekt.",
      });
    });

    const model = getModelById(input.model);
    if (!model || (model.type !== "VIDEO" && model.type !== "VIDEO_I2V")) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Onbekend videomodel." });
    }

    const aspectRatio = resolveAspectRatio(input);
    const brand = await loadCreativeBrandContext(ctx.db, ctx.user.workspaceId!);
    const enriched = enrichGenerationWithBrand(brand, {
      prompt: input.prompt?.trim() || "",
      modelType: model.type,
      imageUrl: input.imageUrl,
    });

    if (!enriched.prompt?.trim() && !enriched.imageUrl && !input.imageUrl) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Voeg een prompt of startframe toe voor videogeneratie.",
      });
    }

    const job = await createGenerationJob({
      db: ctx.db,
      workspaceId: ctx.user.workspaceId!,
      userId: ctx.user.id,
      type: "VIDEO",
      model: input.model,
      prompt: input.prompt?.trim() || "",
      socialPostId: input.socialPostId,
      metadata: {
        aspectRatio,
        duration: input.duration,
        resolution: input.resolution,
        quality: input.quality,
        imageUrl: enriched.imageUrl ?? input.imageUrl,
        brandApplied: enriched.brandApplied,
        enrichedPrompt: enriched.prompt,
      },
    });

    try {
      const imageField = model.imageField || "image_url";
      const videoPayload: Record<string, unknown> = {
        prompt: enriched.prompt || undefined,
        aspect_ratio: aspectRatio,
        duration: input.duration,
        resolution: input.resolution,
        quality: input.quality,
      };
      if (enriched.imageUrl) {
        if (imageField === "images_list") videoPayload.images_list = [enriched.imageUrl];
        else videoPayload[imageField] = enriched.imageUrl;
      }

      const submit = await submitMuapiJob(apiKey, model.endpoint, videoPayload);

      const updated = await ctx.db.mediaGeneration.update({
        where: { id: job.id },
        data: {
          status: submit.requestId ? "PROCESSING" : "COMPLETED",
          requestId: submit.requestId,
          outputUrl: submit.immediateUrl,
        },
      });
      return { jobId: updated.id, status: updated.status, requestId: updated.requestId, outputUrl: updated.outputUrl };
    } catch (error) {
      await ctx.db.mediaGeneration.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Generatie mislukt",
        },
      });
      mapMuapiAuthError(error);
    }
  }),

  startMarketingAd: aiRateLimitedProcedure.input(startMarketingAdInput).mutation(async ({ ctx, input }) => {
    const apiKey = await requireUserMuapiKey(ctx.db, ctx.user.id).catch((error) => {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: error instanceof Error ? error.message : "MuAPI API-key ontbreekt.",
      });
    });

    const modelId = input.model || "seedance-2-vip-omni-reference";
    const model = getModelById(modelId);
    if (!model || model.type !== "MARKETING_AD") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Onbekend advertentiemodel." });
    }

    const resolution = input.resolution || model.resolutions?.[0] || "720p";
    let endpoint = model.endpoint;
    if (resolution === "1080p" && (modelId === "seedance-2-vip-omni-reference" || endpoint === "seedance-2-vip-omni-reference")) {
      endpoint = "sd-2-vip-omni-reference-1080p";
    }

    const brand = await loadCreativeBrandContext(ctx.db, ctx.user.workspaceId!);
    const enriched = enrichGenerationWithBrand(brand, {
      prompt: input.prompt,
      modelType: "MARKETING_AD",
      imagesList: input.imagesList,
    });

    const job = await createGenerationJob({
      db: ctx.db,
      workspaceId: ctx.user.workspaceId!,
      userId: ctx.user.id,
      type: "MARKETING_AD",
      model: modelId,
      prompt: input.prompt,
      socialPostId: input.socialPostId,
      metadata: {
        aspectRatio: input.aspectRatio,
        duration: input.duration,
        resolution,
        endpoint,
        imagesList: enriched.imagesList ?? input.imagesList,
        videoFiles: input.videoFiles,
        brandApplied: enriched.brandApplied,
        enrichedPrompt: enriched.prompt,
      },
    });

    try {
      const submit = await submitMuapiJob(apiKey, endpoint, {
        prompt: enriched.prompt,
        aspect_ratio: input.aspectRatio || "9:16",
        duration: input.duration || 5,
        images_list: enriched.imagesList ?? input.imagesList,
        video_files: input.videoFiles || [],
      });

      const updated = await ctx.db.mediaGeneration.update({
        where: { id: job.id },
        data: {
          status: submit.requestId ? "PROCESSING" : "COMPLETED",
          requestId: submit.requestId,
          outputUrl: submit.immediateUrl,
        },
      });
      return { jobId: updated.id, status: updated.status, requestId: updated.requestId, outputUrl: updated.outputUrl };
    } catch (error) {
      await ctx.db.mediaGeneration.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Advertentie-generatie mislukt",
        },
      });
      mapMuapiAuthError(error);
    }
  }),

  getJobStatus: protectedProcedure
    .input(z.object({ jobId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.db.mediaGeneration.findFirst({
        where: { id: input.jobId, workspaceId: ctx.user.workspaceId! },
      });
      if (!job) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Generatie niet gevonden." });
      }

      if (job.status === "COMPLETED" || job.status === "FAILED" || !job.requestId) {
        return {
          id: job.id,
          status: job.status,
          type: job.type,
          prompt: job.prompt,
          outputUrl: job.outputUrl,
          blobUrl: job.blobUrl,
          errorMessage: job.errorMessage,
        };
      }

      const apiKey = await requireUserMuapiKey(ctx.db, ctx.user.id).catch((error) => {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: error instanceof Error ? error.message : "MuAPI API-key ontbreekt.",
        });
      });

      try {
        const result = await fetchMuapiResultOnce(apiKey, job.requestId);
        if (isTerminalFailure(result.status)) {
          const failed = await ctx.db.mediaGeneration.update({
            where: { id: job.id },
            data: {
              status: "FAILED",
              errorMessage: result.error || "Generatie mislukt",
            },
          });
          return {
            id: failed.id,
            status: failed.status,
            type: failed.type,
            prompt: failed.prompt,
            outputUrl: failed.outputUrl,
            blobUrl: failed.blobUrl,
            errorMessage: failed.errorMessage,
          };
        }
        if (!isTerminalSuccess(result.status)) {
          return {
            id: job.id,
            status: job.status,
            type: job.type,
            prompt: job.prompt,
            outputUrl: job.outputUrl,
            blobUrl: job.blobUrl,
            errorMessage: job.errorMessage,
          };
        }
        const updated = await ctx.db.mediaGeneration.update({
          where: { id: job.id },
          data: {
            status: "COMPLETED",
            outputUrl: result.url,
          },
        });
        return {
          id: updated.id,
          status: updated.status,
          type: updated.type,
          prompt: updated.prompt,
          outputUrl: updated.outputUrl,
          blobUrl: updated.blobUrl,
          errorMessage: updated.errorMessage,
        };
      } catch (error) {
        if (error instanceof MuapiError && error.message.includes("time-out")) {
          return {
            id: job.id,
            status: job.status,
            type: job.type,
            prompt: job.prompt,
            outputUrl: job.outputUrl,
            blobUrl: job.blobUrl,
            errorMessage: job.errorMessage,
          };
        }
        const failed = await ctx.db.mediaGeneration.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            errorMessage: error instanceof Error ? error.message : "Generatie mislukt",
          },
        });
        return {
          id: failed.id,
          status: failed.status,
          type: failed.type,
          prompt: failed.prompt,
          outputUrl: failed.outputUrl,
          blobUrl: failed.blobUrl,
          errorMessage: failed.errorMessage,
        };
      }
    }),

  importToBlob: mutationProcedure
    .input(z.object({ jobId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.db.mediaGeneration.findFirst({
        where: { id: input.jobId, workspaceId: ctx.user.workspaceId! },
      });
      if (!job) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Generatie niet gevonden." });
      }
      if (!job.outputUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Deze generatie heeft nog geen output-URL." });
      }
      if (job.blobUrl) {
        return { jobId: job.id, blobUrl: job.blobUrl };
      }

      const imported = await importRemoteMediaToBlob({
        sourceUrl: job.outputUrl,
        workspaceId: ctx.user.workspaceId!,
        userId: ctx.user.id,
        filename: `${job.type.toLowerCase()}-${job.id}`,
      });

      const updated = await ctx.db.mediaGeneration.update({
        where: { id: job.id },
        data: { blobUrl: imported.url },
      });

      return { jobId: updated.id, blobUrl: updated.blobUrl, storage: imported.storage };
    }),

  deleteGeneration: mutationProcedure
    .input(z.object({ jobId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.db.mediaGeneration.findFirst({
        where: { id: input.jobId, workspaceId: ctx.user.workspaceId! },
      });
      if (!job) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Generatie niet gevonden." });
      }
      await ctx.db.mediaGeneration.delete({ where: { id: job.id } });
      return { ok: true as const };
    }),

  uploadReference: aiRateLimitedProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(200),
        contentType: z.string().min(1).max(100).refine((value) => value.startsWith("image/"), {
          message: "Alleen afbeeldingen zijn toegestaan als referentie.",
        }),
        base64: z.string().min(1).max(MAX_REFERENCE_UPLOAD_BASE64_LENGTH),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const apiKey = await requireUserMuapiKey(ctx.db, ctx.user.id).catch((error) => {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: error instanceof Error ? error.message : "MuAPI API-key ontbreekt.",
        });
      });

      const bytes = Buffer.from(input.base64, "base64");
      if (bytes.byteLength > MAX_REFERENCE_UPLOAD_BYTES) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Referentiebeeld is te groot (max 10MB)." });
      }
      try {
        const url = await uploadFileToMuapi(apiKey, bytes, input.filename, input.contentType);
        if (ctx.user.workspaceId) {
          await addReferenceUpload(ctx.db, ctx.user.workspaceId, {
            url,
            filename: input.filename,
            contentType: input.contentType,
          });
        }
        return { url };
      } catch (error) {
        mapMuapiAuthError(error);
      }
    }),

  uploadMediaFile: aiRateLimitedProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(200),
        contentType: z.string().min(1).max(100).refine(
          (value) =>
            value.startsWith("image/") ||
            value.startsWith("audio/") ||
            value.startsWith("video/"),
          { message: "Alleen afbeeldingen, audio of video zijn toegestaan." },
        ),
        base64: z.string().min(1).max(MAX_MEDIA_UPLOAD_BASE64_LENGTH),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const apiKey = await requireUserMuapiKey(ctx.db, ctx.user.id).catch((error) => {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: error instanceof Error ? error.message : "MuAPI API-key ontbreekt.",
        });
      });

      const bytes = Buffer.from(input.base64, "base64");
      if (bytes.byteLength > MAX_MEDIA_UPLOAD_BYTES) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Bestand is te groot (max 25MB)." });
      }
      try {
        const url = await uploadFileToMuapi(apiKey, bytes, input.filename, input.contentType);
        if (input.contentType.startsWith("image/") && ctx.user.workspaceId) {
          await addReferenceUpload(ctx.db, ctx.user.workspaceId, {
            url,
            filename: input.filename,
            contentType: input.contentType,
          });
        }
        return { url };
      } catch (error) {
        mapMuapiAuthError(error);
      }
    }),

  startLipSyncGeneration: aiRateLimitedProcedure.input(startLipSyncInput).mutation(async ({ ctx, input }) => {
    const apiKey = await requireUserMuapiKey(ctx.db, ctx.user.id).catch((error) => {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: error instanceof Error ? error.message : "MuAPI API-key ontbreekt.",
      });
    });

    const model = getModelById(input.model);
    if (!model || model.type !== "LIP_SYNC") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Onbekend lip sync-model." });
    }
    if (model.lipSyncMode === "PORTRAIT" && !input.imageUrl) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Portretafbeelding is verplicht voor dit model." });
    }
    if (model.lipSyncMode === "VIDEO" && !input.videoUrl) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Videobestand is verplicht voor dit model." });
    }

    const brand = await loadCreativeBrandContext(ctx.db, ctx.user.workspaceId!);
    const enriched = enrichGenerationWithBrand(brand, {
      prompt: input.prompt?.trim() || "",
      modelType: "LIP_SYNC",
      imageUrl: input.imageUrl,
    });

    const job = await createGenerationJob({
      db: ctx.db,
      workspaceId: ctx.user.workspaceId!,
      userId: ctx.user.id,
      type: "LIP_SYNC" as MediaGenerationType,
      model: input.model,
      prompt: input.prompt?.trim() || "",
      socialPostId: input.socialPostId,
      metadata: {
        resolution: input.resolution,
        imageUrl: enriched.imageUrl ?? input.imageUrl,
        videoUrl: input.videoUrl,
        audioUrl: input.audioUrl,
        lipSyncMode: model.lipSyncMode,
        brandApplied: enriched.brandApplied,
        enrichedPrompt: enriched.prompt,
      },
    });

    try {
      const submit = await submitMuapiJob(
        apiKey,
        model.endpoint,
        buildLipSyncPayload({
          model: input.model,
          prompt: enriched.prompt || undefined,
          image_url: input.imageUrl,
          video_url: input.videoUrl,
          audio_url: input.audioUrl,
          resolution: input.resolution,
        }),
      );

      const updated = await ctx.db.mediaGeneration.update({
        where: { id: job.id },
        data: {
          status: submit.requestId ? "PROCESSING" : "COMPLETED",
          requestId: submit.requestId,
          outputUrl: submit.immediateUrl,
        },
      });
      return { jobId: updated.id, status: updated.status, requestId: updated.requestId, outputUrl: updated.outputUrl };
    } catch (error) {
      await ctx.db.mediaGeneration.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Lip sync mislukt",
        },
      });
      mapMuapiAuthError(error);
    }
  }),
});
