import { describe, it, expect } from "vitest";
import { hasWebsiteFactor } from "../factors/has-website";
import { gmbRatingFactor } from "../factors/gmb-rating";
import { reviewCountFactor } from "../factors/review-count";
import type { LeadData, EnrichmentPayload } from "../types";

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

const emptyEnrichment: EnrichmentPayload = {};

describe("hasWebsiteFactor", () => {
  it("scores high opportunity without website", () => {
    const result = hasWebsiteFactor(baseLead, emptyEnrichment);
    expect(result.rawValue).toBe(10);
  });

  it("scores low opportunity with website", () => {
    const result = hasWebsiteFactor({ ...baseLead, website: "https://test.be" }, emptyEnrichment);
    expect(result.rawValue).toBe(2);
  });
});

describe("gmbRatingFactor", () => {
  it("uses 10 below 3.0", () => {
    expect(gmbRatingFactor({ ...baseLead, gmbRating: 2.99 }, emptyEnrichment).rawValue).toBe(10);
  });

  it("uses 8 at 3.0 boundary", () => {
    expect(gmbRatingFactor({ ...baseLead, gmbRating: 3.0 }, emptyEnrichment).rawValue).toBe(8);
  });

  it("uses 1 for excellent ratings", () => {
    expect(gmbRatingFactor({ ...baseLead, gmbRating: 4.8 }, emptyEnrichment).rawValue).toBe(1);
  });
});

describe("reviewCountFactor", () => {
  it("scores higher opportunity with zero reviews", () => {
    const none = reviewCountFactor({ ...baseLead, gmbReviewCount: 0 }, emptyEnrichment);
    const many = reviewCountFactor({ ...baseLead, gmbReviewCount: 120 }, emptyEnrichment);
    expect(none.rawValue).toBeGreaterThan(many.rawValue);
  });
});
