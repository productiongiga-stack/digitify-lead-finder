import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return "N/A";
  return Math.round(score).toString();
}

export function getScorePriorityColor(priority: string | null | undefined): string {
  switch (priority) {
    case "Hot":
      return "text-red-600 dark:text-red-400";
    case "Warm":
      return "text-amber-600 dark:text-amber-400";
    case "Low":
      return "text-slate-500 dark:text-slate-400";
    default:
      return "text-muted-foreground";
  }
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "text-red-600 dark:text-red-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  if (score >= 40) return "text-blue-600 dark:text-blue-400";
  return "text-slate-500 dark:text-slate-400";
}

export function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" {
  switch (status) {
    case "NEW":
      return "info";
    case "RESEARCHING":
      return "secondary";
    case "CONTACTED":
      return "warning";
    case "RESPONDED":
      return "success";
    case "QUALIFIED":
      return "success";
    case "PROPOSAL_SENT":
      return "default";
    case "WON":
      return "success";
    case "LOST":
      return "destructive";
    case "ARCHIVED":
      return "outline";
    default:
      return "secondary";
  }
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Returns a safe https/http URL string, or null if the value is missing or
 * uses a dangerous scheme (javascript:, data:, vbscript:, etc.).
 * Use this before setting any href from user-controlled data.
 */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
    return null;
  } catch {
    // Not a valid URL — try prepending https:// as a convenience
    try {
      const parsed = new URL(`https://${url.trim()}`);
      return parsed.toString();
    } catch {
      return null;
    }
  }
}

/** Same-origin relative paths only — blocks protocol-relative and open redirects. */
export function safeRelativeAppPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (/[\r\n\\]/.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed, "https://example.local");
    if (parsed.origin !== "https://example.local") return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Zojuist";
  if (diffMins < 60) return `${diffMins}m geleden`;
  if (diffHours < 24) return `${diffHours}u geleden`;
  if (diffDays < 7) return `${diffDays}d geleden`;
  return formatDate(date);
}
