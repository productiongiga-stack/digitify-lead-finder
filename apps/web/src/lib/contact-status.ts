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
  APPROVED: "Goedgekeurd",
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
