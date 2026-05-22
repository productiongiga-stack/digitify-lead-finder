"use client";

import { useMemo, useRef, useEffect } from "react";
import { generateBrandedHtml } from "@digitify/email/html-template";
import type { EmailLayout } from "@digitify/email/layouts";

export interface EmailPreviewProps {
  subject: string;
  body: string;
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
}

export function EmailPreview(props: EmailPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const html = useMemo(
    () =>
      generateBrandedHtml({
        subject: props.subject,
        body: props.body,
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
      }),
    [props],
  );

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.srcdoc = html;
  }, [html]);

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/30 px-4 py-2">
        <p className="text-xs text-muted-foreground">Onderwerp</p>
        <p className="text-sm font-medium">{props.subject}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Preview gebruikt dezelfde layout-engine als verzonden e-mails.
      </p>
      <iframe
        ref={iframeRef}
        title="E-mail preview"
        className="w-full rounded-md border"
        style={{ height: 480, border: "none" }}
        sandbox="allow-same-origin"
      />
    </div>
  );
}
