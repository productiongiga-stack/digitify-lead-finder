import { describe, expect, it } from "vitest";
import { adsWizardCampaignProposalSchema, adsWizardDraftContentSchema, adsWizardStrategySchema, buildGoogleSearchPlan, buildPerformanceMaxPlan, googleSearchPlanSchema, performanceMaxPlanSchema } from "../lib/ads-wizard-ai";

describe("ads wizard AI strategy contract", () => {
  it("accepts evidence-bound strategy output with 0-100 confidence", () => {
    const result = adsWizardStrategySchema.parse({
      summary: "Start met een gecontroleerde briefing.",
      assumptions: ["De landingspagina is bereikbaar."],
      unknowns: ["Budget ontbreekt."],
      confidence: 62,
      evidenceRefs: ["briefing", "workspace-profile"],
      meta: { angles: ["Probleemoplossing"], audiences: ["Beslissers"], creativeDirections: ["Heldere demo"], callsToAction: ["Plan gesprek"] },
    });
    expect(result.confidence).toBe(62);
    expect(result.google).toBeUndefined();
  });

  it("rejects confidence outside the documented range", () => {
    expect(() => adsWizardStrategySchema.parse({ summary: "x", confidence: -1 })).toThrow();
    expect(() => adsWizardStrategySchema.parse({ summary: "x", confidence: 101 })).toThrow();
  });

  it("rejects provider payload fields so strategy JSON cannot be published directly", () => {
    expect(() => adsWizardStrategySchema.parse({ summary: "x", confidence: 50, campaignId: "external-id" })).toThrow();
  });

  it("accepts only approval-gated, editable patch proposals", () => {
    const result = adsWizardCampaignProposalSchema.parse({
      reason: "Maak de boodschap duidelijker voor de gekozen doelgroep.",
      expectedImpact: "Meer relevante klikken; controleer dit met live metrics.",
      confidence: 74,
      evidenceRefs: ["workspace-profile"],
      patches: [{ path: "name", value: "Nieuwe campagneboodschap" }],
    });
    expect(result.patches).toHaveLength(1);
    expect(() => adsWizardCampaignProposalSchema.parse({ reason: "Te kort", patches: [] })).toThrow();
  });

  it("validates provider copy limits and keeps metrics out of the content contract", () => {
    const result = adsWizardDraftContentSchema.parse({
      summary: "Tekstvoorstel op basis van briefing en profiel.",
      assumptions: [],
      unknowns: ["Budget is nog niet ingevuld."],
      confidence: 68,
      evidenceRefs: ["briefing", "workspace-profile", "strategy"],
      google: {
        headlines: ["Heldere oplossing", "Plan een gesprek", "Ontdek wat past"],
        descriptions: ["Bekijk de aanpak en kies je volgende stap.", "Vraag informatie aan zonder verplichting."],
        path1: "oplossing",
        path2: "contact",
        callToAction: "Meer informatie",
        adGroupName: "Oplossing",
      },
    });
    expect(result.google?.headlines).toHaveLength(3);
    expect(() => adsWizardDraftContentSchema.parse({
      summary: "x", confidence: 50, evidenceRefs: [], google: { headlines: ["Te lang".repeat(8)], descriptions: ["x", "y"] },
    })).toThrow();
    expect(() => adsWizardDraftContentSchema.parse({ summary: "x", confidence: 50, evidenceRefs: [], metrics: { cpc: 1 } })).toThrow();
  });

  it("accepts a Meta campaign plan with bounded creative variants", () => {
    const result = adsWizardDraftContentSchema.parse({
      summary: "Twee invalshoeken voor gecontroleerde testing.",
      assumptions: [],
      unknowns: ["Pixel en conversie-event zijn nog niet bevestigd."],
      confidence: 61,
      evidenceRefs: ["briefing", "strategy"],
      meta: {
        primaryText: "Plan een gesprek over de aanpak.",
        headline: "Plan een gesprek",
        description: "Bekijk de aanpak.",
        ctaType: "LEARN_MORE",
        ctaLabel: "Meer informatie",
        angle: "Duidelijke aanpak",
        variants: [
          { primaryText: "Plan een gesprek over de aanpak.", headline: "Plan een gesprek", description: "Bekijk de aanpak.", ctaType: "LEARN_MORE", ctaLabel: "Meer informatie", angle: "Duidelijke aanpak" },
          { primaryText: "Ontdek welke volgende stap past.", headline: "Ontdek je volgende stap", description: "Zonder verplichting.", ctaType: "CONTACT_US", ctaLabel: "Contact opnemen", angle: "Laagdrempelig starten" },
        ],
      },
    });
    expect(result.meta?.variants).toHaveLength(2);
    expect(result.meta).not.toHaveProperty("metrics");
  });

  it("keeps AI keywords metric-free and merges only workspace source metrics", () => {
    const plan = buildGoogleSearchPlan({
      ai: {
        summary: "Searchplan met twee duidelijke thema's.",
        assumptions: [],
        unknowns: [],
        confidence: 71,
        evidenceRefs: ["strategy"],
        adGroups: [{
          name: "Leadgeneratie",
          theme: "Aanvragen verzamelen",
          keywords: [{ text: "lead generatie software", matchType: "PHRASE" }, { text: "offerte aanvragen", matchType: "EXACT" }],
          negativeKeywords: [{ text: "gratis cursus", matchType: "PHRASE" }],
          headlines: ["Meer relevante leads", "Plan een gesprek", "Ontdek de aanpak"],
          descriptions: ["Bekijk de aanpak voor je volgende campagne.", "Vraag informatie aan zonder verplichting."],
          path1: "leads",
          path2: "start",
        }],
      },
      measured: [{ keyword: "offerte aanvragen", source: "SEARCH_CONSOLE", metrics: { clicks: 12, impressions: 300 }, evidenceRefs: ["seo-keyword:1"] }],
      brief: { website: "https://example.com" },
    });
    const group = plan.adGroups[0]!;
    expect(group.keywords.find((keyword) => keyword.text === "lead generatie software")?.source).toBe("AI_SUGGESTION");
    expect(group.keywords.find((keyword) => keyword.text === "lead generatie software")?.metrics).toBeUndefined();
    expect(group.keywords.find((keyword) => keyword.text === "offerte aanvragen")?.source).toBe("SEARCH_CONSOLE");
    expect(group.keywords.find((keyword) => keyword.text === "offerte aanvragen")?.metrics?.clicks).toBe(12);
    expect(plan.sourceStatus).toBe("MIXED");
  });

  it("preserves existing manual keywords and limits the plan to three groups", () => {
    const adGroups = Array.from({ length: 4 }, (_, index) => ({
      name: `Thema ${index + 1}`,
      theme: "",
      keywords: [{ text: `suggestie ${index + 1}`, matchType: "PHRASE" as const }],
      negativeKeywords: [],
      headlines: ["Headline een", "Headline twee", "Headline drie"],
      descriptions: ["Beschrijving een", "Beschrijving twee"],
      path1: "",
      path2: "",
    }));
    const plan = buildGoogleSearchPlan({
      ai: { summary: "Plan", assumptions: [], unknowns: [], confidence: 50, evidenceRefs: [], adGroups },
      measured: [],
      brief: { website: "" },
      existing: { searchPlan: { adGroups: [{ name: "Thema 1", keywords: [{ text: "bestaand handmatig", source: "MANUAL", matchType: "EXACT" }] }] } },
    });
    expect(plan.adGroups).toHaveLength(3);
    expect(plan.adGroups[0]?.keywords.map((keyword) => keyword.text)).toEqual(["bestaand handmatig", "suggestie 1"]);
    expect(plan.adGroups[0]?.keywords[0]?.source).toBe("MANUAL");
    expect(plan.unknowns).toContain("Koppel Keyword Planner of Search Console voor echte keywordmetrics.");
  });

  it("rejects invalid final URLs and metrics on AI-only keywords", () => {
    expect(() => googleSearchPlanSchema.parse({
      campaignType: "SEARCH",
      finalUrl: "javascript:alert(1)",
      adGroups: [],
      summary: "Plan",
      assumptions: [],
      unknowns: [],
      confidence: 50,
      evidenceRefs: [],
      sourceStatus: "AI_SUGGESTIONS",
      generatedAt: new Date().toISOString(),
    })).toThrow();
    const plan = buildGoogleSearchPlan({
      ai: { summary: "Plan", assumptions: [], unknowns: [], confidence: 50, evidenceRefs: [], adGroups: [{ name: "Groep", theme: "", keywords: [{ text: "suggestie", matchType: "BROAD" }], negativeKeywords: [], headlines: [], descriptions: [], path1: "", path2: "" }] },
      measured: [],
      brief: { website: "https://example.com" },
    });
    expect(plan.adGroups[0]?.keywords[0]).not.toHaveProperty("metrics");
  });

  it("builds a bounded PMax plan from explicitly assigned library assets", () => {
    const plan = buildPerformanceMaxPlan({
      ai: {
        summary: "Gebruik de bestaande merkbeelden met een korte introductie.",
        assumptions: [],
        unknowns: [],
        confidence: 64,
        evidenceRefs: ["briefing", "workspace-profile"],
        campaignName: "",
        assetGroupName: "Introductie",
        conversionGoal: "",
        biddingStrategy: "MAXIMIZE_CONVERSIONS",
        businessName: "Onjuiste AI-naam",
        headlines: ["Ontdek onze aanpak", "Plan vandaag een gesprek", "Heldere volgende stap"],
        longHeadlines: ["Een duidelijke aanpak voor je volgende stap"],
        descriptions: ["Bekijk de mogelijkheden en kies je volgende actie.", "Start met een korte kennismaking zonder verplichting."],
        searchThemes: ["aanpak"],
        audienceSignals: ["beslissers"],
        assets: [],
      },
      profile: { companyName: "Workspace BV" },
      brief: { product: "Dienst", website: "https://example.com" },
      projectName: "Campagneconcept",
      assets: [
        { id: "landscape", type: "IMAGE", url: "https://cdn.example/landscape.jpg", role: "LANDSCAPE", evidenceRefs: ["media:landscape"] },
        { id: "square", type: "IMAGE", url: "https://cdn.example/square.jpg", role: "SQUARE", evidenceRefs: ["media:square"] },
        { id: "logo", type: "IMAGE", url: "https://cdn.example/logo.png", role: "LOGO", evidenceRefs: ["media:logo"] },
      ],
    });
    expect(plan.campaignType).toBe("PERFORMANCE_MAX");
    expect(plan.businessName).toBe("Workspace BV");
    expect(plan.assets.map((asset) => asset.role)).toEqual(["LANDSCAPE", "SQUARE", "LOGO"]);
    expect(plan.unknowns.some((item) => /budget|customer|conversie/i.test(item))).toBe(true);
    expect(() => performanceMaxPlanSchema.parse({ ...plan, finalUrl: "javascript:alert(1)" })).toThrow();
  });
});
