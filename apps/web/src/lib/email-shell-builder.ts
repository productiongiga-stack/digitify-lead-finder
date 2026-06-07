import { buildShellRenderMetaComment } from "@digitify/email/master-shell";
import { EMAIL_SHELL_PRESETS } from "@/lib/email-design-examples";
import {
  fontsFromLegacyStyle,
  HEADER_WEIGHT_VALUES,
  LINE_HEIGHT_VALUES,
  shellFontStack,
  type ShellFontFamily,
  type ShellHeaderCase,
  type ShellHeaderWeight,
  type ShellLineHeight,
} from "@/lib/email-shell-fonts";

export type { ShellFontFamily, ShellHeaderCase, ShellLineHeight, ShellHeaderWeight } from "@/lib/email-shell-fonts";
export { FONT_PAIRING_PRESETS, WIZARD_FONT_OPTIONS } from "@/lib/email-shell-fonts";

export type ShellBaseStyle = "blank" | "brief" | "studio" | "convert";
export type ShellHeaderBackground = "brand" | "white" | "light";
export type ShellFooterAlign = "left" | "center";
export type ShellBodyTone = "default" | "muted";
export type ShellBackgroundTone = "warm" | "cool" | "neutral" | "dark";
export type ShellHeaderStyle = "bold" | "minimal" | "accent-bar";
export type ShellCardRadius = "sharp" | "soft" | "round";
export type ShellSpacing = "compact" | "comfortable" | "generous";
/** @deprecated Use headerFont + bodyFont */
export type ShellFontStyle = "modern" | "classic";
export type ShellCtaZone = "inline" | "highlighted" | "minimal";
export type ShellFooterStyle = "subtle" | "bar" | "minimal";
export type ShellCardWidth = "narrow" | "standard" | "wide";
export type ShellCardShadow = "none" | "soft" | "lifted";
export type ShellContentAlign = "left" | "center";
export type ShellBodySize = "sm" | "md" | "lg";
export type ShellHeaderSize = "sm" | "md" | "lg";
export type ShellCardBorder = "none" | "subtle" | "accent";
export type ShellCtaStyle = "pill" | "rounded" | "soft" | "outline" | "block";
export type ShellCtaSize = "sm" | "md" | "lg";
export type ShellCtaSpacing = "tight" | "normal" | "roomy";
export type ShellLogoSize = "sm" | "md" | "lg";
export type ShellSignatureStyle = "subtle" | "bordered" | "card";

export type ShellWizardConfig = {
  baseStyle: ShellBaseStyle;
  backgroundTone: ShellBackgroundTone;
  headerStyle: ShellHeaderStyle;
  headerSize: ShellHeaderSize;
  cardRadius: ShellCardRadius;
  cardWidth: ShellCardWidth;
  cardShadow: ShellCardShadow;
  cardBorder: ShellCardBorder;
  spacing: ShellSpacing;
  /** @deprecated */
  fontStyle?: ShellFontStyle;
  headerFont: ShellFontFamily;
  bodyFont: ShellFontFamily;
  lineHeight: ShellLineHeight;
  headerWeight: ShellHeaderWeight;
  headerCase: ShellHeaderCase;
  bodySize: ShellBodySize;
  contentAlign: ShellContentAlign;
  ctaZone: ShellCtaZone;
  ctaStyle: ShellCtaStyle;
  ctaSize: ShellCtaSize;
  ctaSpacing: ShellCtaSpacing;
  ctaFullWidth: boolean;
  ctaShadow: boolean;
  footerStyle: ShellFooterStyle;
  logoSize: ShellLogoSize;
  signatureStyle: ShellSignatureStyle;
  headerBackground: ShellHeaderBackground;
  footerAlign: ShellFooterAlign;
  bodyTone: ShellBodyTone;
  showHeader: boolean;
  showLogoArea: boolean;
  showSlogan: boolean;
  showContentDivider: boolean;
  centerCta: boolean;
};

