import type { EmailLayout } from "@/lib/email-content";

export type ParsedTemplateSelection = {
  subject: string;
  cleanBody: string;
  ctaText?: string | null;
  ctaUrl?: string | null;
  layout?: string | null;
};

export function applyEmailTemplateSelection(template: ParsedTemplateSelection) {
  return {
    subject: template.subject,
    body: template.cleanBody,
    ctaText: template.ctaText || "",
    ctaUrl: template.ctaUrl || "",
    layout: (template.layout || "modern") as EmailLayout,
  };
}
