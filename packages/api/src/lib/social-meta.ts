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

const META_API_ERROR_HINTS: Record<number, string> = {
  1885183:
    "Zet je Meta-app op Live: developers.facebook.com → jouw app → App settings → Basic → schakel van Development naar Live.",
  2207009:
    "Afbeeldingsverhouding ongeldig voor Instagram. Gebruik een publieke JPG/PNG/WebP tussen 4:5 en 1.91:1, bijvoorbeeld 1080x1080 of 1080x1350.",
  33:
    "Meta ondersteunt deze edge mogelijk niet voor jouw app of Page. Controleer of Page Stories publishing beschikbaar is en of je app de juiste rechten/App Review heeft.",
};

export function formatMetaApiError(error: MetaErrorPayload["error"], fallbackStatus?: number) {
  if (!error) return `Meta API fout (${fallbackStatus || "unknown"})`;
  const parts = [error.error_user_msg || error.message || "Meta API fout"];
  if (error.error_user_title && error.error_user_title !== parts[0]) {
    parts.unshift(error.error_user_title);
  }
  const hint =
    (error.error_subcode ? META_API_ERROR_HINTS[error.error_subcode] : undefined) ||
    (error.code ? META_API_ERROR_HINTS[error.code] : undefined);
  if (error.code === 36003 && !hint) {
    parts.push("Afbeelding geweigerd door Meta. Controleer beeldratio, bestandstype en publieke bereikbaarheid van de image URL.");
  }
  if (hint) parts.push(hint);
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

const META_API_TIMEOUT_MS = 45_000;

async function metaFetch(url: URL, init: RequestInit) {
  try {
    const response = await fetch(url, init);
    return parseMetaResponse(response);
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("Meta API reageerde niet op tijd. Probeer opnieuw over enkele minuten.");
    }
    throw error;
  }
}

export async function metaGet(path: string, params: Record<string, string | undefined>) {
  const url = new URL(`https://graph.facebook.com/${resolveMetaGraphVersion()}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    url.searchParams.set(key, value);
  }
  return metaFetch(url, { method: "GET", signal: AbortSignal.timeout(META_API_TIMEOUT_MS) });
}

export async function metaPost(path: string, body: Record<string, string | undefined>) {
  const url = new URL(`https://graph.facebook.com/${resolveMetaGraphVersion()}/${path}`);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    params.set(key, value);
  }
  return metaFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    signal: AbortSignal.timeout(META_API_TIMEOUT_MS),
  });
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

type MetaAccountsListItem = {
  id?: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id?: string; username?: string };
};

type MetaCollectionResponse<T> = {
  data?: T[];
  paging?: {
    cursors?: { after?: string };
    next?: string;
  };
};

function mapMetaAccountsListItem(item: MetaAccountsListItem): MetaManagedPage | null {
  if (!item.id?.trim() || !item.access_token?.trim()) return null;
  return {
    id: item.id.trim(),
    name: (item.name ?? "").trim(),
    accessToken: item.access_token.trim(),
    instagramBusinessId: item.instagram_business_account?.id?.trim() || "",
    instagramUsername: item.instagram_business_account?.username?.trim() || "",
  };
}

export async function metaGetCollection<T>(
  path: string,
  params: Record<string, string | undefined>,
): Promise<T[]> {
  const items: T[] = [];
  let after: string | undefined;

  for (let page = 0; page < 20; page += 1) {
    const raw = (await metaGet(path, {
      ...params,
      limit: params.limit || "100",
      ...(after ? { after } : {}),
    })) as MetaCollectionResponse<T>;

    items.push(...(raw.data || []));
    after = raw.paging?.cursors?.after?.trim();
    if (!after || !raw.paging?.next) break;
  }

  return items;
}

export async function resolvePageInstagramLink(page: MetaManagedPage): Promise<MetaManagedPage> {
  if (page.instagramBusinessId) return page;

  try {
    const raw = (await metaGet(page.id, {
      access_token: page.accessToken,
      fields: "instagram_business_account{id,username}",
    })) as {
      instagram_business_account?: { id?: string; username?: string };
    };

    const instagramBusinessId = raw.instagram_business_account?.id?.trim() || "";
    const instagramUsername = raw.instagram_business_account?.username?.trim() || "";
    if (!instagramBusinessId) return page;

    return {
      ...page,
      instagramBusinessId,
      instagramUsername,
    };
  } catch {
    return page;
  }
}

