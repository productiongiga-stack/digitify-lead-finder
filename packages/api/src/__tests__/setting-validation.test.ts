import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { normalizeSettingKey, validateSettingValue } from "../lib/setting-validation";

describe("setting key validation", () => {
  it("accepts valid namespaced keys", () => {
    expect(normalizeSettingKey("email.smtp_port")).toBe("email.smtp_port");
    expect(normalizeSettingKey("quotes.embed_product_specs_json")).toBe("quotes.embed_product_specs_json");
    expect(normalizeSettingKey("openclaw_language")).toBe("openclaw_language");
  });

  it("rejects invalid key format", () => {
    expect(() => normalizeSettingKey("SMTP_PORT")).toThrow(TRPCError);
    expect(() => normalizeSettingKey("noNamespace")).toThrow(TRPCError);
  });
});

describe("setting value validation", () => {
  it("normalizes booleans for boolean keys", () => {
    expect(validateSettingValue("chatbot.enabled", "true")).toBe(true);
    expect(validateSettingValue("chatbot.enabled", "0")).toBe(false);
  });

  it("validates enum values", () => {
    expect(validateSettingValue("email.provider", "SMTP")).toBe("smtp");
    expect(validateSettingValue("seo.og_locale", "nl_BE")).toBe("nl_BE");
    expect(validateSettingValue("seo.og_locale", "nl_be")).toBe("nl_BE");
    expect(() => validateSettingValue("email.provider", "mailgun")).toThrow(TRPCError);
  });

  it("validates numeric ranges", () => {
    expect(validateSettingValue("email.smtp_port", "587")).toBe(587);
    expect(() => validateSettingValue("email.smtp_port", 70000)).toThrow(TRPCError);
  });

  it("validates URL and color formats", () => {
    expect(validateSettingValue("branding.logo_url", "https://example.com/logo.png")).toBe("https://example.com/logo.png");
    expect(() => validateSettingValue("branding.logo_url", "javascript:alert(1)")).toThrow(TRPCError);

    expect(validateSettingValue("branding.primary_color", "#1f2937")).toBe("#1f2937");
    expect(() => validateSettingValue("branding.primary_color", "red")).toThrow(TRPCError);
  });

  it("allows larger data image URLs for uploaded branding assets", () => {
    const dataUrl = `data:image/png;base64,${"a".repeat(25_000)}`;
    expect(validateSettingValue("branding.logo_url", dataUrl)).toBe(dataUrl);
    expect(() => validateSettingValue("email.signature", dataUrl)).toThrow(TRPCError);
  });

  it("accepts website fields with or without protocol and treats website labels as text", () => {
    expect(validateSettingValue("company.website", "www.digitify.be")).toBe("www.digitify.be");
    expect(validateSettingValue("branding.website", "https://digitify.be")).toBe("https://digitify.be");
    expect(validateSettingValue("quotes.embed_footer_website", "digitify.be/contact")).toBe("digitify.be/contact");
    expect(validateSettingValue("company.footer_website_label", "www.digitify.be")).toBe("www.digitify.be");

    expect(() => validateSettingValue("company.website", "not a website")).toThrow(TRPCError);
  });

  it("allows object values only for *_json keys", () => {
    expect(validateSettingValue("quotes.embed_product_specs_json", { productA: ["x"] })).toEqual({
      productA: ["x"],
    });
    expect(() => validateSettingValue("branding.company_name", { invalid: true })).toThrow(TRPCError);
  });
});
