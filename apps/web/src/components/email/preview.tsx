"use client";

import { useMemo, useRef, useEffect } from "react";

type EmailLayout = "modern" | "minimal" | "business" | "proposal" | "followup";

interface EmailPreviewProps {
  subject: string;
  body: string;
  companyName: string;
  primaryColor: string;
  fromName: string;
  headerSlogan?: string;
  recipientCompany: string;
  layout?: EmailLayout;
  ctaText?: string;
  ctaUrl?: string;
  typographyMode?: "compact" | "normal";
}

/**
 * Generates a simplified branded HTML preview for the iframe.
 * Supports all 5 layout variants.
 */
function generatePreviewHtml(options: EmailPreviewProps): string {
  const {
    subject,
    body,
    companyName,
    primaryColor,
    fromName,
    headerSlogan,
    recipientCompany,
    layout = "modern",
    ctaText,
    ctaUrl,
    typographyMode = "compact",
  } = options;

  const pickFont = (compact: number, normal: number) => (typographyMode === "normal" ? normal : compact);

  const escapeHtml = (text: string) =>
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const makeBodyHtml = (fontSize = `${pickFont(15, 16)}px`) =>
    body
      .split("\n\n")
      .filter((p) => p.trim())
      .map((paragraph) => {
        const escaped = escapeHtml(paragraph.trim());
        const withTags = escaped.replace(
          /\{\{(\s*\w+\s*)\}\}/g,
          '<span style="background:#e0e7ff;color:#4338ca;padding:1px 6px;border-radius:3px;font-size:13px;">{{$1}}</span>'
        );
        return `<p style="margin:0 0 16px 0;line-height:1.6;color:#374151;font-size:${fontSize};">${withTags.replace(/\n/g, "<br>")}</p>`;
      })
      .join("\n");

  const year = new Date().getFullYear();
  const ctaButton = ctaText && ctaUrl
    ? `<div style="text-align:center;margin:8px 0 28px 0;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${primaryColor};color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:999px;font-size:${pickFont(15, 16)}px;font-weight:700;">${escapeHtml(ctaText)}</a></div>`
    : "";
  const sloganHtmlWhite = headerSlogan
    ? `<p style="margin:8px 0 0 0;font-size:12px;color:rgba(255,255,255,0.82);line-height:1.5;">${escapeHtml(headerSlogan)}</p>`
    : "";
  const sloganHtmlMuted = headerSlogan
    ? `<p style="margin:8px 0 0 0;font-size:12px;color:#9ca3af;line-height:1.5;">${escapeHtml(headerSlogan)}</p>`
    : "";
  const premiumPreview = (options?: {
    badge?: string;
    eyebrow?: string;
    bodyFontSize?: string;
    intro?: string;
    background?: string;
    summaryTitle?: string;
    summaryValue?: string;
  }) => {
    const accent = primaryColor && primaryColor !== "#6366f1" ? primaryColor : "#f5b04c";
    const badge = options?.badge ?? "UPDATE";
    const eyebrow = options?.eyebrow ?? "Premium compact mail";
    const summaryTitle = options?.summaryTitle ?? "Aan";
    const summaryValue = options?.summaryValue ?? recipientCompany;
    const intro = options?.intro
      ? `<p style="margin:0 0 16px 0;font-size:${pickFont(14, 15)}px;line-height:1.65;color:#6b7280;">${escapeHtml(options.intro)}</p>`
      : "";

    return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>body{margin:0;padding:0;background:${options?.background || "#eef0f3"};font-family:Arial,Helvetica,sans-serif;}</style>
</head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${options?.background || "#eef0f3"};">
    <tr>
      <td align="center" style="padding:22px 14px;">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#ffffff;border:1px solid #d9dde3;border-radius:22px;overflow:hidden;box-shadow:0 18px 44px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:#131416;padding:22px 22px 20px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:${pickFont(26, 30)}px;font-weight:800;letter-spacing:-0.4px;color:#ffffff;">${escapeHtml(companyName)}</p>
                    <p style="margin:4px 0 0 0;font-size:${pickFont(12, 13)}px;font-weight:700;color:${accent};">${escapeHtml(headerSlogan || eyebrow)}</p>
                  </td>
                  <td align="right" valign="top">
                    <span style="display:inline-block;background:${accent};color:#111213;padding:8px 14px;border-radius:999px;font-size:${pickFont(11, 12)}px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">${escapeHtml(badge)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:22px 22px 10px 22px;">
              <p style="margin:0 0 12px 0;font-size:${pickFont(23, 26)}px;font-weight:800;letter-spacing:-0.35px;color:#17181c;">${escapeHtml(subject)}</p>
              ${intro}
            </td>
          </tr>
          <tr>
            <td style="padding:0 22px 18px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;">
                <tr>
                  <td style="width:52%;padding-right:6px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f6f8;border:1px solid #e7e9ee;border-radius:16px;">
                      <tr><td style="padding:14px 16px;">
                        <p style="margin:0 0 5px 0;font-size:${pickFont(11, 12)}px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#8b9098;">${escapeHtml(summaryTitle)}</p>
                        <p style="margin:0;font-size:${pickFont(17, 18)}px;font-weight:800;color:#17181c;">${escapeHtml(summaryValue)}</p>
                      </td></tr>
                    </table>
                  </td>
                  <td style="width:48%;padding-left:6px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#17181c;border-radius:16px;">
                      <tr><td style="padding:14px 16px;">
                        <p style="margin:0 0 5px 0;font-size:${pickFont(11, 12)}px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#858b94;">Verzender</p>
                        <p style="margin:0;font-size:${pickFont(17, 18)}px;font-weight:800;color:${accent};">${escapeHtml(fromName)}</p>
                      </td></tr>
                    </table>
                  </td>
                </tr>
              </table>
              <div style="background:#fffaf1;border:1px solid rgba(245,176,76,0.24);border-left:4px solid ${accent};border-radius:14px;padding:16px 16px 2px 16px;">
                ${makeBodyHtml(options?.bodyFontSize || `${pickFont(14, 15)}px`)}
              </div>
              ${ctaButton ? `<div style="padding-top:18px;">${ctaButton}</div>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:0 22px 20px 22px;">
              <div style="border-top:1px solid #eceef2;padding-top:18px;">
                <p style="margin:0;font-size:${pickFont(13, 14)}px;font-weight:700;color:#1f2937;">${escapeHtml(fromName)}</p>
                <p style="margin:4px 0 0 0;font-size:${pickFont(12, 13)}px;color:#707784;">${escapeHtml(companyName)}</p>
              </div>
            </td>
          </tr>
          <tr><td style="height:3px;background:${accent};font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="background:#131416;padding:16px 22px;text-align:center;">
              <p style="margin:0;font-size:${pickFont(13, 14)}px;font-weight:700;color:#ffffff;">${escapeHtml(companyName)}</p>
              <p style="margin:5px 0 0 0;font-size:${pickFont(11, 12)}px;color:#8b9098;">&copy; ${year} ${escapeHtml(companyName)}. Premium outreach, helder en compact.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  };

  const extractProposalData = (text: string) => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const data: {
      greeting?: string;
      attachment?: string;
      reference?: string;
      total?: string;
      validUntil?: string;
      note?: string;
      narrative: string[];
      services: Array<{ service: string; details: string; total: string }>;
    } = { narrative: [], services: [] };

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (!data.greeting && /^beste\b/i.test(line)) {
        data.greeting = line;
        continue;
      }
      if (lower.startsWith("bijlage toegevoegd:")) {
        data.attachment = line.replace(/^bijlage toegevoegd:\s*/i, "").trim();
        continue;
      }
      if (lower.startsWith("offertenummer:")) {
        data.reference = line.replace(/^offertenummer:\s*/i, "").trim();
        continue;
      }
      if (lower.startsWith("totaalprijs:")) {
        data.total = line.replace(/^totaalprijs:\s*/i, "").trim();
        continue;
      }
      if (lower.startsWith("geldig tot:")) {
        data.validUntil = line.replace(/^geldig tot:\s*/i, "").trim();
        continue;
      }
      if (lower.startsWith("opmerkingen:")) {
        data.note = line.replace(/^opmerkingen:\s*/i, "").trim();
        continue;
      }
      if (lower.startsWith("samenvatting van de voorgestelde diensten")) {
        continue;
      }
      if (/^-/.test(line)) {
        const match = line.match(/^-+\s*(.+?):\s*(.+)$/);
        const service = (match?.[1] || line.replace(/^-+\s*/, "").trim()).trim();
        const details = (match?.[2] || "").trim();
        const totalMatch = details.match(/(€\s?[0-9][0-9\.\,\s]*)$/);
        data.services.push({
          service,
          details: details.replace(/\s+·\s+€\s?[0-9][0-9\.\,\s]*$/, "").trim() || details || "Dienst",
          total: totalMatch?.[1]?.trim() || "",
        });
        continue;
      }
      data.narrative.push(line);
    }

    return data;
  };

  if (layout === "minimal") {
    return premiumPreview({
      badge: "COMPACT",
      eyebrow: "Korte, heldere update",
      intro: `Een compacte mail aan ${recipientCompany}, ontworpen om snel te scannen.`,
      background: "#f4f5f7",
      summaryTitle: "Ontvanger",
      summaryValue: recipientCompany,
    });
  }

  if (layout === "business") {
    return premiumPreview({
      badge: "BUSINESS",
      eyebrow: "Zakelijke update",
      intro: "Strakke, professionele opmaak voor afspraken, rapporten en commerciële opvolging.",
      background: "#eceff3",
      summaryTitle: "Bedrijf",
      summaryValue: recipientCompany,
    });
  }

  if (layout === "proposal") {
    const parsed = extractProposalData(body);
    const accent = primaryColor && primaryColor !== "#6366f1" ? primaryColor : "#f6ad49";
    const narrative = parsed.narrative.join("\n\n");
    const renderedBody = (narrative || body)
      .split("\n\n")
      .filter((p) => p.trim())
      .map(
        (paragraph) =>
          `<p style="margin:0 0 14px 0;line-height:1.6;color:#4b5563;font-size:${pickFont(15, 16)}px;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
      )
      .join("");
    const serviceRows = parsed.services
      .map(
        (service) => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:${pickFont(12, 13)}px;font-weight:700;color:#1f2937;">${escapeHtml(service.service)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:${pickFont(12, 13)}px;color:#6b7280;">${escapeHtml(service.details)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:${pickFont(12, 13)}px;font-weight:700;color:${accent};text-align:right;">${escapeHtml(service.total || "-")}</td>
        </tr>`,
      )
      .join("");
    const hasQuoteReference = Boolean(parsed.reference || parsed.total || parsed.validUntil);
    const hasAttachment = Boolean(parsed.attachment);
    const proposalCta =
      ctaText && ctaUrl
        ? `<div style="text-align:center;margin:14px 0 6px 0;">
          <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${accent};color:#111;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:${pickFont(14, 15)}px;font-weight:800;">
            ${escapeHtml(ctaText)} &rarr;
          </a>
        </div>`
        : "";

    return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><style>body{margin:0;padding:0;background:#d9d9dd;font-family:Arial,Helvetica,sans-serif;}</style></head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#d9d9dd;">
    <tr><td align="center" style="padding:16px;">
      <table role="presentation" width="680" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;width:100%;background-color:#ececee;border-radius:14px;overflow:hidden;">
        <tr><td style="background:#0a0d12;padding:20px 22px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <p style="margin:0;font-size:${pickFont(30, 34)}px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${escapeHtml(companyName)}</p>
                <p style="margin:2px 0 0 0;font-size:${pickFont(12, 13)}px;font-weight:700;color:${accent};">Partner in Digital Solutions</p>
              </td>
              <td align="right">
                <span style="display:inline-block;background:${accent};color:#0a0d12;padding:7px 13px;border-radius:999px;font-size:${pickFont(11, 12)}px;font-weight:800;letter-spacing:1px;">OFFERTE</span>
                <p style="margin:8px 0 0 0;font-size:${pickFont(20, 24)}px;font-weight:700;color:#5d636d;">${escapeHtml(parsed.reference || subject)}</p>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="height:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:22px;">
          <p style="margin:0 0 10px 0;font-size:${pickFont(24, 28)}px;font-weight:800;color:#1a1d23;">${escapeHtml(parsed.greeting || `Beste ${recipientCompany},`)}</p>
          <p style="margin:0 0 14px 0;font-size:${pickFont(15, 16)}px;color:#5b6068;">Hierbij vindt u uw <strong>persoonlijke offerte op maat</strong>.</p>
          ${renderedBody}
          ${
            hasAttachment
              ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;background:#e7e7e8;border:1px solid #d8d8d8;border-radius:10px;">
            <tr><td style="padding:12px 14px;font-size:${pickFont(13, 14)}px;color:#4d5056;">
              <strong>Bijlage toegevoegd:</strong> ${escapeHtml(parsed.attachment || "Offerte.pdf")}
            </td></tr>
          </table>`
              : ""
          }
          ${
            hasQuoteReference
              ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;">
            <tr>
              <td style="width:50%;padding-right:5px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e5e5e6;border-radius:10px;">
                  <tr><td style="padding:12px 14px;">
                    <p style="margin:0 0 4px 0;font-size:${pickFont(11, 12)}px;font-weight:800;color:#8b8e95;">REFERENTIE</p>
                    <p style="margin:0 0 4px 0;font-size:${pickFont(18, 20)}px;font-weight:800;color:#171a1f;">${escapeHtml(parsed.reference || subject)}</p>
                    <p style="margin:0;font-size:${pickFont(11, 12)}px;color:#7a7f86;">${escapeHtml(parsed.validUntil || "")}</p>
                  </td></tr>
                </table>
              </td>
              <td style="width:50%;padding-left:5px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0d12;border-radius:10px;">
                  <tr><td style="padding:12px 14px;">
                    <p style="margin:0 0 5px 0;font-size:${pickFont(11, 12)}px;font-weight:800;color:#6b7078;">TOTAAL INCL. BTW</p>
                    <p style="margin:0;font-size:${pickFont(28, 32)}px;font-weight:800;color:${accent};">${escapeHtml(parsed.total || "-")}</p>
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>`
              : ""
          }
          ${
            serviceRows
              ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:12px;">
              <tr style="background:#0a0d12;">
                <th style="padding:9px 10px;text-align:left;color:${accent};font-size:${pickFont(11, 12)}px;">DIENST</th>
                <th style="padding:9px 10px;text-align:left;color:#878b92;font-size:${pickFont(11, 12)}px;">CATEGORIE</th>
                <th style="padding:9px 10px;text-align:right;color:${accent};font-size:${pickFont(11, 12)}px;">TOTAAL</th>
              </tr>
              ${serviceRows}
            </table>`
              : ""
          }
          ${proposalCta}
        </td></tr>
        <tr><td style="height:3px;background:${accent};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="background:#0a0d12;padding:14px 22px;text-align:center;">
          <p style="margin:0;font-size:${pickFont(14, 15)}px;font-weight:700;color:#fff;">${escapeHtml(companyName)}</p>
          <p style="margin:4px 0 0 0;font-size:${pickFont(11, 12)}px;color:#7e838c;">${escapeHtml(fromName)}</p>
          <p style="margin:4px 0 0 0;font-size:${pickFont(11, 12)}px;color:#7e838c;">&copy; ${year} ${escapeHtml(companyName)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }

  if (layout === "followup") {
    return premiumPreview({
      badge: "FOLLOW-UP",
      eyebrow: "Compacte herinnering",
      bodyFontSize: `${pickFont(13, 14)}px`,
      intro: "Een vriendelijke opvolgmail met weinig ruis en een duidelijke volgende stap.",
      background: "#f3f4f6",
      summaryTitle: "Volgende stap",
      summaryValue: ctaText || "Reactie gevraagd",
    });
  }

  // Default: modern
  return premiumPreview({
    badge: "UPDATE",
    eyebrow: "Heldere premium outreach",
    intro: "Moderne allround opmaak voor kennismaking, opvolging en commerciële communicatie.",
    background: "#eef1f5",
    summaryTitle: "Contact",
    summaryValue: recipientCompany,
  });
}

export function EmailPreview(props: EmailPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => generatePreviewHtml(props), [props]);

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
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/30 px-4 py-2">
        <p className="text-xs text-muted-foreground">Onderwerp</p>
        <p className="text-sm font-medium">{props.subject}</p>
      </div>
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