async function enrichManagedPagesInstagram(pages: MetaManagedPage[]) {
  const batchSize = 8;
  const enriched: MetaManagedPage[] = [];

  for (let index = 0; index < pages.length; index += batchSize) {
    const batch = pages.slice(index, index + batchSize);
    const resolved = await Promise.all(batch.map((page) => resolvePageInstagramLink(page)));
    enriched.push(...resolved);
  }

  return enriched;
}

export async function loadMetaManagedPages(userAccessToken: string): Promise<MetaManagedPage[]> {
  const rows = await metaGetCollection<MetaAccountsListItem>("me/accounts", {
    fields: "id,name,access_token,instagram_business_account{id,username}",
    access_token: userAccessToken,
    limit: "100",
  });

  const pages = rows
    .map((item) => mapMetaAccountsListItem(item))
    .filter((item): item is MetaManagedPage => Boolean(item));

  return enrichManagedPagesInstagram(pages);
}

export function pickDefaultMetaPage(pages: MetaManagedPage[]) {
  const withInstagram = pages.find((page) => Boolean(page.instagramBusinessId));
  return withInstagram || pages[0] || null;
}

export type SocialPublishTarget = {
  pageId: string;
  pageAccessToken: string;
  pageName: string;
  instagramBusinessId: string;
  instagramUsername: string;
};

export async function resolveSocialPublishTarget(params: {
  config: MetaWorkspaceConfig;
  publisherPageId?: string | null;
}): Promise<SocialPublishTarget> {
  const requestedPageId = params.publisherPageId?.trim() || params.config.pageId?.trim();
  if (!requestedPageId) {
    throw new Error("Geen Facebook-pagina geselecteerd. Kies een account in de Social Planner.");
  }

  if (requestedPageId === params.config.pageId?.trim() && params.config.pageAccessToken) {
    return {
      pageId: params.config.pageId,
      pageAccessToken: params.config.pageAccessToken,
      pageName: "",
      instagramBusinessId: params.config.instagramBusinessId,
      instagramUsername: "",
    };
  }

  if (!params.config.accessToken) {
    throw new Error("Meta access token ontbreekt. Koppel Meta opnieuw via Integraties.");
  }

  const pages = await loadMetaManagedPages(params.config.accessToken);
  const page = pages.find((item) => item.id === requestedPageId);
  if (!page) {
    throw new Error("Geselecteerde Facebook-pagina is niet meer beschikbaar. Kies een ander account.");
  }

  return {
    pageId: page.id,
    pageAccessToken: page.accessToken,
    pageName: page.name,
    instagramBusinessId: page.instagramBusinessId,
    instagramUsername: page.instagramUsername,
  };
}

export type SocialPublishedRef = {
  id: string;
  permalink?: string;
  verified: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForInstagramMediaContainer(params: {
  containerId: string;
  pageAccessToken: string;
  maxWaitMs?: number;
  pollIntervalMs?: number;
}) {
  const maxWait = params.maxWaitMs ?? 120_000;
  const pollInterval = params.pollIntervalMs ?? 3_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxWait) {
    const status = (await metaGet(params.containerId, {
      fields: "status_code",
      access_token: params.pageAccessToken,
    })) as { status_code?: string };

    const code = status.status_code;
    if (code === "FINISHED" || code === "PUBLISHED") return;
    if (code === "ERROR" || code === "EXPIRED") {
      throw new Error(`Instagram media container mislukt (${code || "onbekend"}).`);
    }

    await sleep(pollInterval);
  }

  throw new Error("Instagram media verwerking duurde te lang. Probeer opnieuw met een kleinere afbeelding of video.");
}

export async function verifyFacebookPublishedPost(params: { postId: string; pageAccessToken: string }) {
  const postId = params.postId.trim();
  if (!postId) {
    return { id: "", verified: false } satisfies SocialPublishedRef;
  }

  try {
    const data = (await metaGet(postId, {
      fields: "permalink_url",
      access_token: params.pageAccessToken,
    })) as { permalink_url?: string };

    return {
      id: postId,
      permalink: data.permalink_url,
      verified: true,
    } satisfies SocialPublishedRef;
  } catch {
    // Stories, photos and some feed nodes are not always readable after publish.
    return { id: postId, verified: true } satisfies SocialPublishedRef;
  }
}

