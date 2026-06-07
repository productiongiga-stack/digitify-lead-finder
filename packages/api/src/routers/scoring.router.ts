import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, aiRateLimitedProcedure, mutationProcedure } from "../trpc";
import { computeScore, type ScoringWeightConfig, type LeadData, type EnrichmentPayload } from "@digitify/scoring";
import { analyzeWebsite } from "@digitify/connectors";
import { assertLeadAccess } from "../lib/tenant";
import { loadMergedScoringWeights } from "../lib/scoring-weights";
import { buildWebsiteAuditPayload, websiteAnalysisToEnrichment } from "../lib/website-audit";

type ScoringWeightRow = {
  id: string;
  factorKey: string;
};

type ComputedFactor = {
  factorKey: string;
  rawValue: number;
  weightedValue: number;
  explanation: string;
};

async function upsertLeadScoringFactors(
  db: {
    leadScoringFactor: {
      upsert: (args: {
        where: { leadId_scoringWeightId: { leadId: string; scoringWeightId: string } };
        create: {
          leadId: string;
          scoringWeightId: string;
          rawValue: number;
          weightedValue: number;
          explanation: string;
        };
        update: {
          rawValue: number;
          weightedValue: number;
          explanation: string;
        };
      }) => Promise<unknown>;
    };
  },
  leadId: string,
  factors: ComputedFactor[],
  weights: ScoringWeightRow[],
) {
  const weightByKey = new Map(weights.map((weight) => [weight.factorKey, weight]));

  await Promise.all(
    factors.map((factor) => {
      const weight = weightByKey.get(factor.factorKey);
      if (!weight) return Promise.resolve();

      return db.leadScoringFactor.upsert({
        where: {
          leadId_scoringWeightId: {
            leadId,
            scoringWeightId: weight.id,
          },
        },
        create: {
          leadId,
          scoringWeightId: weight.id,
          rawValue: factor.rawValue,
          weightedValue: factor.weightedValue,
          explanation: factor.explanation,
        },
        update: {
          rawValue: factor.rawValue,
          weightedValue: factor.weightedValue,
          explanation: factor.explanation,
        },
      });
    }),
  );
}

