import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@digitify/db";
import { GoogleAdsApi, enums, errors, resources, toMicros, ResourceNames, type MutateOperation } from "google-ads-api";
import { validateBudgetGuard } from "./meta-ads";
import { type WorkspaceScope } from "./workspace-settings";
import {
  GOOGLE_ADS_SETTING_KEYS,
  loadGoogleAdsWorkspaceConfig,
  normalizeGoogleCustomerId,
  type GoogleAdsWorkspaceConfig,
} from "./google-ads-oauth";

export type { GoogleAdsWorkspaceConfig };

type MutateResourcesResult = {
  results?: Array<{ resource_name?: string }>;
};

export type GoogleAdCustomerSummary = {
  customerId: string;
  resourceName: string;
  name: string;
  currency: string;
  timezone: string;
};

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function asStringArray(value: unknown, min = 1): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 15);
}

export function centsToBudgetMicros(cents: number) {
  return Math.max(1, Math.round(cents)) * 10_000;
}

/** Required on all new campaigns (EU political ads regulation). */
const EU_POLITICAL_ADS_DECLARATION = "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING";

function formatGoogleAdsErrorEntry(error: {
  message?: string | null;
  error_code?: unknown;
  trigger?: unknown;
  location?: { field_path_elements?: Array<{ field_name?: string | null; index?: number | null }> };
}) {
  const codeParts =
    error.error_code && typeof error.error_code === "object"
      ? Object.entries(error.error_code as Record<string, unknown>)
          .filter(([, value]) => value != null && value !== 0 && value !== "UNSPECIFIED")
          .map(([key, value]) => `${key}: ${String(value)}`)
      : [];
  const fieldPath =
    error.location?.field_path_elements
      ?.map((element) => element.field_name || (element.index != null ? `[${element.index}]` : ""))
      .filter(Boolean)
      .join(".") || "";
  return [
    error.message,
    codeParts.length ? codeParts.join(", ") : "",
    fieldPath ? `veld: ${fieldPath}` : "",
    error.trigger != null && error.trigger !== "" ? `trigger: ${String(error.trigger)}` : "",
  ]
    .filter(Boolean)
    .join(" — ");
}

export function formatGoogleAdsError(error: unknown): string {
  if (error instanceof errors.GoogleAdsFailure) {
    const parts = error.errors.map((entry) => formatGoogleAdsErrorEntry(entry)).filter(Boolean);
    if (parts.length) return parts.join(" · ");
  }

  if (error instanceof Error) {
    const anyErr = error as { errors?: Array<Parameters<typeof formatGoogleAdsErrorEntry>[0]> };
    if (anyErr.errors?.length) {
      const parts = anyErr.errors.map((entry) => formatGoogleAdsErrorEntry(entry)).filter(Boolean);
      if (parts.length) return parts.join(" · ");
    }
    if (error.message && error.message !== "[object Object]") return error.message;
  }

  if (error && typeof error === "object") {
    const nested = (error as { errors?: unknown[] }).errors;
    if (Array.isArray(nested) && nested.length) {
      const parts = nested
        .map((entry) =>
          typeof entry === "object" && entry
            ? formatGoogleAdsErrorEntry(entry as Parameters<typeof formatGoogleAdsErrorEntry>[0])
            : String(entry),
        )
        .filter(Boolean);
      if (parts.length) return parts.join(" · ");
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

export function defaultSearchTargeting(targeting: unknown) {
  const custom = asObject(targeting);
  const keywords = asStringArray(custom.keywords, 1);
  return {
    geoTargetConstants: asStringArray(custom.geoTargetConstants).length
      ? asStringArray(custom.geoTargetConstants)
      : ["geoTargetConstants/2056"],
    keywords: keywords.length ? keywords : ["digitify leads", "lead generatie belgie"],
    languageConstants: asStringArray(custom.languageConstants).length
      ? asStringArray(custom.languageConstants)
      : ["languageConstants/1010"],
  };
}

export function normalizeSearchCreatives(creatives: unknown) {
  const creative = asObject(creatives);
  const finalUrl = String(creative.finalUrl || creative.linkUrl || creative.url || "").trim();
  if (!finalUrl) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Creative finalUrl ontbreekt. Voeg een bestemmingslink toe.",
    });
  }
  const headlines = asStringArray(creative.headlines || creative.headline, 3);
  const descriptions = asStringArray(creative.descriptions || creative.description, 2);
  while (headlines.length < 3) headlines.push(`Meer weten over ${headlines.length + 1}`);
  while (descriptions.length < 2) descriptions.push(`Ontdek meer via onze website.`);
  return { finalUrl, headlines: headlines.slice(0, 15), descriptions: descriptions.slice(0, 4) };
}

