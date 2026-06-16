import { describe, it, expect } from "vitest";
import { computeScore } from "../engine";
import type { LeadData, EnrichmentPayload, ScoringWeightConfig } from "../types";

const baseLead: LeadData = {
  companyName: "Test BV",
  website: null,
  email: null,
  phone: null,
  gmbRating: null,
  gmbReviewCount: null,
  gmbCategories: [],
  facebookUrl: null,
  instagramUrl: null,
  linkedinUrl: null,
  twitterUrl: null,
  tiktokUrl: null,
  youtubeUrl: null,
};

const weights: ScoringWeightConfig[] = [
  { factorKey: "has_website", label: "Website", weight: 1, maxPoints: 10, enabled: true, category: "website" },
  { factorKey: "gmb_rating", label: "Rating", weight: 1, maxPoints: 10, enabled: true, category: "gmb" },
];

describe("computeScore semantics", () => {
  it("scores higher opportunity for leads without website", () => {
    const noWebsite = computeScore({ lead: baseLead, enrichment: {}, weights });
    const withWebsite = computeScore({
      lead: { ...baseLead, website: "https://example.com" },
      enrichment: {},
      weights,
    });
    expect(noWebsite.overallScore).toBeGreaterThan(withWebsite.overallScore);
  });

  it("scores lower opportunity for strong online presence", () => {
    const richLead: LeadData = {
      ...baseLead,
      website: "https://example.com",
      gmbRating: 4.8,
      gmbReviewCount: 200,
    };
    const richEnrichment: EnrichmentPayload = {
      website_analysis: {
        hasSSL: true,
        isMobileFriendly: true,
        loadTimeMs: 800,
        hasMetaTitle: true,
        hasMetaDescription: true,
        hasH1: true,
        hasStructuredData: true,
        hasFavicon: true,
        hasAnalytics: true,
        hasCTA: true,
        contentLength: 5000,
        lastModified: new Date().toISOString(),
        technologies: ["WordPress"],
      },
    };
    const result = computeScore({ lead: richLead, enrichment: richEnrichment, weights });
    expect(result.overallScore).toBeLessThan(40);
    expect(result.priority).not.toBe("Hot");
  });
});
