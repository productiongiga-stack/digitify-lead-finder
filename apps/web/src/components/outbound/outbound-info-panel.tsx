"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Clock,
  FileEdit,
  Inbox,
  Link2,
  ListChecks,
  Mail,
  PenSquare,
  Send,
  Settings,
  ShieldCheck,
  Target,
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@digitify/ui";
import { cn } from "@/lib/utils";
import {
  OUTBOUND_STATUS_LABELS,
  OUTBOUND_STATUS_VARIANTS,
  OUTBOUND_STAT_CARD_LABELS,
  OUTBOUND_STAT_CARD_STATUSES,
  type OutboundStatCardStatus,
} from "@/lib/contact-status";
import { OutboundWorkflowHelp } from "@/components/outbound/outbound-workflow-help";
import { OutboundStatsCards } from "@/components/outbound/outbound-stats-cards";
import type { StatItem } from "@digitify/ui";

export type OutboundInfoStats = {
  draft: number;
  pending: number;
  approved: number;
  sent: number;
  failed: number;
};

export type OutboundInfoDraft = {
  id: string;
  status: string;
  subject: string;
  lead: { id: string; companyName: string };
};

export type OutboundFollowUpItem = {
  id: string;
  subject: string;
  daysSinceSent: number;
  lead: { id: string; companyName: string };
};

type OutboundInfoPanelProps = {
  drafts: OutboundInfoDraft[];
  followUpDays?: number;
  followUpItems: OutboundFollowUpItem[];
  topbarFollowUpCount?: number;
  activeStatusFilter?: string;
  onStatusCardClick?: (status: OutboundStatCardStatus) => void;
};

type FocusAction = {
  tone: "emerald" | "amber" | "red" | "sky";
  title: string;
  detail: string | null;
  href: string;
  cta: string;
};

function getFocusAction(stats: OutboundInfoStats, drafts: OutboundInfoDraft[]): FocusAction {
  const firstByStatus = (status: string) =>
    drafts.find((draft) => draft.status === status || (status === "DRAFT" && draft.status === "SCHEDULED"));

  if (stats.pending > 0) {
    const first = firstByStatus("PENDING_APPROVAL");
    return {
      tone: "amber",
      title: `${stats.pending} ${OUTBOUND_STATUS_LABELS.PENDING_APPROVAL!.toLowerCase()}`,
      detail: first ? `${first.lead.companyName} — ${first.subject}` : null,
      href: "/contacts/approval",
      cta: "Open goedkeuringswachtrij",
    };
  }

  if (stats.failed > 0) {
    const first = firstByStatus("FAILED");
    return {
      tone: "red",
      title: `${stats.failed} ${OUTBOUND_STATUS_LABELS.FAILED!.toLowerCase()}`,
      detail: first ? `${first.lead.companyName} — ${first.subject}` : null,
      href: first ? `/contacts/drafts/${first.id}` : "/contacts",
      cta: "Bekijk foutmelding",
    };
  }

  if (stats.approved > 0) {
    const first = firstByStatus("APPROVED");
    return {
      tone: "emerald",
      title: `${stats.approved} ${OUTBOUND_STATUS_LABELS.APPROVED!.toLowerCase()}`,
      detail: first
        ? `${first.lead.companyName} — klaar voor SMTP-verzending`
        : "Mails zijn goedgekeurd en wachten op Verzenden.",
      href: first ? `/contacts/drafts/${first.id}` : "/contacts",
      cta: "Naar draft",
    };
  }

  if (stats.draft > 0) {
    const first = firstByStatus("DRAFT");
    return {
      tone: "sky",
      title: `${stats.draft} concept${stats.draft !== 1 ? "en" : ""} in bewerking`,
      detail: first ? `${first.lead.companyName} — ${first.subject}` : null,
      href: first ? `/contacts/drafts/${first.id}` : "/contacts/compose",
      cta: first ? "Concept afmaken" : "Nieuwe e-mail",
    };
  }

  return {
    tone: "emerald",
    title: "Wachtrij is leeg",
    detail: "Geen openstaande goedkeuringen of verzendblokkades in deze lijst.",
    href: "/contacts/compose",
    cta: "Nieuwe outreach",
  };
}

