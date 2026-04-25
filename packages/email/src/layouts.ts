/**
 * Multi-layout email system.
 * All layouts are table-based HTML for maximum email client compatibility.
 */

export type EmailLayout = "modern" | "minimal" | "business" | "proposal" | "followup";
type TypographyMode = "compact" | "normal";

export interface LayoutOptions {
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
  typographyMode?: TypographyMode;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fontSize(mode: TypographyMode | undefined, compact: number, normal: number) {
  return mode === "normal" ? normal : compact;
}

function bodyToHtml(body: string, style?: string, typographyMode?: TypographyMode): string {
  const defaultStyle =
    style || `margin:0 0 16px 0;line-height:1.6;color:#374151;font-size:${fontSize(typographyMode, 15, 16)}px;`;
  return body
    .split("\n\n")
    .map((paragraph) => {
      const escaped = escapeHtml(paragraph.trim());
      const withTags = escaped.replace(
        /\{\{(\s*\w+\s*)\}\}/g,
        "{{$1}}"
      );
      return `<p style="${defaultStyle}">${withTags.replace(/\n/g, "<br>")}</p>`;
    })
    .filter((p) => !p.includes(`>${"<"}/p>`))
    .join("\n");
}

function ctaToHtml(options: LayoutOptions): string {
  if (!options.ctaText || !options.ctaUrl) return "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px 0;">
      <tr>
        <td align="center">
          <a
            href="${escapeHtml(options.ctaUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            style="display:inline-block;background-color:${options.primaryColor};color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:999px;font-size:${fontSize(options.typographyMode, 15, 16)}px;font-weight:700;"
          >
            ${escapeHtml(options.ctaText)}
          </a>
        </td>
      </tr>
    </table>`;
}

function doctype(): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">`;
}

function msoFontStyle(): string {
  return `<!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->`;
}

function sloganBlock(text?: string, align: "left" | "center" = "left", color = "rgba(255,255,255,0.75)"): string {
  if (!text?.trim()) return "";
  return `<p style="margin:8px 0 0 0;font-size:12px;line-height:1.6;color:${color};text-align:${align};">${escapeHtml(text.trim())}</p>`;
}

const year = new Date().getFullYear();

function unsubBlock(url: string | undefined, escaped: boolean = false): string {
  if (!url) return "";
  const href = escaped ? url : escapeHtml(url);
  return `<a href="${href}" style="color:#9ca3af;text-decoration:underline;">Uitschrijven</a>`;
}

function renderPremiumShell(
  o: LayoutOptions,
  input: {
    badge: string;
    eyebrow: string;
    accentTone?: string;
    bodyHtml: string;
    summaryTitle: string;
    summaryBody: string;
  },
): string {
  const ctaHtml = ctaToHtml({
    ...o,
    ctaText: o.ctaText || "Bekijk meer",
  });
  const unsub = unsubBlock(o.unsubscribeUrl);
  const accentTone = input.accentTone || "#f7f1e5";

  return `${doctype()}
<html xmlns="http://www.w3.org/1999/xhtml" lang="nl">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(o.subject)}</title>
  ${msoFontStyle()}
</head>
<body style="margin:0;padding:0;background-color:#ececec;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ececec;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="680" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;width:100%;background-color:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 36px rgba(17,24,39,0.08);">
          <tr>
            <td style="background-color:#171717;padding:22px 24px 18px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:${fontSize(o.typographyMode, 28, 32)}px;line-height:1.05;font-weight:800;color:#ffffff;">${escapeHtml(o.companyName)}</p>
                    <p style="margin:6px 0 0 0;font-size:${fontSize(o.typographyMode, 12, 13)}px;font-weight:700;color:${o.primaryColor};">${escapeHtml(o.headerSlogan || input.eyebrow)}</p>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <span style="display:inline-block;background:${o.primaryColor};color:#171717;padding:7px 14px;border-radius:999px;font-size:${fontSize(o.typographyMode, 11, 12)}px;font-weight:800;letter-spacing:1px;">${escapeHtml(input.badge)}</span>
                    <p style="margin:10px 0 0 0;font-size:${fontSize(o.typographyMode, 12, 13)}px;color:#8d939c;">${escapeHtml(o.subject)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height:4px;background:${o.primaryColor};font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 10px 0;font-size:${fontSize(o.typographyMode, 24, 28)}px;line-height:1.2;font-weight:800;color:#20242b;">${escapeHtml(o.recipientCompany)}</p>
              <p style="margin:0 0 18px 0;font-size:${fontSize(o.typographyMode, 14, 15)}px;line-height:1.6;color:#666c75;">${escapeHtml(input.eyebrow)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;background:${accentTone};border-left:4px solid ${o.primaryColor};border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0 0 4px 0;font-size:${fontSize(o.typographyMode, 11, 12)}px;font-weight:800;color:#7a6240;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(input.summaryTitle)}</p>
                    <p style="margin:0;font-size:${fontSize(o.typographyMode, 14, 15)}px;line-height:1.6;color:#494f58;">${escapeHtml(input.summaryBody)}</p>
                  </td>
                </tr>
              </table>
              ${input.bodyHtml}
              ${ctaHtml}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;">
                <tr>
                  <td style="border-top:1px solid #ececec;padding-top:16px;">
                    <p style="margin:0;font-size:${fontSize(o.typographyMode, 13, 14)}px;color:#20242b;font-weight:700;">${escapeHtml(o.fromName)}</p>
                    <p style="margin:4px 0 0 0;font-size:${fontSize(o.typographyMode, 12, 13)}px;color:#7b818a;">${escapeHtml(o.fromEmail)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height:3px;background:${o.primaryColor};font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="background:#171717;padding:16px 24px;text-align:center;">
              <p style="margin:0;font-size:${fontSize(o.typographyMode, 12, 13)}px;font-weight:700;color:#ffffff;">${escapeHtml(o.companyName)}</p>
              <p style="margin:6px 0 0 0;font-size:${fontSize(o.typographyMode, 10, 11)}px;line-height:1.5;color:#8d939c;">
                ${unsub || ""}${unsub ? " &middot; " : ""}${o.hidePoweredBy ? "" : '<span style="color:#69707a;">Powered by Digitify</span>'}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* =============== MODERN =============== */
function generateModern(o: LayoutOptions): string {
  return renderPremiumShell(o, {
    badge: "UPDATE",
    eyebrow: "Een compacte premium mail voor heldere updates en volgende stappen.",
    summaryTitle: "Kernboodschap",
    summaryBody: "Duidelijk, kort en visueel rustig zodat de ontvanger meteen begrijpt wat belangrijk is.",
    bodyHtml: bodyToHtml(
      o.body,
      `margin:0 0 14px 0;line-height:1.65;color:#4b5563;font-size:${fontSize(o.typographyMode, 14, 15)}px;`,
      o.typographyMode,
    ),
  });
}

