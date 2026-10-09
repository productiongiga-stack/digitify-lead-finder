import { z } from "zod";
import { router, aiRateLimitedProcedure, mutationProcedure, protectedProcedure } from "../trpc";
import {
  adsWizardCreateInputSchema,
  adsWizardSaveInputSchema,
  archiveAdsWizardProject,
  createAdsWizardProject,
  listAdsWizardAssets,
  reviewAdsWizardProject,
  resumeAdsWizardProject,
  saveAdsWizardProject,
  adsWizardSharedReviewInputSchema,
  wizardOwnerId,
} from "../lib/ads-wizard";
import { campaignProposalInputSchema, draftContentInputSchema, generateAdsWizardCampaignProposal, generateAdsWizardDraftContent, generateAdsWizardStrategy, generateGoogleSearchPlan, generatePerformanceMaxPlan, googleSearchPlanInputSchema, performanceMaxPlanInputSchema, strategyInputSchema } from "../lib/ads-wizard-ai";
import { createAdsWizardNativeDraft, nativeDraftApprovalInputSchema, nativeDraftInputSchema, nativeDraftReviewInputSchema, nativeDraftStatusInputSchema, reviewAdsWizardNativeDraft, submitAdsWizardNativeDraftForApproval, syncAdsWizardNativeDraftStatus } from "../lib/ads-wizard-drafts";

export const adsWizardRouter = router({
  list: protectedProcedure
    .input(z.object({ includeArchived: z.boolean().default(false) }).optional())
    .query(({ ctx, input }) => ctx.db.adsWizardProject.findMany({
      where: {
        createdById: wizardOwnerId(ctx),
        ...(input?.includeArchived ? {} : { status: { not: "ARCHIVED" } }),
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    })),

  listAssets: protectedProcedure
    .query(({ ctx }) => listAdsWizardAssets(ctx.db, ctx)),

  get: protectedProcedure
    .input(z.object({ id: z.string().trim().min(1) }))
    .query(({ ctx, input }) => ctx.db.adsWizardProject.findFirst({
      where: { id: input.id, createdById: wizardOwnerId(ctx) },
    })),

  create: mutationProcedure
    .input(adsWizardCreateInputSchema)
    .mutation(({ ctx, input }) => createAdsWizardProject(ctx.db, ctx, input)),

  save: mutationProcedure
    .input(adsWizardSaveInputSchema)
    .mutation(({ ctx, input }) => saveAdsWizardProject(ctx.db, ctx, input)),

  generateStrategy: aiRateLimitedProcedure
    .input(strategyInputSchema)
    .mutation(({ ctx, input }) => generateAdsWizardStrategy(ctx.db, ctx, input)),

  generateCampaignProposal: aiRateLimitedProcedure
    .input(campaignProposalInputSchema)
    .mutation(({ ctx, input }) => generateAdsWizardCampaignProposal(ctx.db, ctx, input)),

  generateDraftContent: aiRateLimitedProcedure
    .input(draftContentInputSchema)
    .mutation(({ ctx, input }) => generateAdsWizardDraftContent(ctx.db, ctx, input)),

  generateGoogleSearchPlan: aiRateLimitedProcedure
    .input(googleSearchPlanInputSchema)
    .mutation(({ ctx, input }) => generateGoogleSearchPlan(ctx.db, ctx, input)),

  generatePerformanceMaxPlan: aiRateLimitedProcedure
    .input(performanceMaxPlanInputSchema)
    .mutation(({ ctx, input }) => generatePerformanceMaxPlan(ctx.db, ctx, input)),

  createNativeDraft: mutationProcedure
    .input(nativeDraftInputSchema)
    .mutation(({ ctx, input }) => createAdsWizardNativeDraft(ctx.db, ctx, input)),

  reviewNativeDraft: mutationProcedure
    .input(nativeDraftReviewInputSchema)
    .mutation(({ ctx, input }) => reviewAdsWizardNativeDraft(ctx.db, ctx, input)),

  submitNativeDraftForApproval: mutationProcedure
    .input(nativeDraftApprovalInputSchema)
    .mutation(({ ctx, input }) => submitAdsWizardNativeDraftForApproval(ctx.db, ctx, input)),

  syncNativeDraftStatus: mutationProcedure
    .input(nativeDraftStatusInputSchema)
    .mutation(({ ctx, input }) => syncAdsWizardNativeDraftStatus(ctx.db, ctx, input)),

  reviewProject: mutationProcedure
    .input(adsWizardSharedReviewInputSchema)
    .mutation(({ ctx, input }) => reviewAdsWizardProject(ctx.db, ctx, input)),

  archive: mutationProcedure
    .input(z.object({ id: z.string().trim().min(1) }))
    .mutation(({ ctx, input }) => archiveAdsWizardProject(ctx.db, ctx, input.id)),

  resume: mutationProcedure
    .input(z.object({ id: z.string().trim().min(1) }))
    .mutation(({ ctx, input }) => resumeAdsWizardProject(ctx.db, ctx, input.id)),
});
