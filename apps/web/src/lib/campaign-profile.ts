import type { LucideIcon } from "lucide-react";
import { MessageSquare, Star, Users } from "lucide-react";

export type CampaignProfileType = "LEAD_OUTREACH" | "REVIEW_REQUEST";

export const CAMPAIGN_PROFILE_OPTIONS: Array<{
  value: CampaignProfileType;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    value: "LEAD_OUTREACH",
    label: "Lead outreach",
    shortLabel: "Leads",
    description: "3-stappen e-maildrip naar leads: contact, opvolging en laatste bericht.",
    icon: Users,
  },
  {
    value: "REVIEW_REQUEST",
    label: "Review-aanvragen",
    shortLabel: "Reviews",
    description: "Automatische review-uitnodigingen in 3 stappen na afgerond werk.",
    icon: Star,
  },
];

export const CAMPAIGN_PROFILE_LABELS: Record<CampaignProfileType, string> = Object.fromEntries(
  CAMPAIGN_PROFILE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<CampaignProfileType, string>;

export function getCampaignProfileLabel(type: string | null | undefined): string {
  if (!type) return CAMPAIGN_PROFILE_LABELS.LEAD_OUTREACH;
  return CAMPAIGN_PROFILE_LABELS[type as CampaignProfileType] ?? type;
}

export function getDefaultDripModeForProfile(
  type: string | null | undefined,
): "lead" | "review" {
  return type === "REVIEW_REQUEST" ? "review" : "lead";
}

export function getAudienceSectionTitle(type: string | null | undefined): string {
  return type === "REVIEW_REQUEST"
    ? "Contacten in dit profiel"
    : "Leads in dit profiel";
}

export function isLeadOutreachProfile(type: string | null | undefined): boolean {
  return type !== "REVIEW_REQUEST";
}
