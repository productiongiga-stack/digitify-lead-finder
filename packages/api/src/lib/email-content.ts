import type { EmailLayout } from "@digitify/email";

const EMAIL_LAYOUTS: EmailLayout[] = ["modern", "minimal", "business", "proposal", "followup"];

function matchTag(body: string, key: string) {
  return body.match(new RegExp(`\\[\\[${key}=(.+?)\\]\\]`, "i"))?.[1]?.trim() || "";
}

function stripTag(body: string, key: string) {
  return body.replace(new RegExp(`\\n?\\[\\[${key}=.+?\\]\\]`, "gi"), "");
}

export function extractEmailTemplateMetadata(body: string) {
  const ctaText = matchTag(body, "CTA_TEXT");
  const ctaUrl = matchTag(body, "CTA_URL");
  const rawLayout = matchTag(body, "LAYOUT").toLowerCase();
  const layout = EMAIL_LAYOUTS.includes(rawLayout as EmailLayout) ? (rawLayout as EmailLayout) : undefined;
  const cleanBody = stripTag(stripTag(stripTag(body, "CTA_TEXT"), "CTA_URL"), "LAYOUT").trim();

  return {
    cleanBody,
    ctaText: ctaText || undefined,
    ctaUrl: ctaUrl || undefined,
    layout,
  };
}
