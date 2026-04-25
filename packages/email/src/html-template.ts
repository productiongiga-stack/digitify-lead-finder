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
