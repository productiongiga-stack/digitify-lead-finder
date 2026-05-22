import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { assertLeadAccess } from "../lib/tenant";

export const reportRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          page: z.number().min(1).default(1),
          perPage: z.number().min(1).max(50).default(10),
        })
        .default({})
    )
    .query(async ({ ctx, input }) => {
      const { page, perPage } = input;
      const skip = (page - 1) * perPage;

      const [reports, total] = await Promise.all([
        ctx.db.report.findMany({
          where: { generatedById: ctx.user.workspaceId! },
          orderBy: { createdAt: "desc" },
          skip,
          take: perPage,
          include: {
            campaign: { select: { id: true, name: true } },
            generatedBy: { select: { id: true, name: true } },
          },
        }),
        ctx.db.report.count({ where: { generatedById: ctx.user.workspaceId! } }),
      ]);

      return {
        reports,
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const report = await ctx.db.report.findFirst({
        where: { id: input.id, generatedById: ctx.user.workspaceId! },
        include: {
          campaign: { select: { id: true, name: true } },
          generatedBy: { select: { id: true, name: true } },
        },
      });

      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Rapport niet gevonden" });
      return report;
    }),

  generate: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().optional(),
        title: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { campaignId } = input;

      // Fetch leads: either campaign-specific or all
      let leads;
      let campaignName = "Alle Leads";

      if (campaignId) {
        const campaign = await ctx.db.campaign.findFirst({
          where: { id: campaignId, createdById: ctx.user.workspaceId! },
          include: {
            campaignLeads: {
              include: {
                lead: {
                  include: {
                    pipelineStage: true,
                    tags: { include: { tag: true } },
                  },
                },
              },
            },
          },
        });

        if (!campaign)
          throw new TRPCError({ code: "NOT_FOUND", message: "Campagne niet gevonden" });

        campaignName = campaign.name;
        leads = campaign.campaignLeads.map((cl) => cl.lead);
      } else {
        leads = await ctx.db.lead.findMany({
          where: { createdById: ctx.user.workspaceId! },
          include: {
            pipelineStage: true,
            tags: { include: { tag: true } },
          },
        });
      }

      const totalLeads = leads.length;

      // Average score
      const leadsWithScore = leads.filter((l) => l.overallScore != null);
      const avgScore =
        leadsWithScore.length > 0
          ? Math.round(
              (leadsWithScore.reduce((sum, l) => sum + (l.overallScore ?? 0), 0) /
                leadsWithScore.length) *
                10
            ) / 10
          : 0;

      // Score distribution (buckets: 0-20, 20-40, 40-60, 60-80, 80-100)
      const scoreBuckets = [
        { range: "0-20", count: 0 },
        { range: "20-40", count: 0 },
        { range: "40-60", count: 0 },
        { range: "60-80", count: 0 },
        { range: "80-100", count: 0 },
      ];
      for (const lead of leadsWithScore) {
        const s = lead.overallScore ?? 0;
        if (s < 20) scoreBuckets[0].count++;
        else if (s < 40) scoreBuckets[1].count++;
        else if (s < 60) scoreBuckets[2].count++;
        else if (s < 80) scoreBuckets[3].count++;
        else scoreBuckets[4].count++;
      }

      // Hot / Warm / Low counts (based on scorePriority or score thresholds)
      const normalizedPriority = (value: string | null | undefined) => value?.toUpperCase();
      const hotCount = leads.filter(
        (l) => normalizedPriority(l.scorePriority) === "HOT" || (l.overallScore ?? 0) >= 70
      ).length;
      const warmCount = leads.filter(
        (l) =>
          normalizedPriority(l.scorePriority) === "WARM" ||
          ((l.overallScore ?? 0) >= 40 &&
            (l.overallScore ?? 0) < 70 &&
            normalizedPriority(l.scorePriority) !== "HOT")
      ).length;
      const lowCount = totalLeads - hotCount - warmCount;

      // Top niches (industry)
      const nicheCounts: Record<string, number> = {};
      for (const lead of leads) {
        const niche = lead.industry ?? "Onbekend";
        nicheCounts[niche] = (nicheCounts[niche] || 0) + 1;
      }
      const topNiches = Object.entries(nicheCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      // Top cities
      const cityCounts: Record<string, number> = {};
      for (const lead of leads) {
        const city = lead.city ?? "Onbekend";
        cityCounts[city] = (cityCounts[city] || 0) + 1;
      }
      const topCities = Object.entries(cityCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      // Pipeline breakdown
      const pipelineCounts: Record<string, number> = {};
      for (const lead of leads) {
        const stage = lead.pipelineStage?.name ?? "Geen stage";
        pipelineCounts[stage] = (pipelineCounts[stage] || 0) + 1;
      }
      const pipelineBreakdown = Object.entries(pipelineCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // Status breakdown
      const statusCounts: Record<string, number> = {};
      for (const lead of leads) {
        statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;
      }
      const statusBreakdown = Object.entries(statusCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      const reportData = {
        totalLeads,
        avgScore,
        scoreBuckets,
        hotCount,
        warmCount,
        lowCount,
        topNiches,
        topCities,
        pipelineBreakdown,
        statusBreakdown,
        campaignName,
        generatedAt: new Date().toISOString(),
      };

      const title =
        input.title ?? `Rapport: ${campaignName} - ${new Date().toLocaleDateString("nl-BE")}`;

      const report = await ctx.db.report.create({
        data: {
          title,
          type: campaignId ? "campaign" : "all",
          data: reportData,
          campaignId: campaignId ?? null,
          generatedById: ctx.user.workspaceId!,
        },
        include: {
          campaign: { select: { id: true, name: true } },
          generatedBy: { select: { id: true, name: true } },
        },
      });

      return report;
    }),

  generateLeadReport: protectedProcedure
    .input(z.object({ leadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertLeadAccess(ctx.db, ctx.user.workspaceId!, input.leadId);
      const lead = await ctx.db.lead.findFirstOrThrow({
        where: { id: input.leadId, createdById: ctx.user.workspaceId! },
        include: {
          scoringFactors: { include: { scoringWeight: true } },
          enrichmentData: true,
          tags: { include: { tag: true } },
          pipelineStage: true,
          emailDrafts: {
            select: { id: true, status: true, sentAt: true, repliedAt: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      });

      // Build rich report data
      const enrichment = lead.enrichmentData?.[0]?.data as Record<string, any> | undefined;

      const factors = lead.scoringFactors.map((f) => ({
        name: f.scoringWeight.label,
        category: f.scoringWeight.category,
        rawValue: f.rawValue,
        weightedValue: f.weightedValue,
        maxPoints: f.scoringWeight.maxPoints,
        explanation: f.explanation,
      }));

      const painPoints = factors
        .filter((f) => f.rawValue >= 6)
        .map((f) => f.explanation)
        .filter(Boolean);
      const suggestedServices = factors
        .filter((f) => f.rawValue >= 6)
        .map((f) => f.name);

      const highestImpact = [...factors]
        .sort((a, b) => b.weightedValue - a.weightedValue)
        .slice(0, 6);

      const opportunityAreas = highestImpact.map((factor) => ({
        factor: factor.name,
        impactScore: Math.round(factor.weightedValue * 10) / 10,
        urgency:
          factor.rawValue >= 8 ? "hoog" : factor.rawValue >= 6 ? "middel" : "normaal",
        explanation:
          factor.explanation ||
          `${factor.name} scoort momenteel ${factor.rawValue.toFixed(1)}/${factor.maxPoints.toFixed(
            1
          )}.`,
        recommendation: `Verbetering op "${factor.name}" kan direct bijdragen aan meer kwalitatieve aanvragen en betere conversie.`,
      }));

      const sentEmails = lead.emailDrafts.filter((draft) => draft.status === "SENT").length;
      const repliedEmails = lead.emailDrafts.filter((draft) => draft.repliedAt !== null).length;
      const conversionRate = sentEmails > 0 ? Math.round((repliedEmails / sentEmails) * 100) : 0;

      const quickWins = [
        !enrichment?.isMobileFriendly ? "Mobiele gebruikservaring verbeteren voor snellere conversie." : null,
        !enrichment?.hasCTA ? "Duidelijke call-to-action toevoegen op kernpagina's." : null,
        !enrichment?.hasAnalytics ? "Analytics en conversietracking actief maken." : null,
        enrichment?.loadTimeMs && enrichment.loadTimeMs > 2500
          ? `Laadtijd verlagen (nu ${enrichment.loadTimeMs} ms) voor betere SEO en lagere drop-off.`
          : null,
      ].filter(Boolean) as string[];

      const executiveSummary = [
        `${lead.companyName} behaalt momenteel een Opportunity Score van ${lead.overallScore ?? 0}/100 (${lead.scorePriority || "onbekend"}).`,
        `De grootste opportuniteiten zitten in ${opportunityAreas
          .slice(0, 3)
          .map((item) => item.factor)
          .join(", ") || "digitale zichtbaarheid en opvolging"}.`,
        sentEmails > 0
          ? `Van ${sentEmails} verzonden e-mails kwam ${conversionRate}% met een reactie terug.`
          : "Er is nog weinig historische e-mailrespons, dus een gestructureerde opvolgflow levert waarschijnlijk snel winst op.",
      ];

      const reportData = {
        type: "lead_proposal",
        lead: {
          leadId: lead.id,
          companyName: lead.companyName,
          website: lead.website,
          city: lead.city,
          industry: lead.industry,
          phone: lead.phone,
          email: lead.email,
          address: lead.address,
        },
        score: {
          overall: lead.overallScore,
          priority: lead.scorePriority,
          factors,
        },
        audit: enrichment
          ? {
              ssl: enrichment.hasSSL,
              mobileFriendly: enrichment.isMobileFriendly,
              responseTime: enrichment.loadTimeMs,
              hasCTA: enrichment.hasCTA,
              hasAnalytics: enrichment.hasAnalytics,
              technologies: enrichment.technologies || [],
              seo: {
                hasMetaTitle: enrichment.hasMetaTitle ?? enrichment.metaTitle != null,
                hasMetaDescription: enrichment.hasMetaDescription ?? enrichment.metaDescription != null,
                hasH1: enrichment.hasH1 ?? enrichment.h1Text != null,
                hasStructuredData: enrichment.hasStructuredData,
              },
            }
          : null,
        painPoints,
        suggestedServices,
        opportunityAreas,
        quickWins,
        executiveSummary,
        communication: {
          sentEmails,
          repliedEmails,
          conversionRate,
          lastActivityAt: lead.emailDrafts[0]?.createdAt || null,
        },
        context: {
          pipelineStage: lead.pipelineStage?.name || "Geen stage",
          tags: lead.tags.map((t) => t.tag.name),
        },
        tags: lead.tags.map((t) => t.tag.name),
        generatedAt: new Date().toISOString(),
      };

      const existing = await ctx.db.report.findFirst({
        where: { leadId: lead.id, type: "lead_proposal", generatedById: ctx.user.workspaceId! },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      const title = `Klantrapport: ${lead.companyName}`;
      const report = existing
        ? await ctx.db.report.update({
            where: { id: existing.id },
            data: {
              title,
              data: reportData,
              generatedById: ctx.user.workspaceId!,
            },
            include: {
              generatedBy: { select: { id: true, name: true } },
            },
          })
        : await ctx.db.report.create({
            data: {
              title,
              type: "lead_proposal",
              leadId: lead.id,
              data: reportData,
              generatedById: ctx.user.workspaceId!,
            },
            include: {
              generatedBy: { select: { id: true, name: true } },
            },
          });

      await ctx.db.activity.create({
        data: {
          leadId: lead.id,
          userId: ctx.user.id,
          type: "REPORT_GENERATED",
          title: `Klantrapport bijgewerkt voor ${lead.companyName}`,
          metadata: { reportId: report.id, score: lead.overallScore ?? null },
        },
      });

      return report;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const report = await ctx.db.report.findUnique({
        where: { id: input.id },
        select: { id: true, generatedById: true },
      });

      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Rapport niet gevonden" });

      if (report.generatedById !== ctx.user.workspaceId!) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Rapport niet gevonden" });
      }

      await ctx.db.report.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
