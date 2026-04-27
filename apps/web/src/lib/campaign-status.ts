export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Concept",
  ACTIVE: "Actief",
  PAUSED: "Gepauzeerd",
  COMPLETED: "Voltooid",
  ARCHIVED: "Gearchiveerd",
};

export function getCampaignStatusVariant(status: string) {
  switch (status) {
    case "ACTIVE":
      return "success" as const;
    case "PAUSED":
      return "warning" as const;
    case "COMPLETED":
      return "info" as const;
    case "ARCHIVED":
      return "outline" as const;
    case "DRAFT":
    default:
      return "secondary" as const;
  }
}

export const CAMPAIGN_STATUS_FILTERS = [
  { key: undefined as string | undefined, label: "Alle" },
  { key: "DRAFT", label: CAMPAIGN_STATUS_LABELS.DRAFT },
  { key: "ACTIVE", label: CAMPAIGN_STATUS_LABELS.ACTIVE },
  { key: "PAUSED", label: CAMPAIGN_STATUS_LABELS.PAUSED },
  { key: "COMPLETED", label: "Afgerond" },
] as const;
