"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  ChevronDown,
  FileText,
  LayoutDashboard,
  Megaphone,
  Radio,
  Sparkles,
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@digitify/ui";
import type { CampaignScoreEntry } from "@/lib/meta-ads-campaign-score";
import { cn } from "@/lib/utils";

type PlanStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "PUSHING" | "PUSHED_PAUSED" | "FAILED" | "CANCELLED";

type InsightCoach = {
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
  conversions: number;
  tips: string[];
};

type OperationalRequirement = {
  code: string;
  title: string;
  description: string;
};

function formatEur(amount: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(amount);
}

function statusLabel(status: string) {
  if (status === "PUSHED_PAUSED") return "Gepusht";
  if (status === "FAILED") return "Mislukt";
  if (status === "PENDING_APPROVAL") return "Approval";
  if (status === "APPROVED") return "OK";
  if (status === "PUSHING") return "Pushen";
  return "Concept";
}

function insightRowLabel(row: Record<string, unknown>) {
  return String(row.campaign_name || row.adset_name || row.ad_name || "Onbekend");
}

function pipelineSummaryText(pipeline: Record<PlanStatus, number>) {
  const parts: string[] = [];
  if (pipeline.DRAFT) parts.push(`${pipeline.DRAFT} concept${pipeline.DRAFT === 1 ? "" : "en"}`);
  if (pipeline.PENDING_APPROVAL) {
    parts.push(`${pipeline.PENDING_APPROVAL} in goedkeuring`);
  }
  if (pipeline.APPROVED) parts.push(`${pipeline.APPROVED} goedgekeurd`);
  if (pipeline.PUSHED_PAUSED) parts.push(`${pipeline.PUSHED_PAUSED} live`);
  if (pipeline.FAILED) parts.push(`${pipeline.FAILED} mislukt`);
  return parts.length ? parts.join(" · ") : null;
}

function PanelLinkButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 gap-0.5 px-2 text-xs" onClick={onClick}>
      {label}
      <ArrowRight className="h-3 w-3" aria-hidden />
    </Button>
  );
}

function KpiChip({
  label,
  value,
  sub,
  alert,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-1 flex-col rounded-lg px-2.5 py-2 text-left ring-1 transition hover:ring-[#1877F2]/30",
        alert
          ? "bg-amber-500/8 ring-amber-500/25 hover:bg-amber-500/12"
          : "bg-background/80 ring-border/40 hover:bg-background dark:bg-slate-950/60",
      )}
    >
      <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="mt-0.5 truncate text-base font-bold tabular-nums leading-none">{value}</span>
      {sub ? <span className="mt-0.5 truncate text-[10px] text-muted-foreground">{sub}</span> : null}
    </button>
  );
}

