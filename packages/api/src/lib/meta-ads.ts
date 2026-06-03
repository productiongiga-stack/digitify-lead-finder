import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@digitify/db";
import { getSettingNumber, getSettingString, settingsRowsToMap } from "./settings";
import { loadWorkspaceSettingRows, type WorkspaceScope } from "./workspace-settings";
import {
  loadMetaWorkspaceConfig,
  metaGet,
  metaPost,
  META_ADS_OAUTH_SCOPES,
  resolveMetaOAuthScopes,
} from "./social-meta";

export const META_ADS_SETTING_KEYS = [
  "ads.meta_ad_account_id",
  "ads.meta_business_id",
  "ads.autoads_enabled",
  "ads.default_currency",
  "ads.max_daily_budget_cents",
] as const;

export const META_ADS_REQUIRED_SCOPES = META_ADS_OAUTH_SCOPES;

export type MetaAdsWorkspaceConfig = Awaited<ReturnType<typeof loadMetaAdsWorkspaceConfig>>;

export type MetaAdAccountSummary = {
  id: string;
  accountId: string;
  name: string;
  currency: string;
  timezoneName: string;
  businessId: string;
  businessName: string;
  accountStatus?: number;
};

export type MetaInsightLevel = "campaign" | "adset" | "ad";

export type MetaDraftScore = {
  score: number;
  label: string;
  checks: Array<{ ok: boolean; label: string; hint: string }>;
  tips: string[];
};

type MetaCreativeVariant = {
  id?: string;
  name?: string;
  adName?: string;
  message?: string;
  primaryText?: string;
  headline?: string;
  description?: string;
  linkUrl?: string;
  displayUrl?: string;
  imageUrl?: string;
  feedImageUrl?: string;
  squareImageUrl?: string;
  storyImageUrl?: string;
  publishAsset?: "feed" | "square" | "story";
  ctaType?: string;
  cta?: string;
  ctaLabel?: string;
  urlTags?: string;
};

type MetaCreativeGroup = {
  adsetId?: string;
  name?: string;
  variants?: MetaCreativeVariant[];
};

type MetaCampaignDraftLike = {
  name?: string;
  objective?: string;
  dailyBudgetCents?: number | null;
  lifetimeBudgetCents?: number | null;
  targeting?: unknown;
  creatives?: unknown;
};

export class MetaAdsPushPartialError extends Error {
  externalIds: Record<string, unknown>;

  constructor(message: string, externalIds: Record<string, unknown>) {
    super(message);
    this.name = "MetaAdsPushPartialError";
    this.externalIds = externalIds;
  }
}

export function normalizeAdAccountId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("act_") ? trimmed : `act_${trimmed}`;
}

export function resolveMissingMarketingScopes(grantedScopes?: string[] | null) {
  if (!grantedScopes?.length) return META_ADS_REQUIRED_SCOPES.slice();
  const granted = new Set(grantedScopes);
  return META_ADS_REQUIRED_SCOPES.filter((scope) => !granted.has(scope));
}

export function resolveConfiguredMarketingScopes() {
  const configured = new Set(resolveMetaOAuthScopes());
  return META_ADS_REQUIRED_SCOPES.filter((scope) => configured.has(scope));
}

export async function loadMetaAdsWorkspaceConfig(db: PrismaClient, scope: WorkspaceScope) {
  const [base, rows] = await Promise.all([
    loadMetaWorkspaceConfig(db, scope),
    loadWorkspaceSettingRows(db, scope, [...META_ADS_SETTING_KEYS]),
  ]);
  const settings = settingsRowsToMap(rows);
  return {
    ...base,
    adAccountId: getSettingString(settings, "ads.meta_ad_account_id", base.adAccountId || ""),
    businessId: getSettingString(settings, "ads.meta_business_id", base.businessId || ""),
    autoadsEnabled: getSettingString(settings, "ads.autoads_enabled", String(base.autoadsEnabled || false)) === "true",
    defaultCurrency: getSettingString(settings, "ads.default_currency", base.defaultCurrency || "EUR") || "EUR",
    maxDailyBudgetCents: getSettingNumber(settings, "ads.max_daily_budget_cents", base.maxDailyBudgetCents || 5000),
  };
}

export type MetaPublisherIdentity = {
  adAccountName: string | null;
  facebookPublisherName: string;
  instagramPublisherName: string;
  hasInstagram: boolean;
};

/** Names shown in ads preview: ad account for Facebook; Instagram when linked, else Facebook. */
export async function loadMetaPublisherIdentity(params: {
  config: Pick<MetaAdsWorkspaceConfig, "pageId" | "pageAccessToken" | "accessToken" | "instagramBusinessId">;
  adAccountName?: string | null;
}): Promise<MetaPublisherIdentity> {
  const adAccountName = (params.adAccountName ?? "").trim() || null;
  const fallback = adAccountName || "Facebook-pagina";

  let facebookPageName = "";
  let instagramUsername = "";
  let hasInstagram = Boolean(params.config.instagramBusinessId?.trim());

  const pageToken = params.config.pageAccessToken?.trim() || params.config.accessToken?.trim();
  if (params.config.pageId?.trim() && pageToken) {
    try {
      const raw = (await metaGet(params.config.pageId.trim(), {
        access_token: pageToken,
        fields: "name,instagram_business_account{id,username}",
      })) as {
        name?: string;
        instagram_business_account?: { id?: string; username?: string };
      };
      facebookPageName = (raw.name ?? "").trim();
      const ig = raw.instagram_business_account;
      if (ig?.id?.trim()) {
        hasInstagram = true;
        instagramUsername = (ig.username ?? "").trim();
      }
    } catch {
      // Graph unavailable — fall back to ad account / page settings only.
    }
  }

  const facebookPublisherName = (adAccountName || facebookPageName || fallback).trim();
  const instagramPublisherName = hasInstagram
    ? (adAccountName || (instagramUsername ? `@${instagramUsername.replace(/^@/, "")}` : "") || facebookPublisherName).trim()
    : facebookPublisherName;

  return {
    adAccountName,
    facebookPublisherName,
    instagramPublisherName,
    hasInstagram,
  };
}

