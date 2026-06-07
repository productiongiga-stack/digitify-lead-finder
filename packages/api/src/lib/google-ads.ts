import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@digitify/db";
import { assertPublicHttpUrl } from "@digitify/connectors";
import type { GoogleAdsApi, MutateOperation } from "google-ads-api";
import { validateBudgetGuard } from "./meta-ads";
import { type WorkspaceScope } from "./workspace-settings";
import {
  GOOGLE_ADS_SETTING_KEYS,
  loadGoogleAdsWorkspaceConfig,
  normalizeGoogleCustomerId,
  type GoogleAdsWorkspaceConfig,
} from "./google-ads-oauth";

export type { GoogleAdsWorkspaceConfig };

type GoogleAdsSdk = typeof import("google-ads-api");

let googleAdsSdkPromise: Promise<GoogleAdsSdk> | null = null;

function loadGoogleAdsSdk() {
  googleAdsSdkPromise ??= import("google-ads-api");
  return googleAdsSdkPromise;
}

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

function asLongStringArray(value: unknown, max = 80): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, max);
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
  location?: { field_path_elements?: Array<{ field_name?: string | null; index?: number | null }> | null } | null;
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

function googleAdsHintFor(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("developer_token") || lower.includes("developer token")) {
    return "Tip: zet GOOGLE_ADS_DEVELOPER_TOKEN in de server/Vercel env en controleer Google Ads API Center toegang.";
  }
  if (lower.includes("invalid_grant") || lower.includes("refresh_token") || lower.includes("oauth") || lower.includes("authorization")) {
    return "Tip: koppel Google Ads opnieuw via Integraties met de adwords scope en controleer accounttoegang.";
  }
  if (lower.includes("field_error") || lower.includes("required") || lower.includes("missing") || lower.includes("veld:")) {
    return "Tip: controleer het genoemde veld; Search vereist minstens 3 headlines, 2 beschrijvingen en een geldige finalUrl.";
  }
  if (lower.includes("policy") || lower.includes("disapproved")) {
    return "Tip: controleer Google Ads Policy Manager; pas claims, hoofdletters, verboden woorden of landingspagina-inhoud aan.";
  }
  if (lower.includes("customer") || lower.includes("resource_not_found") || lower.includes("not found")) {
    return "Tip: selecteer de Google Ads customer opnieuw en controleer manager/login customer toegang.";
  }
  if (lower.includes("budget")) {
    return "Tip: verlaag het budget of verhoog de workspace budgetlimiet.";
  }
  return "Tip: controleer Google OAuth, customer, developer token, billing status en het veldpad in de foutmelding.";
}

function withGoogleAdsHint(message: string): string {
  if (!message || message.includes("Tip:")) return message;
  return `${message} · ${googleAdsHintFor(message)}`;
}

export function formatGoogleAdsError(error: unknown): string {
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
      if (parts.length) return withGoogleAdsHint(parts.join(" · "));
    }
  }

  if (error instanceof Error) {
    const anyErr = error as { errors?: Array<Parameters<typeof formatGoogleAdsErrorEntry>[0]> };
    if (anyErr.errors?.length) {
      const parts = anyErr.errors.map((entry) => formatGoogleAdsErrorEntry(entry)).filter(Boolean);
      if (parts.length) return withGoogleAdsHint(parts.join(" · "));
    }
    if (error.message && error.message !== "[object Object]") return withGoogleAdsHint(error.message);
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
      if (parts.length) return withGoogleAdsHint(parts.join(" · "));
    }
    try {
      return withGoogleAdsHint(JSON.stringify(error));
    } catch {
      return withGoogleAdsHint(String(error));
    }
  }

  return withGoogleAdsHint(String(error));
}