/* =============== MINIMAL =============== */
function generateMinimal(o: LayoutOptions): string {
  return renderPremiumShell(o, {
    badge: "COMPACT",
    eyebrow: "Minimalistische mail met premium uitstraling voor korte, persoonlijke berichten.",
    summaryTitle: "Compact",
    summaryBody: "Minder ruis, meer focus. Ideaal voor korte outreach, reminders en zachte check-ins.",
    accentTone: "#f7f4ec",
    bodyHtml: bodyToHtml(
      o.body,
      `margin:0 0 12px 0;line-height:1.65;color:#4b5563;font-size:${fontSize(o.typographyMode, 13, 14)}px;`,
      o.typographyMode,
    ),
  });
}

/* =============== BUSINESS =============== */
function generateBusiness(o: LayoutOptions): string {
  return renderPremiumShell(o, {
    badge: "BUSINESS",
    eyebrow: "Zakelijke premium mail voor duidelijke beslissingen, afspraken en professionele opvolging.",
    summaryTitle: "Beslissingskader",
    summaryBody: "Helder opgebouwd voor professionele communicatie met snelle scanbaarheid en duidelijke call-to-action.",
    accentTone: "#f3efe6",
    bodyHtml: bodyToHtml(
      o.body,
      `margin:0 0 14px 0;line-height:1.65;color:#47505a;font-size:${fontSize(o.typographyMode, 14, 15)}px;`,
      o.typographyMode,
    ),
  });
}

