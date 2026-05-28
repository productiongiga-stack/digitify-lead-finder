"use client";

import { useMemo, useRef, useEffect } from "react";
import { generateBrandedHtml, normalizeHtmlEmailDocument } from "@digitify/email/html-template";
import { replacePlaceholders } from "@digitify/email/placeholders";
import type { EmailLayout } from "@digitify/email/layouts";

export interface EmailPreviewProps {
  subject: string;
  body: string;
  bodyFormat?: "TEXT" | "HTML";
  companyName: string;
  primaryColor: string;
  fromName: string;
  fromEmail?: string;
  headerSlogan?: string;
  recipientCompany: string;
  layout?: EmailLayout;
  ctaText?: string;
  ctaUrl?: string;
  typographyMode?: "compact" | "normal";
  logoUrl?: string;
  /** Compact layout for sidebars (smaller iframe, less chrome). */
  compact?: boolean;
  /** Show subject line and helper text above the iframe. */
  showMeta?: boolean;
}

const PREVIEW_CONTEXT = {
  contactName: "Jan Peeters",
  companyName: "Voorbeeldbedrijf BV",
  senderName: "Digitify",
  bookingLink: "https://example.com/afspraak",
  reviewLink: "https://example.com/review",
  quoteNumber: "OFF-2026-0001",
  todayDate: new Date().toLocaleDateString("nl-BE"),
};

export function EmailPreview({
  compact = false,
  showMeta = true,
  ...props
}: EmailPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isHtml = props.bodyFormat === "HTML";

  const html = useMemo(() => {
    const previewBody = replacePlaceholders(
      props.body,
      {
        ...PREVIEW_CONTEXT,
        companyName: props.recipientCompany || PREVIEW_CONTEXT.companyName,
        senderName: props.fromName || props.companyName,
      },
      { removeMissing: true },
    );

    if (isHtml) {
      return normalizeHtmlEmailDocument(previewBody);
    }

    return generateBrandedHtml({
      subject: props.subject,
      body: previewBody,
      companyName: props.companyName,
      primaryColor: props.primaryColor,
      fromName: props.fromName,
      fromEmail: props.fromEmail || "preview@digitify.local",
      headerSlogan: props.headerSlogan,
      recipientCompany: props.recipientCompany,
      layout: props.layout,
      ctaText: props.ctaText,
      ctaUrl: props.ctaUrl,
      typographyMode: props.typographyMode,
      logoUrl: props.logoUrl,
      hidePoweredBy: true,
    });
  }, [props, isHtml]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.srcdoc = html;
  }, [html]);

  const iframeHeight = compact ? 360 : 480;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {showMeta ? (
        <>
          <div
            className={
              compact
                ? "rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
                : "rounded-md border bg-muted/30 px-4 py-2"
            }
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Onderwerp
            </p>
            <p className={compact ? "line-clamp-2 text-xs font-medium" : "text-sm font-medium"}>
              {props.subject || "—"}
            </p>
          </div>
          {!compact ? (
            <p className="text-xs text-muted-foreground">
              {isHtml
                ? "Preview toont je HTML-opmaak met voorbeeld-placeholders."
                : "Preview gebruikt dezelfde layout-engine als verzonden e-mails."}
            </p>
          ) : null}
        </>
      ) : null}
      <iframe
        ref={iframeRef}
        title="E-mail preview"
        className="w-full rounded-lg border border-border/60 bg-white"
        style={{ height: iframeHeight, border: "none" }}
        sandbox="allow-same-origin"
      />
    </div>
  );
}