export function defaultSearchTargeting(targeting: unknown) {
  const custom = asObject(targeting);
  const keywords = asLongStringArray(custom.keywords, 80);
  return {
    geoTargetConstants: asStringArray(custom.geoTargetConstants).length
      ? asStringArray(custom.geoTargetConstants)
      : ["geoTargetConstants/2056"],
    keywords: keywords.length ? keywords : ["digitify leads", "lead generatie belgie"],
    negativeKeywords: asLongStringArray(custom.negativeKeywords, 80),
    languageConstants: asStringArray(custom.languageConstants).length
      ? asStringArray(custom.languageConstants)
      : ["languageConstants/1010"],
    matchType: String(custom.matchType || "PHRASE").toUpperCase(),
    adGroupName: String(custom.adGroupName || "").trim(),
    searchPartners: custom.searchPartners !== false,
    displayExpansion: Boolean(custom.displayExpansion),
    campaignSettings: asObject(custom.campaignSettings),
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
  const longHeadlines = asStringArray(creative.longHeadlines || creative.longHeadline, 1);
  while (headlines.length < 3) headlines.push(`Meer weten over ${headlines.length + 1}`);
  while (descriptions.length < 2) descriptions.push(`Ontdek meer via onze website.`);
  return {
    finalUrl,
    headlines: headlines.slice(0, 15),
    longHeadlines: longHeadlines.slice(0, 5),
    descriptions: descriptions.slice(0, 5),
    headlinePin1: String(creative.headlinePin1 || "").trim(),
    descriptionPin1: String(creative.descriptionPin1 || "").trim(),
    businessName: String(creative.businessName || "").trim(),
    path1: String(creative.path1 || "").trim().slice(0, 15),
    path2: String(creative.path2 || "").trim().slice(0, 15),
    imageUrl: String(creative.imageUrl || creative.marketingImageUrl || "").trim(),
    squareImageUrl: String(creative.squareImageUrl || creative.squareMarketingImageUrl || "").trim(),
    portraitImageUrl: String(creative.portraitImageUrl || "").trim(),
    logoUrl: String(creative.logoUrl || "").trim(),
    landscapeLogoUrl: String(creative.landscapeLogoUrl || "").trim(),
    callToAction: String(creative.callToAction || "").trim(),
    assetGroupName: String(creative.assetGroupName || "").trim(),
    brandGuidelinesEnabled: Boolean(creative.brandGuidelinesEnabled),
  };
}

function resolveKeywordMatchType(enums: GoogleAdsSdk["enums"], value: string) {
  const normalized = value.trim().toUpperCase();
  if (normalized === "BROAD") return enums.KeywordMatchType.BROAD;
  if (normalized === "EXACT") return enums.KeywordMatchType.EXACT;
  return enums.KeywordMatchType.PHRASE;
}

function textAsset(text: string, pinnedField?: number) {
  return pinnedField ? { text, pinned_field: pinnedField } : { text };
}

function validatePerformanceMaxAssets(creative: ReturnType<typeof normalizeSearchCreatives>) {
  if (creative.brandGuidelinesEnabled) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Performance Max brand guidelines staan aan, maar V1 pusht nog geen campaign-level brand assets. Zet brand guidelines uit of maak deze campagne voorlopig handmatig in Google Ads.",
    });
  }
  if (creative.headlines.length < 3) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Performance Max vereist minstens 3 headlines." });
  }
  if (creative.longHeadlines.length < 1) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Performance Max vereist minstens 1 long headline." });
  }
  if (creative.descriptions.length < 2) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Performance Max vereist minstens 2 beschrijvingen." });
  }
  if (!creative.imageUrl || !creative.squareImageUrl) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Performance Max vereist minstens 1 landscape image URL en 1 square image URL.",
    });
  }
  if (!creative.businessName || creative.businessName.length > 25) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Performance Max business name is verplicht en maximaal 25 tekens.",
    });
  }
  if (!creative.logoUrl) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Performance Max vereist in V1 een logo URL wanneer brand guidelines uit staan.",
    });
  }
}

