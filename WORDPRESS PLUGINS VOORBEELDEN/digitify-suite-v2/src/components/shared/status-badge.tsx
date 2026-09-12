import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  // Contact
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  INACTIVE: "bg-gray-50 text-gray-600 border-gray-200",
  ARCHIVED: "bg-gray-50 text-gray-500 border-gray-200",

  // Lead
  NEW: "bg-blue-50 text-blue-700 border-blue-200",
  CONTACTED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  QUALIFIED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  UNQUALIFIED: "bg-gray-50 text-gray-600 border-gray-200",
  CONVERTED: "bg-violet-50 text-violet-700 border-violet-200",
  LOST: "bg-red-50 text-red-700 border-red-200",

  // Quote
  DRAFT: "bg-gray-50 text-gray-600 border-gray-200",
  SENT: "bg-blue-50 text-blue-700 border-blue-200",
  VIEWED: "bg-amber-50 text-amber-700 border-amber-200",
  ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DECLINED: "bg-red-50 text-red-700 border-red-200",
  EXPIRED: "bg-orange-50 text-orange-600 border-orange-200",
  INVOICED: "bg-violet-50 text-violet-700 border-violet-200",

  // Invoice
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  OVERDUE: "bg-red-50 text-red-700 border-red-200",
  VOID: "bg-gray-50 text-gray-500 border-gray-200",

  // Booking
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  COMPLETED: "bg-gray-50 text-gray-600 border-gray-200",
  NOSHOW: "bg-red-50 text-red-600 border-red-200",

  // Task
  TODO: "bg-gray-50 text-gray-600 border-gray-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  DONE: "bg-emerald-50 text-emerald-700 border-emerald-200",

  // Configurator
  PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Actief",
  INACTIVE: "Inactief",
  ARCHIVED: "Gearchiveerd",
  NEW: "Nieuw",
  CONTACTED: "Gecontacteerd",
  QUALIFIED: "Gekwalificeerd",
  UNQUALIFIED: "Niet gekwalificeerd",
  CONVERTED: "Geconverteerd",
  LOST: "Verloren",
  DRAFT: "Concept",
  SENT: "Verzonden",
  VIEWED: "Bekeken",
  ACCEPTED: "Goedgekeurd",
  DECLINED: "Afgewezen",
  EXPIRED: "Verlopen",
  INVOICED: "Gefactureerd",
  PAID: "Betaald",
  OVERDUE: "Verlopen",
  VOID: "Geannuleerd",
  PENDING: "In afwachting",
  CONFIRMED: "Bevestigd",
  CANCELLED: "Geannuleerd",
  COMPLETED: "Afgerond",
  NOSHOW: "Niet verschenen",
  TODO: "Te doen",
  IN_PROGRESS: "Bezig",
  DONE: "Klaar",
  PUBLISHED: "Gepubliceerd",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colors = statusColors[status] ?? "bg-gray-50 text-gray-600 border-gray-200";
  const label = statusLabels[status] ?? status;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        colors,
        className
      )}
    >
      {label}
    </span>
  );
}
