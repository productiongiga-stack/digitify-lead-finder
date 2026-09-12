"use client";

import Link from "next/link";
import { Globe2 } from "lucide-react";
import { Badge, EmptyState, Skeleton } from "@digitify/ui";
import type { RouterOutputs } from "@/lib/trpc/client";

type DashboardOverview = RouterOutputs["dashboard"]["getOverview"];

export function ExpiringDomainsWidget({
  domains,
  isLoading,
}: {
  domains: DashboardOverview["expiringDomains"] | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>;
  }

  if (!domains || domains.length === 0) {
    return <EmptyState icon={<Globe2 />} title="Geen verlopende domeinen" description="Alle domeinen zijn nog ≥30 dagen geldig." size="sm" />;
  }

  return <div className="space-y-0.5">{domains.map((domain) => {
    if (!domain.expiresAt) return null;
    const days = Math.max(0, Math.ceil((new Date(domain.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    return <Link key={domain.id} href={`/domains/${domain.id}`} className="flex items-center gap-2.5 rounded-md p-1.5 transition-colors hover:bg-muted/50">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30"><Globe2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /></div>
      <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{domain.domainName}</p><p className="text-[11px] text-muted-foreground">{domain.registrar ? `${domain.registrar} · ` : ""}Verloopt over {days} {days === 1 ? "dag" : "dagen"}</p></div>
      <Badge variant={days <= 7 ? "destructive" : "warning"} className="h-5 px-1.5 text-[10px]">{days}d</Badge>
    </Link>;
  })}</div>;
}
