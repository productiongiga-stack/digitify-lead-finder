import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, aiRateLimitedProcedure, mutationProcedure, protectedProcedure } from "../trpc";
import { adCopilotProviderSchema, adCopilotSourceModeSchema, adResearchInputSchema, adsCopilotStatus, generateAdCampaignProposal, loadAdsCopilotStatus, startAdResearch } from "../lib/ads-copilot";

export const adsCopilotRouter = router({
  status: protectedProcedure.query(({ ctx }) => loadAdsCopilotStatus(ctx.db, ctx.user.workspaceId!)),

  startResearch: aiRateLimitedProcedure.input(adResearchInputSchema).mutation(async ({ ctx, input }) => {
    if (ctx.user.isViewingAs) throw new TRPCError({ code: "FORBIDDEN", message: "AI-onderzoek is niet beschikbaar tijdens het bekijken van een ander account." });
    if (input.sourceMode === "ACCOUNT_AND_WEB" && !adsCopilotStatus().webResearchConfigured) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Live webresearch is niet geconfigureerd op de server. Kies eigen accountdata of configureer een zoekprovider." });
    }
    return startAdResearch(ctx.db, ctx.user.workspaceId!, input, ctx.user.ownerUserId!);
  }),

  getResearchRun: protectedProcedure.input(z.object({ id: z.string().min(1) })).query(({ ctx, input }) =>
    ctx.db.adResearchRun.findFirst({
      where: { id: input.id, createdById: ctx.user.ownerUserId! },
      include: { evidence: { orderBy: { fetchedAt: "desc" }, take: 50 }, changes: { orderBy: { createdAt: "desc" }, take: 20 } },
    })),

  listResearchRuns: protectedProcedure.input(z.object({ provider: adCopilotProviderSchema.optional(), status: z.string().max(40).optional() }).optional()).query(({ ctx, input }) =>
    ctx.db.adResearchRun.findMany({
      where: { createdById: ctx.user.ownerUserId!, ...(input?.provider && input.provider !== "BOTH" ? { provider: { in: [input.provider, "BOTH"] } } : {}), ...(input?.status ? { status: input.status } : {}) },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, provider: true, sourceMode: true, status: true, objective: true, profileHash: true, profileVersion: true, promptVersion: true, model: true, result: true, attempts: true, lastError: true, createdAt: true, completedAt: true },
    })),

  retryResearch: mutationProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    if (ctx.user.isViewingAs) throw new TRPCError({ code: "FORBIDDEN" });
    const run = await ctx.db.adResearchRun.findFirst({ where: { id: input.id, createdById: ctx.user.ownerUserId! } });
    if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Researchrun niet gevonden." });
    if (!["FAILED", "BLOCKED"].includes(run.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Alleen mislukte researchruns kunnen opnieuw worden gestart." });
    await ctx.db.adResearchRun.update({ where: { id: run.id }, data: { status: "PENDING", attempts: 0, lastError: null, completedAt: null, startedAt: null } });
    await ctx.db.adBackgroundJob.upsert({ where: { dedupeKey: `RESEARCH:${run.id}` }, update: { status: "PENDING", attempts: 0, runAt: new Date(), lastError: null, leaseToken: null, leasedUntil: null }, create: { createdById: ctx.user.ownerUserId!, provider: run.provider === "META" ? "META" : "GOOGLE", kind: "RESEARCH", dedupeKey: `RESEARCH:${run.id}` } });
    return { scheduled: true };
  }),

  getResearchEvidence: protectedProcedure.input(z.object({ researchRunId: z.string().min(1) })).query(({ ctx, input }) =>
    ctx.db.adResearchEvidence.findMany({ where: { researchRunId: input.researchRunId, createdById: ctx.user.ownerUserId! }, orderBy: { fetchedAt: "desc" }, take: 100 })),

  generateCampaignProposal: mutationProcedure.input(z.object({ researchRunId: z.string().min(1), versionId: z.string().min(1) })).mutation(({ ctx, input }) => {
    if (ctx.user.isViewingAs) throw new TRPCError({ code: "FORBIDDEN" });
    return generateAdCampaignProposal(ctx.db, ctx.user.ownerUserId!, ctx.user.id, input.researchRunId, input.versionId);
  }),

  validateSourceMode: protectedProcedure.input(z.object({ sourceMode: adCopilotSourceModeSchema })).query(({ input }) => ({ sourceMode: input.sourceMode, available: input.sourceMode === "ACCOUNT_DATA" || adsCopilotStatus().webResearchConfigured })),
});
