import { getStatusBadgeVariant } from "@/lib/utils";

export const LEAD_STATUS_OPTIONS = [
  { value: "NEW", label: "Nieuw" },
  { value: "RESEARCHING", label: "Onderzoek" },
  { value: "CONTACTED", label: "Gecontacteerd" },
  { value: "RESPONDED", label: "Gereageerd" },
  { value: "QUALIFIED", label: "Gekwalificeerd" },
  { value: "PROPOSAL_SENT", label: "Voorstel verstuurd" },
  { value: "WON", label: "Gewonnen" },
  { value: "LOST", label: "Verloren" },
  { value: "ARCHIVED", label: "Gearchiveerd" },
] as const;

export const LEAD_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  LEAD_STATUS_OPTIONS.map((option) => [option.value, option.label]),
);

export const LEAD_PRIORITY_OPTIONS = [
  { value: "Hot", label: "Heet" },
  { value: "Warm", label: "Warm" },
  { value: "Low", label: "Laag" },
] as const;

const LEAD_PRIORITY_LABELS: Record<string, string> = Object.fromEntries(
  LEAD_PRIORITY_OPTIONS.map((option) => [option.value, option.label]),
);

export function getLeadStatusLabel(status: string | null | undefined): string {
  if (!status) return "Onbekend";
  return LEAD_STATUS_LABELS[status] ?? status;
}

export function getLeadStatusBadgeVariant(status: string) {
  return getStatusBadgeVariant(status);
}

export function getLeadStatusDotClass(status: string | null | undefined): string {
  switch (status) {
    case "NEW":
      return "bg-blue-500";
    case "RESEARCHING":
      return "bg-slate-400";
    case "CONTACTED":
      return "bg-amber-500";
    case "RESPONDED":
      return "bg-emerald-500";
    case "QUALIFIED":
      return "bg-teal-500";
    case "PROPOSAL_SENT":
      return "bg-indigo-500";
    case "WON":
      return "bg-green-600";
    case "LOST":
      return "bg-red-500";
    case "ARCHIVED":
      return "bg-slate-500";
    default:
      return "bg-slate-300";
  }
}

export function getLeadPriorityBadgeVariant(priority: string | null | undefined) {
  switch (priority) {
    case "Hot":
      return "destructive" as const;
    case "Warm":
      return "warning" as const;
    default:
      return "secondary" as const;
  }
}

export function getLeadPriorityLabel(priority: string | null | undefined): string {
  if (!priority) return "Geen prioriteit";
  return LEAD_PRIORITY_LABELS[priority] ?? priority;
}
