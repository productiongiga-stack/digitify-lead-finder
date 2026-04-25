import {
  generateBrandedHtml,
  createEmailProvider,
  type EmailLayout,
  type EmailAttachment,
  buildLeadContext,
  replacePlaceholders,
} from "@digitify/email";
import { type PrismaClient } from "@digitify/db";
import { formatSmtpErrorMessage, normalizeAiPlaceholderSyntax, normalizeLegacyPlaceholders, normalizeTlsOptions } from "./email-utils";
import { getSettingBoolean, getSettingNumber, getSettingString, settingsRowsToMap } from "./settings";
import { extractEmailTemplateMetadata } from "./email-content";
import { loadUserSettingRows } from "./user-settings";

interface EmailSettings {
  providerName: string;
  fromName: string;
  fromEmail: string;
  fromTitle: string;
  headerSlogan: string;
  companyName: string;
  primaryColor: string;
  logoUrl: string;
  website: string;
  signature: string;
  footer: string;
  defaultLayout: EmailLayout;
  typographyMode: "compact" | "normal";
  replyTo: string;
  bcc: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpServername: string;
  smtpRejectUnauthorized: boolean;
}

interface SendBrandedEmailParams {
  toEmail: string;
  subject: string;
  body: string;
  recipientCompany?: string;
  leadId?: string;
  layout?: EmailLayout;
  placeholderContext?: Record<string, string | number | undefined>;
  attachments?: EmailAttachment[];
  userId?: string;
}

/**
 * Load email and branding settings from the database.
 */
export async function loadEmailSettings(db: PrismaClient, userId?: string): Promise<EmailSettings> {
  const settingKeys = [
    "email.provider",
    "email.smtp_host",
    "email.smtp_port",
    "email.smtp_user",
    "email.smtp_pass",
    "email.smtp_servername",
    "email.smtp_tls_reject_unauthorized",
    "email.from_name",
    "email.from_email",
    "email.from_title",
    "email.header_slogan",
    "email.reply_to",
    "email.signature",
    "email.footer",
    "email.default_layout",
    "display.typography_mode",
    "branding.company_name",
    "branding.primary_color",
    "branding.logo_url",
    "branding.website",
    "company.name",
    "company.website",
  ];

  const settingRows = userId
    ? await loadUserSettingRows(db, userId, settingKeys)
    : await db.setting.findMany({ where: { key: { in: settingKeys } } });
  const settings = settingsRowsToMap(settingRows);

  const hasSmtpCredentials = Boolean(
    getSettingString(settings, "email.smtp_host") &&
      getSettingString(settings, "email.smtp_user") &&
      getSettingString(settings, "email.smtp_pass")
  );
  const configuredProvider = getSettingString(settings, "email.provider");
  const providerName =
    configuredProvider === "console" && hasSmtpCredentials
      ? "smtp"
      : configuredProvider || (hasSmtpCredentials ? "smtp" : "console");

  return {
    providerName,
    fromName: getSettingString(settings, "email.from_name") || getSettingString(settings, "branding.company_name"),
    fromEmail: getSettingString(settings, "email.from_email"),
    fromTitle: getSettingString(settings, "email.from_title"),
    headerSlogan: getSettingString(settings, "email.header_slogan"),
    companyName: getSettingString(settings, "branding.company_name") || getSettingString(settings, "company.name"),
    primaryColor: getSettingString(settings, "branding.primary_color", "#f9ae5a"),
    logoUrl: getSettingString(settings, "branding.logo_url"),
    website: getSettingString(settings, "branding.website") || getSettingString(settings, "company.website"),
    signature: getSettingString(settings, "email.signature"),
    footer: getSettingString(settings, "email.footer"),
    defaultLayout: getSettingString(settings, "email.default_layout", "proposal") as EmailLayout,
    typographyMode: getSettingString(settings, "display.typography_mode", "compact") === "normal" ? "normal" : "compact",
    replyTo: getSettingString(settings, "email.reply_to"),
    bcc: getSettingString(settings, "email.bcc"),
    smtpHost: getSettingString(settings, "email.smtp_host"),
    smtpPort: getSettingNumber(settings, "email.smtp_port", 587),
    smtpUser: getSettingString(settings, "email.smtp_user"),
    smtpPass: getSettingString(settings, "email.smtp_pass"),
    smtpServername: getSettingString(settings, "email.smtp_servername"),
    smtpRejectUnauthorized: getSettingBoolean(settings, "email.smtp_tls_reject_unauthorized", true),
  };
}

/**
 * Send a branded email using the configured provider.
 * Returns { success, messageId?, error? }.
 */