export const scoringRouter = router({
  /**
   * Compute score for a lead using current enrichment data + scoring weights.
   * Does NOT re-fetch the website — uses stored enrichment data.
   */
  computeForLead: mutationProcedure
    .input(z.object({ leadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertLeadAccess(ctx.db, ctx.user.workspaceId!, input.leadId);
      const lead = await ctx.db.lead.findFirstOrThrow({
        where: { id: input.leadId, createdById: ctx.user.workspaceId! },
        include: { enrichmentData: true, scoringFactors: true },
      });

      const merged = await loadMergedScoringWeights(ctx.db, ctx.user.workspaceId!);
      const weights = merged.filter((w) => w.enabled);

      const enrichmentRaw = lead.enrichmentData?.[0]?.data as Record<string, unknown> | null;

      const leadData: LeadData = {
        companyName: lead.companyName,
        website: lead.website,
        email: lead.email,
        phone: lead.phone,
        gmbRating: lead.gmbRating ? Number(lead.gmbRating) : null,
        gmbReviewCount: lead.gmbReviewCount,
        gmbCategories: (lead.gmbCategories as string[]) || [],
        facebookUrl: lead.facebookUrl,
        instagramUrl: lead.instagramUrl,
        linkedinUrl: lead.linkedinUrl,
        twitterUrl: lead.twitterUrl,
        tiktokUrl: lead.tiktokUrl,
        youtubeUrl: lead.youtubeUrl,
      };

      const enrichment: EnrichmentPayload = {
        website_analysis: enrichmentRaw?.website_analysis as EnrichmentPayload["website_analysis"],
        social_analysis: enrichmentRaw?.social_analysis as EnrichmentPayload["social_analysis"],
      };

      const weightConfigs: ScoringWeightConfig[] = weights.map((w) => ({
        factorKey: w.factorKey,
        label: w.label,
        weight: w.weight,
        maxPoints: w.maxPoints,
        enabled: w.enabled,
        category: w.category,
      }));

      const result = computeScore({ lead: leadData, enrichment, weights: weightConfigs });

      // Persist scores to the lead
      await ctx.db.lead.update({
        where: { id: input.leadId },
        data: {
          overallScore: result.overallScore,
          scorePriority: result.priority,
          scoreComputedAt: new Date(),
        },
      });

      await upsertLeadScoringFactors(ctx.db, input.leadId, result.factors, weights);

      await ctx.db.activity.create({
        data: {
          leadId: input.leadId,
          userId: ctx.user.id,
          type: "LEAD_SCORED",
          title: `Score berekend: ${result.overallScore}/100 (${result.priority})`,
          metadata: {
            painPoints: result.painPoints,
            suggestedServices: result.suggestedServices,
            bestNextAction: result.bestNextAction,
          },
        },
      });

      return result;
    }),

  /**
   * Recompute scores for many or all leads using existing enrichment data.
   * Fast path for keeping the lead list up-to-date without re-running website analysis.
   */
  recomputeScores: mutationProcedure
    .input(
      z
        .object({
          leadIds: z.array(z.string()).optional(),
          onlyMissing: z.boolean().default(false),
          limit: z.number().min(1).max(5000).default(200),
        })
        .optional()
    )
    .mutation(async ({ ctx, input }) => {
      const params: {
        leadIds?: string[];
        onlyMissing: boolean;
        limit: number;
      } = {
        leadIds: input?.leadIds,
        onlyMissing: input?.onlyMissing ?? false,
        limit: input?.limit ?? 500,
      };
      const merged = await loadMergedScoringWeights(ctx.db, ctx.user.workspaceId!);
      const weights = merged.filter((w) => w.enabled);

      const where: Record<string, unknown> = {
        createdById: ctx.user.workspaceId!,
      };
      if (params.leadIds?.length) {
        where.id = { in: params.leadIds };
      }
      if (params.onlyMissing) {
        where.OR = [{ overallScore: null }, { scoreComputedAt: null }];
      }

      const leads = await ctx.db.lead.findMany({
        where,
        include: { enrichmentData: true },
        take: params.leadIds?.length ? params.leadIds.length : params.limit,
      });

      const weightConfigs: ScoringWeightConfig[] = weights.map((w) => ({
        factorKey: w.factorKey,
        label: w.label,
        weight: w.weight,
        maxPoints: w.maxPoints,
        enabled: w.enabled,
        category: w.category,
      }));

      let updated = 0;
      const errors: Array<{ leadId: string; companyName: string; message: string }> = [];
      const CHUNK_SIZE = 50;

      for (let offset = 0; offset < leads.length; offset += CHUNK_SIZE) {
        const chunk = leads.slice(offset, offset + CHUNK_SIZE);
        const computed: Array<{
          lead: (typeof leads)[number];
          result: ReturnType<typeof computeScore>;
        }> = [];

        for (const lead of chunk) {
          try {
            const enrichmentRows = lead.enrichmentData as Array<{
              source: string;
              data: unknown;
            }>;
            const bestEnrichmentRow =
              enrichmentRows.find((row) => row.source === "website_analyzer") ??
              enrichmentRows[0];
            const enrichmentRaw = (bestEnrichmentRow?.data as Record<string, unknown> | undefined) ?? {};

            const leadData: LeadData = {
              companyName: lead.companyName,
              website: lead.website,
              email: lead.email,
              phone: lead.phone,
              gmbRating: lead.gmbRating ? Number(lead.gmbRating) : null,
              gmbReviewCount: lead.gmbReviewCount,
              gmbCategories: (lead.gmbCategories as string[]) || [],
              facebookUrl: lead.facebookUrl,
              instagramUrl: lead.instagramUrl,
              linkedinUrl: lead.linkedinUrl,
              twitterUrl: lead.twitterUrl,
              tiktokUrl: lead.tiktokUrl,
              youtubeUrl: lead.youtubeUrl,
            };

            const enrichment: EnrichmentPayload = {
              website_analysis: enrichmentRaw.website_analysis as EnrichmentPayload["website_analysis"],
              social_analysis: enrichmentRaw.social_analysis as EnrichmentPayload["social_analysis"],
            };

            computed.push({
              lead,
              result: computeScore({ lead: leadData, enrichment, weights: weightConfigs }),
            });
          } catch (error: any) {
            errors.push({
              leadId: lead.id,
              companyName: lead.companyName,
              message: error?.message || "Onbekende fout",
            });
          }
        }

        if (computed.length > 0) {
          await ctx.db.$transaction(
            computed.map(({ lead, result }) =>
              ctx.db.lead.update({
                where: { id: lead.id },
                data: {
                  overallScore: result.overallScore,
                  scorePriority: result.priority,
                  scoreComputedAt: new Date(),
                },
              }),
            ),
          );

          await Promise.all(
            computed.map(({ lead, result }) =>
              upsertLeadScoringFactors(ctx.db, lead.id, result.factors, weights),
            ),
          );

          updated += computed.length;
        }
      }

      await ctx.db.activity.create({
        data: {
          userId: ctx.user.id,
          type: "LEAD_SCORED",
          title: `Batch scoring uitgevoerd: ${updated}/${leads.length} leads`,
          metadata: {
            total: leads.length,
            updated,
            failed: errors.length,
          },
        },
      });

      return {
        total: leads.length,
        updated,
        failed: errors.length,
        errors,
      };
    }),

  /**
   * Enrich a lead: analyze its website, store enrichment data, then compute score.
   */
  enrichLead: aiRateLimitedProcedure
    .input(z.object({ leadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertLeadAccess(ctx.db, ctx.user.workspaceId!, input.leadId);
      const lead = await ctx.db.lead.findFirstOrThrow({
        where: { id: input.leadId, createdById: ctx.user.workspaceId! },
      });

      const website = lead.website?.trim();
      if (!website) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Deze lead heeft geen website-URL. Voeg eerst een website toe om te analyseren.",
        });
      }

      const analysis = await analyzeWebsite(website);
      const enrichmentSnapshot = websiteAnalysisToEnrichment(analysis);

      const updates: Record<string, unknown> = {};
      if (!lead.email && analysis.contactInfo.emails.length > 0) {
        updates.email = analysis.contactInfo.emails[0];
      }
      if (!lead.phone && analysis.contactInfo.phones.length > 0) {
        updates.phone = analysis.contactInfo.phones[0];
      }
      if (!lead.facebookUrl && analysis.socialLinks.facebook) {
        updates.facebookUrl = analysis.socialLinks.facebook;
      }
      if (!lead.instagramUrl && analysis.socialLinks.instagram) {
        updates.instagramUrl = analysis.socialLinks.instagram;
      }
      if (!lead.linkedinUrl && analysis.socialLinks.linkedin) {
        updates.linkedinUrl = analysis.socialLinks.linkedin;
      }
      if (!lead.twitterUrl && analysis.socialLinks.twitter) {
        updates.twitterUrl = analysis.socialLinks.twitter;
      }
      if (!lead.youtubeUrl && analysis.socialLinks.youtube) {
        updates.youtubeUrl = analysis.socialLinks.youtube;
      }
      if (!lead.tiktokUrl && analysis.socialLinks.tiktok) {
        updates.tiktokUrl = analysis.socialLinks.tiktok;
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.lead.update({ where: { id: input.leadId }, data: updates as any });
      }

      await ctx.db.enrichmentData.upsert({
        where: { leadId_source: { leadId: input.leadId, source: "website_analyzer" } },
        create: {
          leadId: input.leadId,
          source: "website_analyzer",
          data: { website_analysis: enrichmentSnapshot },
        },
        update: {
          data: { website_analysis: enrichmentSnapshot },
          fetchedAt: new Date(),
        },
      });

      const auditPayload = buildWebsiteAuditPayload(analysis, {
        leadId: lead.id,
        leadName: lead.companyName,
        reviews: {
          rating: lead.gmbRating ? Number(lead.gmbRating) : null,
          reviewCount: lead.gmbReviewCount,
          source: lead.gmbRating != null || lead.gmbReviewCount != null ? "lead" : "none",
        },
      });

      const auditReport = await ctx.db.report.create({
        data: {
          title: `Website audit: ${lead.companyName}`,
          type: "website_audit",
          leadId: lead.id,
          generatedById: ctx.user.workspaceId!,
          data: auditPayload,
        },
      });

      await ctx.db.activity.create({
        data: {
          leadId: input.leadId,
          userId: ctx.user.id,
          type: "LEAD_ENRICHED",
          title: `Website geanalyseerd voor ${lead.companyName}`,
          metadata: {
            url: analysis.url,
            statusCode: analysis.statusCode,
            hasSSL: analysis.hasSSL,
            loadTimeMs: analysis.loadTimeMs,
            technologies: analysis.technologies,
            pagesChecked: analysis.uxAudit.pagesChecked,
            pagesBroken: analysis.uxAudit.pagesBroken,
            reportId: auditReport.id,
            auditOverall: auditPayload.metrics.overall,
          },
        },
      });

      // Now compute the score with the fresh enrichment data
      // Re-fetch lead with enrichment
      const enrichedLead = await ctx.db.lead.findFirstOrThrow({
        where: { id: input.leadId, createdById: ctx.user.workspaceId! },
        include: { enrichmentData: true },
      });

      const merged = await loadMergedScoringWeights(ctx.db, ctx.user.workspaceId!);
      const weights = merged.filter((w) => w.enabled);

      const enrichmentRaw = enrichedLead.enrichmentData?.[0]?.data as Record<string, unknown> | null;

      const leadData: LeadData = {
        companyName: enrichedLead.companyName,
        website: enrichedLead.website,
        email: enrichedLead.email,
        phone: enrichedLead.phone,
        gmbRating: enrichedLead.gmbRating ? Number(enrichedLead.gmbRating) : null,
        gmbReviewCount: enrichedLead.gmbReviewCount,
        gmbCategories: (enrichedLead.gmbCategories as string[]) || [],
        facebookUrl: enrichedLead.facebookUrl,
        instagramUrl: enrichedLead.instagramUrl,
        linkedinUrl: enrichedLead.linkedinUrl,
        twitterUrl: enrichedLead.twitterUrl,
        tiktokUrl: enrichedLead.tiktokUrl,
        youtubeUrl: enrichedLead.youtubeUrl,
      };

      const enrichment: EnrichmentPayload = {
        website_analysis: enrichmentRaw?.website_analysis as EnrichmentPayload["website_analysis"],
        social_analysis: enrichmentRaw?.social_analysis as EnrichmentPayload["social_analysis"],
      };

      const weightConfigs: ScoringWeightConfig[] = weights.map((w) => ({
        factorKey: w.factorKey,
        label: w.label,
        weight: w.weight,
        maxPoints: w.maxPoints,
        enabled: w.enabled,
        category: w.category,
      }));

      const result = computeScore({ lead: leadData, enrichment, weights: weightConfigs });

      // Update lead scores
      await ctx.db.lead.update({
        where: { id: input.leadId },
        data: {
          overallScore: result.overallScore,
          scorePriority: result.priority,
          scoreComputedAt: new Date(),
        },
      });

      await upsertLeadScoringFactors(ctx.db, input.leadId, result.factors, weights);

      await ctx.db.activity.create({
        data: {
          leadId: input.leadId,
          userId: ctx.user.id,
          type: "LEAD_SCORED",
          title: `Score berekend: ${result.overallScore}/100 (${result.priority})`,
          metadata: {
            painPoints: result.painPoints,
            suggestedServices: result.suggestedServices,
            bestNextAction: result.bestNextAction,
            reportId: auditReport.id,
          },
        },
      });

      return {
        enrichment: enrichmentRaw,
        scoring: result,
        reportId: auditReport.id,
        auditOverall: auditPayload.metrics.overall,
      };
    }),

  /**
   * Bulk enrich + score multiple leads.
   */
  bulkEnrich: aiRateLimitedProcedure
    .input(z.object({ leadIds: z.array(z.string()).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const results: { leadId: string; score: number; priority: string; error?: string }[] = [];

      for (const leadId of input.leadIds) {
        try {
          const lead = await ctx.db.lead.findFirstOrThrow({
            where: { id: leadId, createdById: ctx.user.workspaceId! },
          });

          if (lead.website) {
            const analysis = await analyzeWebsite(lead.website);

            await ctx.db.enrichmentData.upsert({
              where: { leadId_source: { leadId, source: "website_analyzer" } },
              create: {
                leadId,
                source: "website_analyzer",
                data: {
                  website_analysis: {
                    hasSSL: analysis.hasSSL,
                    isMobileFriendly: analysis.isMobileFriendly,
                    loadTimeMs: analysis.loadTimeMs,
                    hasMetaTitle: analysis.hasMetaTitle,
                    hasMetaDescription: analysis.hasMetaDescription,
                    hasH1: analysis.hasH1,
                    hasStructuredData: analysis.hasStructuredData,
                    hasFavicon: analysis.hasFavicon,
                    hasAnalytics: analysis.hasAnalytics,
                    hasCTA: analysis.hasCTA,
                    contentLength: analysis.contentLength,
                    lastModified: analysis.lastModified,
                    technologies: analysis.technologies,
                  },
                },
              },
              update: {
                data: {
                  website_analysis: {
                    hasSSL: analysis.hasSSL,
                    isMobileFriendly: analysis.isMobileFriendly,
                    loadTimeMs: analysis.loadTimeMs,
                    hasMetaTitle: analysis.hasMetaTitle,
                    hasMetaDescription: analysis.hasMetaDescription,
                    hasH1: analysis.hasH1,
                    hasStructuredData: analysis.hasStructuredData,
                    hasFavicon: analysis.hasFavicon,
                    hasAnalytics: analysis.hasAnalytics,
                    hasCTA: analysis.hasCTA,
                    contentLength: analysis.contentLength,
                    lastModified: analysis.lastModified,
                    technologies: analysis.technologies,
                  },
                },
                fetchedAt: new Date(),
              },
            });
          }

          // Compute score
          const enrichedLead = await ctx.db.lead.findFirstOrThrow({
            where: { id: leadId, createdById: ctx.user.workspaceId! },
            include: { enrichmentData: true },
          });

          const merged = await loadMergedScoringWeights(ctx.db, ctx.user.workspaceId!);
      const weights = merged.filter((w) => w.enabled);
          const enrichmentRaw = enrichedLead.enrichmentData?.[0]?.data as Record<string, unknown> | null;

          const leadData: LeadData = {
            companyName: enrichedLead.companyName,
            website: enrichedLead.website,
            email: enrichedLead.email,
            phone: enrichedLead.phone,
            gmbRating: enrichedLead.gmbRating ? Number(enrichedLead.gmbRating) : null,
            gmbReviewCount: enrichedLead.gmbReviewCount,
            gmbCategories: (enrichedLead.gmbCategories as string[]) || [],
            facebookUrl: enrichedLead.facebookUrl,
            instagramUrl: enrichedLead.instagramUrl,
            linkedinUrl: enrichedLead.linkedinUrl,
            twitterUrl: enrichedLead.twitterUrl,
            tiktokUrl: enrichedLead.tiktokUrl,
            youtubeUrl: enrichedLead.youtubeUrl,
          };

          const enrichment: EnrichmentPayload = {
            website_analysis: enrichmentRaw?.website_analysis as EnrichmentPayload["website_analysis"],
            social_analysis: enrichmentRaw?.social_analysis as EnrichmentPayload["social_analysis"],
          };

          const weightConfigs: ScoringWeightConfig[] = weights.map((w) => ({
            factorKey: w.factorKey,
            label: w.label,
            weight: w.weight,
            maxPoints: w.maxPoints,
            enabled: w.enabled,
            category: w.category,
          }));

          const scoreResult = computeScore({ lead: leadData, enrichment, weights: weightConfigs });

          await ctx.db.lead.update({
            where: { id: leadId },
            data: {
              overallScore: scoreResult.overallScore,
              scorePriority: scoreResult.priority,
              scoreComputedAt: new Date(),
            },
          });

          results.push({ leadId, score: scoreResult.overallScore, priority: scoreResult.priority });
        } catch (error: any) {
          results.push({ leadId, score: 0, priority: "Low", error: error.message });
        }
      }

      return { results, total: results.length };
    }),
});
