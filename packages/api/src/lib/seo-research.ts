import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@digitify/db";
import { getSettingString, settingsRowsToMap } from "./settings";
import { loadWorkspaceSettingRows, workspaceScopeFromUser } from "./workspace-settings";
import { createAdsClient, getGoogleAdsCustomer } from "./google-ads";
import { loadGoogleAdsWorkspaceConfig } from "./google-ads-oauth";
import { loadGoogleOAuthClientConfig } from "./google-calendar";

export type SeoResearchInput = {
  workspaceId: string;
  memberId: string;
  domainId?: string;
  seeds: string[];
  language: string;
  location: string;
  providers: Array<"GOOGLE_ADS" | "SEARCH_CONSOLE">;
  targetUrl?: string;
};

export type SeoIdea = {
  keyword: string;
  keywordKey: string;
  source: "GOOGLE_ADS" | "SEARCH_CONSOLE";
  language: string;
  location: string;
  intent: "INFORMATIONAL" | "COMMERCIAL" | "TRANSACTIONAL" | "NAVIGATIONAL" | "LOCAL" | "UNKNOWN";
  searchVolume?: number | null;
  competition?: number | null;
  cpcCents?: number | null;
  impressions?: number | null;
  clicks?: number | null;
  ctr?: number | null;
  averagePosition?: number | null;
  targetUrl?: string | null;
  evidence?: Record<string, unknown>;
};

export function normalizeSeoKeyword(value: string) {
  return value.trim().toLocaleLowerCase("nl-BE").replace(/\s+/g, " ");
}

export function seoResearchKey(input: Pick<SeoResearchInput, "domainId" | "seeds" | "language" | "location" | "providers" | "targetUrl">) {
  const payload = {
    domainId: input.domainId || null,
    seeds: [...new Set(input.seeds.map(normalizeSeoKeyword).filter(Boolean))].sort(),
    language: input.language.trim().toLowerCase(),
    location: input.location.trim().toLowerCase(),
    providers: [...new Set(input.providers)].sort(),
    targetUrl: input.targetUrl?.trim() || null,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 40);
}

function inferIntent(keyword: string): SeoIdea["intent"] {
  const value = keyword.toLocaleLowerCase("nl-BE");
  if (/(kopen|prijs|offerte|boeken|bestellen|abonnement|dienst)/.test(value)) return "TRANSACTIONAL";
  if (/(beste|vergelijk|review|alternatief|bureau|bedrijf)/.test(value)) return "COMMERCIAL";
  if (/(in |te |antwerpen|gent|brussel|leuven|brugge|belgië|vlaanderen)/.test(value)) return "LOCAL";
  if (/(wat|hoe|waarom|gids|tips|uitleg)/.test(value)) return "INFORMATIONAL";
  return "UNKNOWN";
}

function parseGoogleIdea(raw: any, language: string, location: string, targetUrl?: string): SeoIdea | null {
  const keyword = String(raw?.text || raw?.keyword || "").trim();
  if (!keyword) return null;
  const metrics = raw?.keywordIdeaMetrics || raw?.keyword_idea_metrics || {};
  const micros = Number(metrics.highTopOfPageBidMicros || metrics.high_top_of_page_bid_micros || 0);
  const competition = metrics.competitionIndex ?? metrics.competition_index ?? null;
  return {
    keyword,
    keywordKey: normalizeSeoKeyword(keyword),
    source: "GOOGLE_ADS",
    language,
    location,
    intent: inferIntent(keyword),
    searchVolume: Number(metrics.avgMonthlySearches || metrics.avg_monthly_searches || 0) || null,
    competition: competition == null ? null : Number(competition) / (Number(competition) > 1 ? 100 : 1),
    cpcCents: micros ? Math.round(micros / 10_000) : null,
    targetUrl: targetUrl || null,
    evidence: { provider: "Google Ads Keyword Planner", fetchedAt: new Date().toISOString() },
  };
}

export async function loadSeoConnectorStatus(db: PrismaClient, input: { workspaceId: string; memberId: string }) {
  const scope = workspaceScopeFromUser({ id: input.memberId, workspaceId: input.workspaceId });
  const [googleAds, settingsRows] = await Promise.all([
    loadGoogleAdsWorkspaceConfig(db, scope),
    loadWorkspaceSettingRows(db, scope, [
      "seo.google_search_console_refresh_token",
      "seo.google_search_console_property",
    ]),
  ]);
  const settings = settingsRowsToMap(settingsRows);
  const hasSearchConsole = Boolean(getSettingString(settings, "seo.google_search_console_refresh_token"));
  return {
    googleAds: {
      connected: Boolean(googleAds.refreshToken && googleAds.customerId),
      hasOAuth: Boolean(googleAds.refreshToken),
      hasCustomer: Boolean(googleAds.customerId),
      hasDeveloperToken: Boolean(googleAds.developerToken),
      apiAccessManagedByCloudProject: true,
    },
    searchConsole: {
      connected: hasSearchConsole,
      property: getSettingString(settings, "seo.google_search_console_property") || null,
    },
  };
}