export const DEFAULT_SHELL_WIZARD_CONFIG: ShellWizardConfig = {
  baseStyle: "studio",
  backgroundTone: "cool",
  headerStyle: "bold",
  headerSize: "md",
  cardRadius: "soft",
  cardWidth: "standard",
  cardShadow: "soft",
  cardBorder: "subtle",
  spacing: "comfortable",
  headerFont: "arial",
  bodyFont: "arial",
  lineHeight: "normal",
  headerWeight: "bold",
  headerCase: "normal",
  bodySize: "md",
  contentAlign: "left",
  ctaZone: "inline",
  ctaStyle: "pill",
  ctaSize: "md",
  ctaSpacing: "normal",
  ctaFullWidth: false,
  ctaShadow: true,
  footerStyle: "subtle",
  logoSize: "md",
  signatureStyle: "subtle",
  headerBackground: "brand",
  footerAlign: "left",
  bodyTone: "default",
  showHeader: true,
  showLogoArea: true,
  showSlogan: true,
  showContentDivider: true,
  centerCta: false,
};

/** Neutral canvas — no preset styling, user builds from scratch. */
export const BLANK_SHELL_WIZARD_CONFIG: ShellWizardConfig = {
  baseStyle: "blank",
  backgroundTone: "neutral",
  headerStyle: "minimal",
  headerSize: "md",
  headerBackground: "white",
  cardRadius: "sharp",
  cardWidth: "standard",
  cardShadow: "none",
  cardBorder: "subtle",
  spacing: "comfortable",
  headerFont: "arial",
  bodyFont: "arial",
  lineHeight: "normal",
  headerWeight: "bold",
  headerCase: "normal",
  bodySize: "md",
  bodyTone: "default",
  contentAlign: "left",
  ctaZone: "inline",
  ctaStyle: "rounded",
  ctaSize: "md",
  ctaSpacing: "normal",
  ctaFullWidth: false,
  ctaShadow: false,
  footerStyle: "minimal",
  footerAlign: "left",
  logoSize: "md",
  signatureStyle: "subtle",
  showHeader: false,
  showLogoArea: true,
  showSlogan: false,
  showContentDivider: false,
  centerCta: false,
};

const BACKGROUNDS: Record<ShellBackgroundTone, { outer: string; card: string; footer: string; text: string }> = {
  warm: { outer: "#f3efe8", card: "#ffffff", footer: "#faf9f7", text: "#44403c" },
  cool: { outer: "#e9eef4", card: "#ffffff", footer: "#f6f8fb", text: "#334155" },
  neutral: { outer: "#f4f4f5", card: "#ffffff", footer: "#fafafa", text: "#3f3f46" },
  dark: { outer: "#060b18", card: "#ffffff", footer: "#f4f7fb", text: "#334155" },
};

const RADIUS: Record<ShellCardRadius, string> = {
  sharp: "8px",
  soft: "20px",
  round: "28px",
};

const WIDTH: Record<ShellCardWidth, string> = {
  narrow: "520px",
  standard: "600px",
  wide: "680px",
};

const SHADOW: Record<ShellCardShadow, string> = {
  none: "none",
  soft: "0 4px 12px rgba(15,23,42,0.06),0 24px 56px rgba(15,23,42,0.1)",
  lifted: "0 8px 20px rgba(15,23,42,0.1),0 32px 80px rgba(15,23,42,0.18)",
};

const PADDING: Record<ShellSpacing, { body: string; header: string; footer: string; outer: string }> = {
  compact: { body: "28px 32px", header: "28px 32px", footer: "22px 32px", outer: "36px 20px" },
  comfortable: { body: "40px 44px", header: "36px 44px", footer: "28px 44px", outer: "44px 20px" },
  generous: { body: "48px 52px", header: "44px 52px", footer: "34px 52px", outer: "52px 24px" },
};

const BODY_SIZE: Record<ShellBodySize, { font: string; line: string }> = {
  sm: { font: "15px", line: "1.7" },
  md: { font: "16px", line: "1.75" },
  lg: { font: "17px", line: "1.85" },
};

const HEADER_TITLE_SIZE: Record<ShellHeaderSize, string> = {
  sm: "22px",
  md: "28px",
  lg: "32px",
};

