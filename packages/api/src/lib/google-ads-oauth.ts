import { type PrismaClient } from "@digitify/db";
import { protectSettingValue } from "@digitify/db";
import { getSettingString, settingsRowsToMap } from "./settings";
import { loadGoogleOAuthClientConfig } from "./google-calendar";
import { loadWorkspaceSettingRows, resolveSettingDbKey, type WorkspaceScope } from "./workspace-settings";

export const GOOGLE_ADS_OAUTH_SCOPE = "https://www.googleapis.com/auth/adwords";

export const GOOGLE_ADS_SETTING_KEYS = [
  "ads.google_oauth_access_token",
  "ads.google_oauth_refresh_token",
  "ads.google_oauth_account_email",
  "ads.google_oauth_token_expires_at",
  "ads.google_customer_id",
  "ads.google_login_customer_id",
  "ads.google_autoads_enabled",
  "ads.google_default_currency",
  "ads.google_max_daily_budget_cents",
] as const;

export type GoogleAdsWorkspaceConfig = Awaited<ReturnType<typeof loadGoogleAdsWorkspaceConfig>>;

export function normalizeGoogleCustomerId(value: string) {
  return value.replace(/\D/g, "");
}

export function resolveGoogleAdsDeveloperToken() {
  return process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() || "";
}

export function resolveGoogleAdsLoginCustomerId(fallback?: string) {
  return (
    fallback?.trim() ||
    process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim().replace(/\D/g, "") ||
    ""
  );
}

export async function loadGoogleAdsWorkspaceConfig(db: PrismaClient, scope: WorkspaceScope) {
  const [oauthClient, rows] = await Promise.all([
    loadGoogleOAuthClientConfig(db, { userId: scope.memberId }),
    loadWorkspaceSettingRows(db, scope, [...GOOGLE_ADS_SETTING_KEYS]),
  ]);
  const settings = settingsRowsToMap(rows);

  return {
    clientId: oauthClient.clientId,
    clientSecret: oauthClient.clientSecret,
    developerToken: resolveGoogleAdsDeveloperToken(),
    refreshToken: getSettingString(settings, "ads.google_oauth_refresh_token"),
    accessToken: getSettingString(settings, "ads.google_oauth_access_token"),
    accountEmail: getSettingString(settings, "ads.google_oauth_account_email"),
    customerId: normalizeGoogleCustomerId(getSettingString(settings, "ads.google_customer_id")),
    loginCustomerId: resolveGoogleAdsLoginCustomerId(
      getSettingString(settings, "ads.google_login_customer_id"),
    ),
    autoadsEnabled: getSettingString(settings, "ads.google_autoads_enabled") === "true",
    defaultCurrency: getSettingString(settings, "ads.google_default_currency", "EUR") || "EUR",
    maxDailyBudgetCents: Number(
      getSettingString(settings, "ads.google_max_daily_budget_cents", "5000") || "5000",
    ),
  };
}

export async function upsertGoogleAdsSettings(
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

export async function clearGoogleAdsOAuthSettings(db: PrismaClient, scope: WorkspaceScope) {
  const keys = [
    "ads.google_oauth_access_token",
    "ads.google_oauth_refresh_token",
    "ads.google_oauth_account_email",
    "ads.google_oauth_token_expires_at",
  ];
  await db.setting.deleteMany({
    where: { key: { in: keys.map((key) => resolveSettingDbKey(scope, key)) } },
  });
}

export async function exchangeGoogleAdsOAuthCode(params: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google token exchange fout (${response.status}): ${body.slice(0, 300)}`);
  }

  return (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
}

export async function refreshGoogleAdsAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      grant_type: "refresh_token",
      refresh_token: params.refreshToken,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google OAuth refresh fout (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Google OAuth access token ontbreekt na refresh.");
  return data;
}
