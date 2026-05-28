/**
 * Branded HTML email template generator.
 * Produces responsive, table-based HTML suitable for all major email clients.
 */

import { generateLayout, type EmailLayout } from "./layouts";

export interface BrandedHtmlOptions {
  subject: string;
  body: string;
  companyName: string;
  primaryColor: string;
  fromName: string;
  fromEmail: string;
  headerSlogan?: string;
  recipientCompany: string;
  unsubscribeUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  logoUrl?: string;
  hidePoweredBy?: boolean;
  typographyMode?: "compact" | "normal";
}

export function generateBrandedHtml(options: BrandedHtmlOptions & { layout?: EmailLayout }): string {
  return generateLayout(options.layout || "modern", {
    subject: options.subject,
    body: options.body,
    companyName: options.companyName,
    primaryColor: options.primaryColor,
    fromName: options.fromName,
    fromEmail: options.fromEmail,
    headerSlogan: options.headerSlogan,
    recipientCompany: options.recipientCompany,
    unsubscribeUrl: options.unsubscribeUrl,
    ctaText: options.ctaText,
    ctaUrl: options.ctaUrl,
    logoUrl: options.logoUrl,
    hidePoweredBy: options.hidePoweredBy,
    typographyMode: options.typographyMode,
  });
}

/** Wrap HTML fragments in a minimal document for iframe preview and email clients. */
export function normalizeHtmlEmailDocument(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) {
    return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>';
  }
  if (/<html[\s>]/i.test(trimmed) || /<!DOCTYPE/i.test(trimmed)) {
    return trimmed;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;">${trimmed}</body></html>`;
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
