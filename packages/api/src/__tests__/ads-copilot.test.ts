import { describe, expect, it } from "vitest";
import { adResearchInputSchema, adResearchResultSchema, adsCopilotStatus } from "../lib/ads-copilot";

describe("ads copilot contracts", () => {
  it("normalizes account research defaults without inventing a web source", () => {
    const input = adResearchInputSchema.parse({ provider: "GOOGLE" });
    expect(input.sourceMode).toBe("ACCOUNT_DATA");
    expect(input.campaignIds).toEqual([]);
  });

  it("keeps confidence within the explicit 0-100 contract", () => {
    const result = adResearchResultSchema.parse({
      summary: "Beperkte data",
      recommendations: [{ versionId: "v1", reason: "Testvoorstel met bewijs", confidence: 82, patches: [] }],
    });
    expect(result.recommendations[0]?.confidence).toBe(82);
    expect(() => adResearchResultSchema.parse({ recommendations: [{ versionId: "v1", reason: "Te hoog", confidence: 101, patches: [] }] })).toThrow();
  });

  it("reports whether the optional web adapter is configured", () => {
    const previous = process.env.ADS_RESEARCH_PROVIDER_URL;
    delete process.env.ADS_RESEARCH_PROVIDER_URL;
    expect(adsCopilotStatus().webResearchConfigured).toBe(false);
    process.env.ADS_RESEARCH_PROVIDER_URL = "https://research.example.test/query";
    expect(adsCopilotStatus().webResearchConfigured).toBe(true);
    if (previous === undefined) delete process.env.ADS_RESEARCH_PROVIDER_URL;
    else process.env.ADS_RESEARCH_PROVIDER_URL = previous;
  });
});
