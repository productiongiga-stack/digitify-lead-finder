import { DEFAULT_MASTER_SHELL_HTML as PACKAGE_DEFAULT_SHELL } from "@digitify/email/master-shell";

export type EmailShellPreset = {
  id: string;
  label: string;
  description: string;
  tag: string;
  layout: "letter" | "brand" | "convert";
  html: string;
};

export const EMAIL_SHELL_PRESETS: EmailShellPreset[] = [
  {
    id: "minimal-clean",
    label: "Brief",
    tag: "Editorial & rustig",
    layout: "letter",
    description:
      "Warme editorial layout met accentlijn en wit kaartvlak. Ideaal voor persoonlijke 1-op-1 outreach.",
    html: `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="x-apple-disable-message-reformatting">
</head>
<body style="margin:0;padding:0;font-family:Georgia,'Times New Roman',Times,serif;background:#f3efe8;color:#292524;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f3efe8" style="background:#f3efe8;">
    <tr>
      <td align="center" style="padding:52px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
          <tr>
            <td style="padding:0 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="6" valign="top" style="padding-top:4px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="4" height="52" bgcolor="{{primaryColor}}" style="width:4px;height:52px;background:{{primaryColor}};border-radius:4px;font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                  <td style="padding-left:24px;font-family:Arial,Helvetica,sans-serif;">
                    {{logoBlock}}
                    <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#a8a29e;">{{companyName}}</p>
                    <p style="margin:10px 0 0;font-size:15px;line-height:1.5;color:#78716c;font-style:italic;">{{headerSlogan}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background:#ffffff;border-radius:20px;padding:0;border:1px solid #e8e4dc;box-shadow:0 4px 12px rgba(41,37,36,0.05),0 20px 56px rgba(41,37,36,0.09);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td height="5" bgcolor="{{primaryColor}}" style="height:5px;background:{{primaryColor}};border-radius:20px 20px 0 0;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:44px 40px 40px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.9;color:#44403c;">
                    {{content}}
                    {{ctaBlock}}
                  </td>
                </tr>
                <tr>
                  <td bgcolor="#faf9f7" style="padding:32px 40px 36px;background:#faf9f7;border-top:1px solid #f0eeec;border-radius:0 0 20px 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;color:#57534e;">
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
</html>`,
  },
  {
    id: "branded-header",
    label: "Studio",
    tag: "Merk & structuur",
    layout: "brand",
    description:
      "Premium header met merkkleur, accentstrook en aparte footerzone. Standaard voor professionele mails.",
    html: PACKAGE_DEFAULT_SHELL,
  },
  {
    id: "action-focused",
    label: "Convert",
    tag: "Donker frame + CTA",
    layout: "convert",
    description:
      "Donker premium frame met wit kaartvlak en eigen CTA-zone. Maximaal conversiegericht.",
    html: `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="x-apple-disable-message-reformatting">
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#060b18;color:#f8fafc;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#060b18" style="background:#060b18;">
    <tr>
      <td bgcolor="#0a1228" style="padding:0;background:#0a1228;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td height="3" bgcolor="{{primaryColor}}" style="height:3px;background:{{primaryColor}};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:44px 20px 48px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;">
          <tr>
            <td align="center" style="padding:0 0 20px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#64748b;">{{companyName}}</p>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 12px 24px rgba(0,0,0,0.25),0 40px 96px rgba(0,0,0,0.5);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="8" bgcolor="{{primaryColor}}" style="width:8px;background:{{primaryColor}};font-size:0;line-height:0;">&nbsp;</td>
                  <td style="padding:36px 36px 30px;vertical-align:top;">
                    {{logoBlock}}
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                      <tr>
                        <td bgcolor="#f1f5f9" style="padding:8px 16px;background:#f1f5f9;border-radius:999px;border:1px solid #e2e8f0;">
                          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:{{primaryColor}};">{{headerSlogan}}</p>
                        </td>
                      </tr>
                    </table>
                    <div style="font-size:16px;line-height:1.8;color:#334155;">
                      {{content}}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" bgcolor="#f4f7fb" style="padding:34px 36px;background:#f4f7fb;text-align:center;border-top:1px solid #e2e8f0;border-bottom:1px solid #e8edf3;">
                    {{ctaBlock}}
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:28px 36px 34px;font-size:14px;line-height:1.7;color:#64748b;">
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
</html>`,
  },
];

/** @deprecated Use EMAIL_SHELL_PRESETS */
export const EMAIL_DESIGN_EXAMPLES = EMAIL_SHELL_PRESETS;

export const DEFAULT_MASTER_SHELL_HTML = PACKAGE_DEFAULT_SHELL;
/** @deprecated Use DEFAULT_MASTER_SHELL_HTML */
export const DEFAULT_CUSTOM_EMAIL_HTML = PACKAGE_DEFAULT_SHELL;

export function findMatchingShellPreset(html: string): EmailShellPreset | null {
  const normalized = html.trim();
  if (!normalized) return null;
  return EMAIL_SHELL_PRESETS.find((preset) => preset.html.trim() === normalized) ?? null;
}
