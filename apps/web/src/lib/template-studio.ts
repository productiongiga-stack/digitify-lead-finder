import type { EmailLayout } from "@/lib/email-content";

export type TemplateType =
  | "OUTREACH"
  | "FOLLOW_UP"
  | "PROPOSAL"
  | "REPORT"
  | "BOOKING"
  | "REVIEW"
  | "REENGAGEMENT"
  | "CUSTOM";

export const TEMPLATE_TYPES: Array<{
  id: TemplateType;
  label: string;
  description: string;
}> = [
  { id: "OUTREACH", label: "Eerste contact", description: "Introductie en kennismaking" },
  { id: "FOLLOW_UP", label: "Follow-up", description: "Opvolging na eerdere mail" },
  { id: "PROPOSAL", label: "Offerte", description: "Voorstel, prijs en CTA naar offerte" },
  { id: "REPORT", label: "Rapport", description: "Analyse of audit delen" },
  { id: "BOOKING", label: "Afspraak", description: "Bevestiging of uitnodiging" },
  { id: "REVIEW", label: "Review", description: "Vraag om feedback" },
  { id: "REENGAGEMENT", label: "Heractivatie", description: "Inactieve leads opnieuw benaderen" },
  { id: "CUSTOM", label: "Custom", description: "Vrij template voor eigen flow" },
];

export const LAYOUT_CATALOG: Array<{
  id: EmailLayout;
  label: string;
  description: string;
  accent: string;
  bestFor: TemplateType[];
}> = [
  {
    id: "modern",
    label: "Modern",
    description: "Gradient header, warme premium look",
    accent: "from-amber-500 to-orange-600",
    bestFor: ["OUTREACH", "CUSTOM"],
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Rustig, veel witruimte, focus op tekst",
    accent: "from-slate-400 to-slate-600",
    bestFor: ["FOLLOW_UP", "REVIEW", "REENGAGEMENT"],
  },
  {
    id: "business",
    label: "Business",
    description: "Zakelijk met sterke header en structuur",
    accent: "from-blue-600 to-indigo-700",
    bestFor: ["REPORT", "BOOKING"],
  },
  {
    id: "proposal",
    label: "Proposal",
    description: "Offerte-stijl met highlight-blok",
    accent: "from-emerald-500 to-teal-600",
    bestFor: ["PROPOSAL"],
  },
  {
    id: "followup",
    label: "Follow-up",
    description: "Compact, direct en actiegericht",
    accent: "from-violet-500 to-purple-600",
    bestFor: ["FOLLOW_UP", "REENGAGEMENT"],
  },
];

export function templateTypeLabel(type: TemplateType | string | undefined) {
  return TEMPLATE_TYPES.find((entry) => entry.id === type)?.label || type || "Custom";
}
