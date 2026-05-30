export type OutboundSourceModule =
  | "campaign"
  | "outbound"
  | "quotes"
  | "inbox"
  | "reviews"
  | "transactional";

export const OUTBOUND_SOURCE_MODULE_OPTIONS: Array<{
  value: OutboundSourceModule | "all";
  label: string;
}> = [
  { value: "all", label: "Alle modules" },
  { value: "campaign", label: "Campagneprofielen" },
  { value: "outbound", label: "Outbound Center" },
  { value: "quotes", label: "Offertes" },
  { value: "inbox", label: "Inbox" },
  { value: "reviews", label: "Reviews" },
  { value: "transactional", label: "Transactie" },
];

export const OUTBOUND_EMAIL_TYPE_OPTIONS = [
  { value: "all", label: "Alle mailtypes" },
  { value: "LEAD_CONTACT", label: "Lead contact" },
  { value: "FOLLOW_UP", label: "Opvolging" },
  { value: "QUOTE", label: "Offerte" },
  { value: "REPLY", label: "Antwoord" },
  { value: "REVIEW_REQUEST", label: "Reviewverzoek" },
  { value: "TRANSACTIONAL", label: "Transactie" },
] as const;

export const OUTBOUND_SOURCE_MODULE_LABELS: Record<OutboundSourceModule, string> = {
  campaign: "Campagneprofiel",
  outbound: "Outbound",
  quotes: "Offertes",
  inbox: "Inbox",
  reviews: "Reviews",
  transactional: "Transactie",
};

export const OUTBOUND_EMAIL_TYPE_LABELS: Record<string, string> = {
  LEAD_CONTACT: "Lead contact",
  FOLLOW_UP: "Opvolging",
  QUOTE: "Offerte",
  REPLY: "Antwoord",
  REVIEW_REQUEST: "Reviewverzoek",
  TRANSACTIONAL: "Transactie",
};

export function getOutboundSourceModuleLabel(module: string) {
  return OUTBOUND_SOURCE_MODULE_LABELS[module as OutboundSourceModule] ?? module;
}

export function getOutboundEmailTypeLabel(type: string) {
  return OUTBOUND_EMAIL_TYPE_LABELS[type] ?? type;
}