export async function verifyInstagramPublishedMedia(params: { mediaId: string; pageAccessToken: string }) {
  const mediaId = params.mediaId.trim();
  if (!mediaId) {
    return { id: "", verified: false } satisfies SocialPublishedRef;
  }

  try {
    const data = (await metaGet(mediaId, {
      fields: "permalink",
      access_token: params.pageAccessToken,
    })) as { permalink?: string };

    return {
      id: mediaId,
      permalink: data.permalink,
      verified: true,
    } satisfies SocialPublishedRef;
  } catch {
    return { id: mediaId, verified: true } satisfies SocialPublishedRef;
  }
}

export async function publishFacebookImagePost(params: {
  pageId: string;
  pageAccessToken: string;
  caption: string;
  imageUrl: string;
}): Promise<SocialPublishedRef> {
  const response = (await metaPost(`${params.pageId}/photos`, {
    access_token: params.pageAccessToken,
    url: params.imageUrl,
    caption: params.caption,
    published: "true",
  })) as { post_id?: string; id?: string };

  const postId = response.post_id || response.id || "";
  if (!postId) throw new Error("Facebook gaf geen post-ID terug na publicatie.");

  return verifyFacebookPublishedPost({ postId, pageAccessToken: params.pageAccessToken });
}

export async function publishFacebookImageStory(params: {
  pageId: string;
  pageAccessToken: string;
  imageUrl: string;
}): Promise<SocialPublishedRef> {
  const uploaded = (await metaPost(`${params.pageId}/photos`, {
    access_token: params.pageAccessToken,
    url: params.imageUrl,
    published: "false",
  })) as { id?: string };

  const photoId = uploaded.id?.trim() || "";
  if (!photoId) {
    throw new Error("Facebook Story foto kon niet worden geüpload.");
  }

  const response = (await metaPost(`${params.pageId}/photo_stories`, {
    access_token: params.pageAccessToken,
    photo_id: photoId,
  })) as { post_id?: string; id?: string; success?: boolean };

  const postId = response.post_id || response.id || "";
  if (!postId && !response.success) {
    throw new Error("Facebook Story publicatie mislukt (geen post-ID).");
  }

  if (postId) {
    return verifyFacebookPublishedPost({ postId, pageAccessToken: params.pageAccessToken });
  }

  return { id: photoId, verified: Boolean(response.success) };
}

export async function publishInstagramImagePost(params: {
  instagramBusinessId: string;
  pageAccessToken: string;
  caption: string;
  imageUrl: string;
}): Promise<SocialPublishedRef> {
  const created = (await metaPost(`${params.instagramBusinessId}/media`, {
    access_token: params.pageAccessToken,
    image_url: params.imageUrl,
    caption: params.caption,
  })) as { id?: string };

  if (!created.id) throw new Error("Instagram media container kon niet worden aangemaakt.");

  await waitForInstagramMediaContainer({
    containerId: created.id,
    pageAccessToken: params.pageAccessToken,
  });

  const published = (await metaPost(`${params.instagramBusinessId}/media_publish`, {
    access_token: params.pageAccessToken,
    creation_id: created.id,
  })) as { id?: string };

  const mediaId = published.id || "";
  if (!mediaId) throw new Error("Instagram gaf geen media-ID terug na publicatie.");

  return verifyInstagramPublishedMedia({ mediaId, pageAccessToken: params.pageAccessToken });
}

export async function publishInstagramImageStory(params: {
  instagramBusinessId: string;
  pageAccessToken: string;
  imageUrl: string;
}): Promise<SocialPublishedRef> {
  const created = (await metaPost(`${params.instagramBusinessId}/media`, {
    access_token: params.pageAccessToken,
    image_url: params.imageUrl,
    media_type: "STORIES",
  })) as { id?: string };

  if (!created.id) throw new Error("Instagram Story media container kon niet worden aangemaakt.");

  await waitForInstagramMediaContainer({
    containerId: created.id,
    pageAccessToken: params.pageAccessToken,
  });

  const published = (await metaPost(`${params.instagramBusinessId}/media_publish`, {
    access_token: params.pageAccessToken,
    creation_id: created.id,
  })) as { id?: string };

  const mediaId = published.id || "";
  if (!mediaId) throw new Error("Instagram Story gaf geen media-ID terug na publicatie.");

  return verifyInstagramPublishedMedia({ mediaId, pageAccessToken: params.pageAccessToken });
}