/* =============== PROPOSAL =============== */
function safeUrlHost(url?: string) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function extractProposalData(body: string) {
  const lines = body
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
  } = {
    narrative: [],
    services: [],
  };

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
      const serviceMatch = line.match(/^-+\s*(.+?):\s*(.+)$/);
      const service = (serviceMatch?.[1] || line.replace(/^-+\s*/, "").trim()).trim();
      const details = (serviceMatch?.[2] || "").trim();
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
}

function generateProposal(o: LayoutOptions): string {
  const parsed = extractProposalData(o.body);
  const accent = o.primaryColor && o.primaryColor !== "#6366f1" ? o.primaryColor : "#f6ad49";
  const bodyText = parsed.narrative.join("\n\n");
  const bodyHtml = bodyToHtml(
    bodyText || o.body,
    `margin:0 0 12px 0;line-height:1.6;color:#4b5563;font-size:${fontSize(o.typographyMode, 15, 16)}px;`,
    o.typographyMode,
  );
  const ctaHtml = o.ctaText && o.ctaUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 8px 0;">
      <tr>
        <td align="center">
          <a
            href="${escapeHtml(o.ctaUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            style="display:inline-block;background:${accent};color:#12151a;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:${fontSize(o.typographyMode, 15, 16)}px;font-weight:800;"
          >
            ${escapeHtml(o.ctaText)} &rarr;
          </a>
        </td>
      </tr>
    </table>`
    : "";
  const websiteHost = safeUrlHost(o.ctaUrl);
  const refLabel = parsed.reference || o.subject;
  const totalLabel = parsed.total || "";
  const validUntilLabel = parsed.validUntil || "";
  const attachment = parsed.attachment || `Offerte-${refLabel.replace(/\s+/g, "-")}.pdf`;
  const greeting = parsed.greeting || `Beste ${o.recipientCompany},`;
  const hasQuoteReference = Boolean(parsed.reference || parsed.total || parsed.validUntil);
  const hasAttachment = Boolean(parsed.attachment);
  const serviceRows = parsed.services
    .map(
      (service) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:${fontSize(o.typographyMode, 14, 15)}px;font-weight:700;color:#1f2937;">${escapeHtml(service.service)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:${fontSize(o.typographyMode, 14, 15)}px;color:#6b7280;">${escapeHtml(service.details)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:${fontSize(o.typographyMode, 14, 15)}px;font-weight:700;color:${accent};text-align:right;">${escapeHtml(service.total || "-")}</td>
      </tr>`,
    )
    .join("");

  return `${doctype()}
<html xmlns="http://www.w3.org/1999/xhtml" lang="nl">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(o.subject)}</title>
  ${msoFontStyle()}
</head>
<body style="margin:0;padding:0;background-color:#d9d9dd;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#d9d9dd;">
    <tr>
      <td align="center" style="padding:28px 14px;">
        <table role="presentation" width="760" cellpadding="0" cellspacing="0" border="0" style="max-width:760px;width:100%;background-color:#ececee;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <!-- Dark Header -->
          <tr>
            <td style="background-color:#0a0d12;padding:26px 28px 22px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:top;">
                    ${
                      o.logoUrl
                        ? `<img src="${escapeHtml(o.logoUrl)}" alt="${escapeHtml(o.companyName)}" style="height:44px;display:block;margin:0 0 10px 0;" />`
                        : `<p style="margin:0;font-size:${fontSize(o.typographyMode, 40, 44)}px;line-height:1;font-weight:800;color:#ffffff;letter-spacing:-1px;">${escapeHtml(o.companyName)}</p>`
                    }
                    <p style="margin:0;font-size:${fontSize(o.typographyMode, 14, 15)}px;font-weight:700;color:${accent};">Partner in Digital Solutions</p>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <span style="display:inline-block;background:${accent};color:#0a0d12;font-size:${fontSize(o.typographyMode, 13, 14)}px;font-weight:800;letter-spacing:1px;border-radius:999px;padding:8px 16px;">
                      OFFERTE
                    </span>
                    <p style="margin:10px 0 0 0;font-size:${fontSize(o.typographyMode, 24, 28)}px;font-weight:700;color:#545862;letter-spacing:0.5px;">
                      ${escapeHtml(refLabel)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Main Content -->
          <tr>
            <td style="padding:30px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0 0 12px 0;font-size:${fontSize(o.typographyMode, 32, 36)}px;line-height:1.15;font-weight:800;color:#1a1d23;">
                      ${escapeHtml(greeting)}
                    </p>
                    <p style="margin:0 0 18px 0;font-size:${fontSize(o.typographyMode, 15, 16)}px;line-height:1.5;color:#5b6068;">
                      Hierbij vindt u uw <strong style="color:#444;">persoonlijke offerte op maat</strong>.
                    </p>
                    ${bodyHtml}
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 16px 0;background:#ede9dd;border-left:6px solid ${accent};border-radius:10px;">
                <tr>
                  <td style="padding:14px 16px;font-size:${fontSize(o.typographyMode, 14, 15)}px;color:#5b5b59;">
                    ${escapeHtml(parsed.note || "We zorgen voor een heldere uitvoering, transparante planning en meetbaar resultaat.")}
                  </td>
                </tr>
              </table>

              ${
                hasAttachment
                  ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;background:#e7e7e8;border:1px solid #d8d8d8;border-radius:10px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0 0 5px 0;font-size:${fontSize(o.typographyMode, 14, 15)}px;color:#45484d;">
                      <strong>Bijlage toegevoegd:</strong> ${escapeHtml(attachment)}
                    </p>
                    <p style="margin:0;font-size:${fontSize(o.typographyMode, 13, 14)}px;color:#72757b;">
                      Gelieve het document te openen via de bijlage van deze e-mail.
                    </p>
                  </td>
                </tr>
              </table>`
                  : ""
              }

              ${
                hasQuoteReference || totalLabel
                  ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;">
                <tr>
                  <td style="width:50%;padding-right:8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e5e5e6;border-radius:14px;">
                      <tr>
                        <td style="padding:16px 18px;">
                          <p style="margin:0 0 6px 0;font-size:${fontSize(o.typographyMode, 12, 13)}px;font-weight:800;color:#8b8e95;letter-spacing:1px;">REFERENTIE</p>
                          <p style="margin:0 0 5px 0;font-size:${fontSize(o.typographyMode, 20, 22)}px;font-weight:800;color:#171a1f;">${escapeHtml(refLabel)}</p>
                          <p style="margin:0;font-size:${fontSize(o.typographyMode, 12, 13)}px;color:#7a7f86;">
                            ${escapeHtml(validUntilLabel ? `Geldig tot ${validUntilLabel}` : "Geldigheid standaard 30 dagen")}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="width:50%;padding-left:8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0d12;border-radius:14px;">
                      <tr>
                        <td style="padding:16px 18px;">
                          <p style="margin:0 0 8px 0;font-size:${fontSize(o.typographyMode, 12, 13)}px;font-weight:800;color:#6b7078;letter-spacing:1px;">TOTAAL INCL. BTW</p>
                          <p style="margin:0;font-size:${fontSize(o.typographyMode, 34, 38)}px;line-height:1.05;font-weight:800;color:${accent};">${escapeHtml(totalLabel || "-")}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`
                  : ""
              }

              ${
                serviceRows
                  ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;border-collapse:collapse;background:#ededee;">
                <tr>
                  <td colspan="3" style="padding:0 0 8px 0;font-size:${fontSize(o.typographyMode, 14, 15)}px;font-weight:800;letter-spacing:1px;color:#8b8e95;">OVERZICHT DIENSTEN</td>
                </tr>
                <tr style="background:#0a0d12;">
                  <th style="padding:11px 12px;text-align:left;color:${accent};font-size:${fontSize(o.typographyMode, 13, 14)}px;letter-spacing:0.7px;">DIENST</th>
                  <th style="padding:11px 12px;text-align:left;color:#878b92;font-size:${fontSize(o.typographyMode, 13, 14)}px;letter-spacing:0.7px;">CATEGORIE</th>
                  <th style="padding:11px 12px;text-align:right;color:${accent};font-size:${fontSize(o.typographyMode, 13, 14)}px;letter-spacing:0.7px;">TOTAAL</th>
                </tr>
                ${serviceRows}
                ${
                  totalLabel
                    ? `<tr style="background:#e4e4e5;">
                    <td style="padding:12px 12px;text-align:right;font-size:${fontSize(o.typographyMode, 15, 16)}px;font-weight:800;color:#171a1f;" colspan="2">Totaal incl. BTW</td>
                    <td style="padding:12px 12px;text-align:right;font-size:${fontSize(o.typographyMode, 22, 24)}px;font-weight:800;color:${accent};">${escapeHtml(totalLabel)}</td>
                  </tr>`
                    : ""
                }
              </table>`
                  : ""
              }

              ${ctaHtml}
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#0a0d12;padding:20px 28px;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:${fontSize(o.typographyMode, 22, 24)}px;font-weight:800;color:#ffffff;">${escapeHtml(o.companyName)}</p>
              <p style="margin:0;font-size:${fontSize(o.typographyMode, 14, 15)}px;color:#7e838c;line-height:1.6;">
                ${escapeHtml(o.fromEmail)}
                ${websiteHost ? ` &nbsp;&bull;&nbsp; ${escapeHtml(websiteHost)}` : ""}
              </p>
              <p style="margin:8px 0 0 0;font-size:${fontSize(o.typographyMode, 12, 13)}px;color:#5f646c;">
                &copy; ${year} ${escapeHtml(o.companyName)} ${o.unsubscribeUrl ? `&nbsp;&bull;&nbsp; ${unsubBlock(o.unsubscribeUrl, true)}` : ""}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* =============== FOLLOWUP =============== */
function generateFollowup(o: LayoutOptions): string {
  return renderPremiumShell(o, {
    badge: "FOLLOW-UP",
    eyebrow: "Compacte premium opvolgmail die snel leest en duidelijk aanzet tot reactie.",
    summaryTitle: "Opvolging",
    summaryBody: "Een zachte reminder met duidelijke context, korte inhoud en een snelle volgende stap.",
    accentTone: "#f6f1e7",
    bodyHtml: bodyToHtml(
      o.body,
      `margin:0 0 12px 0;line-height:1.65;color:#4b5563;font-size:${fontSize(o.typographyMode, 13, 14)}px;`,
      o.typographyMode,
    ),
  });
}

/* =============== DISPATCHER =============== */

const layoutGenerators: Record<EmailLayout, (o: LayoutOptions) => string> = {
  modern: generateModern,
  minimal: generateMinimal,
  business: generateBusiness,
  proposal: generateProposal,
  followup: generateFollowup,
};

export function generateLayout(layout: EmailLayout, options: LayoutOptions): string {
  const gen = layoutGenerators[layout];
  if (!gen) {
    return layoutGenerators.modern(options);
  }
  return gen(options);
}
