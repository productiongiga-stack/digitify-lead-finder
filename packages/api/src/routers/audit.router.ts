import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { analyzeWebsite } from "@digitify/connectors";
import { protectedProcedure, router } from "../trpc";
import { assertLeadAccess } from "../lib/tenant";
import { getSettingString, settingsRowsToMap } from "../lib/settings";
import { loadUserSettingRows } from "../lib/user-settings";

function normalizeUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

function scoreRange(value: number, max: number) {
  if (!Number.isFinite(value) || max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
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
  run: protectedProcedure
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
        await assertLeadAccess(ctx.db, ctx.user.id, input.leadId);
        lead = await ctx.db.lead.findFirst({
          where: { id: input.leadId, createdById: ctx.user.id },
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
        const rows = await loadUserSettingRows(ctx.db, ctx.user.id, ["api.google_places_key"]);
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

      const socialCount = Object.values(analysis.socialLinks).filter(Boolean).length;
      const speedScore =
        analysis.loadTimeMs <= 1200 ? 100 :
        analysis.loadTimeMs <= 2000 ? 85 :
        analysis.loadTimeMs <= 3000 ? 65 :
        analysis.loadTimeMs <= 4500 ? 40 : 20;
      const seoSignals = [
        analysis.hasMetaTitle,
        analysis.hasMetaDescription,
        analysis.hasH1,
        analysis.hasStructuredData,
      ].filter(Boolean).length;
      const seoScore = scoreRange(seoSignals, 4);
      const socialScore = scoreRange(socialCount, 4);
      const contactSignals = [
        analysis.contactInfo.emails.length > 0,
        analysis.contactInfo.phones.length > 0,
        analysis.hasCTA,
      ].filter(Boolean).length;
      const contactScore = scoreRange(contactSignals, 3);
      const reviewScore =
        reviews.rating == null
          ? 35
          : Math.max(
              0,
              Math.min(
                100,
                Math.round(((reviews.rating / 5) * 70) + Math.min(30, (reviews.reviewCount || 0) * 1.5)),
              ),
            );
      const overall = Math.round((speedScore * 0.25) + (seoScore * 0.25) + (socialScore * 0.15) + (reviewScore * 0.2) + (contactScore * 0.15));

      const suggestions: string[] = [];
      if (analysis.loadTimeMs > 2500) suggestions.push("Verlaag de laadtijd met gecomprimeerde assets en caching.");
      if (!analysis.hasMetaTitle) suggestions.push("Voeg een duidelijke meta title toe per kernpagina.");
      if (!analysis.hasMetaDescription) suggestions.push("Schrijf unieke meta descriptions met CTA en zoekwoorden.");
      if (!analysis.hasStructuredData) suggestions.push("Implementeer schema.org structured data voor betere SEO-snippets.");
      if (socialCount < 2) suggestions.push("Versterk social presence met minstens 2 actieve sociale profielen.");
      if ((reviews.reviewCount || 0) < 15) suggestions.push("Start een reviewflow om meer Google reviews te verzamelen.");
      if (analysis.contactInfo.emails.length === 0 || analysis.contactInfo.phones.length === 0) {
        suggestions.push("Maak contactgegevens direct zichtbaar in header/footer.");
      }
      if (!analysis.hasCTA) suggestions.push("Voeg een primaire CTA toe boven de vouw (offerte/afspraak/contact).");

      const payload = {
        url: analysis.url,
        checkedAt: new Date().toISOString(),
        leadId: lead?.id || null,
        leadName: lead?.companyName || null,
        metrics: {
          speedScore,
          seoScore,
          socialScore,
          reviewScore,
          contactScore,
          overall,
        },
        checks: {
          statusCode: analysis.statusCode,
          ssl: analysis.hasSSL,
          mobileFriendly: analysis.isMobileFriendly,
          loadTimeMs: analysis.loadTimeMs,
          seo: {
            hasMetaTitle: analysis.hasMetaTitle,
            hasMetaDescription: analysis.hasMetaDescription,
            hasH1: analysis.hasH1,
            hasStructuredData: analysis.hasStructuredData,
          },
          social: analysis.socialLinks,
          reviews,
          contact: analysis.contactInfo,
          hasCTA: analysis.hasCTA,
        },
        technologies: analysis.technologies,
        suggestions,
        errors: analysis.errors,
      };

      const report = await ctx.db.report.create({
        data: {
          title: `Website audit: ${lead?.companyName || analysis.url}`,
          type: "website_audit",
          leadId: lead?.id || null,
          generatedById: ctx.user.id,
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
          generatedById: ctx.user.id,
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
