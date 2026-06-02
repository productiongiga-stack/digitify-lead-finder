import { describe, expect, it } from "vitest";
import {
  buildCampaignScore,
  buildCampaignScoreEntries,
  evaluateMetaPlanReady,
  isMetaCampaignActive,
  planToCampaignScoreInput,
} from "./meta-ads-campaign-score";

const readyPlan = {
  id: "plan-1",
  name: "Digitify leads BE",
  status: "APPROVED",
  objective: "OUTCOME_TRAFFIC",
  dailyBudgetCents: 2500,
  creatives: {
    message: "Ontdek hoe Digitify meer kwalitatieve leads vindt voor Belgische KMO's met een heldere intake.",
    headline: "Meer leads zonder extra chaos",
    description: "Plan veilig als paused in Meta.",
    linkUrl: "https://leads.digitify.be",
    feedImageUrl: "https://cdn.example.com/feed.jpg",
    storyImageUrl: "https://cdn.example.com/story.jpg",
    adsets: [
      {
        adsetId: "a1",
        variants: [
          {
            primaryText: "Ontdek hoe Digitify meer kwalitatieve leads vindt voor Belgische KMO's met een heldere intake.",
            headline: "Meer leads zonder extra chaos",
            linkUrl: "https://leads.digitify.be",
            feedImageUrl: "https://cdn.example.com/feed.jpg",
          },
        ],
      },
      {
        adsetId: "a2",
        variants: [
          {
            primaryText: "Ontdek hoe Digitify meer kwalitatieve leads vindt voor Belgische KMO's met een heldere intake.",
            headline: "Demo boeken in 2 minuten",
            linkUrl: "https://leads.digitify.be/demo",
            feedImageUrl: "https://cdn.example.com/feed-2.jpg",
          },
          {
            primaryText: "Ontdek hoe Digitify meer kwalitatieve leads vindt voor Belgische KMO's met een heldere intake.",
            headline: "Start met leadgeneratie",
            linkUrl: "https://leads.digitify.be/start",
            feedImageUrl: "https://cdn.example.com/feed-3.jpg",
          },
        ],
      },
    ],
  },
  targeting: {
    adsets: [
      { id: "a1", name: "Belgie breed", interestSignals: ["KMO"], audienceNotes: "Breed" },
      { id: "a2", name: "Remarketing", custom_audiences: ["123"], audienceNotes: "Warm" },
    ],
    campaignSettings: { pixelId: "" },
  },
};

describe("meta-ads-campaign-score", () => {
  it("marks complete drafts as ready", () => {
    expect(evaluateMetaPlanReady(readyPlan)).toBe(true);
    const incomplete = {
      ...readyPlan,
      id: "plan-2",
      creatives: {
        ...readyPlan.creatives,
        linkUrl: "http://invalid",
        adsets: readyPlan.creatives.adsets.map((group: { variants: Array<Record<string, string>> }) => ({
          ...group,
          variants: group.variants.map((variant) => ({ ...variant, linkUrl: "http://invalid" })),
        })),
      },
    };
    expect(evaluateMetaPlanReady(incomplete)).toBe(false);
  });

  it("builds a score from stored plan payloads", () => {
    const input = planToCampaignScoreInput(readyPlan);
    expect(input?.adsets).toHaveLength(2);
    const result = buildCampaignScore(input!);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.label).toBeTruthy();
  });

  it("lists ready drafts and active live campaigns without duplicates", () => {
    const linkedDraft = {
      ...readyPlan,
      externalIds: { campaignId: "linked" },
    };
    const entries = buildCampaignScoreEntries({
      draftPlans: [linkedDraft],
      liveCampaigns: [
        { id: "cmp-1", name: "Live campagne", effective_status: "ACTIVE", objective: "OUTCOME_TRAFFIC", daily_budget: "2500" },
        { id: "linked", name: "Linked live", effective_status: "ACTIVE", daily_budget: "2500" },
      ],
    });

    expect(entries.some((entry) => entry.id === "plan-1")).toBe(true);
    expect(entries.some((entry) => entry.id === "live-cmp-1")).toBe(true);
    expect(entries.some((entry) => entry.id === "live-linked")).toBe(false);
  });

  it("detects active Meta campaigns", () => {
    expect(isMetaCampaignActive({ effective_status: "ACTIVE" })).toBe(true);
    expect(isMetaCampaignActive({ status: "PAUSED" })).toBe(false);
  });
});