function cardBorderCss(config: ShellWizardConfig) {
  if (config.cardBorder === "none") return "";
  if (config.cardBorder === "accent") {
    return "border:1px solid #e2e8f0;border-top:4px solid {{primaryColor}};";
  }
  return "border:1px solid #e8e4dc;";
}

function resolveBodyColor(config: ShellWizardConfig, colors: (typeof BACKGROUNDS)[ShellBackgroundTone]) {
  return config.bodyTone === "muted" ? "#64748b" : colors.text;
}

function resolveHeaderFont(config: ShellWizardConfig) {
  return config.headerFont ?? fontsFromLegacyStyle(config.fontStyle).headerFont;
}

function resolveBodyFont(config: ShellWizardConfig) {
  return config.bodyFont ?? fontsFromLegacyStyle(config.fontStyle).bodyFont;
}

function bodyTextStyle(config: ShellWizardConfig, color: string) {
  const size = BODY_SIZE[config.bodySize];
  const align = config.contentAlign === "center" ? "center" : "left";
  const line = LINE_HEIGHT_VALUES[config.lineHeight] ?? size.line;
  return `font-family:${shellFontStack(resolveBodyFont(config))};font-size:${size.font};line-height:${line};color:${color};text-align:${align};`;
}

function headerFontCss(config: ShellWizardConfig) {
  return shellFontStack(resolveHeaderFont(config));
}

function headerWeightCss(config: ShellWizardConfig) {
  return HEADER_WEIGHT_VALUES[config.headerWeight] ?? "700";
}

function headerTitleExtraCss(config: ShellWizardConfig) {
  if (config.headerCase === "uppercase") {
    return "text-transform:uppercase;letter-spacing:0.08em;";
  }
  return "letter-spacing:-0.02em;";
}

function footerAlignStyle(config: ShellWizardConfig) {
  return config.footerAlign === "center" ? "text-align:center;" : "";
}

function buildHeader(config: ShellWizardConfig, pad: string, radius: string, inCard = false) {
  if (!config.showHeader) return "";

  const logo = config.showLogoArea ? "{{logoBlock}}" : "";
  const sloganLight = config.showSlogan
    ? `<p style="margin:14px 0 0;font-size:15px;line-height:1.45;color:rgba(255,255,255,0.92);">{{headerSlogan}}</p>`
    : "";
  const topRadius = inCard ? `${radius} ${radius} 0 0` : `${radius} ${radius} 0 0`;

  const titleSize = HEADER_TITLE_SIZE[config.headerSize];

  if (config.headerStyle === "minimal") {
    return `
          <tr>
            <td style="padding:${pad};font-family:${headerFontCss(config)};">
              ${logo}
              <p style="margin:0;font-size:${titleSize};font-weight:${headerWeightCss(config)};${headerTitleExtraCss(config)}color:#1e293b;">{{companyName}}</p>
              ${config.showSlogan ? `<p style="margin:8px 0 0;font-size:14px;color:#64748b;">{{headerSlogan}}</p>` : ""}
            </td>
          </tr>`;
  }

  if (config.headerStyle === "accent-bar") {
    return `
          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="5" bgcolor="{{primaryColor}}" style="width:5px;background:{{primaryColor}};font-size:0;line-height:0;">&nbsp;</td>
                  <td style="padding:${pad};font-family:${headerFontCss(config)};">
                    ${logo}
                    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#94a3b8;">{{companyName}}</p>
                    ${config.showSlogan ? `<p style="margin:10px 0 0;font-size:15px;line-height:1.5;color:#64748b;font-style:italic;">{{headerSlogan}}</p>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
  }

  const boldHeader = (() => {
    if (config.headerBackground === "white") {
      return {
        bg: "#ffffff",
        titleColor: "#0f172a",
        slogan: config.showSlogan
          ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.45;color:#64748b;">{{headerSlogan}}</p>`
          : "",
        extra: "border-bottom:1px solid #e2e8f0;",
      };
    }
    if (config.headerBackground === "light") {
      return {
        bg: "#f8fafc",
        titleColor: "#0f172a",
        slogan: config.showSlogan
          ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.45;color:#64748b;">{{headerSlogan}}</p>`
          : "",
        extra: "border-bottom:1px solid #e2e8f0;",
      };
    }
    return {
      bg: "{{primaryColor}}",
      titleColor: "#ffffff",
      slogan: sloganLight,
      extra: "",
    };
  })();

  return `
          <tr>
            <td bgcolor="${boldHeader.bg}" style="background:${boldHeader.bg};padding:0;border-radius:${topRadius};${boldHeader.extra}">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:${pad};color:${boldHeader.titleColor};vertical-align:top;font-family:${headerFontCss(config)};">
                    ${logo}
                    <p style="margin:0;font-size:${titleSize};font-weight:${headerWeightCss(config)};line-height:1.1;${headerTitleExtraCss(config)}color:${boldHeader.titleColor};">{{companyName}}</p>
                    ${boldHeader.slogan}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${config.showContentDivider ? `
          <tr>
            <td style="padding:0 44px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td height="5" bgcolor="{{primaryColor}}" style="height:5px;background:{{primaryColor}};border-radius:0 0 6px 6px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>` : ""}`;
}

