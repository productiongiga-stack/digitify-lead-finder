export { SmtpProvider } from "./providers/smtp";
export { ConsoleProvider } from "./providers/console";
export { renderTemplate, renderSubject, htmlFromText } from "./template-renderer";
export { generateBrandedHtml, normalizeHtmlEmailDocument, htmlToPlainText } from "./html-template";
export type { BrandedHtmlOptions } from "./html-template";
export { generateLayout } from "./layouts";
export type { EmailLayout, LayoutOptions } from "./layouts";
export type { EmailMessage, EmailAttachment, SendResult, EmailProvider, TemplateContext } from "./types";
export { replacePlaceholders, buildLeadContext, hasUnresolvedPlaceholders, getPlaceholdersByCategory, PLACEHOLDER_REGISTRY } from "./placeholders";
export type { PlaceholderContext } from "./placeholders";
export { isSafeCtaUrl, sanitizeCtaUrl } from "./safe-url";

import type { EmailProvider } from "./types";
import { SmtpProvider } from "./providers/smtp";
import { ConsoleProvider } from "./providers/console";

export function createEmailProvider(config: {
  provider: string;
  smtp?: { host: string; port: number; user: string; pass: string; tls?: { rejectUnauthorized?: boolean; servername?: string } };
}): EmailProvider {
  switch (config.provider) {
    case "smtp":
      if (!config.smtp) throw new Error("SMTP config required");
      return new SmtpProvider(config.smtp);
    case "console":
    default:
      return new ConsoleProvider();
  }
}