async function getSearchConsoleAccessToken(db: PrismaClient, input: { workspaceId: string; memberId: string }) {
  const scope = workspaceScopeFromUser({ id: input.memberId, workspaceId: input.workspaceId });
  const rows = await loadWorkspaceSettingRows(db, scope, [
    "seo.google_search_console_access_token",
    "seo.google_search_console_refresh_token",
    "seo.google_search_console_token_expires_at",
  ]);
  const settings = settingsRowsToMap(rows);
  const accessToken = getSettingString(settings, "seo.google_search_console_access_token");
  const expiresAt = getSettingString(settings, "seo.google_search_console_token_expires_at");
  if (accessToken && (!expiresAt || new Date(expiresAt).getTime() > Date.now() + 60_000)) return accessToken;
  const refreshToken = getSettingString(settings, "seo.google_search_console_refresh_token");
  // Do not reuse an expired access token. Refresh it when possible so a
  // long-lived workspace connection keeps working after the first hour.
  if (!refreshToken) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Koppel Google Search Console eerst." });
  const client = await loadGoogleOAuthClientConfig(db, { userId: input.memberId });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: client.clientId, client_secret: client.clientSecret, grant_type: "refresh_token", refresh_token: refreshToken }) });
  if (!response.ok) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Search Console-token verlopen. Koppel de integratie opnieuw." });
  const body = await response.json() as { access_token?: string };
  if (!body.access_token) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Geen Search Console-token ontvangen." });
  return body.access_token;
}

export async function listSearchConsoleProperties(db: PrismaClient, input: { workspaceId: string; memberId: string }) {
  const accessToken = await getSearchConsoleAccessToken(db, input);
  const response = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Search Console-properties konden niet worden geladen. Controleer de propertyrechten." });
  const body = await response.json() as { siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }> };
  return (body.siteEntry || []).map((site) => ({ siteUrl: site.siteUrl || "", permissionLevel: site.permissionLevel || "" })).filter((site) => site.siteUrl);
}

export async function fetchGoogleAdsIdeas(db: PrismaClient, input: SeoResearchInput) {
  const config = await loadGoogleAdsWorkspaceConfig(db, workspaceScopeFromUser({ id: input.memberId, workspaceId: input.workspaceId }));
  if (!config.refreshToken || !config.customerId) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Koppel Google Ads en selecteer een customer voordat je keyworddata ophaalt." });
  }
  const client = await createAdsClient(config);
  const customer: any = getGoogleAdsCustomer(client as any, config);
  const languageMap: Record<string, string> = { nl: "languageConstants/1010", fr: "languageConstants/1002" };
  const geoMap: Record<string, string> = { BE: "geoTargetConstants/2056", België: "geoTargetConstants/2056", belgium: "geoTargetConstants/2056" };
  const response = await customer.keywordPlanIdeas.generateKeywordIdeas({
    customer_id: config.customerId,
    language: languageMap[input.language.toLowerCase()] || languageMap.nl,
    geo_target_constants: [geoMap[input.location] || geoMap.BE],
    keyword_seed: { keywords: input.seeds },
    include_adult_keywords: false,
    keyword_plan_network: "GOOGLE_SEARCH_AND_PARTNERS",
  });
  const rows = Array.isArray(response) ? response : response?.results || [];
  return rows.map((row: any) => parseGoogleIdea(row, input.language, input.location, input.targetUrl)).filter(Boolean) as SeoIdea[];
}

export async function fetchSearchConsoleIdeas(db: PrismaClient, input: SeoResearchInput): Promise<SeoIdea[]> {
  const scope = workspaceScopeFromUser({ id: input.memberId, workspaceId: input.workspaceId });
  const rows = await loadWorkspaceSettingRows(db, scope, [
    "seo.google_search_console_refresh_token",
    "seo.google_search_console_property",
  ]);
  const settings = settingsRowsToMap(rows);
  const property = getSettingString(settings, "seo.google_search_console_property");
  if (!property) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Selecteer eerst een Search Console-property." });
  const accessToken = await getSearchConsoleAccessToken(db, { workspaceId: input.workspaceId, memberId: input.memberId });
  const end = new Date(); const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ startDate: iso(start), endDate: iso(end), dimensions: ["query", "page"], rowLimit: 250, dimensionFilterGroups: input.seeds.length ? [{ filters: [{ dimension: "query", operator: "contains", expression: input.seeds[0] }] }] : undefined }) });
  if (!response.ok) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Search Console-data kon niet worden gelezen. Controleer propertyrechten." });
  const body = await response.json() as { rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }> };
  return (body.rows || []).map((row) => {
    const keyword = String(row.keys?.[0] || "");
    return { keyword, keywordKey: normalizeSeoKeyword(keyword), source: "SEARCH_CONSOLE" as const, language: input.language, location: input.location, intent: inferIntent(keyword), impressions: row.impressions || 0, clicks: row.clicks || 0, ctr: row.ctr || 0, averagePosition: row.position || null, targetUrl: row.keys?.[1] || input.targetUrl || null, evidence: { provider: "Google Search Console", period: `${iso(start)}:${iso(end)}`, page: row.keys?.[1] || null } };
  }).filter((idea) => idea.keyword);
}

export async function runSeoResearch(db: PrismaClient, input: SeoResearchInput) {
  const ideas: SeoIdea[] = [];
  const errors: string[] = [];
  if (input.providers.includes("GOOGLE_ADS")) {
    try { ideas.push(...(await fetchGoogleAdsIdeas(db, input))); } catch (error) { errors.push(error instanceof Error ? error.message : "Google Ads keywordresearch mislukt."); }
  }
  if (input.providers.includes("SEARCH_CONSOLE")) {
    try { ideas.push(...(await fetchSearchConsoleIdeas(db, input))); } catch (error) { errors.push(error instanceof Error ? error.message : "Search Console keywordresearch mislukt."); }
  }
  const deduped = Array.from(new Map(ideas.map((idea) => [`${idea.keywordKey}:${idea.source}`, idea])).values());
  if (!deduped.length && errors.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: errors[0] });
  return { ideas: deduped, errors };
}
