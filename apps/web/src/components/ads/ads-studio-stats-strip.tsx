"use client";

import type { LucideIcon } from "lucide-react";
import { BarChart3, CheckCircle2, Link2, Percent, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type AdsStudioStatItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  primary: string;
  secondary?: string;
  connected?: boolean;
};

const STRIP_SHELL = {
  meta: "border-[#1877F2]/15 bg-gradient-to-r from-slate-50/95 via-white to-blue-50/40 shadow-sm dark:from-slate-900/70 dark:via-slate-950 dark:to-blue-950/25",
  google:
    "border-[#4285F4]/15 bg-gradient-to-r from-slate-50/95 via-white to-emerald-50/35 shadow-sm dark:from-slate-900/70 dark:via-slate-950 dark:to-emerald-950/20",
} as const;

const ICON_WRAP = {
  meta: "bg-[#1877F2]/10 text-[#1877F2] dark:bg-[#1877F2]/18",
  google: "bg-[#4285F4]/10 text-[#4285F4] dark:bg-[#4285F4]/18",
} as const;

export function AdsStudioStatsStrip({
  studio,
  items,
}: {
  studio: "meta" | "google";
  items: AdsStudioStatItem[];
}) {
  return (
    <div
      className={cn(
        "grid gap-2 rounded-2xl border p-2 sm:grid-cols-3 sm:gap-px sm:p-px",
        STRIP_SHELL[studio],
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const StatusIcon =
          item.connected === true ? CheckCircle2 : item.connected === false ? XCircle : null;

        return (
          <div
            key={item.id}
            className="flex min-w-0 items-center gap-2.5 rounded-[calc(1rem-2px)] bg-background/85 px-3 py-2.5 sm:rounded-none sm:rounded-[calc(1rem-3px)] sm:py-3 dark:bg-slate-950/70"
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                ICON_WRAP[studio],
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold leading-tight">
                {StatusIcon ? (
                  <StatusIcon
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      item.connected ? "text-emerald-600" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                ) : null}
                <span className="truncate">{item.primary}</span>
              </p>
              {item.secondary ? (
                <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{item.secondary}</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const adsStudioStatIcons = {
  connection: Link2,
  performance: Percent,
  insights: BarChart3,
} as const;
