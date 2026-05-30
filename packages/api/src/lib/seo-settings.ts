import { type PrismaClient } from "@digitify/db";
import { getSettingBoolean, getSettingString, settingsRowsToMap } from "./settings";
import { loadWorkspaceSettingRows } from "./workspace-settings";

export const SEO_SETTING_KEYS = [
  "seo.site_name",
  "seo.default_title",
  "seo.default_description",
  "seo.keywords",
  "seo.canonical_base_url",
  "seo.og_image_url",
  "seo.og_locale",
  "seo.twitter_card",
  "seo.twitter_site",
  "seo.robots_index",
  "seo.robots_follow",
  "seo.google_site_verification",
  "seo.bing_site_verification",
  "seo.yandex_verification",
  "seo.organization_name",
  "seo.organization_logo_url",
  "seo.structured_data_enabled",
  "seo.page_home_title",
  "seo.page_home_description",
  "seo.page_product_title",
  "seo.page_product_description",
  "seo.page_solutions_title",
  "seo.page_solutions_description",
  "seo.page_about_title",
  "seo.page_about_description",
  "seo.page_contact_title",
  "seo.page_contact_description",
  "seo.solution_pages_json",
] as const;

export type MarketingSeoPageKey =
  | "home"
  | "product"
  | "solutions"
  | "about"
  | "contact"
  | `solution:${string}`;

export type PublicSeoConfig = {
  siteName: string;
  defaultTitle: string;
  defaultDescription: string;
  keywords: string[];
  canonicalBaseUrl: string;
  ogImageUrl: string;
  ogLocale: string;
  twitterCard: "summary" | "summary_large_image";
  twitterSite: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  googleSiteVerification: string;
  bingSiteVerification: string;
  yandexVerification: string;
  organizationName: string;
  organizationLogoUrl: string;
  structuredDataEnabled: boolean;
  pageTitles: Record<string, string>;
  pageDescriptions: Record<string, string>;
  solutionPages: Record<string, { title?: string; description?: string }>;
};

const DEFAULTS: Omit<PublicSeoConfig, "canonicalBaseUrl"> & { canonicalBaseUrl: string } = {
  siteName: "Digitify Lead Finder",
  defaultTitle: "Digitify Lead Finder — Lead generation & outreach platform",
  defaultDescription:
    "Vind leads, automatiseer outreach met AI, stuur offertes en boek afspraken. Alles in één white-label platform voor groeiende teams.",
  keywords: [
    "lead generation",
    "outreach",
    "CRM",
    "offertes",
    "boekingen",
    "reviews",
    "white label",
    "België",
  ],
  canonicalBaseUrl: "https://leads.digitify.be",
  ogImageUrl: "",
  ogLocale: "nl_BE",
  twitterCard: "summary_large_image",
  twitterSite: "",
  robotsIndex: true,
  robotsFollow: true,
  googleSiteVerification: "",
  bingSiteVerification: "",
  yandexVerification: "",
  organizationName: "Digitify",
  organizationLogoUrl: "",
  structuredDataEnabled: true,
  pageTitles: {},
  pageDescriptions: {},
  solutionPages: {},
};

function parseKeywords(raw: string) {
  return raw
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 32);
}

function parseSolutionPagesJson(raw: unknown): Record<string, { title?: string; description?: string }> {
  if (!raw) return {};
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const result: Record<string, { title?: string; description?: string }> = {};
  for (const [slug, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!slug.trim() || !value || typeof value !== "object" || Array.isArray(value)) continue;
    const entry = value as Record<string, unknown>;
    result[slug.trim()] = {
      title: typeof entry.title === "string" ? entry.title.trim() : undefined,
      description: typeof entry.description === "string" ? entry.description.trim() : undefined,
    };
  }
  return result;
}