export async function listMetaAdAccounts(accessToken: string): Promise<MetaAdAccountSummary[]> {
  const raw = (await metaGet("me/adaccounts", {
    access_token: accessToken,
    fields: "id,account_id,name,currency,timezone_name,business{id,name},account_status",
    limit: "100",
  })) as {
    data?: Array<{
      id?: string;
      account_id?: string;
      name?: string;
      currency?: string;
      timezone_name?: string;
      business?: { id?: string; name?: string };
      account_status?: number;
    }>;
  };

  return (raw.data || [])
    .map((item) => ({
      id: normalizeAdAccountId(item.id || item.account_id || ""),
      accountId: item.account_id || String(item.id || "").replace(/^act_/, ""),
      name: item.name || "Meta Ad Account",
      currency: item.currency || "EUR",
      timezoneName: item.timezone_name || "",
      businessId: item.business?.id || "",
      businessName: item.business?.name || "",
      accountStatus: item.account_status,
    }))
    .filter((item) => item.id);
}

export async function listMetaCampaigns(params: { adAccountId: string; accessToken: string }) {
  const raw = (await metaGet(`${normalizeAdAccountId(params.adAccountId)}/campaigns`, {
    access_token: params.accessToken,
    fields: "id,name,status,effective_status,objective,created_time,updated_time,daily_budget,lifetime_budget,buying_type,configured_status",
    limit: "100",
  })) as { data?: unknown[] };
  return raw.data || [];
}

export async function getMetaCampaign(params: { campaignId: string; accessToken: string }) {
  return metaGet(params.campaignId, {
    access_token: params.accessToken,
    fields: "id,name,status,effective_status,objective,created_time,updated_time,daily_budget,lifetime_budget,buying_type,configured_status",
  });
}

export async function getMetaCampaignDetails(params: { campaignId: string; accessToken: string }) {
  const campaign = await getMetaCampaign(params);
  const adsetsRaw = (await metaGet(`${params.campaignId}/adsets`, {
    access_token: params.accessToken,
    fields: "id,name,status,effective_status,daily_budget,lifetime_budget,optimization_goal,bid_strategy,updated_time,targeting",
    limit: "100",
  })) as { data?: Array<Record<string, unknown>> };
  const adsets = adsetsRaw.data || [];

  const adGroups = await Promise.all(
    adsets.map(async (adset) => {
      const adsetId = String(adset.id || "");
      if (!adsetId) return { adsetId, ads: [] };
      const adsRaw = (await metaGet(`${adsetId}/ads`, {
        access_token: params.accessToken,
        fields: "id,name,status,effective_status,updated_time,creative{id,name,object_story_spec}",
        limit: "100",
      })) as { data?: Array<Record<string, unknown>> };
      return { adsetId, ads: adsRaw.data || [] };
    }),
  );

  return {
    campaign,
    adsets: adsets.map((adset) => ({
      ...adset,
      ads: adGroups.find((group) => group.adsetId === String(adset.id || ""))?.ads || [],
    })),
  };
}

export async function syncMetaCampaigns(params: { adAccountId: string; accessToken: string }) {
  const campaigns = await listMetaCampaigns(params);
  return {
    syncedAt: new Date().toISOString(),
    campaigns,
  };
}

export async function updateMetaCampaignStatus(params: {
  campaignId: string;
  accessToken: string;
  status: "ACTIVE" | "PAUSED";
}) {
  return metaPost(params.campaignId, {
    access_token: params.accessToken,
    status: params.status,
  });
}

export async function getMetaInsights(params: { adAccountId: string; accessToken: string; datePreset?: string; level?: MetaInsightLevel }) {
  const raw = (await metaGet(`${normalizeAdAccountId(params.adAccountId)}/insights`, {
    access_token: params.accessToken,
    date_preset: params.datePreset || "last_30d",
    level: params.level || "campaign",
    fields:
      params.level === "ad"
        ? "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,reach,clicks,spend,cpc,ctr,actions"
        : params.level === "adset"
          ? "campaign_id,campaign_name,adset_id,adset_name,impressions,reach,clicks,spend,cpc,ctr,actions"
          : "campaign_id,campaign_name,impressions,reach,clicks,spend,cpc,ctr,actions",
    limit: "100",
  })) as { data?: unknown[] };
  return raw.data || [];
}

type BudgetPlan = {
  dailyBudgetCents?: number | null;
  lifetimeBudgetCents?: number | null;
  name?: string;
};