function ctaZoneTopMargin(config: ShellWizardConfig) {
  if (config.ctaSpacing === "tight") return "16px";
  if (config.ctaSpacing === "roomy") return "40px";
  return "28px";
}

function buildCtaSection(config: ShellWizardConfig) {
  const align = config.centerCta || config.contentAlign === "center" ? "center" : "left";
  const top = ctaZoneTopMargin(config);

  if (config.ctaZone === "minimal") return `{{ctaBlock}}`;

  if (config.ctaZone === "highlighted") {
    return `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:${top};">
                      <tr>
                        <td bgcolor="#f8fafc" style="padding:30px 28px;background:linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%);border-radius:18px;border:1px solid #e2e8f0;box-shadow:inset 0 1px 0 rgba(255,255,255,0.8);text-align:${align};">
                          {{ctaBlock}}
                        </td>
                      </tr>
                    </table>`;
  }

  return `{{ctaBlock}}`;
}

function shellRenderMeta(config: ShellWizardConfig) {
  return buildShellRenderMetaComment({
    v: 1,
    cta: {
      variant: config.ctaStyle,
      size: config.ctaSize,
      align: config.centerCta || config.contentAlign === "center" ? "center" : "left",
      fullWidth: config.ctaFullWidth || config.ctaStyle === "block",
      shadow: config.ctaShadow,
      spacing: config.ctaSpacing,
    },
    logoSize: config.logoSize,
    signatureStyle: config.signatureStyle,
  });
}

function buildFooter(config: ShellWizardConfig, colors: (typeof BACKGROUNDS)[ShellBackgroundTone], pad: string) {
  const minimalStyle = "font-size:13px;line-height:1.65;color:#94a3b8;font-family:Arial,Helvetica,sans-serif;";
  const subtleStyle = `font-size:14px;line-height:1.7;color:#64748b;font-family:Arial,Helvetica,sans-serif;`;
  const barExtra = "border-top:1px solid #e8edf3;";

  const align = footerAlignStyle(config);

  if (config.footerStyle === "minimal") {
    return `
          <tr>
            <td style="padding:${pad};${minimalStyle}${align}">
              {{signatureBlock}}
              {{footerBlock}}
            </td>
          </tr>`;
  }

  return `
          <tr>
            <td bgcolor="${colors.footer}" style="padding:${pad};background:${colors.footer};${config.footerStyle === "bar" ? barExtra : ""}${subtleStyle}${align}">
              {{signatureBlock}}
              {{footerBlock}}
            </td>
          </tr>`;
}