export async function sendBrandedEmail(
  db: PrismaClient,
  params: SendBrandedEmailParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const cfg = await loadEmailSettings(db, params.userId);
  const effectiveFromEmail = cfg.fromEmail || cfg.smtpUser;
  const effectiveFromName = cfg.fromName || cfg.companyName || cfg.smtpUser;
  if (!effectiveFromEmail) {
    return {
      success: false,
      error: "E-mail afzender ontbreekt. Configureer eerst SMTP en e-mailinstellingen.",
    };
  }
  const normalizedSubject = normalizeAiPlaceholderSyntax(
    normalizeLegacyPlaceholders(params.subject, {
      "Je naam": effectiveFromName,
      "Je functie": cfg.fromTitle,
      "Bedrijfsnaam": cfg.companyName,
      "Website": cfg.website,
      "E-mail": effectiveFromEmail,
    })
  );
  const normalizedBody = normalizeAiPlaceholderSyntax(normalizeLegacyPlaceholders(params.body, {
    "Je naam": effectiveFromName,
    "Je functie": cfg.fromTitle,
    "Bedrijfsnaam": cfg.companyName,
    "Website": cfg.website,
    "E-mail": effectiveFromEmail,
  }));

  let leadContext = {};
  if (params.leadId) {
    const lead = await db.lead.findUnique({
      where: { id: params.leadId },
      include: {
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { name: "asc" }, { id: "asc" }],
          select: { name: true, isPrimary: true },
        },
      },
    });

    if (lead) {
      leadContext = buildLeadContext({
        ...lead,
        email: lead.email ?? undefined,
        phone: lead.phone ?? undefined,
        website: lead.website ?? undefined,
        industry: lead.industry ?? undefined,
        city: lead.city ?? undefined,
      }, {
        senderName: effectiveFromName,
        senderTitle: cfg.fromTitle,
        senderCompany: cfg.companyName,
        senderEmail: effectiveFromEmail,
        senderPhone: "",
      });
    }
  }

  const mergedContext = {
    ...leadContext,
    ...(params.placeholderContext || {}),
  };
  const safeSubject = replacePlaceholders(normalizedSubject, mergedContext, { removeMissing: true }).replace(/\s{2,}/g, " ").trim() || "Bericht";
  const safeBody = replacePlaceholders(normalizedBody, mergedContext, { removeMissing: true }).replace(/\n{3,}/g, "\n\n").trim();

  const templateMetadata = extractEmailTemplateMetadata(safeBody);

  const bodyWithSignature = [
    templateMetadata.cleanBody.trim(),
    cfg.signature.trim() ? cfg.signature.trim() : "",
    cfg.footer.trim() ? cfg.footer.trim() : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const effectiveLayout = params.layout || templateMetadata.layout || cfg.defaultLayout || "proposal";

  const html = generateBrandedHtml({
    subject: safeSubject,
    body: bodyWithSignature,
    companyName: cfg.companyName,
    primaryColor: cfg.primaryColor,
    fromName: effectiveFromName,
    fromEmail: effectiveFromEmail,
    headerSlogan: cfg.headerSlogan,
    recipientCompany: params.recipientCompany || "",
    ctaText: templateMetadata.ctaText,
    ctaUrl: templateMetadata.ctaUrl,
    layout: effectiveLayout,
    typographyMode: cfg.typographyMode,
    logoUrl: cfg.logoUrl,
    hidePoweredBy: true,
  });

  if (cfg.providerName === "smtp" && (!cfg.smtpHost || !cfg.smtpUser || !cfg.smtpPass)) {
    return {
      success: false,
      error: "SMTP is onvolledig geconfigureerd. Vul host, gebruikersnaam en wachtwoord in bij Integraties.",
    };
  }

  const provider = createEmailProvider({
    provider: cfg.providerName,
    smtp:
      cfg.providerName === "smtp"
        ? {
            host: cfg.smtpHost,
            port: cfg.smtpPort,
            user: cfg.smtpUser,
            pass: cfg.smtpPass,
            tls: normalizeTlsOptions({
              host: cfg.smtpHost,
              explicitServername: cfg.smtpServername,
              username: cfg.smtpUser,
              rejectUnauthorized: cfg.smtpRejectUnauthorized,
            }),
          }
        : undefined,
  });

  const result = await provider.send({
    to: params.toEmail,
    from: effectiveFromEmail,
    fromName: effectiveFromName,
    subject: safeSubject,
    html,
    text: bodyWithSignature.replace(/<[^>]*>/g, ""),
    replyTo: cfg.replyTo || undefined,
    bcc: cfg.bcc || undefined,
    attachments: params.attachments,
  });

  return {
    success: result.success,
    messageId: result.messageId,
    error: result.error ? formatSmtpErrorMessage(result.error) : undefined,
  };
}
