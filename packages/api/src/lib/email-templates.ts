import { EmailTemplateLayout, EmailTemplateType } from "@digitify/db";
import { extractEmailTemplateMetadata } from "./email-content";
import { sanitizeCtaUrl } from "@digitify/email";

export type ParsedEmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  cleanBody: string;
  layout: string;
  type: string;
  description: string;
  ctaText: string;
  ctaUrl: string;
  campaignId: string | null;
  isGlobal: boolean;
  campaign: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EmailTemplateInput = {
  body: string;
  layout?: string;
  type?: string;
  description?: string;
  ctaText?: string;
  ctaUrl?: string;
};

const LAYOUT_VALUES = new Set<string>(Object.values(EmailTemplateLayout));
const TYPE_VALUES = new Set<string>(Object.values(EmailTemplateType));

function parseLayout(value?: string | null): EmailTemplateLayout {
  const normalized = value?.trim().toLowerCase();
  return normalized && LAYOUT_VALUES.has(normalized)
    ? (normalized as EmailTemplateLayout)
    : EmailTemplateLayout.modern;
}

function parseType(value?: string | null): EmailTemplateType {
  const normalized = value?.trim().toUpperCase();
  return normalized && TYPE_VALUES.has(normalized)
    ? (normalized as EmailTemplateType)
    : EmailTemplateType.CUSTOM;
}

export function normalizeEmailTemplateInput(input: EmailTemplateInput) {
  const meta = extractEmailTemplateMetadata(input.body);
  const safeCtaUrl = sanitizeCtaUrl(input.ctaUrl ?? meta.ctaUrl) || "";
  const ctaText = (input.ctaText ?? meta.ctaText)?.trim() || "";

  return {
    cleanBody: meta.cleanBody,
    type: parseType(input.type ?? meta.type),
    layout: parseLayout(input.layout ?? meta.layout),
    description: (input.description ?? meta.description)?.trim() || "",
    ctaText: safeCtaUrl ? ctaText : "",
    ctaUrl: safeCtaUrl,
  };
}

export function emailTemplateDataFromInput(input: EmailTemplateInput) {
  const normalized = normalizeEmailTemplateInput(input);
  return {
    body: normalized.cleanBody,
    type: normalized.type,
    layout: normalized.layout,
    description: normalized.description,
    ctaText: normalized.ctaText,
    ctaUrl: normalized.ctaUrl,
  };
}

export function parseTemplateRow(row: {
  id: string;
  name: string;
  subject: string;
  body: string;
  type?: EmailTemplateType | null;
  layout?: EmailTemplateLayout | null;
  description?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  campaignId: string | null;
  isGlobal: boolean;
  createdAt: Date;
  updatedAt: Date;
  campaign?: { id: string; name: string } | null;
}): ParsedEmailTemplate {
  const meta = extractEmailTemplateMetadata(row.body);
  const hasColumnMetadata = Boolean(
    row.type ||
      row.layout ||
      row.description ||
      row.ctaText ||
      row.ctaUrl ||
      !/\[\[(CTA_TEXT|CTA_URL|LAYOUT|TYPE|DESCRIPTION)=/i.test(row.body),
  );

  const type = row.type ?? parseType(meta.type);
  const layout = row.layout ?? parseLayout(meta.layout);
  const description = row.description ?? meta.description ?? "";
  const ctaText = row.ctaText ?? meta.ctaText ?? "";
  const ctaUrl = row.ctaUrl ?? meta.ctaUrl ?? "";
  const cleanBody = hasColumnMetadata ? row.body : meta.cleanBody;

  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    body: row.body,
    cleanBody,
    layout,
    type,
    description,
    ctaText,
    ctaUrl,
    campaignId: row.campaignId,
    isGlobal: row.isGlobal,
    campaign: row.campaign ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function buildOutboundTemplateWhere(
  workspaceId: string,
  options?: { campaignId?: string; type?: EmailTemplateType },
) {
  const base: Record<string, unknown> = { createdById: workspaceId };

  if (options?.type) {
    base.type = options.type;
  }

  if (!options?.campaignId) {
    return base;
  }

  return {
    ...base,
    OR: [{ isGlobal: true }, { campaignId: null }, { campaignId: options.campaignId }],
  };
}

export async function listParsedEmailTemplates(
  db: any,
  workspaceId: string,
  options?: {
    campaignId?: string;
    forOutbound?: boolean;
    type?: EmailTemplateType;
  },
): Promise<ParsedEmailTemplate[]> {
  const useCampaignScope = Boolean(options?.forOutbound || options?.campaignId);
  const where = useCampaignScope
    ? buildOutboundTemplateWhere(workspaceId, {
        campaignId: options?.campaignId,
        type: options?.type,
      })
    : {
        createdById: workspaceId,
        ...(options?.type ? { type: options.type } : {}),
      };

  const rows = await db.emailTemplate.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { campaign: { select: { id: true, name: true } } },
  });

  return rows.map(parseTemplateRow);
}
