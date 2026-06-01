import type { PrismaClient } from "@digitify/db";
import { protectSettingValue } from "@digitify/db";
import { getSettingBoolean, getSettingString, settingsRowsToMap } from "./settings";
import { sanitizeOAuthClientValue } from "./oauth-credentials";
import { resolveOAuthAppUrl } from "./oauth-app-url";
import { loadWorkspaceSettingRows, resolveSettingDbKey, workspaceScopeFromUser, type WorkspaceScope } from "./workspace-settings";

const META_SETTING_KEYS = [
  "integrations.meta_app_id",
  "integrations.meta_app_secret",
  "social.meta_page_id",
  "social.meta_instagram_business_id",
  "social.meta_access_token",
  "social.meta_refresh_meta",
  "social.meta_page_access_token",
  "social.meta_token_expires_at",
  "social.autopost_enabled",
  "ads.meta_ad_account_id",
  "ads.meta_business_id",
  "ads.autoads_enabled",
  "ads.default_currency",
  "ads.max_daily_budget_cents",
] as const;

export type MetaWorkspaceConfig = {
  appId: string;
  appSecret: string;
  pageId: string;
  instagramBusinessId: string;
  accessToken: string;
  refreshMeta: string;
  pageAccessToken: string;
  tokenExpiresAt: string;
  autopostEnabled: boolean;
  adAccountId: string;
  businessId: string;
  autoadsEnabled: boolean;
  defaultCurrency: string;
  maxDailyBudgetCents: number;
};

export type MetaOAuthLoginMode = "facebook" | "instagram";

/** Minimal Facebook Login scopes (when Pages publish permission is not on the Meta app yet). */
export const META_FACEBOOK_LOGIN_MINIMAL_SCOPES = [
  "pages_show_list",
  "instagram_basic",
  "instagram_content_publish",
] as const;

/** Scopes for Instagram API with Facebook Login (Page-linked IG). */
export const META_FACEBOOK_LOGIN_PUBLISHING_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
] as const;

/** @deprecated Instagram Login scope names — remapped to Facebook Login equivalents. */
const LEGACY_META_SCOPE_REMAP: Record<string, string> = {
  instagram_business_basic: "instagram_basic",
  instagram_business_content_publish: "instagram_content_publish",
  instagram_business_manage_comments: "instagram_manage_comments",
  instagram_business_manage_messages: "instagram_manage_messages",
  business_basic: "instagram_basic",
  business_content_publish: "instagram_content_publish",
};

/** Scopes for Instagram API with Instagram Login (no Facebook Page required). */
export const META_INSTAGRAM_LOGIN_PUBLISHING_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
] as const;

export const META_ADS_OAUTH_SCOPES = ["ads_read", "ads_management", "business_management"] as const;

export function resolveMetaGraphVersion() {
  const raw = process.env.META_GRAPH_API_VERSION?.trim();
  if (!raw) return "v24.0";
  return raw.startsWith("v") ? raw : `v${raw}`;
}

export function resolveMetaOAuthLoginMode(): MetaOAuthLoginMode {
  const raw = process.env.META_OAUTH_LOGIN_MODE?.trim().toLowerCase();
  if (raw === "instagram") return "instagram";
  return "facebook";
}

export function resolveMetaOAuthIncludeAds() {
  const raw = process.env.META_OAUTH_INCLUDE_ADS?.trim().toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return false;
}

export function resolveMetaOAuthScopeLevel(): "minimal" | "standard" {
  const raw = process.env.META_OAUTH_SCOPE_LEVEL?.trim().toLowerCase();
  if (raw === "minimal") return "minimal";
  return "standard";
}

export function normalizeMetaOAuthScopes(scopes: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const scope of scopes) {
    const trimmed = scope.trim();
    if (!trimmed) continue;
    const mapped = LEGACY_META_SCOPE_REMAP[trimmed] || trimmed;
    if (seen.has(mapped)) continue;
    seen.add(mapped);
    normalized.push(mapped);
  }

  return normalized;
}

