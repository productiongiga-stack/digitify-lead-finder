export type EmailDesignExample = {
  id: string;
  label: string;
  description: string;
};

export const EMAIL_DESIGN_EXAMPLES: Array<EmailDesignExample & { html: string }> = [
  {
    id: "minimal-card",
    label: "Minimal kaart",
    description: "Wit vlak op lichte achtergrond, ideaal als startpunt.",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;background:#f8fafc;color:#374151;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;">
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Beste {{contactName}},</p>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Bedankt voor je interesse in {{companyName}}. Hieronder een kort overzicht van de volgende stap.</p>
        <p style="margin:0;font-size:16px;line-height:1.6;">{{senderName}}<br>{{senderCompany}}</p>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    id: "branded-header",
    label: "Gekleurde header",
    description: "Merkkleur bovenaan met witte content.",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 32px rgba(15,23,42,0.08);">
    <tr>
      <td style="padding:28px 32px;background:#f9ae5a;color:#ffffff;">
        <p style="margin:0;font-size:20px;font-weight:700;">{{senderCompany}}</p>
        <p style="margin:8px 0 0;font-size:13px;opacity:0.9;">Persoonlijk bericht voor {{companyName}}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Beste {{contactName}},</p>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">We hebben je aanvraag bekeken en stellen graag een korte call voor om de mogelijkheden te bespreken.</p>
        <p style="margin:0;font-size:16px;line-height:1.6;">Met vriendelijke groeten,<br><strong>{{senderName}}</strong></p>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    id: "cta-button",
    label: "Met CTA-knop",
    description: "Call-to-action voor afspraken of offertes.",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;background:#f8fafc;color:#374151;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;">
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#111827;">Hallo {{contactName}},</p>
        <p style="margin:0 0 20px;font-size:16px;line-height:1.6;">Klaar om de volgende stap te zetten? Plan direct een moment dat voor jou past.</p>
        <p style="margin:0 0 24px;text-align:center;">
          <a href="{{bookingLink}}" style="display:inline-block;padding:14px 28px;background:#f9ae5a;color:#ffffff;text-decoration:none;font-weight:700;border-radius:999px;font-size:15px;">Plan een gesprek</a>
        </p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">Vragen? Antwoord gerust op deze mail.<br>{{senderName}} · {{senderEmail}}</p>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    id: "highlight-box",
    label: "Highlight-blok",
    description: "Accentbox voor kernboodschap of aanbod.",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;background:#f8fafc;color:#374151;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;">
    <tr>
      <td style="padding:0 0 16px;font-size:14px;color:#6b7280;">Bericht voor {{companyName}}</td>
    </tr>
    <tr>
      <td style="padding:32px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Beste {{contactName}},</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border-left:4px solid #f9ae5a;border-radius:8px;">
          <tr>
            <td style="padding:16px 18px;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#c2410c;">Kernboodschap</p>
              <p style="margin:0;font-size:15px;line-height:1.55;color:#1f2937;">We helpen teams zoals die van {{companyName}} met heldere digitale processen en meetbare opvolging.</p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-size:16px;line-height:1.6;">Laat weten wanneer een kort gesprek past — dan sturen we een voorstel op maat.</p>
        <p style="margin:16px 0 0;font-size:16px;line-height:1.6;">{{senderName}}</p>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
];

export const DEFAULT_CUSTOM_EMAIL_HTML = EMAIL_DESIGN_EXAMPLES[0]?.html ?? "";