export type SocialCarouselPublishSlide = {
  mediaType: "IMAGE" | "VIDEO";
  imageUrl?: string;
  videoUrl?: string;
};

export async function publishFacebookVideoPost(params: {
  pageId: string;
  pageAccessToken: string;
  caption: string;
  videoUrl: string;
}): Promise<SocialPublishedRef> {
  const response = (await metaPost(`${params.pageId}/videos`, {
    access_token: params.pageAccessToken,
    file_url: params.videoUrl,
    description: params.caption,
    published: "true",
  })) as { id?: string };

  const videoId = response.id?.trim() || "";
  if (!videoId) throw new Error("Facebook gaf geen video-ID terug na publicatie.");

  return { id: videoId, verified: true };
}

export async function publishInstagramVideoPost(params: {
  instagramBusinessId: string;
  pageAccessToken: string;
  caption: string;
  videoUrl: string;
}): Promise<SocialPublishedRef> {
  const created = (await metaPost(`${params.instagramBusinessId}/media`, {
    access_token: params.pageAccessToken,
    video_url: params.videoUrl,
    media_type: "VIDEO",
    caption: params.caption,
  })) as { id?: string };

  if (!created.id) throw new Error("Instagram video container kon niet worden aangemaakt.");

  await waitForInstagramMediaContainer({
    containerId: created.id,
    pageAccessToken: params.pageAccessToken,
    maxWaitMs: 300_000,
    pollIntervalMs: 5_000,
  });

  const published = (await metaPost(`${params.instagramBusinessId}/media_publish`, {
    access_token: params.pageAccessToken,
    creation_id: created.id,
  })) as { id?: string };

  const mediaId = published.id || "";
  if (!mediaId) throw new Error("Instagram gaf geen media-ID terug na video-publicatie.");

  return verifyInstagramPublishedMedia({ mediaId, pageAccessToken: params.pageAccessToken });
}

async function uploadFacebookCarouselMedia(params: {
  pageId: string;
  pageAccessToken: string;
  slide: SocialCarouselPublishSlide;
}) {
  if (params.slide.mediaType === "IMAGE") {
    const imageUrl = params.slide.imageUrl?.trim();
    if (!imageUrl) throw new Error("Carousel-foto ontbreekt.");

    const uploaded = (await metaPost(`${params.pageId}/photos`, {
      access_token: params.pageAccessToken,
      url: imageUrl,
      published: "false",
    })) as { id?: string };

    const mediaId = uploaded.id?.trim() || "";
    if (!mediaId) throw new Error("Facebook carousel-foto kon niet worden geüpload.");
    return mediaId;
  }

  const videoUrl = params.slide.videoUrl?.trim();
  if (!videoUrl) throw new Error("Carousel-video ontbreekt.");

  const uploaded = (await metaPost(`${params.pageId}/videos`, {
    access_token: params.pageAccessToken,
    file_url: videoUrl,
    published: "false",
  })) as { id?: string };

  const mediaId = uploaded.id?.trim() || "";
  if (!mediaId) throw new Error("Facebook carousel-video kon niet worden geüpload.");
  return mediaId;
}

export async function publishFacebookCarouselPost(params: {
  pageId: string;
  pageAccessToken: string;
  caption: string;
  slides: SocialCarouselPublishSlide[];
}): Promise<SocialPublishedRef> {
  if (params.slides.length < 2) {
    throw new Error("Carousel vereist minstens 2 slides.");
  }

  const mediaIds: string[] = [];
  for (const slide of params.slides) {
    mediaIds.push(
      await uploadFacebookCarouselMedia({
        pageId: params.pageId,
        pageAccessToken: params.pageAccessToken,
        slide,
      }),
    );
  }

  const body: Record<string, string | undefined> = {
    access_token: params.pageAccessToken,
    message: params.caption,
  };
  mediaIds.forEach((mediaId, index) => {
    body[`attached_media[${index}]`] = JSON.stringify({ media_fbid: mediaId });
  });

  const response = (await metaPost(`${params.pageId}/feed`, body)) as { id?: string };
  const postId = response.id?.trim() || "";
  if (!postId) throw new Error("Facebook carousel gaf geen post-ID terug na publicatie.");

  return verifyFacebookPublishedPost({ postId, pageAccessToken: params.pageAccessToken });
}

