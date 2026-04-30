import * as React from "react";
import { cn } from "../lib/utils";
import { Card } from "./card";

export interface StatItem {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  delta?: React.ReactNode;
  tone?: "neutral" | "positive" | "negative" | "warning";
  hint?: React.ReactNode;
  onClick?: () => void;
  href?: string;
}

const toneClass: Record<NonNullable<StatItem["tone"]>, string> = {
  neutral: "text-muted-foreground",
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
};

export interface StatsCardsProps extends React.HTMLAttributes<HTMLDivElement> {
  items: StatItem[];
  columns?: 2 | 3 | 4 | 5 | 6;
  loading?: boolean;
}

export function StatsCards({
  items,
  columns = 4,
  loading,
  className,
  ...props
}: StatsCardsProps) {
  const gridCols: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-5",
    6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
  };

  return (
    <div className={cn("grid gap-2 sm:gap-3", gridCols[columns], className)} {...props}>
      {items.map((item, i) => {
        const interactive = item.onClick || item.href;
        const Inner = (
          <Card
            className={cn(
              "min-w-0 p-2.5 transition-colors sm:p-3",
              interactive && "cursor-pointer hover:bg-accent/40",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                {item.label}
              </p>
              {item.icon ? (
                <span className="shrink-0 text-muted-foreground [&_svg]:h-3.5 [&_svg]:w-3.5 sm:[&_svg]:h-4 sm:[&_svg]:w-4">
                  {item.icon}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-lg font-semibold leading-tight sm:mt-1.5 sm:text-xl">
              {loading ? <span className="inline-block h-5 w-12 animate-pulse rounded bg-muted" /> : item.value}
            </p>
            {item.delta || item.hint ? (
              <p className={cn("mt-0.5 truncate text-[10px] sm:mt-1 sm:text-[11px]", toneClass[item.tone ?? "neutral"])}>
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
