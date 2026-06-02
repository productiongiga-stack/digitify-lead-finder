import { describe, expect, it } from "vitest";
import { defaultTargeting, resolveAdsetDestinationType, resolveAdsetOptimizationGoal, scoreMetaAdDraft } from "../lib/meta-ads";

describe("meta ads push helpers", () => {
  it("uses valid instagram_positions for default targeting", () => {
    const targeting = defaultTargeting(undefined) as { instagram_positions?: string[] };
    expect(targeting.instagram_positions).toEqual(["stream", "story"]);
    expect(targeting.instagram_positions).not.toContain("feed");
  });

  it("remaps legacy instagram feed alias to stream", () => {
    const targeting = defaultTargeting({
      geo_locations: { countries: ["BE"] },
      instagram_positions: ["feed", "story"],
    }) as { instagram_positions?: string[] };
    expect(targeting.instagram_positions).toEqual(["stream", "story"]);
  });

  it("omits WEBSITE destination_type for OUTCOME_TRAFFIC (Meta rejects it)", () => {
    expect(resolveAdsetDestinationType("OUTCOME_TRAFFIC")).toBeUndefined();
    expect(resolveAdsetDestinationType("LINK_CLICKS")).toBeUndefined();
    expect(resolveAdsetOptimizationGoal("OUTCOME_TRAFFIC")).toBe("LINK_CLICKS");
  });

  it("uses WEBSITE destination_type for lead/sales outcomes", () => {
    expect(resolveAdsetDestinationType("OUTCOME_LEADS")).toBe("WEBSITE");
    expect(resolveAdsetDestinationType("OUTCOME_SALES")).toBe("WEBSITE");
  });

  it("sets targeting_automation.advantage_audience for custom age targeting (Meta v23+)", () => {
    const targeting = defaultTargeting({
      geo_locations: { countries: ["BE"] },
      age_min: 24,
      age_max: 60,
      publisher_platforms: ["facebook", "instagram"],
      facebook_positions: ["feed"],
      instagram_positions: ["stream", "story"],
    }) as { targeting_automation?: { advantage_audience?: number } };
    expect(targeting.targeting_automation?.advantage_audience).toBe(0);
  });

  it("strips internal wizard settings and normalizes Meta ID targeting", () => {
    const targeting = defaultTargeting({
      geo_locations: { countries: ["be"], regions: ["1754"], cities: ["12345"] },
      publisher_platforms: ["facebook", "instagram", "audience_network"],
      facebook_positions: ["feed", "story", "bad_position"],
      instagram_positions: ["feed", "reels"],
      interests: ["Leadgeneratie"],
      custom_audiences: ["238000000000001"],
      exclusions: { custom_audiences: ["238000000000002"] },
      interestSignals: ["Leadgeneratie", "KMO"],
      adsets: [{ name: "Belgie breed" }],
      campaignSettings: { bidStrategy: "COST_CAP" },
    }) as {
      campaignSettings?: unknown;
      adsets?: unknown;
      interestSignals?: unknown;
      geo_locations?: { countries?: string[]; regions?: Array<{ key: string }>; cities?: Array<{ key: string }> };
      custom_audiences?: Array<{ id: string }>;
      exclusions?: { custom_audiences?: Array<{ id: string }> };
      interests?: unknown;
      instagram_positions?: string[];
      facebook_positions?: string[];
    };

    expect(targeting.campaignSettings).toBeUndefined();
    expect(targeting.adsets).toBeUndefined();
    expect(targeting.interestSignals).toBeUndefined();
    expect(targeting.geo_locations?.countries).toEqual(["BE"]);
    expect(targeting.geo_locations?.regions).toEqual([{ key: "1754" }]);
    expect(targeting.geo_locations?.cities).toEqual([{ key: "12345" }]);
    expect(targeting.custom_audiences).toEqual([{ id: "238000000000001" }]);
    expect(targeting.exclusions?.custom_audiences).toEqual([{ id: "238000000000002" }]);
    expect(targeting.interests).toBeUndefined();
    expect(targeting.facebook_positions).toEqual(["feed", "story"]);
    expect(targeting.instagram_positions).toEqual(["stream", "reels"]);
  });

  it("scores stronger drafts higher when adsets, variants and assets are present", () => {
    const strong = scoreMetaAdDraft({
      name: "Leadgeneratie zomer",
      objective: "OUTCOME_LEADS",
      dailyBudgetCents: 3500,
      targeting: {
        campaignSettings: { pixelId: "123456789" },
        adsets: [
          { id: "a1", placements: ["facebook_feed", "instagram_feed"] },
          { id: "a2", placements: ["instagram_story", "instagram_reels"] },
        ],
      },
      creatives: {
        adsets: [
          {
            adsetId: "a1",
            variants: [
              {
                primaryText: "Vraag vandaag nog je gratis audit aan en ontdek waar je website leads laat liggen.",
                headline: "Meer demo's zonder giswerk",
                description: "Snelle audit met duidelijke volgende stap.",
                linkUrl: "https://leads.digitify.be/demo",
                feedImageUrl: "https://cdn.example.com/feed.jpg",
                squareImageUrl: "https://cdn.example.com/square.jpg",
                ctaLabel: "Meer informatie",
              },
            ],
          },
          {
            adsetId: "a2",
            variants: [
              {
                primaryText: "Zie in 1 gesprek hoe je meer afspraken uit je website haalt.",
                headline: "Plan je gratis groeisessie",
                description: "Voor Belgische KMO's.",
                linkUrl: "https://leads.digitify.be/plan",
                storyImageUrl: "https://cdn.example.com/story.jpg",
                ctaLabel: "Plan nu",
              },
              {
                primaryText: "Krijg heldere lead-opportuniteiten zonder extra giswerk.",
                headline: "Meer kwalitatieve leads",
                description: "Met duidelijke opvolging.",
                linkUrl: "https://leads.digitify.be/plan",
                feedImageUrl: "https://cdn.example.com/feed-2.jpg",
              },
            ],
          },
        ],
      },
    });

    const weak = scoreMetaAdDraft({
      name: "Test",
      objective: "OUTCOME_SALES",
      dailyBudgetCents: 100,
      targeting: {
        adsets: [{ id: "a1", placements: ["instagram_story"] }],
      },
      creatives: {
        adsets: [
          {
            adsetId: "a1",
            variants: [
              {
                primaryText: "Kort",
                headline: "Test",
                linkUrl: "http://example.com",
              },
            ],
          },
        ],
      },
    });

    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.label).toMatch(/Sterk|Goed/);
    expect(weak.tips).toContain("Voeg een aparte 9:16 story/reels asset toe om aspect ratio fouten te vermijden.");
    expect(weak.tips).toContain("Vul een Pixel ID in voor sales/conversion-achtige campagnes.");
  });
});
