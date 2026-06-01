import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@digitify/db";
import { getSettingNumber, getSettingString, settingsRowsToMap } from "./settings";
import { loadWorkspaceSettingRows, type WorkspaceScope } from "./workspace-settings";
import { loadMetaWorkspaceConfig, metaGet, metaPost, resolveMetaOAuthScopes } from "./social-meta";

export const META_ADS_SETTING_KEYS = [
  "ads.meta_ad_account_id",
  "ads.meta_business_id",
  "ads.autoads_enabled",
  "ads.default_currency",
  "ads.max_daily_budget_cents",
] as const;

export const META_ADS_REQUIRED_SCOPES = ["ads_read", "ads_management", "business_management"] as const;

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
    fields: "id,name,status,effective_status,objective,created_time,updated_time,daily_budget,lifetime_budget",
    limit: "100",
  })) as { data?: unknown[] };
  return raw.data || [];
}

export async function getMetaCampaign(params: { campaignId: string; accessToken: string }) {
  return metaGet(params.campaignId, {
    access_token: params.accessToken,
    fields: "id,name,status,effective_status,objective,created_time,updated_time,daily_budget,lifetime_budget",
  });
}

export async function getMetaInsights(params: { adAccountId: string; accessToken: string; datePreset?: string }) {
  const raw = (await metaGet(`${normalizeAdAccountId(params.adAccountId)}/insights`, {
    access_token: params.accessToken,
    date_preset: params.datePreset || "last_30d",
    level: "campaign",
    fields: "campaign_id,campaign_name,impressions,clicks,spend,cpc,ctr,actions",
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

function defaultTargeting(targeting: unknown) {
  const custom = asObject(targeting);
  if (Object.keys(custom).length) return custom;
  return {
    geo_locations: { countries: ["BE"] },
    age_min: 18,
    age_max: 65,
    publisher_platforms: ["facebook", "instagram"],
    facebook_positions: ["feed"],
    instagram_positions: ["stream"],
  };
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
      picture: String(creative.imageUrl || "").trim() || undefined,
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

  const campaign = (await metaPost(`${adAccountId}/campaigns`, {
    access_token: config.accessToken,
    name: plan.name,
    objective: plan.objective || "OUTCOME_TRAFFIC",
    status: "PAUSED",
    special_ad_categories: "[]",
  })) as { id?: string };
  if (!campaign.id) throw new Error("Meta heeft geen campaign ID teruggegeven.");

  const adsetBudget = plan.dailyBudgetCents
    ? { daily_budget: String(plan.dailyBudgetCents) }
    : { lifetime_budget: String(plan.lifetimeBudgetCents) };
  const adset = (await metaPost(`${adAccountId}/adsets`, {
    access_token: config.accessToken,
    name: `${plan.name} - Adset`,
    campaign_id: campaign.id,
    billing_event: "IMPRESSIONS",
    optimization_goal: "LINK_CLICKS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    status: "PAUSED",
    targeting: JSON.stringify(defaultTargeting(plan.targeting)),
    start_time: plan.startTime ? new Date(plan.startTime).toISOString() : undefined,
    end_time: plan.endTime ? new Date(plan.endTime).toISOString() : undefined,
    ...adsetBudget,
  })) as { id?: string };
  if (!adset.id) throw new Error("Meta heeft geen ad set ID teruggegeven.");

  const creative = (await metaPost(`${adAccountId}/adcreatives`, {
    access_token: config.accessToken,
    name: `${plan.name} - Creative`,
    object_story_spec: JSON.stringify(buildObjectStorySpec(config, plan.creatives)),
  })) as { id?: string };
  if (!creative.id) throw new Error("Meta heeft geen creative ID teruggegeven.");

  const ad = (await metaPost(`${adAccountId}/ads`, {
    access_token: config.accessToken,
    name: `${plan.name} - Ad`,
    adset_id: adset.id,
    creative: JSON.stringify({ creative_id: creative.id }),
    status: "PAUSED",
  })) as { id?: string };
  if (!ad.id) throw new Error("Meta heeft geen ad ID teruggegeven.");

  return {
    campaignId: campaign.id,
    adsetId: adset.id,
    creativeId: creative.id,
    adId: ad.id,
    status: "PAUSED" as const,
  };
}
