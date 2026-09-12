export const CONNECTOR_IDS = ["google", "meta", "smtp", "imap", "muapi", "webhook", "stripe", "wordpress"] as const;

export type ConnectorId = (typeof CONNECTOR_IDS)[number];

export const CONNECTOR_SETTING_KEYS: Record<ConnectorId, readonly string[]> = {
  google: [
    "api.google_places_key",
    "integrations.google_oauth_client_id",
    "integrations.google_oauth_client_secret",
    "bookings.google_oauth_access_token",
    "bookings.google_oauth_refresh_token",
    "bookings.google_oauth_account_email",
    "bookings.google_calendar_id",
    "bookings.google_service_account_email",
    "bookings.google_service_account_private_key",
  ],
  meta: ["integrations.meta_app_id", "integrations.meta_app_secret", "social.meta_page_id", "social.meta_page_access_token", "social.meta_instagram_business_id"],
  smtp: ["email.smtp_host", "email.smtp_port", "email.smtp_user", "email.smtp_pass", "email.smtp_servername", "email.from_email"],
  imap: ["email.imap_host", "email.imap_port", "email.imap_user", "email.imap_pass", "email.imap_tls"],
  muapi: [],
  webhook: ["bookings.webhook_url", "bookings.webhook_secret", "bookings.webhook_events"],
  stripe: ["integrations.stripe_secret_key"],
  wordpress: ["integrations.wordpress_url", "integrations.wordpress_username", "integrations.wordpress_application_password"],
};

export function connectorIdForSettingKey(key: string): ConnectorId | null {
  const normalized = key.trim();
  return CONNECTOR_IDS.find((connectorId) => CONNECTOR_SETTING_KEYS[connectorId].includes(normalized)) ?? null;
}

export function missingConnectorConfiguration(
  connectorId: ConnectorId,
  settings: Record<string, unknown>,
  muapiKey?: string | null,
) {
  const has = (key: string) => typeof settings[key] === "string" && settings[key].trim().length > 0;
  const missing: string[] = [];

  if (connectorId === "google" && !((has("api.google_places_key")) || (has("integrations.google_oauth_client_id") && has("integrations.google_oauth_client_secret")))) {
    missing.push("Google API/OAuth-configuratie");
  }
  if (connectorId === "meta" && !(has("integrations.meta_app_id") && has("integrations.meta_app_secret"))) {
    missing.push("Meta App ID en App Secret");
  }
  if (connectorId === "smtp") {
    if (!has("email.smtp_host")) missing.push("SMTP-host");
    if (!has("email.smtp_user")) missing.push("SMTP-gebruiker");
    if (!has("email.smtp_pass")) missing.push("SMTP-wachtwoord");
    if (!has("email.from_email")) missing.push("SMTP-afzender");
  }
  if (connectorId === "imap") {
    if (!has("email.imap_host")) missing.push("IMAP-host");
    if (!has("email.imap_user")) missing.push("IMAP-gebruiker");
    if (!has("email.imap_pass")) missing.push("IMAP-wachtwoord");
  }
  if (connectorId === "muapi" && !muapiKey?.trim()) missing.push("MuAPI API-key");
  if (connectorId === "webhook") {
    const url = typeof settings["bookings.webhook_url"] === "string" ? settings["bookings.webhook_url"].trim() : "";
    if (!url) missing.push("Webhook-URL");
    else {
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) missing.push("Webhook-URL met http(s)");
      } catch {
        missing.push("Geldige webhook-URL");
      }
    }
  }
  if (connectorId === "stripe" && !has("integrations.stripe_secret_key")) missing.push("Stripe secret key");
  if (connectorId === "stripe" && has("integrations.stripe_secret_key") && !/^(sk|rk)_(test|live)_/.test(String(settings["integrations.stripe_secret_key"]).trim())) {
    missing.push("Geldige Stripe secret key");
  }
  if (connectorId === "wordpress") {
    const url = typeof settings["integrations.wordpress_url"] === "string" ? settings["integrations.wordpress_url"].trim() : "";
    if (!url) missing.push("WordPress-URL");
    else {
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) missing.push("WordPress-URL met http(s)");
        if (parsed.username || parsed.password) missing.push("WordPress-URL zonder credentials");
      } catch {
        missing.push("Geldige WordPress-URL");
      }
    }
  }

  return missing;
}
