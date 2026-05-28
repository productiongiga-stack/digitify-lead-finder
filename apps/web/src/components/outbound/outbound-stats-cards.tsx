"use client";

import { StatsCards, type StatItem } from "@digitify/ui";
import { cn } from "@/lib/utils";

type OutboundStatsCardsProps = {
  items: StatItem[];
  loading?: boolean;
  className?: string;
};

export function OutboundStatsCards({ items, loading, className }: OutboundStatsCardsProps) {
  return (
    <StatsCards
      items={items}
      columns={6}
      loading={loading}
      variant="rich"
      className={cn(className)}
      aria-label="Outbound statusoverzicht"
    />
  );
}

export type { StatItem };
