import type { EmailType, Prisma, PrismaClient } from "@digitify/db";

export const OUTBOUND_SOURCE_MODULES = [
  "campaign",
  "outbound",
  "quotes",
  "inbox",
  "reviews",
  "transactional",
] as const;

export type OutboundSourceModule = (typeof OUTBOUND_SOURCE_MODULES)[number];

export const EMAIL_TYPE_VALUES = [
  "LEAD_CONTACT",
  "QUOTE",
  "REPLY",
  "FOLLOW_UP",
  "REVIEW_REQUEST",
  "TRANSACTIONAL",
] as const;

export type OutboundEmailType = (typeof EMAIL_TYPE_VALUES)[number];

export function getOutboundSourceModule(draft: {
  sequenceId: string | null;
  type: EmailType | string;
}): OutboundSourceModule {
  if (draft.sequenceId) return "campaign";
  switch (draft.type) {
    case "QUOTE":
      return "quotes";
    case "REVIEW_REQUEST":
      return "reviews";
    case "REPLY":
      return "inbox";
    case "TRANSACTIONAL":
      return "transactional";
    case "FOLLOW_UP":
    case "LEAD_CONTACT":
    default:
      return "outbound";
  }
}

export function buildOutboundSourceModuleWhere(
  module: OutboundSourceModule,
): Prisma.EmailDraftWhereInput {
  switch (module) {
    case "campaign":
      return { sequenceId: { not: null } };
    case "quotes":
      return { sequenceId: null, type: "QUOTE" };
    case "reviews":
      return { sequenceId: null, type: "REVIEW_REQUEST" };
    case "inbox":
      return { sequenceId: null, type: "REPLY" };
    case "transactional":
      return { sequenceId: null, type: "TRANSACTIONAL" };
    case "outbound":
      return {
        sequenceId: null,
        type: { in: ["LEAD_CONTACT", "FOLLOW_UP"] },
      };
    default:
      return {};
  }
}

/** Legacy rows: SCHEDULED meant “planned” but must stay concept until approved. */
export async function normalizeLegacyScheduledDrafts(db: PrismaClient, workspaceId: string) {
  return db.emailDraft.updateMany({
    where: {
      status: "SCHEDULED",
      sentAt: null,
      lead: { createdById: workspaceId },
    },
    data: { status: "DRAFT" },
  });
}

export const RESCHEDULABLE_OUTBOUND_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SCHEDULED",
  "FAILED",
] as const;