async function fetchImageAssetData(url: string) {
  let safeUrl: string;
  try {
    safeUrl = await assertPublicHttpUrl(url);
  } catch (error) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: error instanceof Error ? error.message : "Deze afbeelding-URL is niet toegestaan.",
    });
  }
  const response = await fetch(safeUrl);
  if (!response.ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Afbeelding downloaden mislukt (${response.status}). Gebruik een publieke JPG/PNG/GIF URL.`,
    });
  }
  const contentType = response.headers.get("content-type") || "";
  if (!/image\/(png|jpe?g|gif)/i.test(contentType)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Afbeelding heeft ongeldig content-type (${contentType || "onbekend"}). Gebruik JPG, PNG of GIF.`,
    });
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 5_120_000) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Afbeelding is groter dan 5120 KB, Google Ads weigert deze asset." });
  }
  return bytes;
}

async function createAdsClient(config: GoogleAdsWorkspaceConfig) {
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
  const { GoogleAdsApi } = await loadGoogleAdsSdk();
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
  const client = await createAdsClient(config);
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
  const client = await createAdsClient(config);
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
  const client = await createAdsClient(config);
  const customer = getGoogleAdsCustomer(client, config);
  const rows = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.ctr,
      metrics.conversions
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
    ctr: Number(row.metrics?.ctr || 0),
    conversions: Number(row.metrics?.conversions || 0),
    cpc: Number(row.metrics?.clicks || 0) > 0 ? Number(row.metrics?.cost_micros || 0) / Number(row.metrics?.clicks || 1) / 1_000_000 : 0,
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
  const { enums, ResourceNames, toMicros } = await loadGoogleAdsSdk();
  const targeting = defaultSearchTargeting(plan.targeting);
  const creative = normalizeSearchCreatives(plan.creatives);
  const dailyCents = Number(plan.dailyBudgetCents || plan.lifetimeBudgetCents || 0);
  const amountMicros = centsToBudgetMicros(dailyCents);

  const budgetResourceName = ResourceNames.campaignBudget(customerId, "-1");
  const campaignResourceName = ResourceNames.campaign(customerId, "-2");
  const adGroupResourceName = ResourceNames.adGroup(customerId, "-3");

  const budgetOps: MutateOperation<any>[] = [
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
          target_search_network: targeting.searchPartners,
          target_content_network: targeting.displayExpansion,
        },
        contains_eu_political_advertising: EU_POLITICAL_ADS_DECLARATION,
      } as any,
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
        name: targeting.adGroupName || `${plan.name} - Ad Group`,
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
            headlines: creative.headlines.map((text) =>
              textAsset(text, text === creative.headlinePin1 ? enums.ServedAssetFieldType.HEADLINE_1 : undefined),
            ),
            descriptions: creative.descriptions.slice(0, 4).map((text) =>
              textAsset(text, text === creative.descriptionPin1 ? enums.ServedAssetFieldType.DESCRIPTION_1 : undefined),
            ),
            path1: creative.path1 || undefined,
            path2: creative.path1 && creative.path2 ? creative.path2 : undefined,
          } as any,
          final_urls: [creative.finalUrl],
          tracking_url_template: String(targeting.campaignSettings.trackingTemplate || "").trim() || undefined,
          final_url_suffix: String(targeting.campaignSettings.finalUrlSuffix || "").trim() || undefined,
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
          match_type: resolveKeywordMatchType(enums, targeting.matchType),
        },
      })),
    );
  } catch (error) {
    throw new Error(`Google keywords: ${formatGoogleAdsError(error)}`);
  }

  if (targeting.negativeKeywords.length) {
    try {
      await customer.adGroupCriteria.create(
        targeting.negativeKeywords.map((text) => ({
          ad_group: adGroupRn,
          negative: true,
          keyword: {
            text,
            match_type: resolveKeywordMatchType(enums, targeting.matchType),
          },
        })),
      );
    } catch (error) {
      throw new Error(`Google negatieve keywords: ${formatGoogleAdsError(error)}`);
    }
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
  const { enums, ResourceNames } = await loadGoogleAdsSdk();
  const creative = normalizeSearchCreatives(plan.creatives);
  validatePerformanceMaxAssets(creative);
  const targeting = defaultSearchTargeting(plan.targeting);
  const dailyCents = Number(plan.dailyBudgetCents || plan.lifetimeBudgetCents || 0);
  const amountMicros = centsToBudgetMicros(dailyCents);
  const campaignSettings = asObject(targeting.campaignSettings);
  const biddingStrategy = String(campaignSettings.biddingStrategy || "MAXIMIZE_CONVERSIONS").toUpperCase();
  const targetCpaCents = Number(campaignSettings.targetCpaCents || 0);
  const targetRoas = Number(campaignSettings.targetRoas || 0);
  const bidding =
    biddingStrategy === "MAXIMIZE_CONVERSION_VALUE"
      ? { maximize_conversion_value: targetRoas > 0 ? { target_roas: targetRoas } : {} }
      : { maximize_conversions: targetCpaCents > 0 ? { target_cpa_micros: centsToBudgetMicros(targetCpaCents) } : {} };

  const budgetResourceName = ResourceNames.campaignBudget(customerId, "-1");
  const campaignResourceName = ResourceNames.campaign(customerId, "-2");
  const assetGroupResourceName = ResourceNames.assetGroup(customerId, "-3");
  let tempAssetId = -10;

  const nextAssetResourceName = () => ResourceNames.asset(customerId, tempAssetId--);

  // google-ads-api MutateOperation typings are narrower than batch create payloads.
  const operations: MutateOperation<any>[] =
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
        final_url_suffix: String(campaignSettings.finalUrlSuffix || "").trim() || undefined,
        tracking_url_template: String(campaignSettings.trackingTemplate || "").trim() || undefined,
        ...bidding,
      } as any,
    },
    {
      entity: "asset_group",
      operation: "create",
      resource: {
        resource_name: assetGroupResourceName,
        name: creative.assetGroupName || `${plan.name} Asset Group`,
        campaign: campaignResourceName,
        status: enums.AssetGroupStatus.PAUSED,
        final_urls: [creative.finalUrl],
      },
    },
  ];

  const addTextAsset = (text: string, fieldType: number) => {
    const assetResourceName = nextAssetResourceName();
    operations.push({
      entity: "asset",
      operation: "create",
      resource: {
        resource_name: assetResourceName,
        text_asset: { text },
      },
    } as unknown as MutateOperation<any>);
    operations.push({
      entity: "asset_group_asset",
      operation: "create",
      resource: {
        asset_group: assetGroupResourceName,
        asset: assetResourceName,
        field_type: fieldType,
      },
    } as unknown as MutateOperation<any>);
  };

  const addImageAsset = async (url: string, fieldType: number, label: string) => {
    const assetResourceName = nextAssetResourceName();
    const data = await fetchImageAssetData(url);
    operations.push({
      entity: "asset",
      operation: "create",
      resource: {
        resource_name: assetResourceName,
        name: `${plan.name} - ${label}`,
        image_asset: { data },
      },
    } as unknown as MutateOperation<any>);
    operations.push({
      entity: "asset_group_asset",
      operation: "create",
      resource: {
        asset_group: assetGroupResourceName,
        asset: assetResourceName,
        field_type: fieldType,
      },
    } as unknown as MutateOperation<any>);
  };

  for (const text of creative.headlines.slice(0, 15)) {
    addTextAsset(text, enums.AssetFieldType.HEADLINE);
  }
  for (const text of creative.longHeadlines.slice(0, 5)) {
    addTextAsset(text, enums.AssetFieldType.LONG_HEADLINE);
  }
  for (const text of creative.descriptions.slice(0, 5)) {
    addTextAsset(text, enums.AssetFieldType.DESCRIPTION);
  }
  addTextAsset(creative.businessName, enums.AssetFieldType.BUSINESS_NAME);
  await addImageAsset(creative.imageUrl, enums.AssetFieldType.MARKETING_IMAGE, "landscape image");
  await addImageAsset(creative.squareImageUrl, enums.AssetFieldType.SQUARE_MARKETING_IMAGE, "square image");
  await addImageAsset(creative.logoUrl, enums.AssetFieldType.LOGO, "logo");
  if (creative.portraitImageUrl) {
    await addImageAsset(creative.portraitImageUrl, enums.AssetFieldType.PORTRAIT_MARKETING_IMAGE, "portrait image");
  }
  if (creative.landscapeLogoUrl) {
    await addImageAsset(creative.landscapeLogoUrl, enums.AssetFieldType.LANDSCAPE_LOGO, "landscape logo");
  }

  const geoOps: MutateOperation<any>[] = [];
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

  const client = await createAdsClient(config);
  const customer = getGoogleAdsCustomer(client, config);
  const customerId = normalizeGoogleCustomerId(config.customerId);
  const campaignType = String(plan.campaignType || "SEARCH").toUpperCase();

  if (campaignType === "PERFORMANCE_MAX") {
    return pushPerformanceMaxPaused({ customer, customerId, plan });
  }
  return pushSearchPaused({ customer, customerId, plan });
}

