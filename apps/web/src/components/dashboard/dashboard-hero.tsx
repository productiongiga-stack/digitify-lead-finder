"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button, Badge } from "@digitify/ui";
import { Flame, Receipt, Search, UserPlus, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type DashboardHeroProps = {
  totalLeads: number;
  hotLeads: number;
  pipelineValue: string;
  actionCount: number;
  newLeadsThisWeek?: number;
  loading?: boolean;
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Goedemorgen";
  if (hour < 18) return "Goedemiddag";
  return "Goedenavond";
}

function formatToday(): string {
  return new Intl.DateTimeFormat("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

export function DashboardHero({
  totalLeads,
  hotLeads,
  pipelineValue,
  actionCount,
  newLeadsThisWeek,
  loading,
}: DashboardHeroProps) {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "daar";

  const highlights = [
    {
      label: "Totaal leads",
      value: loading ? "—" : String(totalLeads),
      hint: newLeadsThisWeek ? `+${newLeadsThisWeek} deze week` : undefined,
      icon: UserPlus,
    },
    {
      label: "Hot leads",
      value: loading ? "—" : String(hotLeads),
      hint: hotLeads > 0 ? "Vraagt opvolging" : "Geen urgente leads",
      icon: Flame,
      accent: hotLeads > 0,
    },
    {
      label: "Pipeline",
      value: loading ? "—" : pipelineValue,
      hint: "Open + goedgekeurd",
      icon: Receipt,
    },
    {
      label: "Actie-items",
      value: loading ? "—" : String(actionCount),
      hint: actionCount > 0 ? "Open in actiecentrum" : "Alles bijgewerkt",
      icon: Zap,
      accent: actionCount > 0,
    },
  ];

  return (
    <section className="dashboard-hero">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 left-1/4 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
            {formatToday()}
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {getGreeting()}, {firstName}
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Je werkruimte op één plek — leads, pipeline en openstaande acties.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="secondary" className="h-7 rounded-full px-3 text-xs">
              {loading ? "…" : `${totalLeads} leads`}
            </Badge>
            <Badge
              variant={actionCount > 0 ? "warning" : "success"}
              className="h-7 rounded-full px-3 text-xs"
            >
              {loading
                ? "Laden…"
                : actionCount > 0
                  ? `${actionCount} open acties`
                  : "Geen open acties"}
            </Badge>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild size="sm" className="rounded-full shadow-sm">
            <Link href="/leads/search">
              <Search className="mr-2 h-4 w-4" />
              Leads zoeken
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href="/quotes/new">Nieuwe offerte</Link>
          </Button>
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {highlights.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={cn(
                "dashboard-hero-stat rounded-xl border border-border/50 bg-background/60 p-3 backdrop-blur-sm",
                item.accent && "border-primary/25 bg-primary/5",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                  {item.label}
                </p>
                <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
              </div>
              <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight sm:text-2xl">
                {item.value}
              </p>
              {item.hint ? (
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-[11px]">
                  {item.hint}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
