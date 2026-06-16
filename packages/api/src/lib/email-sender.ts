import {
  createEmailProvider,
  type EmailAttachment,
  buildLeadContext,
  replacePlaceholders,
  htmlToPlainText,
  renderMasterShell,
  DEFAULT_MASTER_SHELL_HTML,
} from "@digitify/email";
import { type PrismaClient } from "@digitify/db";
import { formatSmtpErrorMessage, normalizeAiPlaceholderSyntax, normalizeLegacyPlaceholders, normalizeTlsOptions } from "./email-utils";
import { log } from "./logger";
import { createEmailTrackingToken } from "./email-tracking-token";
import { getSettingBoolean, getSettingNumber, getSettingString, settingsRowsToMap } from "./settings";
import { extractEmailTemplateMetadata } from "./email-content";
import {
  loadWorkspaceSettingRows,
  type WorkspaceScope,
  workspaceScopeFromUser,
} from "./workspace-settings";

export type EmailSettingsScope = string | WorkspaceScope;

function resolveEmailSettingsScope(scope?: EmailSettingsScope): WorkspaceScope | null {
  if (!scope) return null;
  if (typeof scope === "string") {
    return { workspaceId: scope, memberId: scope };
  }
  return scope;
}

export function resolveEmailSettingsScopeFromUser(user: {
  id: string;
  workspaceId?: string | null;
}): WorkspaceScope {
  return workspaceScopeFromUser({
    id: user.id,
    workspaceId: user.workspaceId ?? undefined,
  });
}

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
  masterShellHtml: string;
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
  bodyFormat?: "TEXT" | "HTML";
  recipientCompany?: string;
  leadId?: string;
  ctaText?: string;
  ctaUrl?: string;
  placeholderContext?: Record<string, string | number | undefined>;
  attachments?: EmailAttachment[];
  /** Workspace scope for shared mail settings (shell, branding, SMTP). */
  userId?: EmailSettingsScope;
  trackingDraftId?: string;
  unsubscribeUrl?: string;
  inReplyTo?: string;
  references?: string;
}

function resolveAppUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
  ];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;
    try {
      return new URL(trimmed).toString().replace(/\/$/, "");
    } catch {
      continue;
    }
  }
  return "http://localhost:3000";
}

/**
 * Load email and branding settings from the database.
 */
export async function loadEmailSettings(db: PrismaClient, scope?: EmailSettingsScope): Promise<EmailSettings> {
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
    "email.master_shell_html",
    "email.custom_html",
    "email.default_layout",
    "email.default_layout_by_type_json",
    "display.typography_mode",
    "branding.company_name",
    "branding.primary_color",
    "branding.logo_url",
    "branding.website",
    "company.name",
    "company.website",
  ];

  const resolved = resolveEmailSettingsScope(scope);
  const settingRows = resolved
    ? await loadWorkspaceSettingRows(db, resolved, settingKeys)
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
    masterShellHtml:
      getSettingString(settings, "email.master_shell_html")
      || getSettingString(settings, "email.custom_html")
      || DEFAULT_MASTER_SHELL_HTML,
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
): Promise<{ success: boolean; messageId?: string; error?: string; html?: string }> {
  const cfg = await loadEmailSettings(db, params.userId);
  const effectiveFromEmail = cfg.fromEmail || cfg.smtpUser;
  const effectiveFromName = cfg.fromName || cfg.companyName || cfg.smtpUser;
  if (!effectiveFromEmail) {
    log.email.warn("Email send aborted: missing from address", {
      userId: params.userId,
      to: params.toEmail,
    });
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
  const isHtmlBody = params.bodyFormat === "HTML" || templateMetadata.bodyFormat === "HTML";
  const contentBody = templateMetadata.cleanBody.trim();
  const ctaText = params.ctaText || templateMetadata.ctaText;
  const ctaUrl = params.ctaUrl || templateMetadata.ctaUrl;

  const html = renderMasterShell({
    shellHtml: cfg.masterShellHtml,
    content: contentBody,
    contentFormat: isHtmlBody ? "HTML" : "TEXT",
    ctaText,
    ctaUrl,
    subject: safeSubject,
    unsubscribeUrl: params.unsubscribeUrl,
    branding: {
      companyName: cfg.companyName,
      primaryColor: cfg.primaryColor,
      logoUrl: cfg.logoUrl,
      headerSlogan: cfg.headerSlogan,
      signature: cfg.signature,
      footer: cfg.footer,
      fromName: effectiveFromName,
      fromEmail: effectiveFromEmail,
    },
  });
  const htmlWithTrackingPixel = params.trackingDraftId
    ? `${html}<img src="${resolveAppUrl()}/api/public/email/open/${encodeURIComponent(params.trackingDraftId)}?t=${encodeURIComponent(createEmailTrackingToken(params.trackingDraftId))}" alt="" width="1" height="1" style="display:none;border:0;outline:none;"/>`
    : html;

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
    html: htmlWithTrackingPixel,
    text: isHtmlBody ? htmlToPlainText(contentBody) : contentBody.replace(/<[^>]*>/g, ""),
    replyTo: cfg.replyTo || undefined,
    bcc: cfg.bcc || undefined,
    inReplyTo: params.inReplyTo,
    references: params.references,
    attachments: params.attachments,
  });

  if (!result.success) {
    log.email.error("Email send failed", {
      userId: params.userId,
      provider: cfg.providerName,
      to: params.toEmail,
      from: effectiveFromEmail,
      smtpHost: cfg.providerName === "smtp" ? cfg.smtpHost : undefined,
    }, result.error);
  } else {
    log.email.info("Email sent", {
      userId: params.userId,
      provider: cfg.providerName,
      to: params.toEmail,
      messageId: result.messageId,
    });
  }

  return {
    success: result.success,
    messageId: result.messageId,
    error: result.error ? formatSmtpErrorMessage(result.error) : undefined,
    html: htmlWithTrackingPixel,
  };
}
