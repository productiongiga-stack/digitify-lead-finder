export type CampaignScoreAdset = {
  variants: Array<{
    primaryText: string;
    headline: string;
    linkUrl: string;
    feedImageUrl: string;
    squareImageUrl: string;
    storyImageUrl: string;
  }>;
  customAudiencesText: string;
  notes: string;
};

export type CampaignScoreInput = {
  name: string;
  dailyBudget: string;
  lifetimeBudget: string;
  primaryText: string;
  headline: string;
  description: string;
  linkUrl: string;
  adsets: CampaignScoreAdset[];
  feedImageUrl: string;
  squareImageUrl: string;
  storyImageUrl: string;
  publishAsset: string;
  pixelId: string;
  objective: string;
};

export type CampaignScoreResult = {
  score: number;
  label: string;
  checks: Array<{ ok: boolean; label: string; hint: string }>;
  tips: string[];
};

const SCOREABLE_DRAFT_STATUSES = new Set([
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "PUSHED_PAUSED",
  "FAILED",
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function numberValue(value: string | number | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function linesToList(value: unknown, max = 80) {
  if (!Array.isArray(value)) {
    if (typeof value === "string") {
      return value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, max);
    }
    return [];
  }
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, max);
}

function resolvePublishImage(
  publishAsset: string,
  images: { feedImageUrl: string; squareImageUrl: string; storyImageUrl: string },
) {
  if (publishAsset === "square" && images.squareImageUrl.trim()) return images.squareImageUrl.trim();
  if (publishAsset === "story" && images.storyImageUrl.trim()) return images.storyImageUrl.trim();
  return images.feedImageUrl.trim() || images.squareImageUrl.trim() || images.storyImageUrl.trim();
}

function variantFromRecord(variant: Record<string, unknown>, fallback: Partial<CampaignScoreInput>) {
  return {
    primaryText: String(variant.primaryText || variant.message || fallback.primaryText || ""),
    headline: String(variant.headline || fallback.headline || ""),
    linkUrl: String(variant.linkUrl || variant.url || fallback.linkUrl || ""),
    feedImageUrl: String(variant.feedImageUrl || variant.imageUrl || fallback.feedImageUrl || ""),
    squareImageUrl: String(variant.squareImageUrl || fallback.squareImageUrl || ""),
    storyImageUrl: String(variant.storyImageUrl || fallback.storyImageUrl || ""),
  };
}

export function planToCampaignScoreInput(plan: unknown): CampaignScoreInput | null {
  const row = asRecord(plan);
  if (!row.name) return null;

  const creative = asRecord(row.creatives);
  const targeting = asRecord(row.targeting);
  const campaignSettings = asRecord(targeting.campaignSettings);

  const base: CampaignScoreInput = {
    name: String(row.name || ""),
    dailyBudget: String(row.dailyBudgetCents ?? ""),
    lifetimeBudget: String(row.lifetimeBudgetCents ?? ""),
    primaryText: String(creative.message || creative.primaryText || ""),
    headline: String(creative.headline || creative.name || ""),
    description: String(creative.description || ""),
    linkUrl: String(creative.linkUrl || creative.url || ""),
    feedImageUrl: String(creative.feedImageUrl || creative.imageUrl || ""),
    squareImageUrl: String(creative.squareImageUrl || ""),
    storyImageUrl: String(creative.storyImageUrl || ""),
    publishAsset: String(creative.publishAsset || "feed"),
    pixelId: String(campaignSettings.pixelId || ""),
    objective: String(row.objective || "OUTCOME_TRAFFIC"),
    adsets: [],
  };

  const creativeGroups = Array.isArray(creative.adsets) ? creative.adsets : [];
  const targetingAdsets = Array.isArray(targeting.adsets) ? targeting.adsets : [];

  if (targetingAdsets.length) {
    base.adsets = targetingAdsets.map((item, index) => {
      const adset = asRecord(item);
      const adsetId = String(adset.id || `adset-${index + 1}`);
      const group =
        creativeGroups.find((entry) => String(asRecord(entry).adsetId || "") === adsetId) ||
        creativeGroups[index];
      const groupRecord = asRecord(group);
      const variantsRaw = Array.isArray(groupRecord.variants) ? groupRecord.variants : [];
      const variants =
        variantsRaw.length > 0
          ? variantsRaw.map((variant) => variantFromRecord(asRecord(variant), base))
          : [variantFromRecord({}, base)];

      const interestSignals = linesToList(adset.interestSignals, 25);
      const customAudiences = linesToList(adset.custom_audiences, 25);

      return {
        variants,
        customAudiencesText: customAudiences.join("\n"),
        notes: String(adset.audienceNotes || adset.notes || interestSignals.join(", ")),
      };
    });
  } else if (creativeGroups.length) {
    base.adsets = creativeGroups.map((group) => {
      const groupRecord = asRecord(group);
      const variantsRaw = Array.isArray(groupRecord.variants) ? groupRecord.variants : [];
      const variants =
        variantsRaw.length > 0
          ? variantsRaw.map((variant) => variantFromRecord(asRecord(variant), base))
          : [variantFromRecord({}, base)];
      return { variants, customAudiencesText: "", notes: String(groupRecord.name || "") };
    });
  } else {
    base.adsets = [
      {
        variants: [variantFromRecord({}, base)],
        customAudiencesText: linesToList(asRecord(targeting.exclusions).custom_audiences).join("\n"),
        notes: String(targeting.audienceNotes || ""),
      },
    ];
  }

  const primaryImage = resolvePublishImage(base.publishAsset, base);
  if (!base.feedImageUrl && primaryImage) base.feedImageUrl = primaryImage;

  return base;
}

export function evaluateMetaPlanReady(plan: unknown) {
  const input = planToCampaignScoreInput(plan);
  if (!input) return false;
  if (input.name.trim().length < 2) return false;
  if (!(numberValue(input.dailyBudget) >= 100 || numberValue(input.lifetimeBudget) >= 100)) return false;
  if (!input.adsets.length) return false;

  return input.adsets.every(
    (adset) =>
      adset.variants.length > 0 &&
      adset.variants.every(
        (variant) =>
          variant.primaryText.trim().length > 0 &&
          variant.headline.trim().length > 0 &&
          variant.linkUrl.trim().startsWith("https://"),
      ),
  );
}

export function isScoreableDraftPlan(plan: unknown) {
  const row = asRecord(plan);
  const status = String(row.status || "");
  if (!SCOREABLE_DRAFT_STATUSES.has(status)) return false;
  return evaluateMetaPlanReady(plan);
}

export function isMetaCampaignActive(campaign: unknown) {
  const row = asRecord(campaign);
  const status = String(row.effective_status || row.status || row.configured_status || "").toUpperCase();
  return status === "ACTIVE" || status === "ENABLED";
}

export function buildCampaignScore(input: CampaignScoreInput): CampaignScoreResult {
  const variantCount = input.adsets.reduce((sum, adset) => sum + adset.variants.length, 0);
  let score = 30;
  const checks = [
    {
      ok: input.primaryText.trim().length >= 40,
      label: "Copy heeft genoeg body",
      hint: "Meta ads presteren meestal beter met duidelijke benefit + CTA in de eerste regels.",
    },
    {
      ok: input.headline.trim().length >= 8,
      label: "Headline is bruikbaar",
      hint: "Houd headlines kort, concreet en direct voordeelgedreven.",
    },
    {
      ok: input.linkUrl.trim().startsWith("https://"),
      label: "HTTPS landingspagina",
      hint: "Meta keurt onvolledige of niet-veilige links sneller af.",
    },
    {
      ok: input.adsets.length >= 2,
      label: "Meerdere adsets voorzien",
      hint: "Meerdere adsets helpen om doelgroepen of hooks apart te testen.",
    },
    {
      ok: variantCount >= input.adsets.length,
      label: "Elke adset heeft een variant",
      hint: "Per adset is minstens één advertentievariant nodig.",
    },
    {
      ok: variantCount >= Math.max(2, input.adsets.length + 1),
      label: "A/B testing klaar",
      hint: "Voorzie extra varianten om hooks en copy te testen.",
    },
    {
      ok: Boolean(input.feedImageUrl.trim() || input.squareImageUrl.trim() || input.storyImageUrl.trim()),
      label: "Visual aanwezig",
      hint: "Minstens één beeld is nodig om een goede preview en Meta push te krijgen.",
    },
    {
      ok: Boolean(input.storyImageUrl.trim()),
      label: "Story/Reels formaat klaar",
      hint: "Als je Stories/Reels gebruikt, voorzie best een aparte 9:16 visual.",
    },
    {
      ok: input.objective === "OUTCOME_SALES" ? Boolean(input.pixelId.trim()) : true,
      label: "Tracking past bij objective",
      hint: "Sales of conversion flows hebben idealiter een Pixel ID en event setup.",
    },
  ];

  if (input.name.trim().length >= 6) score += 10;
  if (numberValue(input.dailyBudget) >= 100 || numberValue(input.lifetimeBudget) >= 100) score += 10;
  if (input.primaryText.trim().length >= 80 && input.primaryText.trim().length <= 240) score += 14;
  if (input.headline.trim().length >= 10 && input.headline.trim().length <= 40) score += 10;
  if (input.description.trim().length >= 10) score += 6;
  if (input.linkUrl.trim().startsWith("https://")) score += 8;
  if (input.feedImageUrl.trim()) score += 5;
  if (input.squareImageUrl.trim()) score += 4;
  if (input.storyImageUrl.trim()) score += 4;
  if (input.adsets.length >= 2) score += 5;
  if (variantCount >= input.adsets.length) score += 4;
  if (variantCount >= input.adsets.length + 1) score += 4;
  if (input.pixelId.trim()) score += 4;

  const tips: string[] = [];
  if (!checks[0].ok) tips.push("Maak de primaire tekst specifieker: noem resultaat, doelgroep en duidelijke volgende stap.");
  if (!checks[1].ok) tips.push("Geef de headline een heldere payoff, bijvoorbeeld voordeel + uitkomst.");
  if (!checks[2].ok) tips.push("Gebruik een volledige https-link zodat Meta de creative correct kan valideren.");
  if (!checks[3].ok) tips.push("Voeg minstens een tweede adset toe om messaging of doelgroep te testen.");
  if (!checks[4].ok) tips.push("Geef elke adset minstens één eigen creative variant.");
  if (!checks[5].ok) tips.push("Voeg extra varianten toe voor echte A/B testing.");
  if (!checks[6].ok) tips.push("Upload minstens één feed-, square- of story-visual zodat preview en push kloppen.");
  if (!checks[7].ok) tips.push("Voorzie een aparte 9:16 visual voor Stories/Reels om aspect ratio fouten te vermijden.");
  if (!checks[8].ok) tips.push("Vul een Pixel ID in als je op sales of conversies stuurt.");
  if (!input.adsets.some((adset) => adset.customAudiencesText.trim())) {
    tips.push("Als je remarketing of CRM-lijsten hebt, voeg custom audience IDs toe per adset.");
  }
  if (!input.adsets.some((adset) => adset.notes.trim())) {
    tips.push("Gebruik doelgroep-notities om intern duidelijk te houden waarom elke adset anders is.");
  }

  const safeScore = Math.min(100, Math.max(1, score));
  const label = safeScore >= 85 ? "Sterk" : safeScore >= 70 ? "Goed" : safeScore >= 55 ? "Werkbaar" : "Nog verbeteren";
  return { score: safeScore, label, checks, tips };
}

export function scoreLiveMetaCampaign(campaign: unknown): CampaignScoreResult {
  const row = asRecord(campaign);
  const name = String(row.name || "Meta campagne");
  const hasBudget = Boolean(row.daily_budget || row.lifetime_budget);
  const objective = String(row.objective || "");

  let score = 35;
  const tips: string[] = [];
  const checks = [
    { ok: name.length >= 4, label: "Campagnenaam", hint: "Gebruik een herkenbare naam in Meta Ads." },
    { ok: hasBudget, label: "Budget ingesteld", hint: "Zonder budget draait de campagne niet." },
    { ok: Boolean(objective), label: "Objective gekozen", hint: "Objective bepaalt optimalisatie in Meta." },
    { ok: isMetaCampaignActive(campaign), label: "Campagne actief", hint: "Alleen actieve campagnes worden hier getoond." },
  ];

  if (checks[0].ok) score += 15;
  if (checks[1].ok) score += 20;
  if (checks[2].ok) score += 15;
  if (checks[3].ok) score += 15;

  tips.push("Open de gekoppelde draft in Studio voor een volledige copy-, visual- en adset-score.");
  if (!hasBudget) tips.push("Stel een dag- of levensduurbudget in binnen Meta Ads.");

  const safeScore = Math.min(100, Math.max(1, score));
  const label = safeScore >= 85 ? "Sterk" : safeScore >= 70 ? "Goed" : safeScore >= 55 ? "Werkbaar" : "Nog verbeteren";
  return { score: safeScore, label, checks, tips };
}

export type CampaignScoreEntry = {
  id: string;
  name: string;
  source: "draft" | "live";
  statusLabel: string;
  score: CampaignScoreResult;
  planId?: string;
  campaignId?: string;
};

export function buildCampaignScoreEntries(input: {
  draftPlans: unknown[];
  liveCampaigns: unknown[];
}): CampaignScoreEntry[] {
  const entries: CampaignScoreEntry[] = [];
  const liveIdsWithDraft = new Set<string>();

  for (const plan of input.draftPlans) {
    if (!isScoreableDraftPlan(plan)) continue;
    const scoreInput = planToCampaignScoreInput(plan);
    if (!scoreInput) continue;
    const row = asRecord(plan);
    const campaignId = String(asRecord(row.externalIds).campaignId || "");
    if (campaignId) liveIdsWithDraft.add(campaignId);
    entries.push({
      id: String(row.id || scoreInput.name),
      planId: String(row.id || ""),
      campaignId: campaignId || undefined,
      name: scoreInput.name,
      source: "draft",
      statusLabel: String(row.status || "DRAFT"),
      score: buildCampaignScore(scoreInput),
    });
  }

  for (const campaign of input.liveCampaigns) {
    if (!isMetaCampaignActive(campaign)) continue;
    const row = asRecord(campaign);
    const campaignId = String(row.id || "");
    if (!campaignId || liveIdsWithDraft.has(campaignId)) continue;
    entries.push({
      id: `live-${campaignId}`,
      campaignId,
      name: String(row.name || "Meta campagne"),
      source: "live",
      statusLabel: String(row.effective_status || row.status || "ACTIVE"),
      score: scoreLiveMetaCampaign(campaign),
    });
  }

  return entries.sort((left, right) => right.score.score - left.score.score);
}
