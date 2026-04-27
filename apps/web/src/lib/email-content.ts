export type EmailLayout = "modern" | "minimal" | "business" | "proposal" | "followup";

const EMAIL_LAYOUTS: EmailLayout[] = ["modern", "minimal", "business", "proposal", "followup"];

export function parseEmailLayout(value: string | undefined, fallback: EmailLayout = "proposal"): EmailLayout {
  return value && EMAIL_LAYOUTS.includes(value as EmailLayout) ? (value as EmailLayout) : fallback;
}

function isEmailLayout(value: string): value is EmailLayout {
  return EMAIL_LAYOUTS.includes(value as EmailLayout);
}

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
  const layout = rawLayout && isEmailLayout(rawLayout) ? rawLayout : undefined;
  const cleanBody = stripTag(stripTag(stripTag(body, "CTA_TEXT"), "CTA_URL"), "LAYOUT").trim();

  return {
    cleanBody,
    ctaText: ctaText || "",
    ctaUrl: ctaUrl || "",
    layout,
  };
}

export function injectEmailTemplateMetadata(body: string, options: {
  ctaText?: string;
  ctaUrl?: string;
  layout?: EmailLayout;
}) {
  const base = extractEmailTemplateMetadata(body).cleanBody;
  const tags = [
    options.layout ? `[[LAYOUT=${options.layout}]]` : "",
    options.ctaText?.trim() && options.ctaUrl?.trim() ? `[[CTA_TEXT=${options.ctaText.trim()}]]` : "",
    options.ctaText?.trim() && options.ctaUrl?.trim() ? `[[CTA_URL=${options.ctaUrl.trim()}]]` : "",
  ].filter(Boolean);

  return tags.length > 0 ? `${base}\n\n${tags.join("\n")}` : base;
}
