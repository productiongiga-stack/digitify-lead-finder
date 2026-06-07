import { sanitizeCtaUrl } from "./safe-url";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type CtaButtonVariant = "pill" | "rounded" | "soft" | "outline" | "block";
export type CtaButtonSize = "sm" | "md" | "lg";
export type CtaButtonAlign = "left" | "center" | "right";
export type ShellLogoSize = "sm" | "md" | "lg";
export type ShellSignatureStyle = "subtle" | "bordered" | "card";

export type CtaRenderOptions = {
  variant?: CtaButtonVariant;
  size?: CtaButtonSize;
  align?: CtaButtonAlign;
  fullWidth?: boolean;
  shadow?: boolean;
  spacing?: "tight" | "normal" | "roomy";
};

export type ShellRenderMeta = {
  v: 1;
  cta?: CtaRenderOptions;
  logoSize?: ShellLogoSize;
  signatureStyle?: ShellSignatureStyle;
};

const SHELL_CONFIG_REGEX = /<!--\s*digitify-shell-config:([\s\S]*?)\s*-->/;

export function parseShellRenderMeta(shellHtml: string): ShellRenderMeta | null {
  const match = shellHtml.match(SHELL_CONFIG_REGEX);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(match[1]) as ShellRenderMeta;
    return parsed?.v === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function buildShellRenderMetaComment(meta: ShellRenderMeta): string {
  return `<!-- digitify-shell-config:${JSON.stringify(meta)} -->`;
}

const SIZE_STYLES: Record<CtaButtonSize, { font: string; pad: string; minWidth: string }> = {
  sm: { font: "13px", pad: "11px 24px", minWidth: "120px" },
  md: { font: "15px", pad: "15px 34px", minWidth: "148px" },
  lg: { font: "17px", pad: "17px 42px", minWidth: "176px" },
};

const SPACING_MARGIN: Record<NonNullable<CtaRenderOptions["spacing"]>, string> = {
  tight: "20px 0 4px 0",
  normal: "32px 0 8px 0",
  roomy: "44px 0 12px 0",
};

type VariantVisual = {
  radius: string;
  fillColor: string;
  textColor: string;
  border: string;
  shadow: string;
  useTdFill: boolean;
};

function variantStyles(variant: CtaButtonVariant, primaryColor: string): VariantVisual {
  const color = escapeHtml(primaryColor);
  const rgb = hexToRgb(primaryColor);

  switch (variant) {
    case "rounded":
      return {
        radius: "12px",
        fillColor: color,
        textColor: "#ffffff",
        border: "none",
        shadow: "0 8px 22px rgba(15,23,42,0.15)",
        useTdFill: true,
      };
    case "soft":
      return {
        radius: "12px",
        fillColor: `rgba(${rgb},0.14)`,
        textColor: color,
        border: `1px solid rgba(${rgb},0.28)`,
        shadow: "none",
        useTdFill: true,
      };
    case "outline":
      return {
        radius: "12px",
        fillColor: "#ffffff",
        textColor: color,
        border: `2px solid ${color}`,
        shadow: "none",
        useTdFill: true,
      };
    case "block":
      return {
        radius: "10px",
        fillColor: color,
        textColor: "#ffffff",
        border: "none",
        shadow: "0 6px 18px rgba(15,23,42,0.14)",
        useTdFill: true,
      };
    case "pill":
    default:
      return {
        radius: "999px",
        fillColor: color,
        textColor: "#ffffff",
        border: "none",
        shadow: "0 10px 26px rgba(15,23,42,0.17),0 2px 4px rgba(15,23,42,0.08)",
        useTdFill: true,
      };
  }
}

function hexToRgb(hex: string): string {
  const normalized = hex.replace("#", "").trim();
  if (normalized.length !== 6) return "15,23,42";
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) return "15,23,42";
  return `${r},${g},${b}`;
}

function buildButtonCell(
  label: string,
  url: string,
  visual: VariantVisual,
  sizeStyle: (typeof SIZE_STYLES)[CtaButtonSize],
  align: CtaButtonAlign,
  fullWidth: boolean,
  shadow: boolean,
) {
  const shadowStyle = shadow && visual.shadow !== "none" ? `box-shadow:${visual.shadow};` : "";
  const widthStyle = fullWidth ? "width:100%;" : "";
  const minWidth = fullWidth ? "" : `min-width:${sizeStyle.minWidth};`;
  const tdAlign = fullWidth ? "center" : align;
  const linkDisplay = fullWidth ? "block" : "inline-block";
  const bgcolorAttr = visual.useTdFill && !visual.fillColor.startsWith("rgba")
    ? ` bgcolor="${visual.fillColor}"`
    : "";

  const tdStyle = [
    "padding:0",
    "line-height:1",
    `border-radius:${visual.radius}`,
    visual.useTdFill ? `background-color:${visual.fillColor}` : "",
    visual.border !== "none" ? `border:${visual.border}` : "",
    shadowStyle.replace(/;$/, ""),
    widthStyle.replace(/;$/, ""),
  ].filter(Boolean).join(";");

  const linkStyle = [
    `display:${linkDisplay}`,
    `padding:${sizeStyle.pad}`,
    `color:${visual.textColor}`,
    "background:transparent",
    "text-decoration:none",
    "font-family:Arial,Helvetica,sans-serif",
    `font-size:${sizeStyle.font}`,
    "font-weight:700",
    "letter-spacing:0.02em",
    "line-height:1.25",
    "text-align:center",
    `border-radius:${visual.radius}`,
    minWidth.replace(/;$/, ""),
    widthStyle.replace(/;$/, ""),
    "box-sizing:border-box",
    "mso-line-height-rule:exactly",
    "mso-padding-alt:0",
  ].filter(Boolean).join(";");

  return `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"${fullWidth ? ' width="100%" style="width:100%;"' : ""}>
                <tr>
                  <td align="${tdAlign}"${bgcolorAttr} style="${tdStyle}">
                    <a href="${url}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">
                      ${label}
                    </a>
                  </td>
                </tr>
              </table>`;
}

export function renderCtaBlock(
  ctaText: string | undefined,
  ctaUrl: string | undefined,
  primaryColor: string,
  options: CtaRenderOptions = {},
): string {
  const safeUrl = sanitizeCtaUrl(ctaUrl);
  if (!ctaText?.trim() || !safeUrl) return "";

  const variant = options.variant ?? "pill";
  const size = options.size ?? "md";
  const align = options.align ?? "center";
  const fullWidth = options.fullWidth ?? variant === "block";
  const shadow = options.shadow ?? (variant === "pill" || variant === "block" || variant === "rounded");
  const spacing = options.spacing ?? "normal";

  const sizeStyle = SIZE_STYLES[size];
  const visual = variantStyles(variant, primaryColor || "#f9ae5a");
  const label = escapeHtml(ctaText.trim());
  const url = escapeHtml(safeUrl);
  const buttonCell = buildButtonCell(label, url, visual, sizeStyle, align, fullWidth, shadow);

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:${SPACING_MARGIN[spacing]};">
      <tr>
        <td align="${align}" style="padding:0;">
          ${buttonCell}
        </td>
      </tr>
    </table>`;
}
