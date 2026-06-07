import { htmlFromText } from "./template-renderer";
import { sanitizeCtaUrl } from "./safe-url";
import {
  parseShellRenderMeta,
  renderCtaBlock as renderStyledCtaBlock,
  type CtaRenderOptions,
  type ShellLogoSize,
  type ShellSignatureStyle,
} from "./cta-block";

export type { CtaRenderOptions, CtaButtonVariant, CtaButtonSize, CtaButtonAlign } from "./cta-block";
export { renderCtaBlock, parseShellRenderMeta, buildShellRenderMetaComment } from "./cta-block";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replacePlaceholder(template: string, key: string, value: string): string {
  const regex = new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, "g");
  return template.replace(regex, () => value);
}

/** Studio — default branded shell (preset: branded-header) */
export const DEFAULT_MASTER_SHELL_HTML = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="x-apple-disable-message-reformatting">
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#e9eef4;color:#1e293b;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#e9eef4" style="background:#e9eef4;">
    <tr>
      <td align="center" style="padding:44px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;border-radius:24px;overflow:hidden;background:#ffffff;box-shadow:0 2px 8px rgba(15,23,42,0.06),0 28px 64px rgba(15,23,42,0.12);">
          <tr>
            <td bgcolor="{{primaryColor}}" style="background:{{primaryColor}};padding:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:38px 44px 34px;color:#ffffff;vertical-align:top;">
                    {{logoBlock}}
                    <p style="margin:0;font-size:28px;font-weight:800;line-height:1.1;letter-spacing:-0.04em;">{{companyName}}</p>
                    <p style="margin:14px 0 0;font-size:15px;line-height:1.45;color:rgba(255,255,255,0.92);">{{headerSlogan}}</p>
                  </td>
                  <td width="72" style="padding:0 28px 20px 0;vertical-align:bottom;font-size:0;line-height:0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" align="right">
                      <tr>
                        <td width="52" height="52" style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.14);font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                      <tr><td height="8" style="font-size:0;line-height:0;">&nbsp;</td></tr>
                      <tr>
                        <td width="32" height="32" align="right" style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.08);font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 44px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td height="5" bgcolor="{{primaryColor}}" style="height:5px;background:{{primaryColor}};border-radius:0 0 6px 6px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 44px 36px;font-size:16px;line-height:1.75;color:#334155;">
              {{content}}
              {{ctaBlock}}
              {{signatureBlock}}
            </td>
          </tr>
          <tr>
            <td bgcolor="#f6f8fb" style="padding:26px 44px 30px;background:#f6f8fb;border-top:1px solid #e8edf3;">
              {{footerBlock}}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  {{unsubscribeBlock}}
</body>
</html>`;

export type MasterShellBranding = {
  companyName: string;
  primaryColor: string;
  logoUrl?: string;
  headerSlogan?: string;
  signature?: string;
  footer?: string;
  fromName?: string;
  fromEmail?: string;
};

export type RenderMasterShellOptions = {
  shellHtml: string;
  content: string;
  contentFormat?: "TEXT" | "HTML";
  ctaBlock?: string;
  ctaText?: string;
  ctaUrl?: string;
  ctaOptions?: CtaRenderOptions;
  branding: MasterShellBranding;
  subject?: string;
  unsubscribeUrl?: string;
};

function formatSignatureHtml(signature: string, style: ShellSignatureStyle = "subtle"): string {
  const trimmed = signature.trim();
  if (!trimmed) return "";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;

  const body = htmlFromText(trimmed);
  if (style === "card") {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 0;"><tr><td bgcolor="#f8fafc" style="padding:20px 22px;background:#f8fafc;border-radius:14px;border:1px solid #e2e8f0;font-size:15px;line-height:1.7;color:#475569;font-family:Arial,Helvetica,sans-serif;">${body}</td></tr></table>`;
  }
  if (style === "bordered") {
    return `<p style="margin:32px 0 0;padding:20px 0 0;border-top:2px solid #e2e8f0;font-size:15px;line-height:1.75;color:#475569;font-family:Arial,Helvetica,sans-serif;">${body}</p>`;
  }
  return `<p style="margin:32px 0 0;padding-top:24px;border-top:1px solid #e8edf3;font-size:15px;line-height:1.7;color:#475569;font-family:Arial,Helvetica,sans-serif;">${body}</p>`;
}