export function mapSettingsToPublicSeoConfig(
  settings: Record<string, unknown>,
  options?: { fallbackCanonical?: string },
): PublicSeoConfig {
  const canonicalBase =
    getSettingString(settings, "seo.canonical_base_url", "") ||
    options?.fallbackCanonical ||
    DEFAULTS.canonicalBaseUrl;

  const twitterRaw = getSettingString(settings, "seo.twitter_card", "summary_large_image");
  const twitterCard = twitterRaw === "summary" ? "summary" : "summary_large_image";

  return {
    siteName: getSettingString(settings, "seo.site_name", DEFAULTS.siteName),
    defaultTitle: getSettingString(settings, "seo.default_title", DEFAULTS.defaultTitle),
    defaultDescription: getSettingString(settings, "seo.default_description", DEFAULTS.defaultDescription),
    keywords: parseKeywords(getSettingString(settings, "seo.keywords", DEFAULTS.keywords.join(", "))),
    canonicalBaseUrl: canonicalBase.replace(/\/$/, ""),
    ogImageUrl:
      getSettingString(settings, "seo.og_image_url", "") ||
      getSettingString(settings, "branding.logo_url", "") ||
      DEFAULTS.ogImageUrl,
    ogLocale: getSettingString(settings, "seo.og_locale", DEFAULTS.ogLocale),
    twitterCard,
    twitterSite: getSettingString(settings, "seo.twitter_site", ""),
    robotsIndex: getSettingBoolean(settings, "seo.robots_index", DEFAULTS.robotsIndex),
    robotsFollow: getSettingBoolean(settings, "seo.robots_follow", DEFAULTS.robotsFollow),
    googleSiteVerification: getSettingString(settings, "seo.google_site_verification", ""),
    bingSiteVerification: getSettingString(settings, "seo.bing_site_verification", ""),
    yandexVerification: getSettingString(settings, "seo.yandex_verification", ""),
    organizationName:
      getSettingString(settings, "seo.organization_name", "") ||
      getSettingString(settings, "branding.company_name", DEFAULTS.organizationName),
    organizationLogoUrl:
      getSettingString(settings, "seo.organization_logo_url", "") ||
      getSettingString(settings, "branding.logo_url", ""),
    structuredDataEnabled: getSettingBoolean(
      settings,
      "seo.structured_data_enabled",
      DEFAULTS.structuredDataEnabled,
    ),
    pageTitles: {
      home: getSettingString(settings, "seo.page_home_title", ""),
      product: getSettingString(settings, "seo.page_product_title", ""),
      solutions: getSettingString(settings, "seo.page_solutions_title", ""),
      about: getSettingString(settings, "seo.page_about_title", ""),
      contact: getSettingString(settings, "seo.page_contact_title", ""),
    },
    pageDescriptions: {
      home: getSettingString(settings, "seo.page_home_description", ""),
      product: getSettingString(settings, "seo.page_product_description", ""),
      solutions: getSettingString(settings, "seo.page_solutions_description", ""),
      about: getSettingString(settings, "seo.page_about_description", ""),
      contact: getSettingString(settings, "seo.page_contact_description", ""),
    },
    solutionPages: parseSolutionPagesJson(settings["seo.solution_pages_json"]),
  };
}

export async function loadPublicSeoConfigForWorkspace(
  db: PrismaClient,
  workspaceId: string,
  options?: { fallbackCanonical?: string },
): Promise<PublicSeoConfig> {
  const rows = await loadWorkspaceSettingRows(db, { workspaceId, memberId: workspaceId }, [...SEO_SETTING_KEYS]);
  const settings = settingsRowsToMap(rows);
  return mapSettingsToPublicSeoConfig(settings, options);
}

/** Public marketing site SEO (owner workspace from PUBLIC_MARKETING_WORKSPACE_ID or default tenant). */
export async function loadMarketingPublicSeoConfig(
  db: PrismaClient,
  options?: { fallbackCanonical?: string },
): Promise<PublicSeoConfig> {
  const { resolveMarketingWorkspaceOwnerId } = await import("./public-tenant");
  const ownerId = await resolveMarketingWorkspaceOwnerId(db);
  if (!ownerId) {
    return mapSettingsToPublicSeoConfig({}, options);
  }
  return loadPublicSeoConfigForWorkspace(db, ownerId, options);
}

export function resolvePageSeoCopy(
  config: PublicSeoConfig,
  page: MarketingSeoPageKey,
  fallback: { title: string; description: string },
) {
  if (page.startsWith("solution:")) {
    const slug = page.slice("solution:".length);
    const override = config.solutionPages[slug];
    const title = override?.title || fallback.title;
    const description = override?.description || fallback.description;
    return { title, description };
  }

  const baseKey = page as keyof PublicSeoConfig["pageTitles"];
  const title = config.pageTitles[baseKey]?.trim() || fallback.title;
  const description = config.pageDescriptions[baseKey]?.trim() || fallback.description;
  return { title, description };
}
