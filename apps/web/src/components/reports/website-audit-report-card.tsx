"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
} from "@digitify/ui";
import { Calendar, Globe, Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function hostnameFromAuditUrl(raw: string) {
  try {
    const normalized = raw.startsWith("http") ? raw : `https://${raw}`;
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return raw.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] || raw;
  }
}

function faviconUrlForHost(hostname: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
}

function formatPagesIssueLine(pagesChecked: number, pagesBroken: number) {
  const broken = pagesBroken ?? 0;
  if (broken === 0) return `${pagesChecked} pagina${pagesChecked === 1 ? "" : "'s"} · geen problemen`;
  if (broken === 1) return `${pagesChecked} pagina${pagesChecked === 1 ? "" : "'s"} · 1 probleem`;
  return `${pagesChecked} pagina${pagesChecked === 1 ? "" : "'s"} · ${broken} problemen`;
}

function scoreStyles(score: number) {
  if (score >= 75) {
    return {
      ring: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10 ring-emerald-500/20",
      label: "text-emerald-800 dark:text-emerald-200",
    };
  }
  if (score >= 50) {
    return {
      ring: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10 ring-amber-500/20",
      label: "text-amber-900 dark:text-amber-100",
    };
  }
  return {
    ring: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10 ring-red-500/20",
    label: "text-red-800 dark:text-red-200",
  };
}

function MiniScoreRing({ score }: { score: number }) {
  const styles = scoreStyles(score);
  const radius = 18;
  const size = 44;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, score));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={cn("relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1", styles.bg)}
      aria-label={`Score ${clamped}`}
    >
      <svg className="absolute inset-0 h-11 w-11 -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          className="text-muted/30"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={styles.ring}
        />
      </svg>
      <span className={cn("relative text-sm font-bold tabular-nums leading-none", styles.label)}>{clamped}</span>
    </div>
  );
}

export type WebsiteAuditReportCardProps = {
  id: string;
  title: string;
  createdAt: string | Date;
  data: {
    url?: string;
    metrics?: { overall?: number; speedScore?: number };
    checks?: { ux?: { pagesBroken?: number; pagesChecked?: number } };
  };
  onOpen: () => void;
  onDelete: () => void;
};

export function WebsiteAuditReportCard({
  title,
  createdAt,
  data,
  onOpen,
  onDelete,
}: WebsiteAuditReportCardProps) {
  const displayUrl = data.url ?? title;
  const hostname = hostnameFromAuditUrl(displayUrl);
  const overall = data.metrics?.overall;
  const [faviconFailed, setFaviconFailed] = useState(false);
  const dateLabel = new Date(createdAt).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Card
      className="reports-audit-card group cursor-pointer overflow-hidden transition-all hover:border-primary/30 hover:shadow-md"
      onClick={onOpen}
    >
      <div className="flex gap-3 p-3.5 sm:p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/30 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          {!faviconFailed ? (
            <img
              src={faviconUrlForHost(hostname)}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
              loading="lazy"
              decoding="async"
              onError={() => setFaviconFailed(true)}
            />
          ) : (
            <Globe className="h-5 w-5 text-muted-foreground/80" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight text-foreground">{hostname}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                <span>Website audit</span>
                <span className="text-border">·</span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {dateLabel}
                </span>
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 opacity-60 transition hover:text-destructive group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label="Audit verwijderen"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {overall != null ? <MiniScoreRing score={overall} /> : null}
            <div className="min-w-0 flex-1 space-y-1">
              {overall != null ? (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Totaalscore</p>
              ) : (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  Geen score
                </Badge>
              )}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                {data.metrics?.speedScore != null ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-900 dark:text-amber-100">
                    <Zap className="h-3 w-3" />
                    Snelheid {data.metrics.speedScore}
                  </span>
                ) : null}
                {data.checks?.ux?.pagesChecked != null ? (
                  <span className="truncate">{formatPagesIssueLine(data.checks.ux.pagesChecked, data.checks.ux.pagesBroken ?? 0)}</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