export function MetaAdsDashboardOverview({
  drafts,
  liveCampaigns,
  insightsRows,
  insightsLoading,
  insightCoach,
  pendingApprovalCount,
  operationalRequirements,
  connected,
  accountSelected,
  topScoreEntry,
  onNavigate,
  onOpenDraft,
  onOpenTopScore,
}: {
  drafts: Array<Record<string, unknown>>;
  liveCampaigns: Array<Record<string, unknown>>;
  insightsRows: Array<Record<string, unknown>>;
  insightsLoading: boolean;
  insightCoach: InsightCoach;
  pendingApprovalCount: number;
  operationalRequirements: OperationalRequirement[];
  connected: boolean;
  accountSelected: boolean;
  topScoreEntry?: CampaignScoreEntry;
  onNavigate: (tab: string) => void;
  onOpenDraft: (planId: string) => void;
  onOpenCampaign: (campaignId: string) => void;
  onOpenTopScore?: () => void;
}) {
  const pipeline = useMemo(() => {
    const counts: Record<PlanStatus, number> = {
      DRAFT: 0,
      PENDING_APPROVAL: 0,
      APPROVED: 0,
      PUSHING: 0,
      PUSHED_PAUSED: 0,
      FAILED: 0,
      CANCELLED: 0,
    };
    for (const row of drafts) {
      const status = String(row.status || "DRAFT") as PlanStatus;
      if (status in counts) counts[status] += 1;
    }
    return counts;
  }, [drafts]);

  const latestDraft = useMemo(
    () =>
      [...drafts].sort(
        (a, b) =>
          new Date(String(b.updatedAt || b.createdAt || 0)).getTime() -
          new Date(String(a.updatedAt || a.createdAt || 0)).getTime(),
      )[0],
    [drafts],
  );

  const topInsight = useMemo(
    () =>
      [...insightsRows].sort((a, b) => Number(b.spend || 0) - Number(a.spend || 0))[0],
    [insightsRows],
  );

  const liveActiveCount = useMemo(
    () =>
      liveCampaigns.filter((row) => {
        const s = String(row.effective_status || row.status || "").toUpperCase();
        return s === "ACTIVE" || s === "PAUSED";
      }).length,
    [liveCampaigns],
  );

  const actions = useMemo(() => {
    const items: Array<{ id: string; title: string; tab: string }> = [];
    if (!connected) items.push({ id: "connect", title: "Meta koppelen", tab: "settings" });
    else if (!accountSelected) items.push({ id: "account", title: "Ad account kiezen", tab: "settings" });
    if (pendingApprovalCount > 0) {
      items.push({
        id: "approval",
        title: `${pendingApprovalCount} wacht op goedkeuring`,
        tab: "approval",
      });
    }
    for (const r of operationalRequirements.slice(0, 1)) {
      items.push({ id: r.code, title: r.title, tab: "settings" });
    }
    if (!drafts.length && connected && accountSelected) {
      items.push({ id: "start", title: "Eerste draft starten", tab: "builder" });
    }
    return items.slice(0, 3);
  }, [accountSelected, connected, drafts.length, operationalRequirements, pendingApprovalCount]);

  const pipelineSummary = useMemo(() => pipelineSummaryText(pipeline), [pipeline]);

  const hasInsightData =
    insightsRows.length > 0 ||
    insightCoach.spend > 0 ||
    insightCoach.impressions > 0 ||
    insightCoach.clicks > 0;

  const [actionsOpen, setActionsOpen] = useState(actions.length > 0);

  return (
    <Card className="border-[#1877F2]/15 bg-gradient-to-br from-slate-50/90 via-card to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/20">
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <LayoutDashboard className="h-4 w-4 text-[#1877F2]" />
          Studio overzicht
        </CardTitle>
        <CardDescription className="text-xs">Drafts, live campagnes en 30 dagen performance.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <div className="flex gap-1.5">
          <KpiChip
            label="Drafts"
            value={String(drafts.length)}
            sub={pipeline.DRAFT ? `${pipeline.DRAFT} concept` : undefined}
            onClick={() => onNavigate("drafts")}
          />
          <KpiChip
            label="Approval"
            value={String(pendingApprovalCount)}
            sub={pendingApprovalCount ? "Actie" : "Leeg"}
            alert={pendingApprovalCount > 0}
            onClick={() => onNavigate("approval")}
          />
          <KpiChip
            label="Live"
            value={String(liveCampaigns.length)}
            sub={`${liveActiveCount} actief`}
            onClick={() => onNavigate("campaigns")}
          />
          <KpiChip
            label="30d"
            value={insightsLoading ? "…" : formatEur(insightCoach.spend)}
            sub={insightsLoading ? "Laden" : `CTR ${insightCoach.ctr.toFixed(1)}%`}
            onClick={() => onNavigate("insights")}
          />
        </div>

        {actions.length > 0 ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5">
            <button
              type="button"
              onClick={() => setActionsOpen((v) => !v)}
              className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span className="flex-1 font-semibold text-amber-950 dark:text-amber-100">
                {actions.length} actiepunt{actions.length === 1 ? "" : "en"}
              </span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition", actionsOpen && "rotate-180")} />
            </button>
            {actionsOpen ? (
              <ul className="space-y-0.5 border-t border-amber-500/15 px-1 pb-1">
                {actions.map((action) => (
                  <li key={action.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate(action.tab)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-amber-500/10"
                    >
                      <span className="flex-1 font-medium">{action.title}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-3">
          <section className="rounded-xl border border-border/50 bg-background/60 p-3 dark:bg-slate-950/50">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <h3 className="text-sm font-semibold">Drafts</h3>
                  {drafts.length > 0 ? (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] tabular-nums">
                      {drafts.length}
                    </Badge>
                  ) : null}
                </div>
                {pipelineSummary ? (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{pipelineSummary}</p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Nog geen campagne-concepten.</p>
                )}
              </div>
              <PanelLinkButton label="Alles" onClick={() => onNavigate("drafts")} />
            </div>

            {latestDraft ? (
              <button
                type="button"
                onClick={() => onOpenDraft(String(latestDraft.id))}
                className="mt-3 flex w-full items-center gap-3 rounded-lg border border-border/40 bg-muted/20 p-3 text-left transition hover:border-[#1877F2]/25 hover:bg-muted/35"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1877F2]/10 text-[#1877F2]">
                  <FileText className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-snug text-foreground break-words">
                    {String(latestDraft.name || "Draft")}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        String(latestDraft.status) === "PENDING_APPROVAL" ? "warning" : "secondary"
                      }
                      className="h-5 px-1.5 text-[10px]"
                    >
                      {statusLabel(String(latestDraft.status || "DRAFT"))}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">Laatst bewerkt · openen</span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 h-9 w-full gap-2 text-xs"
                onClick={() => onNavigate("builder")}
              >
                <Megaphone className="h-3.5 w-3.5" aria-hidden />
                Eerste campagne starten
              </Button>
            )}
          </section>

          <section className="rounded-xl border border-border/50 bg-background/60 p-3 dark:bg-slate-950/50">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 shrink-0 text-[#1877F2]" aria-hidden />
                  <h3 className="text-sm font-semibold">30 dagen</h3>
                </div>
                {!insightsLoading && hasInsightData ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatEur(insightCoach.spend)} uitgegeven · CTR {insightCoach.ctr.toFixed(1)}%
                  </p>
                ) : null}
              </div>
              <PanelLinkButton label="Details" onClick={() => onNavigate("insights")} />
            </div>

            {insightsLoading ? (
              <Skeleton className="mt-3 h-20 w-full rounded-lg" />
            ) : hasInsightData ? (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: insightCoach.clicks, label: "Kliks" },
                      {
                        value:
                          insightCoach.impressions > 999
                            ? `${(insightCoach.impressions / 1000).toFixed(1)}k`
                            : insightCoach.impressions,
                        label: "Impressies",
                      },
                      { value: insightCoach.conversions, label: "Conversies" },
                    ] as const
                  ).map(({ value, label }) => (
                    <div
                      key={label}
                      className="rounded-lg bg-muted/30 px-2 py-2 text-center ring-1 ring-border/30"
                    >
                      <p className="text-sm font-bold tabular-nums leading-none">{value}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
                {topInsight ? (
                  <button
                    type="button"
                    onClick={() => onNavigate("insights")}
                    className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border/60 px-3 py-2 text-left text-xs hover:bg-muted/25"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Meeste spend
                      </span>
                      <span className="mt-0.5 block text-sm font-medium leading-snug break-words text-foreground">
                        {insightRowLabel(topInsight)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatEur(Number(topInsight.spend || 0))}
                    </span>
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/50 bg-muted/15 px-4 py-5 text-center">
                <BarChart3 className="h-8 w-8 text-muted-foreground/35" aria-hidden />
                <p className="max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
                  Nog geen prestatiedata. Koppel een Ad Account om inzichten te zien.
                </p>
                {!connected || !accountSelected ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => onNavigate("settings")}
                  >
                    Naar koppeling
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => onNavigate("insights")}
                  >
                    Prestaties-tab
                  </Button>
                )}
              </div>
            )}
          </section>

          {topScoreEntry ? (
            <button
              type="button"
              onClick={onOpenTopScore}
              className="flex w-full items-center gap-3 rounded-xl border border-[#1877F2]/20 bg-gradient-to-r from-[#1877F2]/8 via-background/80 to-transparent p-3 text-left transition hover:border-[#1877F2]/35 hover:from-[#1877F2]/12"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1877F2]/15 text-[#1877F2]">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#1877F2]">
                  Top AI-score
                </span>
                <span className="mt-0.5 block text-sm font-medium leading-snug break-words">
                  {topScoreEntry.name}
                </span>
              </span>
              <Badge className="h-7 shrink-0 px-2 text-sm font-bold tabular-nums">{topScoreEntry.score.score}</Badge>
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-border/30 pt-2">
          {(
            [
              { tab: "builder", icon: Megaphone, label: "Wizard" },
              { tab: "campaigns", icon: Radio, label: "Live" },
              { tab: "approval", icon: FileText, label: "Goedkeuring", badge: pendingApprovalCount },
            ] as Array<{ tab: string; icon: typeof Megaphone; label: string; badge?: number }>
          ).map(({ tab, icon: Icon, label, badge }) => (
            <Button
              key={tab}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={() => onNavigate(tab)}
            >
              <Icon className="h-3 w-3" />
              {label}
              {badge && badge > 0 ? (
                <span className="rounded-full bg-amber-500/15 px-1 text-[9px] font-semibold text-amber-800">
                  {badge}
                </span>
              ) : null}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
