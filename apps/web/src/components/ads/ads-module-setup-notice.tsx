"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { Badge } from "@digitify/ui";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export type AdsModuleSetupTone = "amber" | "emerald" | "meta";

const TONE_STYLES: Record<
  AdsModuleSetupTone,
  {
    shell: string;
    header: string;
    icon: string;
    title: string;
    badge: string;
    panel: string;
    accentCard: string;
    mutedCard: string;
    cta: string;
    outlineBtn: string;
  }
> = {
  amber: {
    shell: "border-amber-200/70 dark:border-amber-900/50",
    header:
      "border-amber-200/50 bg-gradient-to-r from-amber-50/90 via-amber-50/40 to-transparent dark:border-amber-900/40 dark:from-amber-950/40",
    icon: "bg-amber-500",
    title: "text-amber-950 dark:text-amber-50",
    badge: "border-amber-300/60 bg-white/60 text-amber-900 dark:bg-white/5 dark:text-amber-100",
    panel: "border-amber-200/50 dark:border-amber-900/40",
    accentCard: "border-amber-100/80 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-950/20",
    mutedCard: "border-amber-100/40 bg-muted/20",
    cta: "bg-amber-600 hover:bg-amber-700",
    outlineBtn: "border-amber-200/80 bg-background/80",
  },
  emerald: {
    shell: "border-emerald-200/70 dark:border-emerald-900/50",
    header:
      "border-emerald-200/50 bg-gradient-to-r from-emerald-50/90 via-emerald-50/40 to-transparent dark:border-emerald-900/40 dark:from-emerald-950/40",
    icon: "bg-emerald-600",
    title: "text-emerald-950 dark:text-emerald-50",
    badge: "border-emerald-300/60 bg-white/60 text-emerald-900 dark:bg-white/5 dark:text-emerald-100",
    panel: "border-emerald-200/50 dark:border-emerald-900/40",
    accentCard: "border-emerald-100/80 bg-emerald-50/30 dark:border-emerald-900/30 dark:bg-emerald-950/20",
    mutedCard: "border-emerald-100/40 bg-muted/20",
    cta: "bg-emerald-700 hover:bg-emerald-800",
    outlineBtn: "border-emerald-200/80 bg-background/80",
  },
  meta: {
    shell: "border-[#1877F2]/20 dark:border-[#1877F2]/30",
    header:
      "border-[#1877F2]/15 bg-[#1877F2]/[0.06] dark:border-[#1877F2]/25 dark:bg-[#1877F2]/10",
    icon: "bg-[#1877F2] shadow-sm ring-2 ring-white/60 dark:ring-white/10",
    title: "text-slate-900 dark:text-slate-50",
    badge:
      "border-[#1877F2]/25 bg-white/70 text-[#166FE5] dark:border-[#1877F2]/35 dark:bg-[#1877F2]/10 dark:text-[#8CB4FF]",
    panel: "border-[#1877F2]/10 dark:border-[#1877F2]/25",
    accentCard: "border-[#1877F2]/15 bg-[#1877F2]/[0.05] dark:border-[#1877F2]/25 dark:bg-[#1877F2]/10",
    mutedCard: "border-border/60 bg-muted/15",
    cta: "bg-[#1877F2] shadow-sm hover:bg-[#166FE5]",
    outlineBtn: "border-[#1877F2]/20 bg-background/80 hover:bg-[#1877F2]/5 dark:border-[#1877F2]/30",
  },
};

export function adsModuleSetupToneStyles(tone: AdsModuleSetupTone) {
  return TONE_STYLES[tone];
}

export function AdsModuleSetupNotice({
  tone,
  icon: Icon,
  title,
  badge,
  summary,
  headerAction,
  children,
  defaultOpen = false,
}: {
  tone: AdsModuleSetupTone;
  icon: ComponentType<{ className?: string }>;
  title: string;
  badge: string;
  summary: string;
  headerAction?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toneStyles = TONE_STYLES[tone];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card/90 backdrop-blur-sm",
        toneStyles.shell,
      )}
    >
      <div className={cn("relative flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3", toneStyles.header)}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left sm:gap-3"
        >
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white sm:h-10 sm:w-10",
              toneStyles.icon,
            )}
          >
            <Icon className="h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className={cn("text-sm font-semibold tracking-tight sm:text-[15px]", toneStyles.title)}>{title}</p>
              <Badge variant="outline" className={cn("text-[10px] font-medium", toneStyles.badge)}>
                {badge}
              </Badge>
            </div>
            {!open ? <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground sm:text-[13px]">{summary}</p> : null}
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground/80 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
        {!open && headerAction ? <div className="relative hidden shrink-0 sm:block">{headerAction}</div> : null}
      </div>

      {open ? (
        <div className={cn("relative space-y-4 border-t px-4 pb-4 pt-3.5", toneStyles.panel)}>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{summary}</p>
          {children}
          {headerAction ? <div className="sm:hidden">{headerAction}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