function shellHead(config: ShellWizardConfig) {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="x-apple-disable-message-reformatting">
  ${shellRenderMeta(config)}
</head>`;
}

function buildBlankShell(config: ShellWizardConfig): string {
  const colors = BACKGROUNDS[config.backgroundTone];
  const radius = RADIUS[config.cardRadius];
  const width = WIDTH[config.cardWidth];
  const shadow = SHADOW[config.cardShadow];
  const pad = PADDING[config.spacing];
  const textColor = resolveBodyColor(config, colors);
  const flatCard = config.cardShadow === "none" && config.cardBorder === "none";

  return `${shellHead(config)}
<body style="margin:0;padding:0;font-family:${shellFontStack(resolveBodyFont(config))};background:${colors.outer};color:${textColor};-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${colors.outer}" style="background:${colors.outer};">
    <tr>
      <td align="center" style="padding:${pad.outer};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${width};border-radius:${radius};overflow:hidden;${flatCard ? "" : `background:${colors.card};${cardBorderCss(config)}box-shadow:${shadow};`}">
          ${buildHeader(config, pad.header, radius, true)}
          <tr>
            <td bgcolor="${colors.card}" style="padding:${pad.body};background:${colors.card};${bodyTextStyle(config, textColor)}">
              {{content}}
              ${buildCtaSection(config)}
            </td>
          </tr>
          ${buildFooter(config, colors, pad.footer)}
        </table>
      </td>
    </tr>
  </table>
  {{unsubscribeBlock}}
</body>
</html>`;
}

function buildBriefShell(config: ShellWizardConfig): string {
  const colors = BACKGROUNDS[config.backgroundTone];
  const radius = RADIUS[config.cardRadius];
  const width = WIDTH[config.cardWidth];
  const shadow = SHADOW[config.cardShadow];
  const pad = PADDING[config.spacing];
  const headerOutside = config.headerStyle === "accent-bar" || config.headerStyle === "minimal";

  return `${shellHead(config)}
<body style="margin:0;padding:0;font-family:${shellFontStack(resolveBodyFont(config))};background:${colors.outer};color:${colors.text};-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${colors.outer}" style="background:${colors.outer};">
    <tr>
      <td align="center" style="padding:${pad.outer};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${width};">
          ${headerOutside ? buildHeader(config, pad.header, radius) : ""}
          <tr>
            <td bgcolor="${colors.card}" style="background:${colors.card};border-radius:${radius};padding:0;${cardBorderCss(config)}box-shadow:${shadow};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${!headerOutside ? buildHeader(config, pad.header, radius, true) : `
                <tr>
                  <td height="5" bgcolor="{{primaryColor}}" style="height:5px;background:{{primaryColor}};border-radius:${radius} ${radius} 0 0;font-size:0;line-height:0;">&nbsp;</td>
                </tr>`}
                <tr>
                  <td style="padding:${pad.body};${bodyTextStyle(config, resolveBodyColor(config, colors))}">
                    {{content}}
                    ${buildCtaSection(config)}
                  </td>
                </tr>
                ${buildFooter(config, colors, pad.footer)}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  {{unsubscribeBlock}}
</body>
</html>`;
}

function buildStudioShell(config: ShellWizardConfig): string {
  const colors = BACKGROUNDS[config.backgroundTone];
  const radius = RADIUS[config.cardRadius];
  const width = WIDTH[config.cardWidth];
  const shadow = SHADOW[config.cardShadow];
  const pad = PADDING[config.spacing];

  return `${shellHead(config)}
<body style="margin:0;padding:0;font-family:${shellFontStack(resolveBodyFont(config))};background:${colors.outer};color:#1e293b;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${colors.outer}" style="background:${colors.outer};">
    <tr>
      <td align="center" style="padding:${pad.outer};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${width};border-radius:${radius};overflow:hidden;background:${colors.card};${cardBorderCss(config)}box-shadow:${shadow};">
          ${buildHeader(config, pad.header, radius, true)}
          <tr>
            <td style="padding:${pad.body};${bodyTextStyle(config, resolveBodyColor(config, colors))}">
              {{content}}
              ${buildCtaSection(config)}
            </td>
          </tr>
          ${buildFooter(config, colors, pad.footer)}
        </table>
      </td>
    </tr>
  </table>
  {{unsubscribeBlock}}
</body>
</html>`;
}