export function resolveMetaOAuthScopes() {
  const raw = process.env.META_OAUTH_SCOPES?.trim();
  let scopes: string[];

  if (raw) {
    scopes = raw
      .split(/[,\s]+/)
      .map((scope) => scope.trim())
      .filter(Boolean);
  } else if (resolveMetaOAuthLoginMode() === "instagram") {
    scopes = [...META_INSTAGRAM_LOGIN_PUBLISHING_SCOPES];
  } else if (resolveMetaOAuthScopeLevel() === "minimal") {
    scopes = [...META_FACEBOOK_LOGIN_MINIMAL_SCOPES];
  } else {
    scopes = [...META_FACEBOOK_LOGIN_PUBLISHING_SCOPES];
  }

  if (resolveMetaOAuthLoginMode() !== "instagram") {
    scopes = normalizeMetaOAuthScopes(scopes);
  }

  if (resolveMetaOAuthIncludeAds()) {
    for (const scope of META_ADS_OAUTH_SCOPES) {
      if (!scopes.includes(scope)) scopes.push(scope);
    }
  }

  return scopes;
}

export function hasDeprecatedInstagramBusinessScopes(scopes: string[]) {
  return scopes.some((scope) => scope.startsWith("instagram_business_"));
}

export function resolveMetaOAuthScopeSummary() {
  const scopes = resolveMetaOAuthScopes();
  return {
    loginMode: resolveMetaOAuthLoginMode(),
    scopeLevel: resolveMetaOAuthScopeLevel(),
    includeAds: resolveMetaOAuthIncludeAds(),
    scopes,
    overridden: Boolean(process.env.META_OAUTH_SCOPES?.trim()),
    hasDeprecatedInstagramBusinessScopes: hasDeprecatedInstagramBusinessScopes(scopes),
    usesLegacyEnvOverride:
      Boolean(process.env.META_OAUTH_SCOPES?.trim()) &&
      /instagram_business_|business_basic|business_content_publish/.test(process.env.META_OAUTH_SCOPES || ""),
  };
}

export function resolveAppUrl(request?: Request) {
  return resolveOAuthAppUrl(request);
}

export async function loadMetaWorkspaceConfig(db: PrismaClient, scope: WorkspaceScope): Promise<MetaWorkspaceConfig> {
  const rows = await loadWorkspaceSettingRows(db, scope, [...META_SETTING_KEYS]);
  const settings = settingsRowsToMap(rows);
  return {
    appId: sanitizeOAuthClientValue(getSettingString(settings, "integrations.meta_app_id")),
    appSecret: sanitizeOAuthClientValue(getSettingString(settings, "integrations.meta_app_secret")),
    pageId: getSettingString(settings, "social.meta_page_id"),
    instagramBusinessId: getSettingString(settings, "social.meta_instagram_business_id"),
    accessToken: getSettingString(settings, "social.meta_access_token"),
    refreshMeta: getSettingString(settings, "social.meta_refresh_meta"),
    pageAccessToken: getSettingString(settings, "social.meta_page_access_token"),
    tokenExpiresAt: getSettingString(settings, "social.meta_token_expires_at"),
    autopostEnabled: getSettingBoolean(settings, "social.autopost_enabled", false),
    adAccountId: getSettingString(settings, "ads.meta_ad_account_id"),
    businessId: getSettingString(settings, "ads.meta_business_id"),
    autoadsEnabled: getSettingBoolean(settings, "ads.autoads_enabled", false),
    defaultCurrency: getSettingString(settings, "ads.default_currency", "EUR") || "EUR",
    maxDailyBudgetCents: Number(getSettingString(settings, "ads.max_daily_budget_cents", "5000") || "5000"),
  };
}

export async function upsertMetaSettings(
  db: PrismaClient,
  scope: WorkspaceScope,
  entries: Array<{ key: string; value: string }>,
) {
  await db.$transaction(
    entries.map((entry) => {
      const dbKey = resolveSettingDbKey(scope, entry.key);
      const value = protectSettingValue(entry.key, entry.value) as any;
      return db.setting.upsert({
        where: { key: dbKey },
        update: { value },
        create: { key: dbKey, value },
      });
    }),
  );
}

export async function clearMetaSettings(db: PrismaClient, scope: WorkspaceScope) {
  const keys = [
    "social.meta_page_id",
    "social.meta_instagram_business_id",
    "social.meta_access_token",
    "social.meta_refresh_meta",
    "social.meta_page_access_token",
    "social.meta_token_expires_at",
  ];
  await db.setting.deleteMany({
    where: { key: { in: keys.map((key) => resolveSettingDbKey(scope, key)) } },
  });
}

type MetaErrorPayload = {
  error?: {
    message?: string;
    code?: number;
    type?: string;
    error_subcode?: number;
    error_user_msg?: string;
    error_user_title?: string;
  };
};

