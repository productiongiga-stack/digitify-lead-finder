import { describe, expect, it } from "vitest";
import {
  centsToBudgetMicros,
  defaultSearchTargeting,
  formatGoogleAdsError,
  normalizeSearchCreatives,
  validatePerformanceMaxAssets,
} from "../lib/google-ads";

describe("google ads push helpers", () => {
  it("converts cents to budget micros", () => {
    expect(centsToBudgetMicros(2500)).toBe(25_000_000);
  });

  it("uses Belgium geo and default keywords", () => {
    const targeting = defaultSearchTargeting(undefined);
    expect(targeting.geoTargetConstants).toContain("geoTargetConstants/2056");
    expect(targeting.keywords.length).toBeGreaterThan(0);
  });

  it("requires finalUrl in creatives", () => {
    expect(() => normalizeSearchCreatives({ headlines: ["a", "b", "c"], descriptions: ["x", "y"] })).toThrow(
      /finalUrl/i,
    );
  });

  it("formats nested Google API errors instead of [object Object]", () => {
    const message = formatGoogleAdsError({
      errors: [
        {
          message: "Required field is missing",
          error_code: { field_error: "REQUIRED" },
          location: { field_path_elements: [{ field_name: "contains_eu_political_advertising" }] },
        },
      ],
    });
    expect(message).toContain("Required field is missing");
    expect(message).toContain("Tip:");
    expect(message).not.toContain("[object Object]");
  });

  it("normalizes RSA headlines and descriptions", () => {
    const creative = normalizeSearchCreatives({
      finalUrl: "https://example.com",
      headlines: ["H1"],
      descriptions: ["D1"],
    });
    expect(creative.headlines.length).toBeGreaterThanOrEqual(3);
    expect(creative.descriptions.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps PMax targeting open when no account settings were supplied", () => {
    const targeting = defaultSearchTargeting(undefined, { campaignType: "PERFORMANCE_MAX" });
    expect(targeting.geoTargetConstants).toEqual([]);
    expect(targeting.languageConstants).toEqual([]);
    expect(targeting.keywords).toEqual([]);
  });

  it("blocks PMax until all required copy and asset roles are present", () => {
    expect(() => validatePerformanceMaxAssets(normalizeSearchCreatives({
      finalUrl: "https://example.com",
      headlines: ["Een", "Twee", "Drie"],
      longHeadlines: ["Lange headline"],
      descriptions: ["Een beschrijving", "Nog een beschrijving"],
      businessName: "Workspace BV",
      imageUrl: "https://cdn.example/landscape.jpg",
      squareImageUrl: "https://cdn.example/square.jpg",
    }))).toThrow(/logo/i);
  });
});
