import { describe, expect, it } from "vitest";
import { normalizeSeoKeyword, seoResearchKey } from "../lib/seo-research";

describe("seo research helpers", () => {
  it("normalizes keywords consistently for deduplication", () => {
    expect(normalizeSeoKeyword("  SEO   Bureau Gent ")).toBe("seo bureau gent");
    expect(normalizeSeoKeyword("SEO Bureau Gent")).toBe(normalizeSeoKeyword("seo bureau gent"));
  });

  it("creates an order-independent idempotency key", () => {
    const base = { seeds: ["webdesign", "seo bureau"], language: "nl" as const, location: "BE", providers: ["GOOGLE_ADS"] as Array<"GOOGLE_ADS" | "SEARCH_CONSOLE">, targetUrl: "https://example.be" };
    const reordered = { ...base, seeds: ["seo bureau", "webdesign"] };
    expect(seoResearchKey(base)).toBe(seoResearchKey(reordered));
    expect(seoResearchKey(base)).not.toBe(seoResearchKey({ ...base, language: "fr" }));
  });
});
