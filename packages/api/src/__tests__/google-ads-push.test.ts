import { describe, expect, it } from "vitest";
import {
  centsToBudgetMicros,
  defaultSearchTargeting,
  normalizeSearchCreatives,
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

  it("normalizes RSA headlines and descriptions", () => {
    const creative = normalizeSearchCreatives({
      finalUrl: "https://example.com",
      headlines: ["H1"],
      descriptions: ["D1"],
    });
    expect(creative.headlines.length).toBeGreaterThanOrEqual(3);
    expect(creative.descriptions.length).toBeGreaterThanOrEqual(2);
  });
});