export type GeoTargetSuggestion = {
  id: string;
  label: string;
  canonicalName: string;
  countryCode: string;
  targetType: string;
};

const BENELUX_COUNTRY_CODES = ["BE", "NL", "LU"] as const;

function formatGeoTargetType(targetType: unknown) {
  const value = String(targetType || "").toUpperCase();
  if (value.includes("CITY")) return "Stad";
  if (value.includes("PROVINCE") || value.includes("REGION")) return "Regio";
  if (value.includes("MUNICIPALITY")) return "Gemeente";
  if (value.includes("POSTAL")) return "Postcode";
  if (value.includes("COUNTRY")) return "Land";
  if (value.includes("NEIGHBORHOOD")) return "Buurt";
  return value ? value.replace(/_/g, " ").toLowerCase() : "Locatie";
}

export async function suggestBeneluxGeoTargets(
  config: GoogleAdsWorkspaceConfig,
  query: string,
): Promise<GeoTargetSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const client = await createAdsClient(config);
  const customer = getGoogleAdsCustomer(client, config);

  const responses = await Promise.all(
    BENELUX_COUNTRY_CODES.map(async (countryCode) => {
      try {
        return await customer.geoTargetConstants.suggestGeoTargetConstants({
          locale: "nl",
          country_code: countryCode,
          location_names: { names: [trimmed] },
        } as never);
      } catch {
        return null;
      }
    }),
  );

  const suggestions: GeoTargetSuggestion[] = [];
  const seen = new Set<string>();

  for (const response of responses) {
    const items = response?.geo_target_constant_suggestions;
    if (!items?.length) continue;

    for (const item of items) {
      const geo = item.geo_target_constant;
      if (!geo) continue;
      const resourceName = String(geo.resource_name || "");
      if (!resourceName || seen.has(resourceName)) continue;

      const countryCode = String(geo.country_code || "").toUpperCase();
      if (countryCode && !BENELUX_COUNTRY_CODES.includes(countryCode as (typeof BENELUX_COUNTRY_CODES)[number])) {
        continue;
      }

      seen.add(resourceName);
      suggestions.push({
        id: resourceName,
        label: String(geo.name || item.search_term || geo.canonical_name || resourceName),
        canonicalName: String(geo.canonical_name || geo.name || ""),
        countryCode,
        targetType: formatGeoTargetType(geo.target_type),
      });
    }
  }

  return suggestions
    .sort((a, b) => {
      const rank = (item: GeoTargetSuggestion) => (item.targetType === "Stad" ? 0 : item.targetType === "Regio" ? 1 : 2);
      const diff = rank(a) - rank(b);
      if (diff !== 0) return diff;
      return a.label.localeCompare(b.label, "nl");
    })
    .slice(0, 12);
}

export async function loadGoogleAdsWorkspaceConfigFromDb(db: PrismaClient, scope: WorkspaceScope) {
  return loadGoogleAdsWorkspaceConfig(db, scope);
}

export { GOOGLE_ADS_SETTING_KEYS, loadGoogleAdsWorkspaceConfig };
export { validateBudgetGuard } from "./meta-ads";
