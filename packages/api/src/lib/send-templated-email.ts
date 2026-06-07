import type { PrismaClient } from "@digitify/db";
import { replacePlaceholders } from "@digitify/email";
import { sendBrandedEmail } from "./email-sender";
import {
  EMAIL_SYSTEM_TEMPLATES,
  ensureSystemEmailTemplates,
  type SystemEmailTemplateDef,
} from "./email-template-starter-pack";
import type { EmailAttachment } from "@digitify/email";

export type SendTemplatedEmailParams = {
  templateKey: string;
  toEmail: string;
  placeholderContext?: Record<string, string | number | undefined>;
  attachments?: EmailAttachment[];
  trackingDraftId?: string;
  userId?: string;
  leadId?: string;
  recipientCompany?: string;
  unsubscribeUrl?: string;
  /** Override subject after placeholder resolution */
  subjectOverride?: string;
  /** Override body after placeholder resolution */
  bodyOverride?: string;
};

function resolveTemplateContent(
  template: SystemEmailTemplateDef,
  context: Record<string, string | number | undefined>,
  overrides?: { subject?: string; body?: string },
) {
  const subject = replacePlaceholders(overrides?.subject ?? template.subject, context, { removeMissing: true })
    .replace(/\s{2,}/g, " ")
    .trim();
  const body = replacePlaceholders(overrides?.body ?? template.body, context, { removeMissing: true })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const ctaText = template.ctaText
    ? replacePlaceholders(template.ctaText, context, { removeMissing: true }).trim()
    : "";
  const ctaUrl = template.ctaUrl
    ? replacePlaceholders(template.ctaUrl, context, { removeMissing: true }).trim()
    : "";

  return { subject, body, ctaText, ctaUrl, bodyFormat: template.bodyFormat ?? "TEXT" };
}

/**
 * Load a system template by key and send via the branded email pipeline.
 */
export async function sendTemplatedEmail(
  db: PrismaClient,
  workspaceId: string,
  params: SendTemplatedEmailParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const resolvedWorkspaceId = workspaceId?.trim();
  if (resolvedWorkspaceId) {
    await ensureSystemEmailTemplates(db, resolvedWorkspaceId);
  }

  const row = resolvedWorkspaceId
    ? await db.emailTemplate.findFirst({
        where: {
          createdById: resolvedWorkspaceId,
          templateKey: params.templateKey,
        },
      })
    : null;

  const fallback = EMAIL_SYSTEM_TEMPLATES.find((item) => item.templateKey === params.templateKey);
  if (!row && !fallback) {
    return {
      success: false,
      error: `E-mailtemplate "${params.templateKey}" niet gevonden.`,
    };
  }

  const templateDef: SystemEmailTemplateDef = row
    ? {
        templateKey: row.templateKey!,
        module: row.module,
        name: row.name,
        type: row.type,
        subject: row.subject,
        body: row.body,
        bodyFormat: row.bodyFormat,
        description: row.description,
        ctaText: row.ctaText || undefined,
        ctaUrl: row.ctaUrl || undefined,
        isSystem: row.isSystem,
      }
    : fallback!;

  const context = params.placeholderContext ?? {};
  const resolved = resolveTemplateContent(templateDef, context, {
    subject: params.subjectOverride,
    body: params.bodyOverride,
  });

  if (!resolved.subject || !resolved.body) {
    return {
      success: false,
      error: `E-mailtemplate "${params.templateKey}" heeft lege inhoud na placeholder-vervanging.`,
    };
  }

  return sendBrandedEmail(db, {
    toEmail: params.toEmail,
    subject: resolved.subject,
    body: resolved.body,
    bodyFormat: resolved.bodyFormat,
    ctaText: resolved.ctaText || undefined,
    ctaUrl: resolved.ctaUrl || undefined,
    recipientCompany: params.recipientCompany,
    leadId: params.leadId,
    placeholderContext: context,
    attachments: params.attachments,
    userId: params.userId ?? resolvedWorkspaceId,
    trackingDraftId: params.trackingDraftId,
    unsubscribeUrl: params.unsubscribeUrl,
  });
}
