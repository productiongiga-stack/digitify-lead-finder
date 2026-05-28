import type { WebsiteAnalysis } from "@digitify/connectors";

export type WebsiteAuditReviews = {
  rating: number | null;
  reviewCount: number | null;
  source: string;
};

export function scoreRange(value: number, max: number) {
  if (!Number.isFinite(value) || max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

export function buildWebsiteAuditPayload(
  analysis: WebsiteAnalysis,
  options: {
    leadId?: string | null;
    leadName?: string | null;
    reviews?: WebsiteAuditReviews;
  } = {},
) {
  const reviews: WebsiteAuditReviews = options.reviews ?? {
    rating: null,
    reviewCount: null,
    source: "none",
  };

  const socialCount = Object.values(analysis.socialLinks).filter(Boolean).length;
  const speedScore =
    analysis.loadTimeMs <= 1200
      ? 100
      : analysis.loadTimeMs <= 2000
        ? 85
        : analysis.loadTimeMs <= 3000
          ? 65
          : analysis.loadTimeMs <= 4500
            ? 40
            : 20;
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
  const ux = analysis.uxAudit;
  const uxSignals = [
    ux.pagesBroken === 0 && ux.pagesChecked > 0,
    ux.buttonCount >= 2,
    ux.formCount >= 1 || analysis.hasCTA,
    ux.imagesMissingAlt === 0 || ux.imagesTotal === 0,
  ].filter(Boolean).length;
  const uxScore = scoreRange(uxSignals, 4);
  const reviewScore =
    reviews.rating == null
      ? 35
      : Math.max(
          0,
          Math.min(
            100,
            Math.round((reviews.rating / 5) * 70 + Math.min(30, (reviews.reviewCount || 0) * 1.5)),
          ),
        );
  const overall = Math.round(
    speedScore * 0.2 +
      seoScore * 0.2 +
      socialScore * 0.1 +
      reviewScore * 0.15 +
      contactScore * 0.15 +
      uxScore * 0.2,
  );

  const suggestions: string[] = [];
  if (analysis.loadTimeMs > 2500) {
    suggestions.push("Verlaag de laadtijd met gecomprimeerde assets en caching.");
  }
  if (!analysis.hasMetaTitle) suggestions.push("Voeg een duidelijke meta title toe per kernpagina.");
  if (!analysis.hasMetaDescription) {
    suggestions.push("Schrijf unieke meta descriptions met CTA en zoekwoorden.");
  }
  if (!analysis.hasStructuredData) {
    suggestions.push("Implementeer schema.org structured data voor betere SEO-snippets.");
  }
  if (socialCount < 2) {
    suggestions.push("Versterk social presence met minstens 2 actieve sociale profielen.");
  }
  if ((reviews.reviewCount || 0) < 15) {
    suggestions.push("Start een reviewflow om meer Google reviews te verzamelen.");
  }
  if (analysis.contactInfo.emails.length === 0 || analysis.contactInfo.phones.length === 0) {
    suggestions.push("Maak contactgegevens direct zichtbaar in header/footer.");
  }
  if (!analysis.hasCTA) {
    suggestions.push("Voeg een primaire CTA toe boven de vouw (offerte/afspraak/contact).");
  }
  if (ux.pagesBroken > 0) {
    suggestions.push(
      `${ux.pagesBroken} van ${ux.pagesChecked} gecontroleerde pagina's reageert niet correct — herstel broken links of serverfouten.`,
    );
  }
  if (ux.buttonCount < 2) {
    suggestions.push("Voeg duidelijke actieknoppen toe (contact, offerte, reserveren) op kernpagina's.");
  }
  if (ux.imagesMissingAlt > 0) {
    suggestions.push(
      `Vul alt-teksten in voor ${ux.imagesMissingAlt} afbeelding(en) — beter voor SEO en toegankelijkheid.`,
    );
  }
  if (!analysis.hasFavicon) {
    suggestions.push("Voeg een favicon toe voor een professionelere uitstraling in tabs en bookmarks.");
  }
  if (!analysis.hasAnalytics) {
    suggestions.push("Installeer analytics (bv. GA4) om bezoekersgedrag te meten en te optimaliseren.");
  }
  if (analysis.statusCode >= 400) {
    suggestions.push(`Homepage geeft HTTP ${analysis.statusCode} — controleer hosting en routing.`);
  }

  return {
    url: analysis.url,
    checkedAt: new Date().toISOString(),
    leadId: options.leadId ?? null,
    leadName: options.leadName ?? null,
    metrics: {
      speedScore,
      seoScore,
      socialScore,
      reviewScore,
      contactScore,
      uxScore,
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
      hasFavicon: analysis.hasFavicon,
      hasAnalytics: analysis.hasAnalytics,
      metaTitle: analysis.metaTitle,
      metaDescription: analysis.metaDescription,
      h1Text: analysis.h1Text,
      ux: analysis.uxAudit,
    },
    technologies: analysis.technologies,
    suggestions,
    errors: analysis.errors,
  };
}

export function websiteAnalysisToEnrichment(analysis: WebsiteAnalysis) {
  return {
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
    statusCode: analysis.statusCode,
    metaTitle: analysis.metaTitle,
    metaDescription: analysis.metaDescription,
    h1Text: analysis.h1Text,
    contactFormFound: analysis.uxAudit.formCount > 0,
    uxAudit: analysis.uxAudit,
    url: analysis.url,
  };
}
