import { TRPCError } from "@trpc/server";
import { adVersionTargetKey, googleEditorSelectionSchema } from "../lib/google-editor-selection";
import { listGoogleEditorTargets } from "../lib/google-ads";
import { adProviderConfig } from "../lib/ads-workflow-providers";
import { retryAdRead } from "../lib/ads-workflow-read";
import { z } from "zod";
import { adminProcedure, aiRateLimitedProcedure, mutationProcedure, protectedProcedure } from "../trpc";
import { AD_CAPABILITIES, changePatchSchema, optimizationSettingsSchema, type AdProvider } from "../lib/ads-workflow-policy";
import { applyAdChange, captureAdVersion, createAdChange, decideAdChange, loadOptimizationSettings, optimizeAds, prepareMetaReplacementSwitch, reconcileAdChange, saveOptimizationSettings, summarizeAdPerformance, syncAdAccount } from "../lib/ads-workflow";

// Mounted under the original provider routers so existing module guards apply.
export function adWorkflowProcedures(provider: AdProvider) {
  const idInput = z.object({ id: z.string().min(1) });
  return {
    workflowCapabilities: protectedProcedure.query(() => AD_CAPABILITIES[provider]),
    workflowOverview: protectedProcedure.query(async ({ ctx }) => {
      const where = { createdById: ctx.user.ownerUserId!, provider };
      const [versions, changes, runs, operations, settings, jobs] = await Promise.all([
        ctx.db.adVersion.findMany({ where, orderBy: { syncedAt: "desc" }, take: 100 }),
        ctx.db.adChangeSet.findMany({ where, orderBy: { createdAt: "desc" }, take: 50 }),
        ctx.db.aiOptimizationRun.findMany({ where, orderBy: { createdAt: "desc" }, take: 10 }),
        ctx.db.adSyncOperation.findMany({ where, orderBy: { createdAt: "desc" }, take: 50 }),
        loadOptimizationSettings(ctx.db, ctx.user.workspaceId!, provider),
        ctx.db.adBackgroundJob.findMany({ where, orderBy: { createdAt: "desc" }, take: 30 }),
      ]);
      const seen = new Set<string>();
      const uniqueVersions = versions.filter((v) => !seen.has(adVersionTargetKey(v)) && Boolean(seen.add(adVersionTargetKey(v))));
      return { versions: uniqueVersions, performance: summarizeAdPerformance(uniqueVersions), changes, runs, operations, settings, jobs };
    }),
    workflowSync: adminProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.isViewingAs) throw new TRPCError({ code: "FORBIDDEN" });
      return syncAdAccount(ctx.db, ctx.user.workspaceId!, provider);
    }),
    workflowTargets: protectedProcedure.input(z.object({ campaignId: z.string().regex(/^\d{1,20}$/) })).query(async ({ ctx, input }) => {
      if (provider !== "GOOGLE") return [];
      const config = await adProviderConfig(ctx.db, ctx.user.workspaceId!, provider);
      return retryAdRead(() => listGoogleEditorTargets(config.google!, input.campaignId));
    }),
    workflowImport: mutationProcedure.input(z.object({ campaignId: z.string().regex(/^\d{1,20}$/), target: googleEditorSelectionSchema.optional() })).mutation(({ ctx, input }) =>
      captureAdVersion(ctx.db, ctx.user.workspaceId!, provider, input.campaignId, undefined, input.target)),
    workflowPropose: mutationProcedure.input(z.object({
      versionId: z.string(), patches: z.array(changePatchSchema).min(1).max(60), reason: z.string().min(3).max(2000),
    })).mutation(({ ctx, input }) =>
      createAdChange(ctx.db, ctx.user.workspaceId!, ctx.user.id, provider, input.versionId, input.patches, input.reason)),
    workflowApprove: adminProcedure.input(idInput.extend({ approve: z.boolean(), reason: z.string().max(2000).optional() })).mutation(({ ctx, input }) => {
      if (ctx.user.isViewingAs) throw new TRPCError({ code: "FORBIDDEN" });
      return decideAdChange(ctx.db, ctx.user.workspaceId!, ctx.user.id, provider, input.id, input.approve, input.reason);
    }),
    workflowPublish: adminProcedure.input(idInput).mutation(({ ctx, input }) => {
      if (ctx.user.isViewingAs) throw new TRPCError({ code: "FORBIDDEN" });
      return applyAdChange(ctx.db, ctx.user.workspaceId!, provider, input.id);
    }),
    workflowReconcile: adminProcedure.input(idInput).mutation(({ ctx, input }) => {
      if (ctx.user.isViewingAs) throw new TRPCError({ code: "FORBIDDEN" });
      return reconcileAdChange(ctx.db, ctx.user.workspaceId!, provider, input.id);
    }),
    workflowReplacementSwitch: adminProcedure.input(idInput).mutation(({ ctx, input }) => {
      if (ctx.user.isViewingAs || provider !== "META") throw new TRPCError({ code: "FORBIDDEN" });
      return prepareMetaReplacementSwitch(ctx.db, ctx.user.workspaceId!, ctx.user.id, input.id);
    }),
    workflowOptimize: aiRateLimitedProcedure.input(z.object({ runKey: z.string().trim().min(8).max(160) }).optional()).mutation(({ ctx, input }) => {
      if (ctx.user.isViewingAs) throw new TRPCError({ code: "FORBIDDEN" });
      return optimizeAds(ctx.db, ctx.user.workspaceId!, ctx.user.id, provider, input?.runKey);
    }),
    workflowSettings: adminProcedure.input(optimizationSettingsSchema).mutation(({ ctx, input }) => {
      if (ctx.user.isViewingAs) throw new TRPCError({ code: "FORBIDDEN" });
      return saveOptimizationSettings(ctx.db, ctx.user.workspaceId!, provider, input);
    }),
    workflowRetryJob: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
      if (ctx.user.isViewingAs) throw new TRPCError({ code: "FORBIDDEN" });
      const where = { id: input.id, createdById: ctx.user.ownerUserId!, provider, status: "FAILED", kind: { not: "OPTIMIZE" } };
      return ctx.db.$transaction(async (tx) => {
        const changed = await tx.adBackgroundJob.updateMany({ where, data: { status: "PENDING", attempts: 0, runAt: new Date(), lastError: null } });
        if (!changed.count) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Alleen mislukte veilige achtergrondtaken kunnen opnieuw worden ingepland." });
        await tx.adBackgroundJob.updateMany({ where: { createdById: ctx.user.ownerUserId!, provider, dependencyId: input.id, status: "BLOCKED" }, data: { status: "PENDING", runAt: new Date(), lastError: null } });
        return { scheduled: true };
      });
    }),
    workflowHistory: protectedProcedure.input(z.object({ campaignId: z.string() })).query(({ ctx, input }) =>
      ctx.db.adVersion.findMany({ where: { createdById: ctx.user.ownerUserId!, provider, campaignId: input.campaignId }, orderBy: { syncedAt: "desc" }, take: 30 })),
  };
}