export function validateBudgetGuard(plan: BudgetPlan, maxDailyBudgetCents: number) {
  const max = Number.isFinite(maxDailyBudgetCents) && maxDailyBudgetCents > 0 ? maxDailyBudgetCents : 5000;
  const daily = Number(plan.dailyBudgetCents || 0);
  const lifetime = Number(plan.lifetimeBudgetCents || 0);
  const effective = daily || lifetime;
  if (!effective || effective < 100) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Budget ontbreekt of is te laag. Minimum is 100 cent." });
  }
  if (daily > max || lifetime > max) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Budget guard: ${plan.name || "deze campagne"} overschrijdt het workspace maximum van ${max} cent.`,
    });
  }
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

/** @see https://developers.facebook.com/docs/marketing-api/audiences/reference/placement-targeting/ */
export const META_INSTAGRAM_POSITIONS = [
  "stream",
  "story",
  "explore",
  "explore_home",
  "reels",
  "profile_feed",
  "ig_search",
  "profile_reels",
] as const;

const LEGACY_INSTAGRAM_POSITION_ALIASES: Record<string, string> = {
  feed: "stream",
};

const META_FACEBOOK_POSITIONS = ["feed", "right_hand_column", "marketplace", "video_feeds", "story", "search", "instream_video", "facebook_reels"] as const;
const META_BID_STRATEGIES = ["LOWEST_COST_WITHOUT_CAP", "LOWEST_COST_WITH_BID_CAP", "COST_CAP"] as const;

function uniqueStrings(values: unknown, options: { upper?: boolean; max?: number } = {}) {
  const source = Array.isArray(values) ? values : [];
  const normalized = source
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((item) => (options.upper ? item.toUpperCase() : item));
  return [...new Set(normalized)].slice(0, options.max ?? 100);
}

function normalizeIdObjectList(values: unknown, key = "id") {
  const source = Array.isArray(values) ? values : [];
  return source
    .map((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) return item as Record<string, unknown>;
      const value = String(item || "").trim();
      return value ? { [key]: value } : null;
    })
    .filter(Boolean);
}

export type MetaGeoLocationSuggestion = {
  key: string;
  label: string;
  canonicalName: string;
  type: string;
  typeLabel: string;
  countryCode: string;
};

function formatMetaGeoType(type: unknown) {
  const value = String(type || "").toLowerCase();
  if (value === "city") return "Stad";
  if (value === "region") return "Regio";
  if (value === "country") return "Land";
  if (value.includes("zip") || value.includes("postcode")) return "Postcode";
  return value ? value.replace(/_/g, " ") : "Locatie";
}

export async function searchMetaGeoLocations(
  accessToken: string,
  query: string,
  options?: { countryCode?: string },
): Promise<MetaGeoLocationSuggestion[]> {
  const trimmed = query.trim();
  if (!accessToken || trimmed.length < 2) return [];

  const params: Record<string, string | undefined> = {
    access_token: accessToken,
    type: "adgeolocation",
    q: trimmed,
    location_types: JSON.stringify(["city", "region"]),
    limit: "25",
  };
  if (options?.countryCode?.trim()) {
    params.country_code = options.countryCode.trim().toUpperCase();
  }

  try {
    const raw = (await metaGet("search", params)) as {
      data?: Array<{
        key?: string | number;
        name?: string;
        type?: string;
        country_code?: string;
        country_name?: string;
        region?: string;
        primary_city?: string;
      }>;
    };

    const suggestions: MetaGeoLocationSuggestion[] = [];
    const seen = new Set<string>();

    for (const item of raw.data || []) {
      const key = String(item.key || "").trim();
      if (!key || seen.has(key)) continue;
      const type = String(item.type || "").toLowerCase();
      if (type !== "city" && type !== "region") continue;

      seen.add(key);
      const label = String(item.name || key).trim();
      const region = String(item.region || item.primary_city || "").trim();
      const countryName = String(item.country_name || "").trim();
      const countryCode = String(item.country_code || "").trim().toUpperCase();
      const canonicalName = [label, region, countryName].filter(Boolean).join(", ");

      suggestions.push({
        key,
        label,
        canonicalName: canonicalName || label,
        type,
        typeLabel: formatMetaGeoType(type),
        countryCode,
      });
    }

    return suggestions.sort((a, b) => {
      const rank = (item: MetaGeoLocationSuggestion) => (item.type === "city" ? 0 : 1);
      const diff = rank(a) - rank(b);
      if (diff !== 0) return diff;
      return a.label.localeCompare(b.label, "nl");
    });
  } catch {
    return [];
  }
}

function normalizeGeoLocations(value: unknown) {
  const geo = asObject(value);
  const countries = uniqueStrings(geo.countries, { upper: true, max: 25 });
  return {
    ...geo,
    countries,
    regions: normalizeIdObjectList(geo.regions, "key"),
    cities: normalizeIdObjectList(geo.cities, "key"),
  };
}

function sanitizeInstagramPositions(positions: unknown): string[] {
  const allowed = new Set<string>(META_INSTAGRAM_POSITIONS);
  if (Array.isArray(positions)) {
    const normalized = positions
      .map((item) => LEGACY_INSTAGRAM_POSITION_ALIASES[String(item)] || String(item))
      .filter((item) => allowed.has(item));
    return [...new Set(normalized)];
  }
  const normalized = ["stream", "story"]
    .map((item) => LEGACY_INSTAGRAM_POSITION_ALIASES[item] || item)
    .filter((item) => allowed.has(item));
  return normalized.length ? [...new Set(normalized)] : ["stream", "story"];
}

/** Meta API v23+ requires explicit Advantage+ audience opt-in/out when using custom targeting. */
export function resolveMetaAdvantageAudienceFlag(): 0 | 1 {
  const raw = process.env.META_ADS_ADVANTAGE_AUDIENCE?.trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes") return 1;
  return 0;
}

function normalizeAdvantageAudienceFlag(value: unknown): 0 | 1 | null {
  if (value === 0 || value === 1) return value;
  if (value === "0" || value === "false") return 0;
  if (value === "1" || value === "true") return 1;
  return null;
}

function ensureTargetingAutomation(targeting: Record<string, unknown>): Record<string, unknown> {
  const automation = asObject(targeting.targeting_automation);
  const explicit = normalizeAdvantageAudienceFlag(automation.advantage_audience);
  targeting.targeting_automation = {
    ...automation,
    advantage_audience: explicit ?? resolveMetaAdvantageAudienceFlag(),
  };
  return targeting;
}

function sanitizeFacebookPositions(positions: unknown) {
  const allowed = new Set<string>(META_FACEBOOK_POSITIONS);
  if (Array.isArray(positions)) {
    return uniqueStrings(positions).filter((item) => allowed.has(item));
  }
  return ["feed"];
}

function sanitizePublisherPlatforms(platforms: unknown) {
  const allowed = new Set(["facebook", "instagram", "audience_network", "messenger"]);
  if (Array.isArray(platforms)) {
    return uniqueStrings(platforms).filter((item) => allowed.has(item));
  }
  return ["facebook", "instagram"];
}

export function defaultTargeting(targeting: unknown): Record<string, unknown> {
  const custom = asObject(targeting);
  const merged: Record<string, unknown> = Object.keys(custom).length
    ? { ...custom }
    : {
        geo_locations: { countries: [] },
        publisher_platforms: [],
        facebook_positions: [],
        instagram_positions: [],
        targeting_automation: { advantage_audience: resolveMetaAdvantageAudienceFlag() },
      };

  // Internal wizard settings live next to targeting in our DB, but Meta rejects unknown targeting fields.
  delete merged.campaignSettings;
  delete merged.adsets;
  delete merged.interestSignals;
  delete merged.geoLabels;
  delete merged.audienceNotes;
  delete merged.name;
  delete merged.label;
  delete merged.id;

  merged.geo_locations = normalizeGeoLocations(merged.geo_locations);
  merged.publisher_platforms = sanitizePublisherPlatforms(merged.publisher_platforms);
  merged.facebook_positions = sanitizeFacebookPositions(merged.facebook_positions);
  merged.instagram_positions = sanitizeInstagramPositions(merged.instagram_positions);

  if (merged.custom_audiences) merged.custom_audiences = normalizeIdObjectList(merged.custom_audiences, "id");
  const exclusions = asObject(merged.exclusions);
  if (Object.keys(exclusions).length) {
    merged.exclusions = {
      ...exclusions,
      custom_audiences: normalizeIdObjectList(exclusions.custom_audiences, "id"),
    };
  }

  const interests = Array.isArray(merged.interests) ? merged.interests : [];
  const validInterests = interests.filter((item) => item && typeof item === "object" && !Array.isArray(item));
  if (validInterests.length) merged.interests = validInterests;
  else delete merged.interests;

  return ensureTargetingAutomation(merged);
}

function resolveCreativeGroups(creatives: unknown) {
  const root = asObject(creatives);
  const groups = Array.isArray(root.adsets) ? (root.adsets as MetaCreativeGroup[]) : [];
  return {
    root,
    groups,
  };
}

function resolveCreativeVariantImageUrl(creative: Record<string, unknown>) {
  const publishAsset = String(creative.publishAsset || "").trim().toLowerCase();
  if (publishAsset === "story") {
    return optionalString(creative.storyImageUrl) || optionalString(creative.feedImageUrl) || optionalString(creative.squareImageUrl);
  }
  if (publishAsset === "square") {
    return optionalString(creative.squareImageUrl) || optionalString(creative.feedImageUrl) || optionalString(creative.storyImageUrl);
  }
  return optionalString(creative.feedImageUrl) || optionalString(creative.imageUrl) || optionalString(creative.squareImageUrl) || optionalString(creative.storyImageUrl);
}

function resolveCreativeVariantGroupsForScore(plan: MetaCampaignDraftLike) {
  const targeting = asObject(plan.targeting);
  const adsets = Array.isArray(targeting.adsets) ? targeting.adsets : [];
  const { root, groups } = resolveCreativeGroups(plan.creatives);

  return adsets.map((adset, index) => {
    const adsetRecord = asObject(adset);
    const group = groups.find((item) => item?.adsetId === adsetRecord.id) || groups[index];
    const variants = Array.isArray(group?.variants) && group?.variants.length ? group.variants : [root];
    return {
      adset: adsetRecord,
      variants: variants.map((variant) => ({ ...root, ...asObject(variant) })),
    };
  });
}

export function scoreMetaAdDraft(plan: MetaCampaignDraftLike): MetaDraftScore {
  const targeting = asObject(plan.targeting);
  const creativeGroups = resolveCreativeVariantGroupsForScore(plan);
  const variantCount = creativeGroups.reduce((sum, group) => sum + group.variants.length, 0);
  const hasStoryPlacements = creativeGroups.some((group) =>
    ["facebook_story", "facebook_reels", "instagram_story", "instagram_reels"].some((placement) =>
      Array.isArray(group.adset.placements) ? group.adset.placements.includes(placement) : false,
    ),
  );
  const allVariants = creativeGroups.flatMap((group) => group.variants);
  const firstVariant = allVariants[0] || {};
  const primaryText = String(firstVariant.message || firstVariant.primaryText || "");
  const headline = String(firstVariant.headline || firstVariant.name || "");
  const description = String(firstVariant.description || "");
  const linkUrl = String(firstVariant.linkUrl || firstVariant.url || "");
  const feedImageUrl = String(firstVariant.feedImageUrl || firstVariant.imageUrl || "");
  const squareImageUrl = String(firstVariant.squareImageUrl || "");
  const storyImageUrl = String(firstVariant.storyImageUrl || "");
  const pixelId = String(asObject(targeting.campaignSettings).pixelId || "");

  let score = 30;
  const checks = [
    { ok: primaryText.trim().length >= 40, label: "Copy heeft genoeg body", hint: "Gebruik benefit + bewijs + CTA in de eerste regels." },
    { ok: headline.trim().length >= 8, label: "Headline is bruikbaar", hint: "Houd headlines kort, concreet en duidelijk." },
    { ok: linkUrl.trim().startsWith("https://"), label: "HTTPS landingspagina", hint: "Meta verwacht een volledige en veilige bestemming." },
    { ok: creativeGroups.length >= 2, label: "Meerdere adsets voorzien", hint: "Meerdere adsets maken doelgroeptests veel bruikbaarder." },
    { ok: variantCount >= creativeGroups.length, label: "Elke adset heeft een creative", hint: "Zorg dat elke adset minstens één variant heeft." },
    { ok: variantCount >= Math.max(2, creativeGroups.length + 1), label: "Er is ruimte voor A/B testing", hint: "Minstens één extra variant maakt testen zinvol." },
    { ok: Boolean(feedImageUrl.trim() || squareImageUrl.trim() || storyImageUrl.trim()), label: "Visual aanwezig", hint: "Voorzie minstens één bruikbare visual." },
    { ok: hasStoryPlacements ? Boolean(storyImageUrl.trim()) : true, label: "Story/Reels formaat klaar", hint: "Stories/Reels vragen best een aparte 9:16 visual." },
    { ok: String(plan.objective || "").trim().toUpperCase() === "OUTCOME_SALES" ? Boolean(pixelId.trim()) : true, label: "Tracking past bij objective", hint: "Sales/conversion flows horen een Pixel ID te hebben." },
  ];

  if (String(plan.name || "").trim().length >= 6) score += 8;
  if (Number(plan.dailyBudgetCents || plan.lifetimeBudgetCents || 0) >= 100) score += 8;
  if (primaryText.trim().length >= 80 && primaryText.trim().length <= 240) score += 12;
  if (headline.trim().length >= 10 && headline.trim().length <= 40) score += 8;
  if (description.trim().length >= 10) score += 4;
  if (linkUrl.trim().startsWith("https://")) score += 8;
  if (feedImageUrl.trim()) score += 4;
  if (squareImageUrl.trim()) score += 4;
  if (storyImageUrl.trim()) score += 4;
  if (creativeGroups.length >= 2) score += 5;
  if (variantCount >= creativeGroups.length + 1) score += 5;
  if (pixelId.trim()) score += 4;

  const tips: string[] = [];
  if (!checks[0].ok) tips.push("Maak de primaire tekst specifieker met voordeel, bewijs en een duidelijke CTA.");
  if (!checks[1].ok) tips.push("Versterk de headline met een concreet resultaat of een scherp voordeel.");
  if (!checks[2].ok) tips.push("Gebruik een volledige https-bestemmingslink.");
  if (!checks[3].ok) tips.push("Voeg minstens een tweede adset toe om messaging of doelgroep te testen.");
  if (!checks[4].ok) tips.push("Elke adset heeft minstens één eigen creative variant nodig.");
  if (!checks[5].ok) tips.push("Voeg extra creative varianten toe voor A/B testing binnen je adsets.");
  if (!checks[6].ok) tips.push("Upload feed-, square- of story-visuals zodat preview en push beter kloppen.");
  if (!checks[7].ok) tips.push("Voeg een aparte 9:16 story/reels asset toe om aspect ratio fouten te vermijden.");
  if (!checks[8].ok) tips.push("Vul een Pixel ID in voor sales/conversion-achtige campagnes.");

  const normalized = Math.min(100, Math.max(1, score));
  return {
    score: normalized,
    label: normalized >= 85 ? "Sterk" : normalized >= 70 ? "Goed" : normalized >= 55 ? "Werkbaar" : "Nog verbeteren",
    checks,
    tips,
  };
}

export function resolveAdsetOptimizationGoal(objective: string) {
  const normalized = objective.trim().toUpperCase();
  if (normalized === "OUTCOME_TRAFFIC" || normalized === "LINK_CLICKS") return "LINK_CLICKS";
  if (normalized === "OUTCOME_LEADS" || normalized === "LEAD_GENERATION") return "LEAD_GENERATION";
  if (normalized === "OUTCOME_SALES") return "OFFSITE_CONVERSIONS";
  if (normalized === "OUTCOME_AWARENESS") return "REACH";
  if (normalized === "OUTCOME_ENGAGEMENT") return "POST_ENGAGEMENT";
  if (normalized.startsWith("OUTCOME_")) return "LINK_CLICKS";
  return "LINK_CLICKS";
}

/** Meta only allows certain destination_type values per campaign objective (see Marketing API docs). */
export function resolveAdsetDestinationType(objective: string): string | undefined {
  const normalized = objective.trim().toUpperCase();
  // OUTCOME_TRAFFIC: UNDEFINED | MESSENGER | WHATSAPP | PHONE_CALL — not WEBSITE (website URL lives on the creative).
  if (normalized === "OUTCOME_TRAFFIC" || normalized === "LINK_CLICKS") return undefined;
  if (normalized === "OUTCOME_LEADS" || normalized === "LEAD_GENERATION") return "WEBSITE";
  if (normalized === "OUTCOME_SALES") return "WEBSITE";
  return undefined;
}

function campaignSettingsFromTargeting(targeting: unknown) {
  return asObject(asObject(targeting).campaignSettings);
}

function optionalString(value: unknown) {
  const text = String(value || "").trim();
  return text || undefined;
}

function optionalPositiveInteger(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : undefined;
}

function normalizeSpecialAdCategories(value: unknown) {
  return uniqueStrings(value, { upper: true, max: 10 });
}

function resolveBidStrategy(value: unknown) {
  const normalized = String(value || "LOWEST_COST_WITHOUT_CAP").trim().toUpperCase();
  return (META_BID_STRATEGIES as readonly string[]).includes(normalized) ? normalized : "LOWEST_COST_WITHOUT_CAP";
}

function resolveOptimizationGoal(objective: string, value: unknown) {
  const normalized = optionalString(value)?.toUpperCase();
  if (normalized && normalized !== "AUTO") return normalized;
  return resolveAdsetOptimizationGoal(objective);
}

function resolveDestinationType(objective: string, value: unknown) {
  const normalized = optionalString(value)?.toUpperCase();
  if (normalized && normalized !== "AUTO") return normalized;
  return resolveAdsetDestinationType(objective);
}

function mergeTargeting(base: unknown, override: unknown) {
  const baseTargeting = asObject(base);
  const nextOverride = asObject(override);
  const merged = {
    ...baseTargeting,
    ...nextOverride,
    geo_locations: {
      ...asObject(baseTargeting.geo_locations),
      ...asObject(nextOverride.geo_locations),
    },
    exclusions: {
      ...asObject(baseTargeting.exclusions),
      ...asObject(nextOverride.exclusions),
    },
    targeting_automation: {
      ...asObject(baseTargeting.targeting_automation),
      ...asObject(nextOverride.targeting_automation),
    },
  };
  return defaultTargeting(merged);
}

function resolveAdsetDefinitions(targeting: unknown, fallbackName: string) {
  const root = asObject(targeting);
  const rootSettings = campaignSettingsFromTargeting(targeting);
  const source = Array.isArray(root.adsets) && root.adsets.length ? root.adsets : [root];

  return source.map((item, index) => {
    const candidate = asObject(item);
    return {
      id: optionalString(candidate.id) || `adset_${index + 1}`,
      name:
        optionalString(candidate.name) ||
        optionalString(candidate.label) ||
        optionalString(candidate.adsetName) ||
        (index === 0 ? optionalString(rootSettings.adsetName) : undefined) ||
        `${fallbackName} - Adset ${index + 1}`,
      targeting: mergeTargeting(root, candidate),
    };
  });
}

function resolveCreativeVariantsForAdset(params: {
  creatives: unknown;
  adsetId?: string;
  adsetName: string;
  fallbackName: string;
}) {
  const { root, groups } = resolveCreativeGroups(params.creatives);
  const group =
    groups.find((item) => optionalString(item?.adsetId) === params.adsetId) ||
    groups.find((item) => optionalString(item?.name) === params.adsetName);
  const source = Array.isArray(group?.variants) && group?.variants.length ? group.variants : [root];

  return source.map((item, index) => {
    const variant = { ...root, ...asObject(item) };
    return {
      id: optionalString(variant.id) || `${params.adsetId || "adset"}_variant_${index + 1}`,
      name:
        optionalString(variant.adName) ||
        optionalString(variant.name) ||
        `${params.fallbackName} - ${params.adsetName} - Variant ${index + 1}`,
      creative: variant,
    };
  });
}

function resolveCreativeImageUrl(creatives: unknown) {
  const creative = asObject(creatives);
  return resolveCreativeVariantImageUrl(creative);
}

function validateTargetingForPush(targeting: unknown) {
  const record = asObject(targeting);
  const geo = asObject(record.geo_locations);
  const countries = uniqueStrings(geo.countries, { upper: true, max: 25 });
  const regions = normalizeIdObjectList(geo.regions, "key");
  const cities = normalizeIdObjectList(geo.cities, "key");
  if (!countries.length && !regions.length && !cities.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "META_TARGETING_INVALID · Kies minstens één land, regio of stad voor de advertentieset.",
    });
  }
  const ageMin = Number(record.age_min || 0);
  const ageMax = Number(record.age_max || 0);
  if (!Number.isFinite(ageMin) || ageMin < 13 || !Number.isFinite(ageMax) || ageMax < ageMin) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "META_TARGETING_INVALID · Stel een geldige leeftijd in (min. 13, max ≥ min).",
    });
  }
  const publisherPlatforms = uniqueStrings(record.publisher_platforms);
  if (!publisherPlatforms.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "META_TARGETING_INVALID · Selecteer minstens één placement voor de advertentieset.",
    });
  }
}

function validateCreativeForPush(
  objective: string,
  targeting: unknown,
  creative: Record<string, unknown>,
  campaignSettings: Record<string, unknown>,
) {
  validateTargetingForPush(targeting);
  const linkUrl = String(creative.linkUrl || creative.url || "").trim();
  if (!linkUrl.startsWith("https://")) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "META_DESTINATION_INVALID · Gebruik een volledige https-bestemmingslink." });
  }

  const imageUrl = resolveCreativeVariantImageUrl(creative);
  if (!imageUrl) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "META_ASSET_RATIO_INVALID · Er ontbreekt een publiceerbare visual voor deze advertentievariant." });
  }

  const targetingRecord = asObject(targeting);
  const placements = Array.isArray(targetingRecord.placements) ? (targetingRecord.placements as string[]) : [];
  const facebookPositions = Array.isArray(targetingRecord.facebook_positions) ? (targetingRecord.facebook_positions as string[]) : [];
  const instagramPositions = Array.isArray(targetingRecord.instagram_positions) ? (targetingRecord.instagram_positions as string[]) : [];
  const hasStoryPlacement =
    placements.some((placement) => ["facebook_story", "facebook_reels", "instagram_story", "instagram_reels"].includes(placement)) ||
    facebookPositions.some((position) => ["story", "facebook_reels"].includes(position)) ||
    instagramPositions.some((position) => ["story", "reels"].includes(position));
  if (hasStoryPlacement && !optionalString(creative.storyImageUrl) && String(creative.publishAsset || "").trim().toLowerCase() !== "story") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "META_ASSET_RATIO_INVALID · Stories/Reels zijn geselecteerd, maar er is geen aparte 9:16 story/reels asset ingesteld.",
    });
  }

  if (objective === "OUTCOME_SALES" && !optionalString(campaignSettings.pixelId)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "META_DESTINATION_INVALID · Sales/conversion campagnes vereisen een Pixel ID in de campaign settings.",
    });
  }
}

function buildObjectStorySpec(config: MetaAdsWorkspaceConfig, creatives: unknown) {
  const creative = asObject(creatives);
  if (creative.objectStorySpec && typeof creative.objectStorySpec === "object") return creative.objectStorySpec;
  if (!config.pageId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Meta Page ID ontbreekt. Koppel eerst je Page in Integraties." });
  }
  const linkUrl = String(creative.linkUrl || creative.url || "").trim();
  if (!linkUrl) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Creative linkUrl ontbreekt. Voeg een bestemmingslink toe." });
  }
  return {
    page_id: config.pageId,
    link_data: {
      link: linkUrl,
      message: String(creative.message || creative.primaryText || "").trim() || "Ontdek meer via onze website.",
      name: String(creative.headline || creative.name || "Meer weten?").trim(),
      description: String(creative.description || "").trim() || undefined,
      picture: resolveCreativeImageUrl(creative),
      call_to_action: optionalString(creative.ctaType)
        ? {
            type: String(creative.ctaType).trim().toUpperCase(),
            value: { link: linkUrl },
          }
        : undefined,
    },
  };
}

export async function pushPausedMetaAdPlan(params: {
  config: MetaAdsWorkspaceConfig;
  plan: {
    name: string;
    objective: string;
    dailyBudgetCents?: number | null;
    lifetimeBudgetCents?: number | null;
    startTime?: Date | string | null;
    endTime?: Date | string | null;
    targeting?: unknown;
    creatives?: unknown;
  };
}) {
  const { config, plan } = params;
  const adAccountId = normalizeAdAccountId(config.adAccountId);
  if (!config.accessToken) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Meta access token ontbreekt. Koppel Meta opnieuw." });
  }
  if (!adAccountId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Geen Meta Ad Account geselecteerd." });
  }

  validateBudgetGuard(plan, config.maxDailyBudgetCents);

  const objective = (plan.objective || "OUTCOME_TRAFFIC").trim().toUpperCase();
  const campaignSettings = campaignSettingsFromTargeting(plan.targeting);
  const optimizationGoal = resolveOptimizationGoal(objective, campaignSettings.optimizationGoal);
  const destinationType = resolveDestinationType(objective, campaignSettings.destinationType);
  const bidStrategy = resolveBidStrategy(campaignSettings.bidStrategy);
  const bidAmount = optionalPositiveInteger(campaignSettings.bidAmount);
  const campaignSpendCap = optionalPositiveInteger(campaignSettings.campaignSpendCap);
  const creatives = asObject(plan.creatives);
  const adsetDefinitions = resolveAdsetDefinitions(plan.targeting, plan.name);

  let campaign: { id?: string };
  try {
    const campaignBody: Record<string, string | undefined> = {
      access_token: config.accessToken,
      name: plan.name,
      objective,
      status: "PAUSED",
      buying_type: optionalString(campaignSettings.buyingType)?.toUpperCase() || "AUCTION",
      special_ad_categories: JSON.stringify(normalizeSpecialAdCategories(campaignSettings.specialAdCategories)),
      is_adset_budget_sharing_enabled: "false",
    };
    if (campaignSpendCap) campaignBody.spend_cap = String(campaignSpendCap);
    campaign = (await metaPost(`${adAccountId}/campaigns`, campaignBody)) as { id?: string };
  } catch (error) {
    throw new Error(`Meta campagne: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!campaign.id) throw new Error("Meta heeft geen campaign ID teruggegeven.");

  const adsetBudget = plan.dailyBudgetCents
    ? { daily_budget: String(plan.dailyBudgetCents) }
    : { lifetime_budget: String(plan.lifetimeBudgetCents || 0) };
  const externalIds: Record<string, unknown> = {
    campaignId: campaign.id,
    adsets: [] as Array<Record<string, unknown>>,
    status: "PAUSED",
    syncedAt: new Date().toISOString(),
    metaState: { configuredStatus: "PAUSED", effectiveStatus: "PAUSED" },
  };
  const adsetIds: string[] = [];
  const adIds: string[] = [];
  const creativeIds: string[] = [];

  for (const [index, definition] of adsetDefinitions.entries()) {
    const adsetBody: Record<string, string | undefined> = {
      access_token: config.accessToken,
      name: definition.name,
      campaign_id: campaign.id,
      billing_event: optionalString(campaignSettings.billingEvent)?.toUpperCase() || "IMPRESSIONS",
      optimization_goal: optimizationGoal,
      bid_strategy: bidStrategy,
      status: "PAUSED",
      targeting: JSON.stringify(definition.targeting),
      start_time: plan.startTime ? new Date(plan.startTime).toISOString() : undefined,
      end_time: plan.endTime ? new Date(plan.endTime).toISOString() : undefined,
      ...adsetBudget,
    };
    if (bidAmount && bidStrategy !== "LOWEST_COST_WITHOUT_CAP") adsetBody.bid_amount = String(bidAmount);
    if (optionalString(campaignSettings.pixelId)) {
      adsetBody.promoted_object = JSON.stringify({
        pixel_id: optionalString(campaignSettings.pixelId),
        custom_event_type: optionalString(campaignSettings.customEventType)?.toUpperCase() || "LEAD",
      });
    }
    if (destinationType) adsetBody.destination_type = destinationType;

    let adset: { id?: string };
    try {
      adset = (await metaPost(`${adAccountId}/adsets`, adsetBody)) as { id?: string };
    } catch (error) {
      throw new Error(`Meta ad set ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!adset.id) throw new Error(`Meta heeft geen ad set ID teruggegeven voor adset ${index + 1}.`);
    adsetIds.push(adset.id);
    const adsetExternal: Record<string, unknown> = {
      localId: definition.id,
      name: definition.name,
      adsetId: adset.id,
      metaState: { configuredStatus: "PAUSED", effectiveStatus: "PAUSED" },
      ads: [] as Array<Record<string, unknown>>,
    };
    (externalIds.adsets as Array<Record<string, unknown>>).push(adsetExternal);

    const variants = resolveCreativeVariantsForAdset({
      creatives: plan.creatives,
      adsetId: definition.id,
      adsetName: definition.name,
      fallbackName: plan.name,
    });
    if (!variants.length) {
      throw new MetaAdsPushPartialError(
        "META_PUSH_PARTIAL_FAILURE · Deze adset heeft geen creative varianten om te pushen.",
        externalIds,
      );
    }

    for (const [variantIndex, variant] of variants.entries()) {
      try {
        validateCreativeForPush(objective, definition.targeting, variant.creative, campaignSettings);

        const creativeBody: Record<string, string | undefined> = {
          access_token: config.accessToken,
          name: variant.name,
          object_story_spec: JSON.stringify(buildObjectStorySpec(config, variant.creative)),
          url_tags: optionalString(variant.creative.urlTags),
        };
        const creative = (await metaPost(`${adAccountId}/adcreatives`, creativeBody)) as { id?: string };
        if (!creative.id) {
          throw new Error(`Meta heeft geen creative ID teruggegeven voor variant ${variantIndex + 1}.`);
        }
        creativeIds.push(creative.id);

        const ad = (await metaPost(`${adAccountId}/ads`, {
          access_token: config.accessToken,
          name: variant.name,
          adset_id: adset.id,
          creative: JSON.stringify({ creative_id: creative.id }),
          status: "PAUSED",
        })) as { id?: string };
        if (!ad.id) {
          throw new Error(`Meta heeft geen ad ID teruggegeven voor variant ${variantIndex + 1}.`);
        }

        adIds.push(ad.id);
        (adsetExternal.ads as Array<Record<string, unknown>>).push({
          localVariantId: variant.id,
          name: variant.name,
          adId: ad.id,
          creativeId: creative.id,
          metaState: { configuredStatus: "PAUSED", effectiveStatus: "PAUSED" },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new MetaAdsPushPartialError(
          `META_PUSH_PARTIAL_FAILURE · Adset ${index + 1}, variant ${variantIndex + 1}: ${message}`,
          externalIds,
        );
      }
    }
  }

  return {
    campaignId: campaign.id,
    adsetId: adsetIds[0],
    adsetIds,
    creativeId: creativeIds[0],
    creativeIds,
    adId: adIds[0],
    adIds,
    status: "PAUSED" as const,
    metaState: externalIds.metaState,
    adsets: externalIds.adsets,
    syncedAt: externalIds.syncedAt,
  };
}
