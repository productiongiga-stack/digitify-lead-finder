import { describe, expect, it } from "vitest";
import { connectorIdForSettingKey, missingConnectorConfiguration } from "../lib/connector-config";

describe("connector configuration checks", () => {
  it("accepts Google Places without requiring OAuth", () => {
    expect(missingConnectorConfiguration("google", { "api.google_places_key": "places-key" })).toEqual([]);
  });

  it("reports each missing SMTP field", () => {
    expect(missingConnectorConfiguration("smtp", {})).toEqual([
      "SMTP-host",
      "SMTP-gebruiker",
      "SMTP-wachtwoord",
      "SMTP-afzender",
    ]);
  });

  it("rejects malformed webhook URLs without making a request", () => {
    expect(missingConnectorConfiguration("webhook", { "bookings.webhook_url": "javascript:alert(1)" })).toEqual([
      "Webhook-URL met http(s)",
    ]);
  });

  it("accepts local HTTP webhook URLs for development", () => {
    expect(missingConnectorConfiguration("webhook", { "bookings.webhook_url": "http://127.0.0.1:4010/hooks" })).toEqual([]);
  });

  it("requires MuAPI credentials separately from workspace settings", () => {
    expect(missingConnectorConfiguration("muapi", {}, null)).toEqual(["MuAPI API-key"]);
    expect(missingConnectorConfiguration("muapi", {}, "muapi-key")).toEqual([]);
  });

  it("keeps unimplemented providers explicit", () => {
    expect(missingConnectorConfiguration("stripe", {})).toEqual(["Stripe secret key"]);
    expect(missingConnectorConfiguration("wordpress", {})).toEqual(["WordPress-URL"]);
  });

  it("validates Stripe key shape before any provider call", () => {
    expect(missingConnectorConfiguration("stripe", { "integrations.stripe_secret_key": "not-a-stripe-key" })).toEqual(["Geldige Stripe secret key"]);
    expect(missingConnectorConfiguration("stripe", { "integrations.stripe_secret_key": "sk_test_123" })).toEqual([]);
  });

  it("rejects WordPress URLs containing embedded credentials", () => {
    expect(missingConnectorConfiguration("wordpress", { "integrations.wordpress_url": "https://user:pass@example.com" })).toEqual([
      "WordPress-URL zonder credentials",
    ]);
  });

  it("maps connector settings to their provider without exposing values", () => {
    expect(connectorIdForSettingKey("integrations.stripe_secret_key")).toBe("stripe");
    expect(connectorIdForSettingKey("integrations.wordpress_url")).toBe("wordpress");
    expect(connectorIdForSettingKey("company.name")).toBeNull();
  });
});
