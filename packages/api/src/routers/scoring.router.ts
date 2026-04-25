import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { computeScore, type ScoringWeightConfig, type LeadData, type EnrichmentPayload } from "@digitify/scoring";
import { analyzeWebsite } from "@digitify/connectors";

export const scoringRouter = router({
  /**
   * Compute score for a lead using current enrichment data + scoring weights.
   * Does NOT re-fetch the website — uses stored enrichment data.
   */
  computeForLead: protectedProcedure
    .input(z.object({ leadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.lead.findUniqueOrThrow({
        where: { id: input.leadId },
        include: { enrichmentData: true, scoringFactors: true },
      });

      const weights = await ctx.db.scoringWeight.findMany({ where: { enabled: true } });

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

      // Upsert scoring factors
      for (const factor of result.factors) {
        const weight = weights.find((w) => w.factorKey === factor.factorKey);
        if (!weight) continue;

        await ctx.db.leadScoringFactor.upsert({
          where: {
            leadId_scoringWeightId: {
              leadId: input.leadId,
              scoringWeightId: weight.id,
            },
          },
          create: {
            leadId: input.leadId,
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
      }

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
  recomputeScores: protectedProcedure
    .input(
      z
        .object({
          leadIds: z.array(z.string()).optional(),
          onlyMissing: z.boolean().default(false),
          limit: z.number().min(1).max(5000).default(1000),
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
      const weights = await ctx.db.scoringWeight.findMany({ where: { enabled: true } });

      const where: Record<string, unknown> = {};
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

      for (const lead of leads) {
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

          const result = computeScore({ lead: leadData, enrichment, weights: weightConfigs });

          await ctx.db.lead.update({
            where: { id: lead.id },
            data: {
              overallScore: result.overallScore,
              scorePriority: result.priority,
              scoreComputedAt: new Date(),
            },
          });

          for (const factor of result.factors) {
            const weight = weights.find((w) => w.factorKey === factor.factorKey);
            if (!weight) continue;
            await ctx.db.leadScoringFactor.upsert({
              where: {
                leadId_scoringWeightId: {
                  leadId: lead.id,
                  scoringWeightId: weight.id,
                },
              },
              create: {
                leadId: lead.id,
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
          }

          updated += 1;
        } catch (error: any) {
          errors.push({
            leadId: lead.id,
            companyName: lead.companyName,
            message: error?.message || "Onbekende fout",
          });
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
  enrichLead: protectedProcedure
    .input(z.object({ leadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.lead.findUniqueOrThrow({
        where: { id: input.leadId },
      });

      if (!lead.website) {
        // No website — store empty enrichment and score based on that
        await ctx.db.enrichmentData.upsert({
          where: { leadId_source: { leadId: input.leadId, source: "website_analyzer" } },
          create: {
            leadId: input.leadId,
            source: "website_analyzer",
            data: { website_analysis: null },
          },
          update: {
            data: { website_analysis: null },
            fetchedAt: new Date(),
          },
        });
      } else {
        // Analyze website
        const analysis = await analyzeWebsite(lead.website);

        // Update lead with discovered info
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

        // Store enrichment data
        await ctx.db.enrichmentData.upsert({
          where: { leadId_source: { leadId: input.leadId, source: "website_analyzer" } },
          create: {
            leadId: input.leadId,
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

        await ctx.db.activity.create({
          data: {
            leadId: input.leadId,
            userId: ctx.user.id,
            type: "LEAD_ENRICHED",
            title: `Website geanalyseerd: ${analysis.technologies.length} technologieën gedetecteerd`,
            metadata: {
              url: analysis.url,
              statusCode: analysis.statusCode,
              hasSSL: analysis.hasSSL,
              loadTimeMs: analysis.loadTimeMs,
              technologies: analysis.technologies,
              discoveredEmails: analysis.contactInfo.emails,
              discoveredPhones: analysis.contactInfo.phones,
            },
          },
        });
      }

      // Now compute the score with the fresh enrichment data
      // Re-fetch lead with enrichment
      const enrichedLead = await ctx.db.lead.findUniqueOrThrow({
        where: { id: input.leadId },
        include: { enrichmentData: true },
      });

      const weights = await ctx.db.scoringWeight.findMany({ where: { enabled: true } });

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

      // Persist factors
      for (const factor of result.factors) {
        const weight = weights.find((w) => w.factorKey === factor.factorKey);
        if (!weight) continue;

        await ctx.db.leadScoringFactor.upsert({
          where: {
            leadId_scoringWeightId: {
              leadId: input.leadId,
              scoringWeightId: weight.id,
            },
          },
          create: {
            leadId: input.leadId,
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
      }

      return {
        enrichment: enrichmentRaw,
        scoring: result,
      };
    }),

  /**
   * Bulk enrich + score multiple leads.
   */
  bulkEnrich: protectedProcedure
    .input(z.object({ leadIds: z.array(z.string()).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const results: { leadId: string; score: number; priority: string; error?: string }[] = [];

      for (const leadId of input.leadIds) {
        try {
          const lead = await ctx.db.lead.findUniqueOrThrow({ where: { id: leadId } });

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
          const enrichedLead = await ctx.db.lead.findUniqueOrThrow({
            where: { id: leadId },
            include: { enrichmentData: true },
          });

          const weights = await ctx.db.scoringWeight.findMany({ where: { enabled: true } });
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
