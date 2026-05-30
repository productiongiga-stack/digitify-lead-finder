import type { Activity, EmailDraft, Prisma } from "@digitify/db";

export type LeadEmailTimelineItem = {
  id: string;
  at: string;
  direction: "inbound" | "outbound";
  channel: string;
  subject: string;
  counterparty: string;
  status: string;
  bodyPreview: string | null;
  draftId: string | null;
  messageId: string | null;
  activityType: string | null;
};

const EMAIL_ACTIVITY_TYPES = [
  "EMAIL_DRAFTED",
  "EMAIL_APPROVED",
  "EMAIL_SENT",
  "EMAIL_OPENED",
  "EMAIL_REPLIED",
  "QUOTE_SENT",
] as const;

function readMeta(metadata: Prisma.JsonValue | null | undefined) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {} as Record<string, unknown>;
  return metadata as Record<string, unknown>;
}

function directionFromActivity(type: string, metadata: Record<string, unknown>): "inbound" | "outbound" {
  if (metadata.direction === "inbound") return "inbound";
  if (metadata.direction === "outbound") return "outbound";
  if (type === "EMAIL_REPLIED") return "inbound";
  return "outbound";
}

function statusLabel(type: string, draftStatus?: string) {
  if (draftStatus) {
    switch (draftStatus) {
      case "SENT":
        return "Verzonden";
      case "DRAFT":
        return "Concept";
      case "FAILED":
        return "Mislukt";
      case "SENDING":
        return "Bezig met verzenden";
      default:
        return draftStatus;
    }
  }
  switch (type) {
    case "EMAIL_SENT":
    case "QUOTE_SENT":
      return "Verzonden";
    case "EMAIL_DRAFTED":
      return "Concept aangemaakt";
    case "EMAIL_APPROVED":
      return "Goedgekeurd";
    case "EMAIL_OPENED":
      return "Geopend";
    case "EMAIL_REPLIED":
      return "Ontvangen";
    default:
      return type;
  }
}

export function buildLeadEmailTimeline(input: {
  activities: Array<
    Pick<Activity, "id" | "type" | "title" | "metadata" | "createdAt"> & {
      user?: { name: string | null } | null;
    }
  >;
  drafts: Array<
    Pick<EmailDraft, "id" | "subject" | "toEmail" | "body" | "status" | "sentAt" | "createdAt" | "messageId" | "type">
  >;
}): LeadEmailTimelineItem[] {
  const items: LeadEmailTimelineItem[] = [];
  const seenDraftIds = new Set<string>();

  for (const activity of input.activities) {
    if (!EMAIL_ACTIVITY_TYPES.includes(activity.type as (typeof EMAIL_ACTIVITY_TYPES)[number])) continue;
    const meta = readMeta(activity.metadata);
    const draftId = typeof meta.draftId === "string" ? meta.draftId : null;
    if (draftId) seenDraftIds.add(draftId);

    const direction = directionFromActivity(activity.type, meta);
    items.push({
      id: `activity-${activity.id}`,
      at: activity.createdAt.toISOString(),
      direction,
      channel: typeof meta.channel === "string" ? meta.channel : "crm",
      subject: typeof meta.subject === "string" ? meta.subject : activity.title,
      counterparty:
        direction === "inbound"
          ? typeof meta.from === "string"
            ? meta.from
            : "Onbekende afzender"
          : typeof meta.to === "string"
            ? meta.to
            : "Onbekende ontvanger",
      status: statusLabel(activity.type),
      bodyPreview: typeof meta.bodyPreview === "string" ? meta.bodyPreview : null,
      draftId,
      messageId: typeof meta.messageId === "string" ? meta.messageId : null,
      activityType: activity.type,
    });
  }

  for (const draft of input.drafts) {
    if (seenDraftIds.has(draft.id)) continue;
    const at = (draft.sentAt || draft.createdAt).toISOString();
    items.push({
      id: `draft-${draft.id}`,
      at,
      direction: "outbound",
      channel: draft.type === "QUOTE" ? "offerte" : "outbound",
      subject: draft.subject,
      counterparty: draft.toEmail,
      status: statusLabel("EMAIL_DRAFTED", draft.status),
      bodyPreview: draft.body.slice(0, 280),
      draftId: draft.id,
      messageId: draft.messageId,
      activityType: null,
    });
  }

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
