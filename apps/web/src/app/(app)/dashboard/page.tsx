"use client";

import { trpc } from "@/lib/trpc/client";
import {
  getLeadPriorityBadgeVariant,
  getLeadStatusDotClass,
  getLeadStatusLabel,
} from "@/lib/lead-status";
import {
  Card, CardContent, CardHeader, CardTitle, Badge, Skeleton, Button,
} from "@digitify/ui";
import {
  Users, UserPlus, Flame, TrendingUp, Receipt, MessageSquare, Mail, Trophy,
  ArrowRight, Search, Target, FileText, Calendar, Star, Clock,
  Activity as ActivityIcon, UserCheck, Send, Zap,
  Globe2, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { formatRelativeTime, formatDate } from "@/lib/utils";

/* ================================================================
   KPI Card
   ================================================================ */
function KpiCard({
  title,
  value,
  icon: Icon,
  href,
  loading,
  colorClass,
  bgClass,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  href?: string;
  loading?: boolean;
  colorClass: string;
  bgClass: string;
}) {
  const content = (
    <Card className="group relative overflow-hidden border border-border/50 bg-card shadow-sm transition-all hover:shadow-md hover:border-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {title}
            </p>
            {loading ? (
              <Skeleton className="mt-1 h-7 w-14" />
            ) : (
              <p className="text-xl font-bold tracking-tight">{value}</p>
            )}
          </div>
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bgClass}`}>
            <Icon className={`h-4 w-4 ${colorClass}`} />
          </div>
        </div>
        {href && (
          <div className="mt-2 flex items-center text-[11px] font-medium text-muted-foreground group-hover:text-primary transition-colors">
            Bekijk details
            <ArrowRight className="ml-1 h-3 w-3" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

/* ================================================================
   Quick Actions
   ================================================================ */
const quickActions = [
  { icon: Search, label: "Zoek Leads", description: "Doorzoek bedrijven", href: "/leads/search" },
  { icon: Target, label: "Nieuwe Campagne", description: "Campagne starten", href: "/campaigns" },
  { icon: Mail, label: "E-mail Opstellen", description: "Contact opnemen", href: "/contacts/compose" },
  { icon: Receipt, label: "Nieuwe Offerte", description: "Offerte configurator", href: "/embed/quotes" },
  { icon: Calendar, label: "Boek Afspraak", description: "Planning beheren", href: "/bookings" },
  { icon: Star, label: "Review Aanvragen", description: "Reviews verzamelen", href: "/reviews" },
];

function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {quickActions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="group flex flex-col items-center gap-1.5 rounded-lg border border-border/50 bg-card p-3 text-center transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
            <action.icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold">{action.label}</p>
            <p className="text-[10px] text-muted-foreground">{action.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ================================================================
   Focus Board
   ================================================================ */
function FocusBoard({
  kpis,
  loading,
}: {
  kpis:
    | {
      failedEmails: number;
      pendingDrafts: number;
      pendingReviews: number;
      hotLeads: number;
    }
    | undefined;
  loading: boolean;
}) {
  const { data: followUps, isLoading: followUpsLoading } = trpc.dashboard.getLeadsNeedingFollowUp.useQuery();
  const topFollowUp = followUps?.[0];
  const cards = [
    {
      title: "Mail issues eerst",
      description:
        (kpis?.failedEmails ?? 0) > 0
          ? `${kpis?.failedEmails ?? 0} mails zijn mislukt en vragen opvolging.`
          : "Geen mislukte mails. Je mailflow oogt stabiel.",
      href: (kpis?.failedEmails ?? 0) > 0 ? "/contacts" : "/settings/integrations",
      cta: (kpis?.failedEmails ?? 0) > 0 ? "Bekijk mail queue" : "Controleer mail health",
      tone: (kpis?.failedEmails ?? 0) > 0
        ? "border-red-200 bg-red-50/80 dark:border-red-900/40 dark:bg-red-950/20"
        : "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-emerald-950/20",
    },
    {
      title: "Goedkeuringen klaarzetten",
      description:
        (kpis?.pendingDrafts ?? 0) > 0
          ? `${kpis?.pendingDrafts ?? 0} drafts wachten op review of verzending.`
          : "Geen drafts die jouw aandacht nodig hebben.",
      href: "/contacts/approval",
      cta: "Open goedkeuringswachtrij",
      tone: "border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/20",
    },
    {
      title: "Opvolging vandaag",
      description: topFollowUp
        ? `${topFollowUp.companyName} wacht al ${topFollowUp.daysSinceLastContact} dagen op een nieuwe stap.`
        : "Geen leads met achterstallige opvolging gevonden.",
      href: topFollowUp ? `/leads/${topFollowUp.id}` : "/leads",
      cta: topFollowUp ? "Open aanbevolen lead" : "Bekijk leads",
      tone: "border-blue-200 bg-blue-50/80 dark:border-blue-900/40 dark:bg-blue-950/20",
    },
    {
      title: "Review pipeline",
      description:
        (kpis?.pendingReviews ?? 0) > 0
          ? `${kpis?.pendingReviews ?? 0} reviewaanvragen staan nog open.`
          : "Er staan momenteel geen open reviewverzoeken.",
      href: "/reviews",
      cta: "Open reviews",
      tone: "border-violet-200 bg-violet-50/80 dark:border-violet-900/40 dark:bg-violet-950/20",
    },
  ];

  if (loading || followUpsLoading) {
    return (
      <div className="grid gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-10 w-full" />
              <Skeleton className="mt-3 h-8 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className={`border shadow-sm ${card.tone}`}>
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {card.title}
            </p>
            <p className="mt-2 min-h-[2.75rem] text-sm font-medium leading-5">
              {card.description}
            </p>
            <Button asChild size="sm" variant="outline" className="mt-3">
              <Link href={card.href}>{card.cta}</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ================================================================
   Activity Feed
   ================================================================ */
function getActivityIcon(type?: string) {
  switch (type) {
    case "LEAD_CREATED": return UserPlus;
    case "LEAD_STATUS_CHANGED": return Zap;
    case "EMAIL_SENT": return Send;
    case "EMAIL_DRAFTED": return Mail;
    case "EMAIL_APPROVED": return UserCheck;
    case "NOTE_ADDED": return MessageSquare;
    case "LEAD_SCORED": return TrendingUp;
    case "CAMPAIGN_CREATED": return Target;
    case "REPORT_GENERATED": return FileText;
    case "QUOTE_CREATED": return Receipt;
    case "QUOTE_SENT": return Receipt;
    case "REVIEW_SENT": return Star;
    default: return ActivityIcon;
  }
}

function getActivityHref(activity: {
  lead?: { id: string } | null;
  metadata?: unknown;
}) {
  const metadata = (activity.metadata ?? {}) as Record<string, unknown>;
  if (typeof metadata.quoteId === "string") return `/quotes/${metadata.quoteId}`;
  if (typeof metadata.bookingId === "string") return "/bookings";
  if (activity.lead?.id) return `/leads/${activity.lead.id}`;
  return null;
}

function ActivityFeed() {
  const { data: activities, isLoading } = trpc.dashboard.getRecentActivity.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="h-7 w-7 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2.5 w-1/3" />
            </div>
            <Skeleton className="h-2.5 w-14" />
          </div>
        ))}
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <ActivityIcon className="h-8 w-8 text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">Nog geen activiteit</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {activities.slice(0, 10).map((activity: NonNullable<typeof activities>[number]) => {
        const Icon = getActivityIcon(activity.type);
        const href = getActivityHref(activity);
        return (
          <Link
            key={activity.id}
            href={href || "#"}
            className={`flex items-center gap-2.5 rounded-md p-2 text-sm transition-colors hover:bg-muted/50 ${!href ? "pointer-events-none" : ""}`}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{activity.title}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {activity.user?.name ? `${activity.user.name} · ` : ""}
                {activity.lead?.companyName || "Systeemactiviteit"}
              </p>
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {formatRelativeTime(activity.createdAt)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/* ================================================================
   Top Leads
   ================================================================ */
function TopLeads() {
  const { data: leads, isLoading } = trpc.dashboard.getTopLeads.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2.5 w-20" />
            </div>
            <Skeleton className="h-5 w-10 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!leads || leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Users className="h-7 w-7 text-muted-foreground/40" />
        <p className="mt-2 text-xs text-muted-foreground">Nog geen leads met scores</p>
      </div>
    );
  }
  const getScoreBg = (priority: string | null) => {
    switch (priority) {
      case "Hot": return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
      case "Warm": return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400";
      default: return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
    }
  };

  return (
    <div className="space-y-0.5">
      {leads.map((lead: NonNullable<typeof leads>[number]) => (
        <Link
          key={lead.id}
          href={`/leads/${lead.id}`}
          className="flex items-center gap-2.5 rounded-md p-2 transition-colors hover:bg-muted/50"
        >
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${getScoreBg(lead.scorePriority)}`}>
            {Math.round(lead.overallScore ?? 0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{lead.companyName}</p>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${getLeadStatusDotClass(lead.status)}`} />
              <span>{getLeadStatusLabel(lead.status)}</span>
              {lead.city && <span>{lead.city}</span>}
            </div>
          </div>
          <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
        </Link>
      ))}
    </div>
  );
}

/* ================================================================
   Pipeline Overview
   ================================================================ */
function PipelineOverview() {
  const { data: stages, isLoading } = trpc.dashboard.getPipelineOverview.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  const total = stages?.reduce(
    (sum: number, stage: NonNullable<typeof stages>[number]) => sum + stage.count,
    0,
  ) ?? 0;

  if (!stages || stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Target className="h-7 w-7 text-muted-foreground/40" />
        <p className="mt-2 text-xs text-muted-foreground">Geen pipeline data beschikbaar</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {stages?.map((stage: NonNullable<typeof stages>[number]) => {
        const pct = total > 0 ? (stage.count / total) * 100 : 0;
        return (
          <div key={stage.id} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <span className="font-medium">{stage.name}</span>
              </div>
              <span className="font-semibold tabular-nums">{stage.count}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: stage.color }}
              />
            </div>
          </div>
        );
      })}
      {total > 0 && (
        <div className="flex items-center justify-between border-t pt-2 text-xs">
          <span className="text-muted-foreground">Totaal</span>
          <span className="font-bold">{total}</span>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Follow-Up Widget
   ================================================================ */
function FollowUpWidget() {
  const { data: leads, isLoading } = trpc.dashboard.getLeadsNeedingFollowUp.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-2.5 w-24" />
            </div>
            <Skeleton className="h-6 w-14 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  if (!leads || leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30">
          <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="mt-2 text-xs font-medium">Alle leads zijn up-to-date!</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Geen leads die opvolging nodig hebben.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {leads.slice(0, 5).map((lead: NonNullable<typeof leads>[number]) => (
        <div
          key={lead.id}
          className="flex items-center gap-2.5 rounded-md p-2 transition-colors hover:bg-muted/50"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30">
            <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{lead.companyName}</p>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>{getLeadStatusLabel(lead.status)}</span>
              {lead.city ? <span>· {lead.city}</span> : null}
              {lead.scorePriority && (
                <Badge
                  variant={getLeadPriorityBadgeVariant(lead.scorePriority)}
                  className="h-3.5 px-1 text-[9px]"
                >
                  {lead.scorePriority}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
              {lead.daysSinceLastContact}d
            </span>
            <Link href={`/leads/${lead.id}`}>
              <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]">
                Open
              </Button>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================================================================
   Mail Health
   ================================================================ */
function MailHealthCard({
  kpis,
  loading,
}: {
  kpis:
    | {
      sentEmails: number;
      failedEmails: number;
      pendingDrafts: number;
      scheduledEmails: number;
    }
    | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const failedEmails = kpis?.failedEmails ?? 0;
  const pendingDrafts = kpis?.pendingDrafts ?? 0;
  const scheduledEmails = kpis?.scheduledEmails ?? 0;
  const sentEmails = kpis?.sentEmails ?? 0;
  const totalQueue = failedEmails + pendingDrafts + scheduledEmails;
  const healthLabel =
    failedEmails > 0 ? "Actie nodig" : totalQueue > 0 ? "Actief" : "Stabiel";
  const healthVariant =
    failedEmails > 0 ? "destructive" : totalQueue > 0 ? "warning" : "success";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </p>
          <p className="mt-1 text-sm font-medium">
            {failedEmails > 0
              ? "Er staan mislukte mails klaar voor diagnose of retry."
              : totalQueue > 0
                ? "De queue draait, maar er zijn nog items die aandacht vragen."
                : "Geen acute problemen in de mailflow."}
          </p>
        </div>
        <Badge variant={healthVariant}>{healthLabel}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-muted-foreground">Verzonden</p>
          <p className="mt-1 text-lg font-semibold">{sentEmails}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-muted-foreground">Mislukt</p>
          <p className="mt-1 text-lg font-semibold">{failedEmails}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-muted-foreground">Goedkeuring</p>
          <p className="mt-1 text-lg font-semibold">{pendingDrafts}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-muted-foreground">Gepland</p>
          <p className="mt-1 text-lg font-semibold">{scheduledEmails}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/contacts">Open mailoverzicht</Link>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href="/settings/integrations">SMTP bekijken</Link>
        </Button>
      </div>
    </div>
  );
}

/* ================================================================
   Reminders Hub
   ================================================================ */
function RemindersHub() {
  const { data: followUps, isLoading } = trpc.dashboard.getUnifiedReminders.useQuery(undefined, {
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 p-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2.5 w-20" />
            </div>
            <Skeleton className="h-6 w-16 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  if (!followUps || followUps.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Clock className="h-7 w-7 text-muted-foreground/40" />
        <p className="mt-2 text-xs font-medium">Geen open reminders</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Nieuwe reminders verschijnen hier voor leads, offertes, mail en bookings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {followUps.items.slice(0, 5).map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="flex items-center gap-2.5 rounded-md p-2 transition-colors hover:bg-muted/50"
        >
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            item.tone === "amber"
              ? "bg-amber-50 dark:bg-amber-900/30"
              : item.tone === "blue"
                ? "bg-blue-50 dark:bg-blue-900/30"
                : item.tone === "emerald"
                  ? "bg-emerald-50 dark:bg-emerald-900/30"
                  : item.tone === "rose"
                    ? "bg-rose-50 dark:bg-rose-900/30"
                    : "bg-violet-50 dark:bg-violet-900/30"
          }`}>
            <Clock className={`h-3.5 w-3.5 ${
              item.tone === "amber"
                ? "text-amber-600 dark:text-amber-400"
                : item.tone === "blue"
                  ? "text-blue-600 dark:text-blue-400"
                  : item.tone === "emerald"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : item.tone === "rose"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-violet-600 dark:text-violet-400"
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{item.title}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {item.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]">
              Open
            </Button>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ================================================================
   Upcoming Bookings
   ================================================================ */
function UpcomingBookings() {
  const { data: bookings, isLoading } = trpc.dashboard.getUpcomingBookings.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-2.5 w-20" />
            </div>
            <Skeleton className="h-5 w-16 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!bookings || bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Calendar className="h-7 w-7 text-muted-foreground/40" />
        <p className="mt-2 text-xs text-muted-foreground">Geen aankomende afspraken</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {bookings.map((booking: NonNullable<typeof bookings>[number]) => (
        <Link
          key={booking.id}
          href="/bookings"
          className="flex items-center gap-2.5 rounded-md p-2 transition-colors hover:bg-muted/50"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{booking.clientName}</p>
            <p className="text-[11px] text-muted-foreground">
              {formatDate(booking.date)} - {booking.duration}min
            </p>
          </div>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {booking.status === "SCHEDULED"
              ? "Gepland"
              : booking.status === "CONFIRMED"
                ? "Bevestigd"
                : booking.status === "PENDING"
                  ? "Wachtend"
                  : booking.status}
          </Badge>
        </Link>
      ))}
    </div>
  );
}

/* ================================================================
   Open Chats
   ================================================================ */
function OpenChats() {
  const { data: chats, isLoading } = trpc.dashboard.getOpenChats.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-full" />
            </div>
            <Skeleton className="h-2.5 w-12" />
          </div>
        ))}
      </div>
    );
  }

  if (!chats || chats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <MessageSquare className="h-7 w-7 text-muted-foreground/40" />
        <p className="mt-2 text-xs text-muted-foreground">Geen openstaande chats</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {chats.map((chat: NonNullable<typeof chats>[number]) => (
        <Link
          key={chat.id}
          href={`/chatbot?session=${chat.id}`}
          className="flex items-center gap-2.5 rounded-md p-2 transition-colors hover:bg-muted/50"
        >
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${chat.isRead ? "bg-muted" : "bg-indigo-50 dark:bg-indigo-900/30"}`}>
            <MessageSquare className={`h-3.5 w-3.5 ${chat.isRead ? "text-muted-foreground" : "text-indigo-600 dark:text-indigo-400"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold truncate">{chat.visitorName}</p>
              {!chat.isRead && (
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
              )}
            </div>
            {chat.lastMessage && (
              <p className="text-[11px] text-muted-foreground truncate">
                {chat.lastMessage.slice(0, 60)}{chat.lastMessage.length > 60 ? "..." : ""}
              </p>
            )}
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {formatRelativeTime(chat.lastMessageAt)}
          </span>
        </Link>
      ))}
    </div>
  );
}

/* ================================================================
   Domain Monitor
   ================================================================ */
function DomainMonitor() {
  const { data: domains, isLoading } = trpc.dashboard.getDomainMonitor.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-2.5 w-20" />
            </div>
            <Skeleton className="h-5 w-14 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!domains || domains.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Globe2 className="h-7 w-7 text-muted-foreground/40" />
        <p className="mt-2 text-xs text-muted-foreground">Nog geen domeinmonitor beschikbaar</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {domains.map((domain: NonNullable<typeof domains>[number]) => {
        const statusTone =
          domain.websiteStatus === "online"
            ? "bg-emerald-500"
            : domain.websiteStatus === "slow"
              ? "bg-amber-500"
              : domain.websiteStatus === "offline"
                ? "bg-red-500"
                : "bg-slate-300";
        const statusLabel =
          domain.websiteStatus === "online"
            ? "Online"
            : domain.websiteStatus === "slow"
              ? "Traag"
              : domain.websiteStatus === "offline"
                ? "Offline"
                : "Onbekend";

        return (
          <Link
            key={domain.id}
            href={`/domains/${domain.id}`}
            className="flex items-center gap-2.5 rounded-md p-2 transition-colors hover:bg-muted/50"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900/40">
              <Globe2 className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{domain.domainName}</p>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className={`inline-block h-2 w-2 rounded-full ${statusTone}`} />
                {statusLabel}
                {domain.loadTimeMs ? ` · ${Math.round(domain.loadTimeMs)}ms` : ""}
                {domain.uniqueVisitors ? ` · ${domain.uniqueVisitors} bezoekers` : ""}
              </p>
            </div>
            <Badge
              variant={domain.sslStatus === "VALID" ? "success" : "secondary"}
              className="h-5 px-1.5 text-[10px] shrink-0"
            >
              {domain.sslStatus === "VALID" ? "SSL" : "Geen SSL"}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}

/* ================================================================
   Dashboard Page
   ================================================================ */
export default function DashboardPage() {
  const { data: kpis, isLoading } = trpc.dashboard.getKpis.useQuery();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Welkom terug. Hier is je overzicht.
        </p>
      </div>

      <FocusBoard
        kpis={kpis ? {
          failedEmails: kpis.failedEmails,
          pendingDrafts: kpis.pendingDrafts,
          pendingReviews: kpis.pendingReviews,
          hotLeads: kpis.hotLeads,
        } : undefined}
        loading={isLoading}
      />

      {/* KPI Cards - 4 columns */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <KpiCard
          title="Totaal Leads"
          value={kpis?.totalLeads ?? 0}
          icon={Users}
          href="/leads"
          loading={isLoading}
          colorClass="text-blue-600"
          bgClass="bg-blue-50 dark:bg-blue-900/30"
        />
        <KpiCard
          title="Nieuwe Leads (deze week)"
          value={kpis?.newLeads ?? 0}
          icon={UserPlus}
          href="/leads?status=NEW"
          loading={isLoading}
          colorClass="text-green-600"
          bgClass="bg-green-50 dark:bg-green-900/30"
        />
        <KpiCard
          title="Hot Leads"
          value={kpis?.hotLeads ?? 0}
          icon={Flame}
          href="/leads?priority=Hot"
          loading={isLoading}
          colorClass="text-red-600"
          bgClass="bg-red-50 dark:bg-red-900/30"
        />
        <KpiCard
          title="Gemiddelde Score"
          value={kpis?.avgScore ?? 0}
          icon={TrendingUp}
          loading={isLoading}
          colorClass="text-purple-600"
          bgClass="bg-purple-50 dark:bg-purple-900/30"
        />
        <KpiCard
          title="Openstaande Offertes"
          value={kpis?.activeQuotes ?? 0}
          icon={Receipt}
          href="/quotes"
          loading={isLoading}
          colorClass="text-orange-600"
          bgClass="bg-orange-50 dark:bg-orange-900/30"
        />
        <KpiCard
          title="Ongelezen Chats"
          value={kpis?.unreadChats ?? 0}
          icon={MessageSquare}
          href="/chatbot"
          loading={isLoading}
          colorClass="text-indigo-600"
          bgClass="bg-indigo-50 dark:bg-indigo-900/30"
        />
        <KpiCard
          title="E-mails in Draft"
          value={kpis?.pendingDrafts ?? 0}
          icon={Mail}
          href="/contacts/approval"
          loading={isLoading}
          colorClass="text-yellow-600"
          bgClass="bg-yellow-50 dark:bg-yellow-900/30"
        />
        <KpiCard
          title="Gewonnen Deals"
          value={kpis?.wonLeads ?? 0}
          icon={Trophy}
          href="/leads?status=WON"
          loading={isLoading}
          colorClass="text-emerald-600"
          bgClass="bg-emerald-50 dark:bg-emerald-900/30"
        />
        <KpiCard
          title="Respons Rate"
          value={`${kpis?.responseRate ?? 0}%`}
          icon={Send}
          loading={isLoading}
          colorClass="text-cyan-600"
          bgClass="bg-cyan-50 dark:bg-cyan-900/30"
        />
        <KpiCard
          title="Conversie Rate"
          value={`${kpis?.conversionRate ?? 0}%`}
          icon={Trophy}
          loading={isLoading}
          colorClass="text-lime-600"
          bgClass="bg-lime-50 dark:bg-lime-900/30"
        />
        <KpiCard
          title="Actieve Campagne Leads"
          value={kpis?.activeCampaignLeadCount ?? 0}
          icon={Target}
          href="/campaigns"
          loading={isLoading}
          colorClass="text-fuchsia-600"
          bgClass="bg-fuchsia-50 dark:bg-fuchsia-900/30"
        />
        <KpiCard
          title="Geplande Drips"
          value={kpis?.scheduledEmails ?? 0}
          icon={Clock}
          href="/campaigns"
          loading={isLoading}
          colorClass="text-violet-600"
          bgClass="bg-violet-50 dark:bg-violet-900/30"
        />
        <KpiCard
          title="Mislukte E-mails"
          value={kpis?.failedEmails ?? 0}
          icon={AlertTriangle}
          href="/contacts"
          loading={isLoading}
          colorClass="text-red-600"
          bgClass="bg-red-50 dark:bg-red-900/30"
        />
        <KpiCard
          title="Pending Reviews"
          value={kpis?.pendingReviews ?? 0}
          icon={Star}
          href="/reviews"
          loading={isLoading}
          colorClass="text-amber-600"
          bgClass="bg-amber-50 dark:bg-amber-900/30"
        />
      </div>

      {/* Second row: 2-column layout */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Left column - wider (~60%) */}
        <div className="space-y-4 lg:col-span-3">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-primary" />
                Snelle Acties
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <QuickActions />
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ActivityIcon className="h-4 w-4 text-primary" />
                  Recente Activiteit
                </CardTitle>
                <Link
                  href="/leads"
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Bekijk alles
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ActivityFeed />
            </CardContent>
          </Card>
        </div>

        {/* Right column (~40%) */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Top Leads
                </CardTitle>
                <Link
                  href="/leads"
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Alle leads
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <TopLeads />
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4 text-primary" />
                Pipeline Overzicht
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <PipelineOverview />
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Opvolging Nodig
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <FollowUpWidget />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Third row: 3-column layout */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-blue-600" />
                Aankomende Boekingen
              </CardTitle>
              <Link
                href="/bookings"
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Alles
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <UpcomingBookings />
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4 text-indigo-600" />
                Openstaande Chats
              </CardTitle>
              <Link
                href="/chatbot"
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Alles
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <OpenChats />
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-emerald-600" />
                Mail Health
              </CardTitle>
              <Link
                href="/settings/integrations"
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Instellingen
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <MailHealthCard
              kpis={kpis ? {
                sentEmails: kpis.sentEmails,
                failedEmails: kpis.failedEmails,
                pendingDrafts: kpis.pendingDrafts,
                scheduledEmails: kpis.scheduledEmails,
              } : undefined}
              loading={isLoading}
            />
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-violet-600" />
                Reminders
              </CardTitle>
              <Link
                href="/contacts"
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Outbound
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <RemindersHub />
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm md:col-span-2 xl:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Globe2 className="h-4 w-4 text-amber-600" />
                Domeinmonitor
              </CardTitle>
              <Link
                href="/domains"
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Alles
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <DomainMonitor />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
