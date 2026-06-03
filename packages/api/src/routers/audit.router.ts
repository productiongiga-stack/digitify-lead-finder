import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { analyzeWebsite } from "@digitify/connectors";
import { protectedProcedure, router, mutationProcedure } from "../trpc";
import { assertLeadAccess } from "../lib/tenant";
import { getSettingString, settingsRowsToMap } from "../lib/settings";
import { loadWorkspaceSettingRows } from "../lib/workspace-settings";
import { buildWebsiteAuditPayload } from "../lib/website-audit";

function normalizeUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

async function lookupGoogleReviews(apiKey: string, placeId: string) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,rating,userRatingCount",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    rating: typeof data.rating === "number" ? data.rating : null,
    reviewCount: typeof data.userRatingCount === "number" ? data.userRatingCount : null,
  };
}

export const auditRouter = router({
  run: mutationProcedure
    .input(
      z.object({
        url: z.string().min(1),
        leadId: z.string().optional(),
        placeId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const targetUrl = normalizeUrl(input.url);
      if (!targetUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "URL is verplicht." });

      let lead: {
        id: string;
        companyName: string;
        gmbPlaceId: string | null;
        gmbRating: number | null;
        gmbReviewCount: number | null;
      } | null = null;
      if (input.leadId) {
        await assertLeadAccess(ctx.db, ctx.user.workspaceId!, input.leadId);
        lead = await ctx.db.lead.findFirst({
          where: { id: input.leadId, createdById: ctx.user.workspaceId! },
          select: {
            id: true,
            companyName: true,
            gmbPlaceId: true,
            gmbRating: true,
            gmbReviewCount: true,
          },
        });
      }

      const analysis = await analyzeWebsite(targetUrl);
      let reviews: { rating: number | null; reviewCount: number | null; source: string } = {
        rating: lead?.gmbRating ?? null,
        reviewCount: lead?.gmbReviewCount ?? null,
        source: lead?.gmbRating != null || lead?.gmbReviewCount != null ? "lead" : "none",
      };

      const placeId = input.placeId || lead?.gmbPlaceId || undefined;
      if (placeId && (!reviews.rating || !reviews.reviewCount)) {
        const rows = await loadWorkspaceSettingRows(
          ctx.db,
          { workspaceId: ctx.user.workspaceId!, memberId: ctx.user.id },
          ["api.google_places_key"],
        );
        const apiKey = getSettingString(settingsRowsToMap(rows), "api.google_places_key");
        if (apiKey) {
          const remote = await lookupGoogleReviews(apiKey, placeId);
          if (remote) {
            reviews = {
              rating: remote.rating,
              reviewCount: remote.reviewCount,
              source: "google_places",
            };
          }
        }
      }

      const payload = buildWebsiteAuditPayload(analysis, {
        leadId: lead?.id ?? null,
        leadName: lead?.companyName ?? null,
        reviews,
      });
      const overall = payload.metrics.overall;

      const report = await ctx.db.report.create({
        data: {
          title: `Website audit: ${lead?.companyName || analysis.url}`,
          type: "website_audit",
          leadId: lead?.id || null,
          generatedById: ctx.user.workspaceId!,
          data: payload,
        },
      });

      await ctx.db.activity.create({
        data: {
          userId: ctx.user.id,
          leadId: lead?.id || null,
          type: "REPORT_GENERATED",
          title: `Website audit gegenereerd voor ${lead?.companyName || analysis.url}`,
          metadata: { reportId: report.id, overallScore: overall, url: analysis.url },
        },
      });

      return { reportId: report.id, ...payload };
    }),

  listRecent: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(12) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 12;
      return ctx.db.report.findMany({
        where: {
          generatedById: ctx.user.workspaceId!,
          type: "website_audit",
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          title: true,
          createdAt: true,
          leadId: true,
          data: true,
        },
      });
    }),
});
