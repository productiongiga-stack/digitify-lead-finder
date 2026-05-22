import { Clock, FileEdit, Send, ShieldCheck, type LucideIcon } from "lucide-react";

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info";

export const OUTBOUND_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Concept",
  PENDING_APPROVAL: "Wacht op goedkeuring",
  APPROVED: "Klaar om te verzenden",
  REJECTED: "Afgekeurd",
  SCHEDULED: "Ingepland",
  SENDING: "Wordt verzonden",
  SENT: "Verzonden",
  FAILED: "Mislukt",
  BOUNCED: "Gebounced",
};

export const OUTBOUND_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  DRAFT: "secondary",
  PENDING_APPROVAL: "warning",
  APPROVED: "info",
  REJECTED: "destructive",
  SCHEDULED: "outline",
  SENDING: "info",
  SENT: "success",
  FAILED: "destructive",
  BOUNCED: "destructive",
};

export const OUTBOUND_STATUS_OPTIONS = [
  { value: "DRAFT", label: OUTBOUND_STATUS_LABELS.DRAFT },
  { value: "PENDING_APPROVAL", label: OUTBOUND_STATUS_LABELS.PENDING_APPROVAL },
  { value: "APPROVED", label: OUTBOUND_STATUS_LABELS.APPROVED },
  { value: "REJECTED", label: OUTBOUND_STATUS_LABELS.REJECTED },
  { value: "SCHEDULED", label: OUTBOUND_STATUS_LABELS.SCHEDULED },
  { value: "SENDING", label: OUTBOUND_STATUS_LABELS.SENDING },
  { value: "SENT", label: OUTBOUND_STATUS_LABELS.SENT },
  { value: "FAILED", label: OUTBOUND_STATUS_LABELS.FAILED },
  { value: "BOUNCED", label: OUTBOUND_STATUS_LABELS.BOUNCED },
] as const;

/** KPI cards on Outbound Center — same labels as badges */
export const OUTBOUND_STAT_CARD_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SENT",
  "FAILED",
] as const;

export type OutboundStatCardStatus = (typeof OUTBOUND_STAT_CARD_STATUSES)[number];

export function getOutboundStatusLabel(status: string) {
  return OUTBOUND_STATUS_LABELS[status] ?? status;
}

export const SEND_OUTBOUND_TOOLTIP =
  "Verstuurt via SMTP. Goedkeuren zet de mail alleen op “Klaar om te verzenden” — dat is nog geen verzending.";

export const OUTBOUND_FLOW_SUMMARY =
  "Concept → goedkeuren (niet verzenden) → Verzenden via SMTP.";

export function getSendButtonLabel(status: string, isPending = false) {
  if (isPending) return "Verzenden...";
  if (status === "FAILED") return "Opnieuw verzenden";
  return "Verzenden";
}

export function formatWorkqueueSummary(stats: {
  pending: number;
  approved: number;
  failed: number;
}) {
  return `${stats.pending} ${OUTBOUND_STATUS_LABELS.PENDING_APPROVAL!.toLowerCase()} · ${stats.approved} ${OUTBOUND_STATUS_LABELS.APPROVED!.toLowerCase()} · ${stats.failed} ${OUTBOUND_STATUS_LABELS.FAILED!.toLowerCase()}`;
}

export function getOutboundNextActionHint(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Werk inhoud af en dien in ter goedkeuring.";
    case "PENDING_APPROVAL":
      return `${OUTBOUND_STATUS_LABELS.PENDING_APPROVAL}. Goedkeuren verstuurt de mail nog niet.`;
    case "APPROVED":
      return `${OUTBOUND_STATUS_LABELS.APPROVED} — klik Verzenden om de mail via SMTP te versturen.`;
    case "SENT":
      return "Volg de reactie op en plan indien nodig een opvolgmail.";
    case "FAILED":
    case "BOUNCED":
      return "Controleer foutmelding en probeer opnieuw te verzenden.";
    case "REJECTED":
      return `${OUTBOUND_STATUS_LABELS.REJECTED}. Pas de inhoud aan en dien opnieuw in.`;
    default:
      return "Controleer deze draft en bepaal de volgende stap.";
  }
}

export function getApprovedNotSentBanner() {
  return {
    title: `${OUTBOUND_STATUS_LABELS.APPROVED} — nog niet verzonden`,
    detail: (approvedAtLabel: string) =>
      `Beoordeeld op ${approvedAtLabel}. Gebruik de knop Verzenden om de mail te versturen.`,
  };
}

export type OutboundTimelineStep = {
  key: string;
  label: string;
  icon: LucideIcon;
};

export const OUTBOUND_TIMELINE_STEPS: OutboundTimelineStep[] = [
  { key: "DRAFT", label: "Aangemaakt", icon: FileEdit },
  { key: "PENDING_APPROVAL", label: "Ingediend", icon: Clock },
  { key: "APPROVED_OR_REJECTED", label: "Beoordeeld", icon: ShieldCheck },
  { key: "SENT", label: "Verzonden", icon: Send },
];

export function getOutboundTimelineStatus(draftStatus: string): { activeIndex: number; rejected: boolean } {
  switch (draftStatus) {
    case "DRAFT":
      return { activeIndex: 0, rejected: false };
    case "PENDING_APPROVAL":
      return { activeIndex: 1, rejected: false };
    case "REJECTED":
      return { activeIndex: 2, rejected: true };
    case "APPROVED":
    case "SCHEDULED":
      return { activeIndex: 2, rejected: false };
    case "SENDING":
    case "SENT":
    case "FAILED":
    case "BOUNCED":
      return { activeIndex: 3, rejected: false };
    default:
      return { activeIndex: 0, rejected: false };
  }
}

export function canSendOutboundDraft(status: string) {
  return status === "APPROVED" || status === "FAILED";
}