export function formatMetaApiError(error: MetaErrorPayload["error"], fallbackStatus?: number) {
  if (!error) return `Meta API fout (${fallbackStatus || "unknown"})`;
  const parts = [error.error_user_msg || error.message || "Meta API fout"];
  if (error.error_user_title && error.error_user_title !== parts[0]) {
    parts.unshift(error.error_user_title);
  }
  if (error.code) parts.push(`code ${error.code}`);
  if (error.error_subcode) parts.push(`subcode ${error.error_subcode}`);
  if (error.type) parts.push(`type ${error.type}`);
  return parts.join(" · ");
}

async function parseMetaResponse(response: Response) {
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown> & MetaErrorPayload;
  if (!response.ok || data.error) {
    throw new Error(formatMetaApiError(data.error, response.status));
  }
  return data;
}

export async function metaGet(path: string, params: Record<string, string | undefined>) {
  const url = new URL(`https://graph.facebook.com/${resolveMetaGraphVersion()}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, { method: "GET" });
  return parseMetaResponse(response);
}

export async function metaPost(path: string, body: Record<string, string | undefined>) {
  const url = new URL(`https://graph.facebook.com/${resolveMetaGraphVersion()}/${path}`);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    params.set(key, value);
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  return parseMetaResponse(response);
}

export async function exchangeMetaOAuthCode(params: {
  code: string;
  redirectUri: string;
  appId: string;
  appSecret: string;
}) {
  const short = (await metaGet("oauth/access_token", {
    client_id: params.appId,
    client_secret: params.appSecret,
    redirect_uri: params.redirectUri,
    code: params.code,
  })) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
  };

  if (!short.access_token) throw new Error("Geen Meta access token ontvangen.");

  const long = (await metaGet("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: params.appId,
    client_secret: params.appSecret,
    fb_exchange_token: short.access_token,
  })) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
  };

  const token = long.access_token || short.access_token;
  const expiresIn = long.expires_in ?? short.expires_in ?? 0;
  return { accessToken: token, expiresInSeconds: expiresIn };
}

export type MetaManagedPage = {
  id: string;
  name: string;
  accessToken: string;
  instagramBusinessId: string;
  instagramUsername: string;
};

export async function loadMetaManagedPages(userAccessToken: string): Promise<MetaManagedPage[]> {
  const raw = (await metaGet("me/accounts", {
    fields: "id,name,access_token,instagram_business_account{id,username}",
    access_token: userAccessToken,
  })) as {
    data?: Array<{
      id?: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id?: string; username?: string };
    }>;
  };

  return (raw.data || [])
    .map((item) => ({
      id: item.id || "",
      name: item.name || "",
      accessToken: item.access_token || "",
      instagramBusinessId: item.instagram_business_account?.id || "",
      instagramUsername: item.instagram_business_account?.username || "",
    }))
    .filter((item) => Boolean(item.id && item.accessToken));
}

export function pickDefaultMetaPage(pages: MetaManagedPage[]) {
  const withInstagram = pages.find((page) => Boolean(page.instagramBusinessId));
  return withInstagram || pages[0] || null;
}

export async function publishFacebookImagePost(params: {
  pageId: string;
  pageAccessToken: string;
  caption: string;
  imageUrl: string;
}) {
  const response = (await metaPost(`${params.pageId}/photos`, {
    access_token: params.pageAccessToken,
    url: params.imageUrl,
    caption: params.caption,
    published: "true",
  })) as { post_id?: string; id?: string };

  return response.post_id || response.id || "";
}

export async function publishInstagramImagePost(params: {
  instagramBusinessId: string;
  pageAccessToken: string;
  caption: string;
  imageUrl: string;
}) {
  const created = (await metaPost(`${params.instagramBusinessId}/media`, {
    access_token: params.pageAccessToken,
    image_url: params.imageUrl,
    caption: params.caption,
  })) as { id?: string };

  if (!created.id) throw new Error("Instagram media container kon niet worden aangemaakt.");

  const published = (await metaPost(`${params.instagramBusinessId}/media_publish`, {
    access_token: params.pageAccessToken,
    creation_id: created.id,
  })) as { id?: string };

  return published.id || "";
}

export function workspaceScopeFromAuthenticatedUser(user: { id: string; workspaceId?: string }) {
  return workspaceScopeFromUser({ id: user.id, workspaceId: user.workspaceId });
}
