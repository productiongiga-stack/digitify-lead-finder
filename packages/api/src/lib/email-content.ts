import type { EmailLayout } from "@digitify/email";
import { sanitizeCtaUrl } from "@digitify/email";

const EMAIL_LAYOUTS: EmailLayout[] = ["modern", "minimal", "business", "proposal", "followup"];

function matchTag(body: string, key: string) {
  return body.match(new RegExp(`\\[\\[${key}=(.+?)\\]\\]`, "i"))?.[1]?.trim() || "";
}

function stripTag(body: string, key: string) {
  return body.replace(new RegExp(`\\n?\\[\\[${key}=.+?\\]\\]`, "gi"), "");
}

function stripAllMetadataTags(body: string) {
  return ["CTA_TEXT", "CTA_URL", "LAYOUT", "TYPE", "DESCRIPTION", "BODY_FORMAT"]
    .reduce((acc, key) => stripTag(acc, key), body)
    .trim();
}

export function extractEmailTemplateMetadata(body: string) {
  const ctaText = matchTag(body, "CTA_TEXT");
  const ctaUrl = matchTag(body, "CTA_URL");
  const rawLayout = matchTag(body, "LAYOUT").toLowerCase();
  const layout = EMAIL_LAYOUTS.includes(rawLayout as EmailLayout) ? (rawLayout as EmailLayout) : undefined;
  const rawBodyFormat = matchTag(body, "BODY_FORMAT").toUpperCase();
  const bodyFormat = rawBodyFormat === "HTML" ? "HTML" : rawBodyFormat === "TEXT" ? "TEXT" : undefined;
  const cleanBody = stripAllMetadataTags(body);

  return {
    cleanBody,
    ctaText: ctaText || undefined,
    ctaUrl: sanitizeCtaUrl(ctaUrl),
    layout,
    type: matchTag(body, "TYPE").toUpperCase() || undefined,
    description: matchTag(body, "DESCRIPTION") || undefined,
    bodyFormat,
  };
}
