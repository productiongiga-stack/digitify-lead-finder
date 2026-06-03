import { describe, it, expect, beforeEach, afterEach } from "vitest";
// Import the file directly to avoid pulling in the Prisma client side-effects
// from @digitify/db's index.ts (which constructs a PrismaClient at import time).
import {
  isSecretSettingKey,
  isEncryptedSettingValue,
  protectSettingValue,
  revealSettingValue,
  redactSecretSettingValue,
  SECRET_REDACTION_MASK,
} from "../../../db/src/secure-settings";

const STRONG_KEY = "a-strong-test-encryption-key-not-the-default";

describe("isSecretSettingKey", () => {
  it("matches the known sensitive keys (case-insensitive)", () => {
    expect(isSecretSettingKey("api.anthropic_key")).toBe(true);
    expect(isSecretSettingKey("API.OPENAI_KEY")).toBe(true);
    expect(isSecretSettingKey("email.smtp_pass")).toBe(true);
    expect(isSecretSettingKey("bookings.google_oauth_refresh_token")).toBe(true);
  });

  it("matches the api.*_key pattern", () => {
    expect(isSecretSettingKey("api.acme_key")).toBe(true);
  });

  it("matches email.*_pass / *_password pattern", () => {
    expect(isSecretSettingKey("email.imap_pass")).toBe(true);
    expect(isSecretSettingKey("email.smtp_password")).toBe(true);
  });

  it("does not match non-sensitive keys", () => {
    expect(isSecretSettingKey("display.theme")).toBe(false);
    expect(isSecretSettingKey("api.endpoint")).toBe(false);
    expect(isSecretSettingKey("email.from_name")).toBe(false);
  });

  it("treats bookings private key and webhook secret as secrets", () => {
    expect(isSecretSettingKey("bookings.google_service_account_private_key")).toBe(true);
    expect(isSecretSettingKey("bookings.webhook_secret")).toBe(true);
  });
});

describe("AES-256-GCM round-trip via protectSettingValue / revealSettingValue", () => {
  const original = process.env;

  beforeEach(() => {
    process.env = { ...original, SETTINGS_ENCRYPTION_KEY: STRONG_KEY, NEXTAUTH_SECRET: "" };
  });

  afterEach(() => {
    process.env = original;
  });

  it("encrypts a secret value into the enc:v1 envelope", () => {
    const enc = protectSettingValue("api.anthropic_key", "sk-test-1234");
    expect(typeof enc).toBe("string");
    expect(isEncryptedSettingValue(enc)).toBe(true);
    expect(String(enc).startsWith("enc:v1:")).toBe(true);
    // Plain value must not be present in the ciphertext
    expect(String(enc)).not.toContain("sk-test-1234");
  });

  it("decrypts back to the original plain value", () => {
    const enc = protectSettingValue("api.anthropic_key", "sk-test-1234");
    const dec = revealSettingValue("api.anthropic_key", enc);
    expect(dec).toBe("sk-test-1234");
  });

  it("is non-deterministic (different IV each call)", () => {
    const a = protectSettingValue("api.anthropic_key", "sk-1");
    const b = protectSettingValue("api.anthropic_key", "sk-1");
    expect(a).not.toEqual(b);
    expect(revealSettingValue("api.anthropic_key", a)).toBe("sk-1");
    expect(revealSettingValue("api.anthropic_key", b)).toBe("sk-1");
  });

  it("does not encrypt non-sensitive keys", () => {
    expect(protectSettingValue("display.theme", "dark")).toBe("dark");
  });

  it("returns empty string for empty/null secret values", () => {
    expect(protectSettingValue("api.anthropic_key", null)).toBe("");
    expect(protectSettingValue("api.anthropic_key", "")).toBe("");
  });

  it("does not double-encrypt already-encrypted values", () => {
    const once = protectSettingValue("api.anthropic_key", "sk-test");
    const twice = protectSettingValue("api.anthropic_key", once);
    expect(twice).toBe(once);
  });

  it("returns empty string when ciphertext has been tampered with", () => {
    const enc = String(protectSettingValue("api.anthropic_key", "sk-tamper"));
    // Flip a character in the ciphertext segment to invalidate the GCM auth tag.
    const parts = enc.split(".");
    const last = parts[parts.length - 1]!;
    const tampered = parts
      .slice(0, -1)
      .concat([last.replace(/^./, last[0] === "A" ? "B" : "A")])
      .join(".");
    const result = revealSettingValue("api.anthropic_key", tampered);
    expect(result).toBe("");
  });
});

describe("redactSecretSettingValue", () => {
  const original = process.env;

  beforeEach(() => {
    process.env = { ...original, SETTINGS_ENCRYPTION_KEY: STRONG_KEY, NEXTAUTH_SECRET: "" };
  });

  afterEach(() => {
    process.env = original;
  });

  it("masks present secret values without revealing them", () => {
    const enc = protectSettingValue("api.anthropic_key", "sk-supersecret");
    const redacted = redactSecretSettingValue("api.anthropic_key", enc);
    expect(redacted).toBe(SECRET_REDACTION_MASK);
    expect(redacted).not.toContain("supersecret");
  });

  it("returns empty string for empty secrets (so the UI can hide the field)", () => {
    expect(redactSecretSettingValue("api.anthropic_key", "")).toBe("");
  });

  it("passes through non-secret keys unchanged", () => {
    expect(redactSecretSettingValue("display.theme", "dark")).toBe("dark");
  });

  it("redacts bookings private key and webhook secret", () => {
    const privateKey = protectSettingValue(
      "bookings.google_service_account_private_key",
      "-----BEGIN PRIVATE KEY-----\nabc",
    );
    const webhookSecret = protectSettingValue("bookings.webhook_secret", "whsec_test123");

    expect(redactSecretSettingValue("bookings.google_service_account_private_key", privateKey)).toBe(
      SECRET_REDACTION_MASK,
    );
    expect(redactSecretSettingValue("bookings.webhook_secret", webhookSecret)).toBe(SECRET_REDACTION_MASK);
  });
});

describe("encryption key requirements", () => {
  const original = process.env;

  beforeEach(() => {
    process.env = { ...original };
  });
  afterEach(() => {
    process.env = original;
  });

  it("throws in production if SETTINGS_ENCRYPTION_KEY is missing or default", () => {
    process.env.NODE_ENV = "production";
    process.env.SETTINGS_ENCRYPTION_KEY = "change-me-in-production";
    process.env.NEXTAUTH_SECRET = "";
    expect(() => protectSettingValue("api.anthropic_key", "sk-x")).toThrow(/SETTINGS_ENCRYPTION_KEY/);
  });
});
