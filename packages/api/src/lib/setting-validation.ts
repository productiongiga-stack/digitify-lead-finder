import { TRPCError } from "@trpc/server";

const KEY_PATTERN = /^[a-z0-9]+(?:\.[a-z0-9_]+)+$/;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const HOST_PATTERN = /^(?=.{1,255}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;
const LEGACY_KEY_PATTERN = /^[a-z0-9_]+$/;
const LEGACY_SETTING_KEYS = new Set([
  "openclaw_language",
  "openclaw_tone",
  "openclaw_aggressiveness",
]);

const BOOLEAN_SETTING_KEYS = new Set([
  "chatbot.enabled",
  "chatbot.auto_messages_enabled",
  "chatbot.ai_responses_enabled",
  "chatbot.ask_name_before_chat",
  "bookings.google_sync_enabled",
  "email.smtp_tls_reject_unauthorized",
  "email.imap_tls",
]);

const ENUM_SETTING_KEYS = new Map<string, readonly string[]>([
  ["email.provider", ["smtp", "console"]],
  ["email.default_layout", ["modern", "minimal", "business", "proposal", "followup"]],
  ["display.typography_mode", ["compact", "normal"]],
  ["api.ai_provider", ["anthropic", "openai"]],
]);

const NUMBER_SETTING_KEYS = new Map<string, { min: number; max: number; integer?: boolean }>([
  ["email.smtp_port", { min: 1, max: 65535, integer: true }],
  ["email.imap_port", { min: 1, max: 65535, integer: true }],
  ["email.followup_days", { min: 1, max: 365, integer: true }],
  ["bookings.slot_minutes", { min: 5, max: 240, integer: true }],
  ["openclaw.max_tokens", { min: 256, max: 8192, integer: true }],
]);

function invalid(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

function parseBoolean(raw: unknown, key: string) {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  invalid(`Instelling "${key}" verwacht een boolean waarde.`);
}

function parseNumber(raw: unknown, key: string) {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) invalid(`Instelling "${key}" verwacht een numerieke waarde.`);
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  invalid(`Instelling "${key}" verwacht een numerieke waarde.`);
}

function isLikelyEmailKey(key: string) {
  return (
    key.endsWith(".email") ||
    key.endsWith("_email") ||
    key === "email.reply_to" ||
    key === "email.smtp_user" ||
    key === "email.imap_user"
  );
}

function isLikelyUrlKey(key: string) {
  return key.endsWith("_url") || key === "branding.logo_url" || key === "branding.favicon_url";
}

function isWebsiteKey(key: string) {
  return key.endsWith(".website") || key.endsWith("_website") || key === "company.footer_website_url";
}

function isLikelyHostKey(key: string) {
  return key.endsWith("_host");
}

function validateStringValue(key: string, value: string) {
  if (value.length > 10_000) {
    invalid(`Instelling "${key}" is te lang (max 10000 tekens).`);
  }

  if (isLikelyEmailKey(key) && value) {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (!emailOk) invalid(`Instelling "${key}" bevat een ongeldig e-mailadres.`);
  }

  if (isLikelyHostKey(key) && value && !HOST_PATTERN.test(value)) {
    invalid(`Instelling "${key}" bevat een ongeldig host-formaat.`);
  }

  if (isWebsiteKey(key) && value) {
    const isHttpUrl = /^https?:\/\//i.test(value);
    if (isHttpUrl) {
      try {
        const parsed = new URL(value);
        if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
          invalid(`Instelling "${key}" gebruikt een ongeldig website-adres.`);
        }
      } catch {
        invalid(`Instelling "${key}" bevat een ongeldig website-formaat.`);
      }
    } else {
      const hostname = value.split("/")[0]?.trim() || "";
      if (!HOST_PATTERN.test(hostname)) {
        invalid(`Instelling "${key}" bevat een ongeldig website-formaat.`);
      }
    }
  }

  if (isLikelyUrlKey(key) && !isWebsiteKey(key) && value) {
    const isDataImageUrl = /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(value);
    const isHttpUrl = /^https?:\/\//i.test(value);
    if (!isDataImageUrl && !isHttpUrl) {
      invalid(`Instelling "${key}" verwacht een absolute URL of data:image URL.`);
    }
    if (isHttpUrl) {
      try {
        const parsed = new URL(value);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          invalid(`Instelling "${key}" gebruikt een ongeldig URL protocol.`);
        }
      } catch {
        invalid(`Instelling "${key}" bevat een ongeldig URL-formaat.`);
      }
    }
  }

  if (key.endsWith("_color") && value && !HEX_COLOR_PATTERN.test(value)) {
    invalid(`Instelling "${key}" verwacht een hex kleur zoals #1f2937.`);
  }
}

export function normalizeSettingKey(rawKey: string) {
  const key = rawKey.trim();
  if (!key) invalid("Instellingssleutel ontbreekt.");
  if (key.length > 120) invalid("Instellingssleutel is te lang (max 120 tekens).");
  const isLegacyAllowed = LEGACY_SETTING_KEYS.has(key) && LEGACY_KEY_PATTERN.test(key);
  if (!KEY_PATTERN.test(key) && !isLegacyAllowed) {
    invalid("Instellingssleutel is ongeldig. Gebruik formaat zoals module.sub_key.");
  }
  return key;
}

export function validateSettingValue(key: string, rawValue: unknown): unknown {
  const normalizedKey = normalizeSettingKey(key);

  if (rawValue === null || rawValue === undefined) return "";

  const enumRule = ENUM_SETTING_KEYS.get(normalizedKey);
  if (enumRule) {
    const value = String(rawValue).trim().toLowerCase();
    if (!enumRule.includes(value)) {
      invalid(`Instelling "${normalizedKey}" moet één van deze waarden hebben: ${enumRule.join(", ")}.`);
    }
    return value;
  }

  if (BOOLEAN_SETTING_KEYS.has(normalizedKey)) {
    return parseBoolean(rawValue, normalizedKey);
  }

  const numberRule = NUMBER_SETTING_KEYS.get(normalizedKey);
  if (numberRule) {
    const value = parseNumber(rawValue, normalizedKey);
    const normalizedNumber = numberRule.integer ? Math.trunc(value) : value;
    if (normalizedNumber < numberRule.min || normalizedNumber > numberRule.max) {
      invalid(
        `Instelling "${normalizedKey}" moet tussen ${numberRule.min} en ${numberRule.max} liggen.`,
      );
    }
    return normalizedNumber;
  }

  if (typeof rawValue === "string") {
    const value = rawValue.trim();
    validateStringValue(normalizedKey, value);
    return value;
  }

  if (typeof rawValue === "number") {
    if (!Number.isFinite(rawValue)) {
      invalid(`Instelling "${normalizedKey}" bevat een ongeldig numeriek formaat.`);
    }
    return rawValue;
  }

  if (typeof rawValue === "boolean") {
    return rawValue;
  }

  if (Array.isArray(rawValue) || typeof rawValue === "object") {
    if (!normalizedKey.endsWith("_json")) {
      invalid(`Instelling "${normalizedKey}" ondersteunt geen object/array waarde.`);
    }
    const serialized = JSON.stringify(rawValue);
    if (serialized.length > 20_000) {
      invalid(`Instelling "${normalizedKey}" is te groot (max 20000 tekens als JSON).`);
    }
    return rawValue;
  }

  invalid(`Instelling "${normalizedKey}" heeft een niet-ondersteund type.`);
}