function createAdsClient(config: GoogleAdsWorkspaceConfig) {
  if (!config.clientId || !config.clientSecret) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Google OAuth client ontbreekt in Integraties." });
  }
  if (!config.developerToken) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "GOOGLE_ADS_DEVELOPER_TOKEN ontbreekt op de server.",
    });
  }
  if (!config.refreshToken) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Koppel Google Ads eerst via Integraties." });
  }
  return new GoogleAdsApi({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    developer_token: config.developerToken,
  });
}

export function getGoogleAdsCustomer(client: GoogleAdsApi, config: GoogleAdsWorkspaceConfig) {
  const customerId = normalizeGoogleCustomerId(config.customerId);
  if (!customerId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Geen Google Ads customer ID geselecteerd." });
  }
  return client.Customer({
    customer_id: customerId,
    refresh_token: config.refreshToken,
    login_customer_id: config.loginCustomerId || undefined,
  });
}

export async function listGoogleAdCustomers(config: GoogleAdsWorkspaceConfig): Promise<GoogleAdCustomerSummary[]> {
  const client = createAdsClient(config);
  const accessible = await client.listAccessibleCustomers(config.refreshToken);
  const resourceNames = Array.isArray(accessible)
    ? accessible
    : ((accessible as { resource_names?: string[] }).resource_names ?? []);
  const summaries: GoogleAdCustomerSummary[] = [];

  for (const resourceName of resourceNames) {
    const customerId = resourceName.replace("customers/", "");
    try {
      const customer = client.Customer({
        customer_id: customerId,
        refresh_token: config.refreshToken,
        login_customer_id: config.loginCustomerId || undefined,
      });
      const rows = await customer.query(`
        SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone
        FROM customer
        LIMIT 1
      `);
      const row = rows[0] as {
        customer?: {
          descriptive_name?: string;
          currency_code?: string;
          time_zone?: string;
        };
      };
      summaries.push({
        customerId,
        resourceName,
        name: row.customer?.descriptive_name || `Customer ${customerId}`,
        currency: row.customer?.currency_code || "EUR",
        timezone: row.customer?.time_zone || "",
      });
    } catch {
      summaries.push({
        customerId,
        resourceName,
        name: `Customer ${customerId}`,
        currency: "EUR",
        timezone: "",
      });
    }
  }

  return summaries;
}

export async function listGoogleCampaigns(config: GoogleAdsWorkspaceConfig) {
  const client = createAdsClient(config);
  const customer = getGoogleAdsCustomer(client, config);
  const rows = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type
    FROM campaign
    WHERE campaign.status != 'REMOVED'
    ORDER BY campaign.id DESC
    LIMIT 100
  `);
  return rows.map((row: any) => ({
    id: String(row.campaign?.id || ""),
    name: row.campaign?.name || "",
    status: row.campaign?.status || "",
    channelType: row.campaign?.advertising_channel_type || "",
  }));
}

export async function getGoogleAdsInsights(config: GoogleAdsWorkspaceConfig) {
  const client = createAdsClient(config);
  const customer = getGoogleAdsCustomer(client, config);
  const rows = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 100
  `);
  return rows.map((row: any) => ({
    campaign_id: String(row.campaign?.id || ""),
    campaign_name: row.campaign?.name || "",
    impressions: Number(row.metrics?.impressions || 0),
    clicks: Number(row.metrics?.clicks || 0),
    spend: Number(row.metrics?.cost_micros || 0) / 1_000_000,
  }));
}