const QUEUE_METRICS: Array<{
  key: keyof OutboundInfoStats;
  shortLabel: string;
  icon: ReactNode;
  tone: "slate" | "amber" | "emerald" | "sky" | "red";
}> = [
  {
    key: "draft",
    shortLabel: OUTBOUND_STAT_CARD_LABELS.DRAFT,
    icon: <FileEdit className="h-3.5 w-3.5" />,
    tone: "slate",
  },
  {
    key: "pending",
    shortLabel: OUTBOUND_STAT_CARD_LABELS.PENDING_APPROVAL,
    icon: <Clock className="h-3.5 w-3.5" />,
    tone: "amber",
  },
  {
    key: "approved",
    shortLabel: "Klaar",
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    tone: "emerald",
  },
  {
    key: "sent",
    shortLabel: OUTBOUND_STAT_CARD_LABELS.SENT,
    icon: <Send className="h-3.5 w-3.5" />,
    tone: "sky",
  },
  {
    key: "failed",
    shortLabel: OUTBOUND_STAT_CARD_LABELS.FAILED,
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    tone: "red",
  },
];

const QUEUE_STATUS_BADGE_LABEL: Record<string, string> = {
  PENDING_APPROVAL: OUTBOUND_STAT_CARD_LABELS.PENDING_APPROVAL,
  APPROVED: "Klaar",
  FAILED: OUTBOUND_STAT_CARD_LABELS.FAILED,
};

const FOCUS_TONE_CLASS: Record<FocusAction["tone"], string> = {
  emerald: "outbound-info-focus-card-emerald",
  amber: "outbound-info-focus-card-amber",
  red: "outbound-info-focus-card-red",
  sky: "outbound-info-focus-card-sky",
};

const FOCUS_ICON: Record<FocusAction["tone"], ReactNode> = {
  emerald: <ShieldCheck className="h-4 w-4" />,
  amber: <Clock className="h-4 w-4" />,
  red: <AlertCircle className="h-4 w-4" />,
  sky: <FileEdit className="h-4 w-4" />,
};

