import { describe, it, expect } from "vitest";
import {
  normalizeLegacyPlaceholders,
  normalizeAiPlaceholderSyntax,
  extractEmailCta,
} from "../lib/email-utils";

describe("normalizeLegacyPlaceholders", () => {
  it("replaces [key] syntax with values", () => {
    expect(normalizeLegacyPlaceholders("Hallo [Je naam]", { "Je naam": "Klim" })).toBe("Hallo Klim");
  });

  it("is case-insensitive", () => {
    expect(normalizeLegacyPlaceholders("[JE NAAM]", { "Je naam": "Klim" })).toBe("Klim");
  });

  it("handles undefined values (replaces with empty string)", () => {
    expect(normalizeLegacyPlaceholders("[Je naam]", { "Je naam": undefined })).toBe("");
  });

  it("does NOT interpret $ in values as regex group references", () => {
    expect(normalizeLegacyPlaceholders("[Je naam]", { "Je naam": "Dr. $1 Smith" })).toBe("Dr. $1 Smith");
  });

  it("does NOT interpret $& in values as matched string", () => {
    expect(normalizeLegacyPlaceholders("[Je naam]", { "Je naam": "$& test" })).toBe("$& test");
  });

  it("leaves unmatched keys intact", () => {
    expect(normalizeLegacyPlaceholders("[Onbekend]", { "Je naam": "Klim" })).toBe("[Onbekend]");
  });

  it("replaces multiple keys", () => {
    const result = normalizeLegacyPlaceholders(
      "[Je naam] van [Bedrijfsnaam]",
      { "Je naam": "Klim", "Bedrijfsnaam": "Digitify" }
    );
    expect(result).toBe("Klim van Digitify");
  });
});

describe("normalizeAiPlaceholderSyntax", () => {
  it("normalizes sender_name → senderName", () => {
    expect(normalizeAiPlaceholderSyntax("{{sender_name}}")).toBe("{{senderName}}");
  });

  it("handles extra whitespace inside braces", () => {
    expect(normalizeAiPlaceholderSyntax("{{ sender_name }}")).toBe("{{senderName}}");
  });

  it("normalizes company_name → companyName", () => {
    expect(normalizeAiPlaceholderSyntax("{{company_name}}")).toBe("{{companyName}}");
  });

  it("is case-insensitive", () => {
    expect(normalizeAiPlaceholderSyntax("{{SENDER_NAME}}")).toBe("{{senderName}}");
  });

  it("leaves already-normalized placeholders unchanged", () => {
    expect(normalizeAiPlaceholderSyntax("{{senderName}}")).toBe("{{senderName}}");
  });

  it("normalizes contact_name → contactName", () => {
    expect(normalizeAiPlaceholderSyntax("{{contact_name}}")).toBe("{{contactName}}");
  });
});

describe("extractEmailCta", () => {
  it("extracts CTA text and URL", () => {
    const body = "Klik hier\n[[CTA_TEXT=Plan een gesprek]]\n[[CTA_URL=https://example.com/book]]";
    const { ctaText, ctaUrl, cleanBody } = extractEmailCta(body);
    expect(ctaText).toBe("Plan een gesprek");
    expect(ctaUrl).toBe("https://example.com/book");
    expect(cleanBody).not.toContain("[[CTA_");
  });

  it("returns undefined when no CTA is present", () => {
    const { ctaText, ctaUrl } = extractEmailCta("Gewone tekst");
    expect(ctaText).toBeUndefined();
    expect(ctaUrl).toBeUndefined();
  });

  it("strips CTA markers cleanly from body", () => {
    const body = "Hello\n[[CTA_TEXT=Boek nu]]\n[[CTA_URL=https://x.com]]";
    const { cleanBody } = extractEmailCta(body);
    expect(cleanBody).not.toContain("[[");
    expect(cleanBody.trim()).toBe("Hello");
  });

  it("handles body with only CTA text (no URL)", () => {
    const body = "[[CTA_TEXT=Meer info]]";
    const { ctaText, ctaUrl } = extractEmailCta(body);
    expect(ctaText).toBe("Meer info");
    expect(ctaUrl).toBeUndefined();
  });
});
