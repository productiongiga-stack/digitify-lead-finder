import { describe, expect, it } from "vitest";
import {
  buildEnrichmentFromLead,
  buildLeadDataFromRecord,
  scoreLeadRecord,
  toWeightConfigs,
} from "../scoring-pipeline";

describe("scoring-pipeline", () => {
  const sampleLead = {
    id: "lead-1",
    companyName: "Acme BV",
    website: "https://acme.nl",
    email: "info@acme.nl",
    phone: "+31612345678",
    gmbRating: "4.5",
    gmbReviewCount: 12,
    gmbCategories: ["Marketing"],
    facebookUrl: null,
    instagramUrl: null,
    linkedinUrl: "https://linkedin.com/company/acme",
    twitterUrl: null,
    tiktokUrl: null,
    youtubeUrl: null,
    enrichmentData: [
      {
        data: {
          website_analysis: {
            hasSSL: true,
            isMobileFriendly: true,
            loadTimeMs: 1200,
            hasMetaTitle: true,
            hasMetaDescription: true,
            hasH1: true,
            hasStructuredData: false,
            hasFavicon: true,
            hasAnalytics: true,
            hasCTA: true,
            contentLength: 2500,
            lastModified: null,
            technologies: ["WordPress"],
          },
        },
      },
    ],
  };

  const sampleWeights = [
    {
      id: "w1",
      factorKey: "website_ssl",
      label: "SSL",
      weight: 1,
      maxPoints: 10,
      enabled: true,
      category: "website",
    },
    {
      id: "w2",
      factorKey: "contact_email",
      label: "Email",
      weight: 1,
      maxPoints: 10,
      enabled: true,
      category: "contact",
    },
  ];

  it("buildLeadDataFromRecord maps lead fields", () => {
    const leadData = buildLeadDataFromRecord(sampleLead);
    expect(leadData.companyName).toBe("Acme BV");
    expect(leadData.gmbRating).toBe(4.5);
    expect(leadData.gmbCategories).toEqual(["Marketing"]);
  });

  it("buildEnrichmentFromLead extracts website_analysis", () => {
    const enrichment = buildEnrichmentFromLead(sampleLead);
    expect(enrichment.website_analysis?.hasSSL).toBe(true);
  });

  it("toWeightConfigs maps scoring weight rows", () => {
    const configs = toWeightConfigs(sampleWeights);
    expect(configs).toHaveLength(2);
    expect(configs[0]?.factorKey).toBe("website_ssl");
  });

  it("scoreLeadRecord computes score via shared pipeline", async () => {
    const db = {} as Parameters<typeof scoreLeadRecord>[0];
    const result = await scoreLeadRecord(db, sampleLead, sampleWeights);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.factors.length).toBeGreaterThan(0);
  });
});
