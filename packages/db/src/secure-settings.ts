import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENCRYPTION_PREFIX = "enc:v1:";
export const SECRET_REDACTION_MASK = "••••••••";

const SECRET_SETTING_KEYS = new Set([
  "api.anthropic_key",
  "api.openai_key",
  "api.google_places_key",
  "integrations.google_oauth_client_secret",
  "integrations.meta_app_secret",
  "email.smtp_pass",
  "email.imap_pass",
  "bookings.google_oauth_access_token",
  "bookings.google_oauth_refresh_token",
  "social.meta_access_token",
  "social.meta_refresh_meta",
  "social.meta_page_access_token",
]);

function normalizeKey(key: string) {
  return key.trim().toLowerCase();
}

function deriveKey(value: string) {
  return createHash("sha256").update(value).digest();
}

function resolvePrimaryEncryptionKey() {
  const settingsKey = process.env.SETTINGS_ENCRYPTION_KEY?.trim() || "";
  if (settingsKey && settingsKey !== "change-me-in-production") {
    return deriveKey(settingsKey);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SETTINGS_ENCRYPTION_KEY is required in production to encrypt/decrypt sensitive settings.",
    );
  }

  const fallback = process.env.NEXTAUTH_SECRET?.trim() || "";
  if (!fallback || fallback === "change-me-in-production") return null;
  return deriveKey(fallback);
}

function resolveLegacyEncryptionKey() {
  const fallback = process.env.NEXTAUTH_SECRET?.trim() || "";
  if (!fallback || fallback === "change-me-in-production") return null;
  const settingsKey = process.env.SETTINGS_ENCRYPTION_KEY?.trim() || "";
  if (settingsKey && settingsKey === fallback) return null;
  return deriveKey(fallback);
}

function tryDecrypt(value: string, secret: Buffer) {
  const payload = String(value).slice(ENCRYPTION_PREFIX.length);
  const [ivEncoded, tagEncoded, encryptedEncoded] = payload.split(".");
  if (!ivEncoded || !tagEncoded || !encryptedEncoded) return "";

  const iv = Buffer.from(ivEncoded, "base64url");
  const tag = Buffer.from(tagEncoded, "base64url");
  const encrypted = Buffer.from(encryptedEncoded, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", secret, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function isSecretSettingKey(key: string) {
  const normalized = normalizeKey(key);
  if (SECRET_SETTING_KEYS.has(normalized)) return true;
  if (normalized.startsWith("api.") && normalized.endsWith("_key")) return true;
  if (normalized.startsWith("integrations.") && normalized.endsWith("_secret")) return true;
  if (normalized.startsWith("email.") && (normalized.endsWith("_pass") || normalized.endsWith("_password"))) return true;
  if (normalized.startsWith("bookings.google_oauth_") && normalized.endsWith("_token")) return true;
  if (normalized.startsWith("social.meta_") && normalized.endsWith("_token")) return true;
  if (normalized === "social.meta_refresh_meta") return true;
  return false;
}

export function isEncryptedSettingValue(value: unknown) {
  return typeof value === "string" && value.startsWith(ENCRYPTION_PREFIX);
}

export function protectSettingValue(key: string, value: unknown): unknown {
  if (!isSecretSettingKey(key)) return value;
  if (value === null || value === undefined) return "";
  if (isEncryptedSettingValue(value)) return value;

  const plain = typeof value === "string" ? value : String(value);
  if (!plain) return "";

  const secret = resolvePrimaryEncryptionKey();
  if (!secret) return plain;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function revealSettingValue(key: string, value: unknown): unknown {
  if (!isSecretSettingKey(key)) return value;
  if (!isEncryptedSettingValue(value)) return value;

  const secret = resolvePrimaryEncryptionKey();
  if (!secret) return "";

  try {
    return tryDecrypt(String(value), secret);
  } catch {
    const legacySecret = resolveLegacyEncryptionKey();
    if (!legacySecret) return "";
    try {
      return tryDecrypt(String(value), legacySecret);
    } catch {
      return "";
    }
  }
}

export function redactSecretSettingValue(key: string, value: unknown): unknown {
  if (!isSecretSettingKey(key)) return value;
  const revealed = revealSettingValue(key, value);
  if (revealed === null || revealed === undefined) return "";
  if (typeof revealed === "string") return revealed ? SECRET_REDACTION_MASK : "";
  return SECRET_REDACTION_MASK;
}