function formatFooterHtml(footer: string): string {
  const trimmed = footer.trim();
  if (!trimmed) return "";
  return `<p style="margin:0;font-size:12px;line-height:1.65;color:#94a3b8;text-align:center;">${escapeHtml(trimmed).replace(/\n/g, "<br>")}</p>`;
}

function formatContentHtml(content: string, format: "TEXT" | "HTML"): string {
  const trimmed = content.trim();
  if (!trimmed) return "";
  if (format === "HTML") {
    if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
    return htmlFromText(trimmed);
  }
  return htmlFromText(trimmed);
}

const LOGO_HEIGHT: Record<ShellLogoSize, number> = {
  sm: 36,
  md: 48,
  lg: 64,
};

function buildLogoBlock(logoUrl?: string, companyName?: string, size: ShellLogoSize = "md"): string {
  if (!logoUrl?.trim()) return "";
  const height = LOGO_HEIGHT[size];
  return `<img src="${escapeHtml(logoUrl.trim())}" alt="${escapeHtml(companyName || "")}" width="auto" height="${height}" style="display:block;max-height:${height}px;margin-bottom:16px;border:0;outline:none;" />`;
}

function buildUnsubscribeBlock(unsubscribeUrl?: string): string {
  if (!unsubscribeUrl?.trim()) return "";
  const safe = sanitizeCtaUrl(unsubscribeUrl);
  if (!safe) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 20px 10px;"><p style="margin:0;font-size:12px;color:#94a3b8;"><a href="${escapeHtml(safe)}" style="color:#64748b;text-decoration:underline;">Uitschrijven</a></p></td></tr></table>`;
}

/**
 * Renders outgoing mail HTML by injecting template content into the workspace master shell.
 */
export function renderMasterShell(options: RenderMasterShellOptions): string {
  const shell = options.shellHtml.trim() || DEFAULT_MASTER_SHELL_HTML;
  const shellMeta = parseShellRenderMeta(shell);
  const contentHtml = formatContentHtml(options.content, options.contentFormat || "TEXT");
  const branding = options.branding;
  const ctaOptions = { ...shellMeta?.cta, ...options.ctaOptions };
  const ctaBlock = options.ctaBlock?.trim()
    || renderStyledCtaBlock(
      options.ctaText,
      options.ctaUrl,
      branding.primaryColor || "#f9ae5a",
      ctaOptions,
    );

  let html = shell;
  html = replacePlaceholder(html, "content", contentHtml);
  html = replacePlaceholder(html, "ctaBlock", ctaBlock);
  html = replacePlaceholder(html, "subject", escapeHtml(options.subject?.trim() || ""));
  html = replacePlaceholder(html, "companyName", escapeHtml(branding.companyName || ""));
  html = replacePlaceholder(html, "primaryColor", escapeHtml(branding.primaryColor || "#f9ae5a"));
  html = replacePlaceholder(html, "headerSlogan", escapeHtml(branding.headerSlogan?.trim() || ""));
  html = replacePlaceholder(html, "logoUrl", escapeHtml(branding.logoUrl?.trim() || ""));
  html = replacePlaceholder(
    html,
    "logoBlock",
    buildLogoBlock(branding.logoUrl, branding.companyName, shellMeta?.logoSize ?? "md"),
  );
  html = replacePlaceholder(html, "signature", escapeHtml(branding.signature?.trim() || ""));
  html = replacePlaceholder(html, "footer", escapeHtml(branding.footer?.trim() || ""));
  html = replacePlaceholder(
    html,
    "signatureBlock",
    formatSignatureHtml(branding.signature || "", shellMeta?.signatureStyle ?? "subtle"),
  );
  html = replacePlaceholder(html, "footerBlock", formatFooterHtml(branding.footer || ""));
  html = replacePlaceholder(html, "unsubscribeUrl", escapeHtml(options.unsubscribeUrl?.trim() || ""));
  html = replacePlaceholder(html, "unsubscribeBlock", buildUnsubscribeBlock(options.unsubscribeUrl));
  html = replacePlaceholder(html, "senderName", escapeHtml(branding.fromName?.trim() || branding.companyName || ""));
  html = replacePlaceholder(html, "senderEmail", escapeHtml(branding.fromEmail?.trim() || ""));

  return html;
}
