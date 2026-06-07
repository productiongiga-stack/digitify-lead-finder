"use client";

import { useMemo, useRef, useEffect } from "react";
import { renderMasterShell, DEFAULT_MASTER_SHELL_HTML } from "@digitify/email/master-shell";
import { replacePlaceholders } from "@digitify/email/placeholders";
import { normalizeHtmlEmailDocument } from "@digitify/email/html-template";
import {
  buildEmailPreviewDocument,
  buildInboxHtmlDocument,
  sanitizeInboxHtml,
} from "@/lib/sanitize-inbox-html";

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
  ctaText?: string;
  ctaUrl?: string;
  typographyMode?: "compact" | "normal";
  logoUrl?: string;
  masterShellHtml?: string;
  signature?: string;
  footer?: string;
  /** Compact layout for sidebars (smaller iframe, less chrome). */
  compact?: boolean;
  /** Tall iframe for the mail-opmaak design page. */
  tall?: boolean;
  /** Extra-large iframe for the shell wizard side panel. */
  wizard?: boolean;
  /** Small iframe for preset thumbnails in the design panel. */
  thumbnail?: boolean;
  /** Show subject line and helper text above the iframe. */
  showMeta?: boolean;
  /** Override helper copy under the preview title. */
  metaHint?: string;
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
  tall = false,
  wizard = false,
  thumbnail = false,
  showMeta = true,
  metaHint,
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
      const normalized = normalizeHtmlEmailDocument(previewBody);
      const safe = sanitizeInboxHtml(normalized);
      return buildInboxHtmlDocument(safe);
    }

    const shellHtml = props.masterShellHtml?.trim() || DEFAULT_MASTER_SHELL_HTML;
    const rendered = renderMasterShell({
      shellHtml,
      content: previewBody,
      contentFormat: "TEXT",
      subject: props.subject,
      ctaText: props.ctaText,
      ctaUrl: props.ctaUrl,
      branding: {
        companyName: props.companyName,
        primaryColor: props.primaryColor,
        logoUrl: props.logoUrl,
        headerSlogan: props.headerSlogan,
        signature: props.signature,
        footer: props.footer,
        fromName: props.fromName,
        fromEmail: props.fromEmail,
      },
    });

    return buildEmailPreviewDocument(rendered);
  }, [
    isHtml,
    props.body,
    props.subject,
    props.companyName,
    props.primaryColor,
    props.fromName,
    props.fromEmail,
    props.headerSlogan,
    props.recipientCompany,
    props.ctaText,
    props.ctaUrl,
    props.logoUrl,
    props.masterShellHtml,
    props.signature,
    props.footer,
  ]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [html]);

  return (
    <div
      className={
        wizard
          ? "flex h-full min-h-0 flex-col"
          : compact
            ? "space-y-2"
            : "space-y-3"
      }
    >
      {showMeta ? (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
          <p className="text-sm font-medium">{props.subject || "Geen onderwerp"}</p>
          <p className="text-xs text-muted-foreground">
            {metaHint
              || "Voorbeeld met jouw ingevulde gegevens — ontvanger-velden zijn fictief."}
          </p>
        </div>
      ) : null}
      <iframe
        ref={iframeRef}
        title="E-mail preview"
        className={
          wizard
            ? "min-h-0 flex-1 w-full rounded-lg border border-border bg-white shadow-sm"
            : thumbnail
              ? "h-[148px] w-full rounded-lg border border-border/70 bg-white"
              : compact
                ? "h-[280px] w-full rounded-lg border border-border bg-white"
                : tall
                  ? "h-[min(560px,70vh)] min-h-[420px] w-full rounded-xl border border-border bg-white shadow-sm"
                  : "h-[420px] w-full rounded-xl border border-border bg-white shadow-sm"
        }
        sandbox="allow-same-origin"
      />
    </div>
  );
}
