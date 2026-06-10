import type { LucideIcon } from "lucide-react";
import { Shield, ShieldAlert, ShieldOff, ShieldQuestion } from "lucide-react";

export const DOMAIN_STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  ACTIVE: { label: "Actief", variant: "default" },
  EXPIRING: { label: "Verloopt binnenkort", variant: "secondary" },
  EXPIRED: { label: "Verlopen", variant: "destructive" },
  TRANSFERRED: { label: "Overgedragen", variant: "outline" },
};

export const DOMAIN_SSL_MAP: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  VALID: { label: "Geldig", icon: Shield, color: "text-emerald-600 dark:text-emerald-400" },
  EXPIRED: { label: "Verlopen", icon: ShieldAlert, color: "text-red-600 dark:text-red-400" },
  NONE: { label: "Geen", icon: ShieldOff, color: "text-muted-foreground" },
  UNKNOWN: { label: "Onbekend", icon: ShieldQuestion, color: "text-muted-foreground" },
};

export const WEBSITE_STATUS_LABEL: Record<string, string> = {
  online: "Online",
  slow: "Traag",
  offline: "Offline",
  unknown: "Onbekend",
};

export function formatDomainDate(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDomainDateTime(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("nl-BE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysUntilExpiry(expiresAt?: string | Date | null) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}