function buildConvertShell(config: ShellWizardConfig): string {
  const palette = BACKGROUNDS[config.backgroundTone];
  const outer = config.backgroundTone === "dark" ? "#060b18" : palette.outer;
  const radius = RADIUS[config.cardRadius];
  const width = WIDTH[config.cardWidth];
  const shadow = SHADOW[config.cardShadow];
  const pad = PADDING[config.spacing];
  const ctaInBand = config.ctaZone !== "inline";
  const convertText = resolveBodyColor(config, { ...palette, text: "#334155" });

  return `${shellHead(config)}
<body style="margin:0;padding:0;font-family:${shellFontStack(resolveBodyFont(config))};background:${outer};color:#f8fafc;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${outer}" style="background:${outer};">
    <tr>
      <td bgcolor="{{primaryColor}}" style="height:4px;background:{{primaryColor}};font-size:0;line-height:0;">&nbsp;</td>
    </tr>
    <tr>
      <td align="center" style="padding:${pad.outer};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${width};">
          <tr>
            <td align="center" style="padding:0 0 20px;">
              ${config.showLogoArea ? "{{logoBlock}}" : ""}
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#64748b;">{{companyName}}</p>
              ${config.showSlogan ? `<p style="margin:8px 0 0;font-size:13px;color:#94a3b8;">{{headerSlogan}}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background:#ffffff;border-radius:${radius};overflow:hidden;${cardBorderCss(config)}box-shadow:${shadow};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="6" bgcolor="{{primaryColor}}" style="width:6px;background:{{primaryColor}};font-size:0;line-height:0;">&nbsp;</td>
                  <td style="padding:${pad.body};vertical-align:top;">
                    <div style="${bodyTextStyle(config, convertText)}">
                      {{content}}
                    </div>
                    ${!ctaInBand ? buildCtaSection(config) : ""}
                  </td>
                </tr>
                ${ctaInBand ? `
                <tr>
                  <td colspan="2" bgcolor="#f4f7fb" style="padding:34px 38px;background:linear-gradient(180deg,#f8fafc 0%,#eef2f7 100%);text-align:${config.centerCta ? "center" : "left"};border-top:1px solid #e2e8f0;">
                    {{ctaBlock}}
                  </td>
                </tr>` : ""}
                <tr>
                  <td colspan="2" style="padding:${pad.footer};font-size:14px;line-height:1.7;color:#64748b;font-family:Arial,Helvetica,sans-serif;">
                    {{signatureBlock}}
                    {{footerBlock}}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  {{unsubscribeBlock}}
</body>
</html>`;
}

export function buildEmailShellHtml(config: ShellWizardConfig): string {
  switch (config.baseStyle) {
    case "blank":
      return buildBlankShell(config);
    case "brief":
      return buildBriefShell(config);
    case "convert":
      return buildConvertShell(config);
    default:
      return buildStudioShell(config);
  }
}

export function wizardConfigToAiInstructions(config: ShellWizardConfig): string {
  return [
    `Basis: ${config.baseStyle}`,
    `Achtergrond: ${config.backgroundTone}`,
    `Header: ${config.headerStyle}`,
    `Breedte: ${config.cardWidth}`,
    `Schaduw: ${config.cardShadow}`,
    `Hoeken: ${config.cardRadius}`,
    `Witruimte: ${config.spacing}`,
    `Header-font: ${resolveHeaderFont(config)}`,
    `Body-font: ${resolveBodyFont(config)}`,
    `Regelhoogte: ${config.lineHeight}`,
    `Header-gewicht: ${config.headerWeight}`,
    `Bedrijfsnaam: ${config.headerCase}`,
    `CTA-zone: ${config.ctaZone}`,
    `CTA-stijl: ${config.ctaStyle}`,
    `CTA-grootte: ${config.ctaSize}`,
    `CTA-spacing: ${config.ctaSpacing}`,
    config.ctaFullWidth ? "CTA volle breedte" : "CTA compact",
    config.ctaShadow ? "CTA schaduw" : "CTA plat",
    `Logo-grootte: ${config.logoSize}`,
    `Handtekening: ${config.signatureStyle}`,
    `Footer: ${config.footerStyle}`,
    config.showHeader ? "Header zichtbaar" : "Geen header",
    `Header-achtergrond: ${config.headerBackground}`,
    `Footer-uitlijning: ${config.footerAlign}`,
    `Teksttoon: ${config.bodyTone}`,
    config.showLogoArea ? "Logo-zone ja" : "Geen logo-zone",
    config.showSlogan ? "Slogan ja" : "Geen slogan",
    config.showContentDivider ? "Accentstrook onder header" : "Geen accentstrook",
    `Tekstgrootte: ${config.bodySize}`,
    `Headergrootte: ${config.headerSize}`,
    `Uitlijning: ${config.contentAlign}`,
    `Kaartrand: ${config.cardBorder}`,
    config.centerCta ? "CTA gecentreerd" : "CTA links",
  ].join(", ");
}

export function presetToWizardConfig(presetId: string): Partial<ShellWizardConfig> {
  const preset = EMAIL_SHELL_PRESETS.find((item) => item.id === presetId);
  if (!preset) return {};
  if (preset.id === "minimal-clean") {
    return {
      baseStyle: "brief",
      headerStyle: "accent-bar",
      headerFont: "georgia",
      bodyFont: "arial",
      backgroundTone: "warm",
      cardWidth: "narrow",
      cardShadow: "soft",
    };
  }
  if (preset.id === "action-focused") {
    return {
      baseStyle: "convert",
      backgroundTone: "dark",
      ctaZone: "highlighted",
      ctaStyle: "block",
      ctaSize: "lg",
      ctaFullWidth: true,
      ctaShadow: true,
      cardShadow: "lifted",
      centerCta: true,
    };
  }
  return {
    baseStyle: "studio",
    headerStyle: "bold",
    backgroundTone: "cool",
    cardShadow: "soft",
  };
}

export const WIZARD_BASE_OPTIONS: Array<{
  id: ShellBaseStyle;
  label: string;
  description: string;
}> = [
  {
    id: "blank",
    label: "Blank",
    description: "Leeg beginpunt — jij kiest alles zelf",
  },
  {
    id: "brief",
    label: "Brief",
    description: "Persoonlijke brief — rustig en editorial",
  },
  {
    id: "studio",
    label: "Studio",
    description: "Professioneel — merkheader op de kaart",
  },
  {
    id: "convert",
    label: "Convert",
    description: "Conversie — opvallende actieknop",
  },
];

/** Optionele starters die wél een volledige stijl laden (los van structuur). */
export const WIZARD_STARTER_PRESETS: Array<{
  presetId: string;
  label: string;
  description: string;
}> = [
  {
    presetId: "minimal-clean",
    label: "Brief-starter",
    description: "Warm, smal, accentlijn — editorial 1-op-1",
  },
  {
    presetId: "branded-header",
    label: "Studio-starter",
    description: "Koele merkheader met zachte schaduw",
  },
  {
    presetId: "action-focused",
    label: "Convert-starter",
    description: "Donker frame, grote block-CTA",
  },
];

export function applyStarterPreset(presetId: string): ShellWizardConfig {
  return normalizeWizardConfig({
    ...DEFAULT_SHELL_WIZARD_CONFIG,
    ...presetToWizardConfig(presetId),
  });
}

export function normalizeWizardConfig(
  partial: Partial<ShellWizardConfig> = {},
): ShellWizardConfig {
  const legacy = fontsFromLegacyStyle(partial.fontStyle);
  const merged = { ...DEFAULT_SHELL_WIZARD_CONFIG, ...partial };
  return {
    ...merged,
    headerFont: partial.headerFont ?? merged.headerFont ?? legacy.headerFont,
    bodyFont: partial.bodyFont ?? merged.bodyFont ?? legacy.bodyFont,
    lineHeight: partial.lineHeight ?? merged.lineHeight ?? "normal",
    headerWeight: partial.headerWeight ?? merged.headerWeight ?? "bold",
    headerCase: partial.headerCase ?? merged.headerCase ?? "normal",
  };
}

export function createInitialWizardConfig(
  brandingDefaults: Partial<ShellWizardConfig> = {},
): ShellWizardConfig {
  return normalizeWizardConfig({
    ...BLANK_SHELL_WIZARD_CONFIG,
    ...brandingDefaults,
  });
}