async function pushSearchPaused(params: {
  customer: ReturnType<GoogleAdsApi["Customer"]>;
  customerId: string;
  plan: {
    name: string;
    dailyBudgetCents?: number | null;
    lifetimeBudgetCents?: number | null;
    targeting?: unknown;
    creatives?: unknown;
  };
}) {
  const { customer, customerId, plan } = params;
  const targeting = defaultSearchTargeting(plan.targeting);
  const creative = normalizeSearchCreatives(plan.creatives);
  const dailyCents = Number(plan.dailyBudgetCents || plan.lifetimeBudgetCents || 0);
  const amountMicros = centsToBudgetMicros(dailyCents);

  const budgetResourceName = ResourceNames.campaignBudget(customerId, "-1");
  const campaignResourceName = ResourceNames.campaign(customerId, "-2");
  const adGroupResourceName = ResourceNames.adGroup(customerId, "-3");

  const budgetOps: MutateOperation<resources.ICampaignBudget | resources.ICampaign>[] = [
    {
      entity: "campaign_budget",
      operation: "create",
      resource: {
        resource_name: budgetResourceName,
        name: `${plan.name} Budget`,
        delivery_method: enums.BudgetDeliveryMethod.STANDARD,
        amount_micros: amountMicros,
      },
    },
    {
      entity: "campaign",
      operation: "create",
      resource: {
        resource_name: campaignResourceName,
        name: plan.name,
        advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
        status: enums.CampaignStatus.PAUSED,
        campaign_budget: budgetResourceName,
        manual_cpc: { enhanced_cpc_enabled: false },
        network_settings: {
          target_google_search: true,
          target_search_network: true,
          target_content_network: false,
        },
        contains_eu_political_advertising: EU_POLITICAL_ADS_DECLARATION,
      },
    },
  ];

  let budgetResult: MutateResourcesResult;
  try {
    budgetResult = (await customer.mutateResources(budgetOps)) as MutateResourcesResult;
  } catch (error) {
    throw new Error(`Google campagne/budget: ${formatGoogleAdsError(error)}`);
  }

  const createdCampaignRn =
    budgetResult.results?.find((r) => r.resource_name?.includes("/campaigns/"))?.resource_name ||
    campaignResourceName;

  let adGroupRn: string = adGroupResourceName;
  try {
    const adGroupResult = await customer.adGroups.create([
      {
        name: `${plan.name} - Ad Group`,
        campaign: createdCampaignRn,
        status: enums.AdGroupStatus.PAUSED,
        type: enums.AdGroupType.SEARCH_STANDARD,
        cpc_bid_micros: toMicros(1),
      },
    ]);
    adGroupRn = String(adGroupResult.results?.[0]?.resource_name || adGroupResourceName);
  } catch (error) {
    throw new Error(`Google ad group: ${formatGoogleAdsError(error)}`);
  }

  try {
    await customer.adGroupAds.create([
      {
        ad_group: adGroupRn,
        status: enums.AdGroupAdStatus.PAUSED,
        ad: {
          responsive_search_ad: {
            headlines: creative.headlines.map((text) => ({ text })),
            descriptions: creative.descriptions.map((text) => ({ text })),
          },
          final_urls: [creative.finalUrl],
        },
      },
    ]);
  } catch (error) {
    throw new Error(`Google advertentie: ${formatGoogleAdsError(error)}`);
  }

  try {
    await customer.adGroupCriteria.create(
      targeting.keywords.map((text) => ({
        ad_group: adGroupRn,
        status: enums.AdGroupCriterionStatus.PAUSED,
        keyword: {
          text,
          match_type: enums.KeywordMatchType.PHRASE,
        },
      })),
    );
  } catch (error) {
    throw new Error(`Google keywords: ${formatGoogleAdsError(error)}`);
  }

  return {
    campaignResourceName: createdCampaignRn,
    adGroupResourceName: adGroupRn,
    status: "PAUSED" as const,
  };
}