export function OutboundInfoPanel({
  drafts,
  followUpDays = 3,
  followUpItems,
  topbarFollowUpCount,
  activeStatusFilter = "",
  onStatusCardClick,
}: OutboundInfoPanelProps) {
  const { data: outboundStats, isLoading: statsLoading } = trpc.contact.getOutboundStats.useQuery(undefined, {
    staleTime: 30_000,
  });

  const stats: OutboundInfoStats = {
    draft: outboundStats?.draft ?? 0,
    pending: outboundStats?.pending ?? 0,
    approved: outboundStats?.approved ?? 0,
    sent: outboundStats?.sent ?? 0,
    failed: outboundStats?.failed ?? 0,
  };

  const statCardItems = useMemo<StatItem[]>(() => {
    const countByStatus: Record<OutboundStatCardStatus, number> = {
      DRAFT: stats.draft,
      PENDING_APPROVAL: stats.pending,
      APPROVED: stats.approved,
      SENT: stats.sent,
      FAILED: stats.failed,
    };
    const meta: Record<
      OutboundStatCardStatus,
      { icon: ReactNode; tone: NonNullable<StatItem["tone"]> }
    > = {
      DRAFT: { icon: <FileEdit className="h-4 w-4" />, tone: "neutral" },
      PENDING_APPROVAL: { icon: <Clock className="h-4 w-4" />, tone: "warning" },
      APPROVED: { icon: <ShieldCheck className="h-4 w-4" />, tone: "positive" },
      SENT: { icon: <Send className="h-4 w-4" />, tone: "positive" },
      FAILED: { icon: <AlertCircle className="h-4 w-4" />, tone: "negative" },
    };

    const statusCards: StatItem[] = OUTBOUND_STAT_CARD_STATUSES.map((status) => {
      const active = activeStatusFilter === status;
      return {
        label: OUTBOUND_STAT_CARD_LABELS[status],
        value: countByStatus[status],
        icon: meta[status].icon,
        tone: meta[status].tone,
        active,
        onClick: onStatusCardClick ? () => onStatusCardClick(status) : undefined,
      };
    });

    return [
      ...statusCards,
      {
        label: "Inkomend",
        value: "Inbox",
        icon: <Inbox className="h-4 w-4" />,
        tone: "info" as const,
        href: "/contacts/inbox",
        hint: "Ontvangen e-mail",
      },
    ];
  }, [activeStatusFilter, onStatusCardClick, stats.approved, stats.draft, stats.failed, stats.pending, stats.sent]);

  const loading = statsLoading;
  const focus = getFocusAction(stats, drafts);
  const blockingDrafts = drafts.filter((draft) =>
    ["PENDING_APPROVAL", "FAILED", "APPROVED"].includes(draft.status),
  );
  const followUpTotal = topbarFollowUpCount ?? followUpItems.length;
  const totalInPipeline =
    stats.draft + stats.pending + stats.approved + stats.failed;

  return (
    <div className="outbound-info-panel space-y-4">
      <OutboundWorkflowHelp />

      <OutboundStatsCards items={statCardItems} loading={statsLoading} />

      <div className="grid gap-3 xl:grid-cols-3">
        <Card className={cn("outbound-info-focus-card xl:self-start", FOCUS_TONE_CLASS[focus.tone])}>
          <CardContent className="p-0">
            <div className="outbound-info-focus-card-inner">
              <div className="outbound-info-focus-card-header">
                <p className="outbound-info-eyebrow">Volgende actie</p>
                <span className="outbound-info-focus-card-icon" aria-hidden>
                  {FOCUS_ICON[focus.tone]}
                </span>
              </div>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-7 w-3/4 rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
              ) : (
                <>
                  <p className="outbound-info-focus-card-title">{focus.title}</p>
                  {focus.detail ? (
                    <p className="outbound-info-focus-card-detail line-clamp-2">{focus.detail}</p>
                  ) : null}
                  {stats.sent > 0 ? (
                    <p className="outbound-info-focus-card-meta">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      {stats.sent} verzonden in huidige lijst
                    </p>
                  ) : null}
                </>
              )}
              <Button asChild size="sm" variant="outline" className="outbound-info-focus-card-cta">
                <Link href={focus.href}>
                  {focus.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="outbound-info-queue-card xl:self-start">
          <CardContent className="p-0">
            <div className="outbound-info-queue-card-inner">
              <div className="outbound-info-queue-card-header">
                <p className="outbound-info-eyebrow">Werkqueue</p>
                <span className="outbound-info-queue-card-icon" aria-hidden>
                  <ListChecks className="h-4 w-4" />
                </span>
              </div>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-[4.5rem] w-full rounded-xl" />
                  <div className="flex gap-2">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton key={index} className="h-16 min-w-[4.85rem] shrink-0 rounded-xl" />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="outbound-info-queue-summary">
                    <span className="outbound-info-queue-summary-value">{totalInPipeline}</span>
                    <div className="min-w-0">
                      <p className="outbound-info-queue-summary-title">
                        {totalInPipeline > 0 ? "open in pipeline" : "Geen open items"}
                      </p>
                      <p className="outbound-info-queue-summary-sub">
                        {totalInPipeline > 0
                          ? "Concept t/m mislukt · huidige lijst"
                          : "Geen concepten, goedkeuringen of fouten in deze filter."}
                      </p>
                    </div>
                  </div>
                  <ul className="outbound-info-queue-metrics" aria-label="Pipeline per status">
                    {QUEUE_METRICS.map((metric) => {
                      const count = stats[metric.key];
                      return (
                        <li
                          key={metric.key}
                          className={cn(
                            "outbound-info-queue-metric",
                            `outbound-info-queue-metric-${metric.tone}`,
                            count > 0 && "outbound-info-queue-metric-active",
                          )}
                        >
                          <span className="outbound-info-queue-metric-icon">{metric.icon}</span>
                          <span className="outbound-info-queue-metric-value">{count}</span>
                          <span className="outbound-info-queue-metric-label">{metric.shortLabel}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {blockingDrafts.length > 0 ? (
                    <div className="outbound-info-queue-activity">
                      <p className="outbound-info-queue-activity-title">Actief in wachtrij</p>
                      <ul className="space-y-2">
                        {blockingDrafts.slice(0, 4).map((draft) => (
                          <li key={draft.id}>
                            <Link
                              href={`/contacts/drafts/${draft.id}`}
                              className="outbound-info-queue-item"
                            >
                              <div className="outbound-info-queue-item-head">
                                <span className="outbound-info-queue-item-company">
                                  {draft.lead.companyName}
                                </span>
                                <Badge
                                  variant={
                                    OUTBOUND_STATUS_VARIANTS[draft.status] ?? "secondary"
                                  }
                                  className="shrink-0 px-2 py-0 text-[10px]"
                                >
                                  {QUEUE_STATUS_BADGE_LABEL[draft.status] ??
                                    OUTBOUND_STATUS_LABELS[draft.status] ??
                                    draft.status}
                                </Badge>
                              </div>
                              <p className="outbound-info-queue-item-subject">{draft.subject}</p>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="outbound-info-queue-empty">
                      Geen goedkeuringen, mislukte of klaarstaande mails in de huidige lijst.
                    </p>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="outbound-info-related-card xl:self-start">
          <CardContent className="p-0">
            <div className="outbound-info-related-card-inner">
              <div className="outbound-info-related-card-header">
                <p className="outbound-info-eyebrow">Gerelateerd</p>
                <span className="outbound-info-related-card-icon" aria-hidden>
                  <Link2 className="h-4 w-4" />
                </span>
              </div>
              <p className="outbound-info-related-desc">
                Templates, SMTP en campagnes die bij outbound horen.
              </p>
              <nav className="outbound-info-related-links" aria-label="Gerelateerde outbound-pagina's">
                <Link href="/contacts/approval" className="outbound-info-related-link">
                  <span className="outbound-info-related-link-icon" aria-hidden>
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </span>
                  <span className="outbound-info-related-link-label">Goedkeuringen</span>
                  {stats.pending > 0 ? (
                    <Badge variant="warning" className="shrink-0 px-2 py-0 text-[10px]">
                      {stats.pending}
                    </Badge>
                  ) : null}
                </Link>
                <Link href="/templates" className="outbound-info-related-link">
                  <span className="outbound-info-related-link-icon" aria-hidden>
                    <Mail className="h-3.5 w-3.5" />
                  </span>
                  <span className="outbound-info-related-link-label">E-mailtemplates</span>
                </Link>
                <Link href="/settings/integrations" className="outbound-info-related-link">
                  <span className="outbound-info-related-link-icon" aria-hidden>
                    <Settings className="h-3.5 w-3.5" />
                  </span>
                  <span className="outbound-info-related-link-label">SMTP &amp; inbox</span>
                </Link>
                <Link href="/contacts/inbox" className="outbound-info-related-link">
                  <span className="outbound-info-related-link-icon" aria-hidden>
                    <Inbox className="h-3.5 w-3.5" />
                  </span>
                  <span className="outbound-info-related-link-label">Inkomende mail</span>
                </Link>
                <Link href="/campaigns" className="outbound-info-related-link">
                  <span className="outbound-info-related-link-icon" aria-hidden>
                    <Target className="h-3.5 w-3.5" />
                  </span>
                  <span className="outbound-info-related-link-label">Campagnes</span>
                </Link>
                <Link href="/contacts/compose" className="outbound-info-related-link">
                  <span className="outbound-info-related-link-icon" aria-hidden>
                    <PenSquare className="h-3.5 w-3.5" />
                  </span>
                  <span className="outbound-info-related-link-label">Nieuwe e-mail</span>
                </Link>
              </nav>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="outbound-info-followups overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">Follow-up herinneringen</CardTitle>
            {!loading && followUpTotal > 0 ? (
              <Badge variant="warning">{followUpTotal} aanbevolen</Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Leads met verzonden mail ouder dan {followUpDays} dagen zonder pipeline-voortgang.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : followUpItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-5 text-center">
              <p className="text-sm font-medium text-foreground">Geen follow-ups voor vandaag</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Nieuwe herinneringen verschijnen na verzonden mails en het interval van {followUpDays} dagen.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link href="/contacts/compose">Plan een opvolgmail</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-2">
              {followUpItems.map((item) => (
                <div key={item.id} className="outbound-info-followup-row">
                  <div className="min-w-0 flex-1">
                    <Link href={`/leads/${item.lead.id}`} className="text-sm font-semibold hover:text-primary">
                      {item.lead.companyName}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.subject}</p>
                    <p className="mt-1 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                      {item.daysSinceSent} dag{item.daysSinceSent !== 1 ? "en" : ""} sinds verzending
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/contacts/compose?leadId=${item.lead.id}`}>Follow-up</Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/leads/${item.lead.id}`}>Lead</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
