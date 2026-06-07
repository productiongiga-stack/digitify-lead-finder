import {
  EmailTemplateBodyFormat,
  EmailTemplateLayout,
  EmailTemplateType,
} from "@digitify/db";
import { extractEmailTemplateMetadata } from "./email-content";
import { sanitizeCtaUrl } from "@digitify/email";

export type ParsedEmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  cleanBody: string;
  bodyFormat: "TEXT" | "HTML";
  layout: string;
  type: string;
  module: string;
  templateKey: string | null;
  isSystem: boolean;
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
  bodyFormat?: string;
  layout?: string;
  type?: string;
  description?: string;
  ctaText?: string;
  ctaUrl?: string;
};

const LAYOUT_VALUES = new Set(["modern", "minimal", "business", "proposal", "followup"]);
const TYPE_VALUES = new Set([
  "OUTREACH",
  "FOLLOW_UP",
  "PROPOSAL",
  "REPORT",
  "BOOKING",
  "REVIEW",
  "REENGAGEMENT",
  "CUSTOM",
]);

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

function parseBodyFormat(value?: string | null): EmailTemplateBodyFormat {
  return value?.trim().toUpperCase() === "HTML"
    ? EmailTemplateBodyFormat.HTML
    : EmailTemplateBodyFormat.TEXT;
}

export function normalizeEmailTemplateInput(input: EmailTemplateInput) {
  const meta = extractEmailTemplateMetadata(input.body);
  const safeCtaUrl = sanitizeCtaUrl(input.ctaUrl ?? meta.ctaUrl) || "";
  const ctaText = (input.ctaText ?? meta.ctaText)?.trim() || "";
  const bodyFormat = input.bodyFormat
    ? parseBodyFormat(input.bodyFormat)
    : meta.bodyFormat
      ? parseBodyFormat(meta.bodyFormat)
      : "TEXT";

  return {
    cleanBody: meta.cleanBody,
    bodyFormat,
    type: parseType(input.type ?? meta.type),
    layout: parseLayout(input.layout ?? meta.layout),
    description: (input.description ?? meta.description)?.trim() || "",
    ctaText: bodyFormat === "HTML" ? "" : safeCtaUrl ? ctaText : "",
    ctaUrl: bodyFormat === "HTML" ? "" : safeCtaUrl,
  };
}

export function emailTemplateDataFromInput(input: EmailTemplateInput) {
  const normalized = normalizeEmailTemplateInput(input);
  return {
    body: normalized.cleanBody,
    bodyFormat: normalized.bodyFormat,
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
  type?: string | null;
  layout?: string | null;
  bodyFormat?: string | null;
  description?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  campaignId: string | null;
  isGlobal: boolean;
  module?: string | null;
  templateKey?: string | null;
  isSystem?: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  campaign?: { id: string; name: string } | null;
}): ParsedEmailTemplate {
  const meta = extractEmailTemplateMetadata(row.body);
  const hasColumnMetadata = Boolean(
    row.type ||
      row.layout ||
      row.bodyFormat ||
      row.description ||
      row.ctaText ||
      row.ctaUrl ||
      !/\[\[(CTA_TEXT|CTA_URL|LAYOUT|TYPE|DESCRIPTION|BODY_FORMAT)=/i.test(row.body),
  );

  const type = row.type ?? parseType(meta.type);
  const layout = row.layout ?? parseLayout(meta.layout);
  const bodyFormat = row.bodyFormat ? parseBodyFormat(row.bodyFormat) : parseBodyFormat(meta.bodyFormat);
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
    bodyFormat,
    layout,
    type,
    module: row.module ?? "LEADS",
    templateKey: row.templateKey ?? null,
    isSystem: row.isSystem ?? false,
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
  options?: { campaignId?: string; type?: string },
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

const DEFAULT_EMAIL_TEMPLATE_LIST_LIMIT = 200;

export async function listParsedEmailTemplates(
  db: any,
  workspaceId: string,
  options?: {
    campaignId?: string;
    forOutbound?: boolean;
    type?: string;
    module?: string;
    search?: string;
    take?: number;
  },
): Promise<ParsedEmailTemplate[]> {
  const useCampaignScope = Boolean(options?.forOutbound || options?.campaignId);
  const moduleFilter = options?.module ? { module: options.module } : {};
  const search = options?.search?.trim();
  const baseWhere = useCampaignScope
    ? buildOutboundTemplateWhere(workspaceId, {
        campaignId: options?.campaignId,
        type: options?.type,
      })
    : {
        createdById: workspaceId,
        ...(options?.type ? { type: options.type } : {}),
        ...moduleFilter,
      };
  const where = search
    ? {
        AND: [
          baseWhere,
          {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { subject: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { body: { contains: search, mode: "insensitive" } },
            ],
          },
        ],
      }
    : baseWhere;

  const take = Math.min(Math.max(options?.take ?? DEFAULT_EMAIL_TEMPLATE_LIST_LIMIT, 1), 500);

  const rows = await db.emailTemplate.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take,
    include: { campaign: { select: { id: true, name: true } } },
  });

  return rows.map(parseTemplateRow);
}