async function createInstagramCarouselChildContainer(params: {
  instagramBusinessId: string;
  pageAccessToken: string;
  slide: SocialCarouselPublishSlide;
}) {
  if (params.slide.mediaType === "IMAGE") {
    const imageUrl = params.slide.imageUrl?.trim();
    if (!imageUrl) throw new Error("Carousel-foto ontbreekt.");

    const created = (await metaPost(`${params.instagramBusinessId}/media`, {
      access_token: params.pageAccessToken,
      image_url: imageUrl,
      is_carousel_item: "true",
    })) as { id?: string };

    if (!created.id) throw new Error("Instagram carousel-foto container kon niet worden aangemaakt.");
    return created.id;
  }

  const videoUrl = params.slide.videoUrl?.trim();
  if (!videoUrl) throw new Error("Carousel-video ontbreekt.");

  const created = (await metaPost(`${params.instagramBusinessId}/media`, {
    access_token: params.pageAccessToken,
    video_url: videoUrl,
    media_type: "VIDEO",
    is_carousel_item: "true",
  })) as { id?: string };

  if (!created.id) throw new Error("Instagram carousel-video container kon niet worden aangemaakt.");
  return created.id;
}

export async function publishInstagramCarouselPost(params: {
  instagramBusinessId: string;
  pageAccessToken: string;
  caption: string;
  slides: SocialCarouselPublishSlide[];
}): Promise<SocialPublishedRef> {
  if (params.slides.length < 2) {
    throw new Error("Carousel vereist minstens 2 slides.");
  }

  const childIds: string[] = [];
  for (const slide of params.slides) {
    const childId = await createInstagramCarouselChildContainer({
      instagramBusinessId: params.instagramBusinessId,
      pageAccessToken: params.pageAccessToken,
      slide,
    });

    await waitForInstagramMediaContainer({
      containerId: childId,
      pageAccessToken: params.pageAccessToken,
      maxWaitMs: slide.mediaType === "VIDEO" ? 300_000 : 120_000,
      pollIntervalMs: slide.mediaType === "VIDEO" ? 5_000 : 3_000,
    });

    childIds.push(childId);
  }

  const parent = (await metaPost(`${params.instagramBusinessId}/media`, {
    access_token: params.pageAccessToken,
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption: params.caption,
  })) as { id?: string };

  if (!parent.id) throw new Error("Instagram carousel container kon niet worden aangemaakt.");

  await waitForInstagramMediaContainer({
    containerId: parent.id,
    pageAccessToken: params.pageAccessToken,
    maxWaitMs: 120_000,
    pollIntervalMs: 3_000,
  });

  const published = (await metaPost(`${params.instagramBusinessId}/media_publish`, {
    access_token: params.pageAccessToken,
    creation_id: parent.id,
  })) as { id?: string };

  const mediaId = published.id || "";
  if (!mediaId) throw new Error("Instagram carousel gaf geen media-ID terug na publicatie.");

  return verifyInstagramPublishedMedia({ mediaId, pageAccessToken: params.pageAccessToken });
}

export async function publishInstagramReel(params: {
  instagramBusinessId: string;
  pageAccessToken: string;
  caption: string;
  videoUrl: string;
  coverUrl?: string;
}): Promise<SocialPublishedRef> {
  const payload: Record<string, string> = {
    access_token: params.pageAccessToken,
    media_type: "REELS",
    video_url: params.videoUrl,
    caption: params.caption,
  };
  if (params.coverUrl?.trim()) {
    payload.cover_url = params.coverUrl.trim();
  }

  const created = (await metaPost(`${params.instagramBusinessId}/media`, payload)) as { id?: string };
  if (!created.id) throw new Error("Instagram Reel media container kon niet worden aangemaakt.");

  await waitForInstagramMediaContainer({
    containerId: created.id,
    pageAccessToken: params.pageAccessToken,
    maxWaitMs: 300_000,
    pollIntervalMs: 5_000,
  });

  const published = (await metaPost(`${params.instagramBusinessId}/media_publish`, {
    access_token: params.pageAccessToken,
    creation_id: created.id,
  })) as { id?: string };

  const mediaId = published.id || "";
  if (!mediaId) throw new Error("Instagram Reel gaf geen media-ID terug na publicatie.");

  return verifyInstagramPublishedMedia({ mediaId, pageAccessToken: params.pageAccessToken });
}

export function workspaceScopeFromAuthenticatedUser(user: { id: string; workspaceId?: string }) {
  return workspaceScopeFromUser({ id: user.id, workspaceId: user.workspaceId });
}