async function pushPerformanceMaxPaused(params: {
  customer: ReturnType<GoogleAdsApi["Customer"]>;
  customerId: string;
  plan: {
    name: string;
    dailyBudgetCents?: number | null;
    lifetimeBudgetCents?: number | null;
    targeting?: unknown;
    creatives?: unknown;
  };
}) {
  const { customer, customerId, plan } = params;
  const creative = normalizeSearchCreatives(plan.creatives);
  const targeting = defaultSearchTargeting(plan.targeting);
  const dailyCents = Number(plan.dailyBudgetCents || plan.lifetimeBudgetCents || 0);
  const amountMicros = centsToBudgetMicros(dailyCents);

  const budgetResourceName = ResourceNames.campaignBudget(customerId, "-1");
  const campaignResourceName = ResourceNames.campaign(customerId, "-2");
  const assetGroupResourceName = ResourceNames.assetGroup(customerId, "-3");

  // google-ads-api MutateOperation typings are narrower than batch create payloads.
  const operations: MutateOperation<resources.ICampaignBudget | resources.ICampaign | resources.IAssetGroup | resources.IAssetGroupAsset>[] =
    [
    {
      entity: "campaign_budget",
      operation: "create",
      resource: {
        resource_name: budgetResourceName,
        name: `${plan.name} Budget`,
        delivery_method: enums.BudgetDeliveryMethod.STANDARD,
        amount_micros: amountMicros,
      },
    },
    {
      entity: "campaign",
      operation: "create",
      resource: {
        resource_name: campaignResourceName,
        name: plan.name,
        advertising_channel_type: enums.AdvertisingChannelType.PERFORMANCE_MAX,
        status: enums.CampaignStatus.PAUSED,
        campaign_budget: budgetResourceName,
        contains_eu_political_advertising: EU_POLITICAL_ADS_DECLARATION,
      },
    },
    {
      entity: "asset_group",
      operation: "create",
      resource: {
        resource_name: assetGroupResourceName,
        name: `${plan.name} Asset Group`,
        campaign: campaignResourceName,
        status: enums.AssetGroupStatus.PAUSED,
        final_urls: [creative.finalUrl],
      },
    },
  ];

  for (const text of creative.headlines.slice(0, 5)) {
    operations.push({
      entity: "asset_group_asset",
      operation: "create",
      resource: {
        asset_group: assetGroupResourceName,
        field_type: enums.AssetFieldType.HEADLINE,
        asset: { text_asset: { text } },
      },
    } as unknown as MutateOperation<resources.IAssetGroupAsset>);
  }

  for (const text of creative.descriptions.slice(0, 5)) {
    operations.push({
      entity: "asset_group_asset",
      operation: "create",
      resource: {
        asset_group: assetGroupResourceName,
        field_type: enums.AssetFieldType.DESCRIPTION,
        asset: { text_asset: { text } },
      },
    } as unknown as MutateOperation<resources.IAssetGroupAsset>);
  }

  const imageUrl = String(asObject(plan.creatives).imageUrl || "").trim();
  if (imageUrl) {
    operations.push({
      entity: "asset_group_asset",
      operation: "create",
      resource: {
        asset_group: assetGroupResourceName,
        field_type: enums.AssetFieldType.MARKETING_IMAGE,
        asset: { image_asset: { full_size: { url: imageUrl } } },
      },
    } as unknown as MutateOperation<resources.IAssetGroupAsset>);
  }

  const geoOps: MutateOperation<resources.ICampaignCriterion>[] = [];
  if (targeting.geoTargetConstants.length) {
    for (const geo of targeting.geoTargetConstants.slice(0, 10)) {
      geoOps.push({
        entity: "campaign_criterion",
        operation: "create",
        resource: {
          campaign: campaignResourceName,
          location: {
            geo_target_constant: geo.startsWith("geoTargetConstants/")
              ? geo
              : `geoTargetConstants/${geo}`,
          },
        },
      });
    }
  }

  try {
    const result = (await customer.mutateResources(operations)) as MutateResourcesResult;
    if (geoOps.length) {
      await customer.mutateResources(geoOps);
    }
    const campaignRn =
      result.results?.find((r: { resource_name?: string }) => r.resource_name?.includes("/campaigns/"))?.resource_name ||
      campaignResourceName;
    return {
      campaignResourceName: campaignRn,
      assetGroupResourceName,
      status: "PAUSED" as const,
    };
  } catch (error) {
    throw new Error(`Google Performance Max: ${formatGoogleAdsError(error)}`);
  }
}

export async function pushPausedGoogleAdPlan(params: {
  config: GoogleAdsWorkspaceConfig;
  plan: {
    name: string;
    campaignType: string;
    dailyBudgetCents?: number | null;
    lifetimeBudgetCents?: number | null;
    targeting?: unknown;
    creatives?: unknown;
  };
}) {
  const { config, plan } = params;
  validateBudgetGuard(plan, config.maxDailyBudgetCents);

  const client = createAdsClient(config);
  const customer = getGoogleAdsCustomer(client, config);
  const customerId = normalizeGoogleCustomerId(config.customerId);
  const campaignType = String(plan.campaignType || "SEARCH").toUpperCase();

  if (campaignType === "PERFORMANCE_MAX") {
    return pushPerformanceMaxPaused({ customer, customerId, plan });
  }
  return pushSearchPaused({ customer, customerId, plan });
}

export async function loadGoogleAdsWorkspaceConfigFromDb(db: PrismaClient, scope: WorkspaceScope) {
  return loadGoogleAdsWorkspaceConfig(db, scope);
}

export { GOOGLE_ADS_SETTING_KEYS, loadGoogleAdsWorkspaceConfig };
export { validateBudgetGuard } from "./meta-ads";
