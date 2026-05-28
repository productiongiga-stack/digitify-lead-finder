import * as React from "react";
import { cn } from "../lib/utils";
import { Card } from "./card";

export interface StatItem {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  delta?: React.ReactNode;
  tone?: "neutral" | "positive" | "negative" | "warning" | "info";
  hint?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  href?: string;
}

const toneTextClass: Record<NonNullable<StatItem["tone"]>, string> = {
  neutral: "text-muted-foreground",
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-blue-600 dark:text-blue-400",
};

const toneIconClass: Record<NonNullable<StatItem["tone"]>, string> = {
  neutral: "bg-slate-100 text-slate-600 ring-slate-200/80 dark:bg-slate-900/50 dark:text-slate-300 dark:ring-slate-700/60",
  positive:
    "bg-emerald-100 text-emerald-700 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/50",
  negative: "bg-red-100 text-red-700 ring-red-200/80 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900/50",
  warning:
    "bg-amber-100 text-amber-700 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50",
  info: "bg-blue-100 text-blue-700 ring-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/50",
};

const toneCardClass: Record<NonNullable<StatItem["tone"]>, string> = {
  neutral: "border-border/55 bg-gradient-to-br from-card via-card/95 to-muted/20",
  positive: "border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 via-card to-card dark:border-emerald-900/40 dark:from-emerald-950/25",
  negative: "border-red-200/70 bg-gradient-to-br from-red-50/70 via-card to-card dark:border-red-900/40 dark:from-red-950/20",
  warning: "border-amber-200/70 bg-gradient-to-br from-amber-50/75 via-card to-card dark:border-amber-900/40 dark:from-amber-950/20",
  info: "border-blue-200/70 bg-gradient-to-br from-blue-50/75 via-card to-card dark:border-blue-900/40 dark:from-blue-950/20",
};

export interface StatsCardsProps extends React.HTMLAttributes<HTMLDivElement> {
  items: StatItem[];
  columns?: 2 | 3 | 4 | 5 | 6;
  loading?: boolean;
  variant?: "default" | "rich";
}

export function StatsCards({
  items,
  columns = 4,
  loading,
  variant = "default",
  className,
  ...props
}: StatsCardsProps) {
  const gridCols: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
    6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
  };

  const rich = variant === "rich";

  return (
    <div className={cn("grid gap-3", gridCols[columns], className)} {...props}>
      {items.map((item, i) => {
        const interactive = item.onClick || item.href;
        const tone = item.tone ?? "neutral";
        const Inner = (
          <Card
            className={cn(
              "min-w-0 shadow-sm transition-all duration-200",
              rich ? cn("p-4", toneCardClass[tone]) : "p-3 sm:p-4",
              interactive && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
              interactive && !rich && "hover:border-primary/25 hover:bg-accent/35",
              interactive && rich && "hover:border-primary/30",
              item.active && "ring-2 ring-primary/25 border-primary/40 shadow-md",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <p
                className={cn(
                  "min-w-0 font-medium leading-snug text-muted-foreground",
                  rich ? "text-xs normal-case tracking-normal" : "truncate text-[10px] uppercase tracking-wide sm:text-[11px]",
                )}
              >
                {item.label}
              </p>
              {item.icon ? (
                <span
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-xl ring-1 [&_svg]:h-4 [&_svg]:w-4",
                    rich ? cn("h-10 w-10", toneIconClass[tone]) : "h-8 w-8 bg-muted/60 text-muted-foreground",
                  )}
                >
                  {item.icon}
                </span>
              ) : null}
            </div>
            <p className="mt-2.5 text-xl font-bold leading-tight tracking-tight sm:text-2xl">{loading ? <span className="inline-block h-5 w-12 animate-pulse rounded bg-muted" /> : item.value}</p>
            {item.delta || item.hint ? (
              <p className={cn("mt-1 line-clamp-2 text-[11px] leading-snug", toneTextClass[tone])}>
                {item.delta}
                {item.delta && item.hint ? " · " : null}
                {item.hint ? <span className="text-muted-foreground">{item.hint}</span> : null}
              </p>
            ) : null}
          </Card>
        );
        if (item.href) {
          return (
            <a key={i} href={item.href} className="block">
              {Inner}
            </a>
          );
        }
        if (item.onClick) {
          return (
            <button key={i} type="button" onClick={item.onClick} className="text-left">
              {Inner}
            </button>
          );
        }
        return <React.Fragment key={i}>{Inner}</React.Fragment>;
      })}
    </div>
  );
}
