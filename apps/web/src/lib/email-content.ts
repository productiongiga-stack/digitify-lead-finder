export type EmailLayout = "modern" | "minimal" | "business" | "proposal" | "followup";
export type TemplateType =
  | "OUTREACH"
  | "FOLLOW_UP"
  | "PROPOSAL"
  | "REPORT"
  | "BOOKING"
  | "REVIEW"
  | "REENGAGEMENT"
  | "CUSTOM";

const EMAIL_LAYOUTS: EmailLayout[] = ["modern", "minimal", "business", "proposal", "followup"];
const TEMPLATE_TYPES: TemplateType[] = [
  "OUTREACH",
  "FOLLOW_UP",
  "PROPOSAL",
  "REPORT",
  "BOOKING",
  "REVIEW",
  "REENGAGEMENT",
  "CUSTOM",
];

export function parseEmailLayout(value: string | undefined, fallback: EmailLayout = "modern"): EmailLayout {
  return value && EMAIL_LAYOUTS.includes(value as EmailLayout) ? (value as EmailLayout) : fallback;
}

function isEmailLayout(value: string): value is EmailLayout {
  return EMAIL_LAYOUTS.includes(value as EmailLayout);
}

function isTemplateType(value: string): value is TemplateType {
  return TEMPLATE_TYPES.includes(value as TemplateType);
}

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
  const rawType = matchTag(body, "TYPE").toUpperCase();
  const layout = rawLayout && isEmailLayout(rawLayout) ? rawLayout : undefined;
  const type = rawType && isTemplateType(rawType) ? rawType : undefined;
  const description = matchTag(body, "DESCRIPTION");
  const rawBodyFormat = matchTag(body, "BODY_FORMAT").toUpperCase();
  const bodyFormat = rawBodyFormat === "HTML" ? "HTML" : rawBodyFormat === "TEXT" ? "TEXT" : undefined;
  const cleanBody = stripAllMetadataTags(body);

  return {
    cleanBody,
    ctaText: ctaText || "",
    ctaUrl: ctaUrl || "",
    layout,
    type,
    description,
    bodyFormat,
  };
}

export function injectEmailTemplateMetadata(
  body: string,
  options: {
    ctaText?: string;
    ctaUrl?: string;
    layout?: EmailLayout;
    type?: TemplateType;
    description?: string;
    bodyFormat?: "TEXT" | "HTML";
  },
) {
  const base = extractEmailTemplateMetadata(body).cleanBody;
  const tags = [
    options.bodyFormat === "HTML" ? "[[BODY_FORMAT=HTML]]" : "",
    options.type ? `[[TYPE=${options.type}]]` : "",
    options.description?.trim() ? `[[DESCRIPTION=${options.description.trim()}]]` : "",
    options.ctaText?.trim() && options.ctaUrl?.trim() ? `[[CTA_TEXT=${options.ctaText.trim()}]]` : "",
    options.ctaText?.trim() && options.ctaUrl?.trim() ? `[[CTA_URL=${options.ctaUrl.trim()}]]` : "",
  ].filter(Boolean);

  return tags.length > 0 ? `${base}\n\n${tags.join("\n")}` : base;
}
