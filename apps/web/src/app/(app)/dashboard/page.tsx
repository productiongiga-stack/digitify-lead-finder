"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  getLeadPriorityBadgeVariant,
  getLeadStatusDotClass,
  getLeadStatusLabel,
} from "@/lib/lead-status";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Skeleton,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  StatsCards,
  type StatItem,
  EmptyState,
} from "@digitify/ui";
import {
  Users,
  UserPlus,
  Flame,
  TrendingUp,
  Receipt,
  MessageSquare,
  Mail,
  Trophy,
  ArrowRight,
  Search,
  Target,
  FileText,
  Calendar,
  Star,
  Clock,
  Activity as ActivityIcon,
  UserCheck,
  Send,
  Zap,
  Globe2,
  AlertTriangle,
  CheckCircle,
  Bell,
  AlertOctagon,
} from "lucide-react";
import Link from "next/link";
import { formatRelativeTime, formatDate } from "@/lib/utils";

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
          className="group flex flex-col items-center gap-1.5 rounded-lg border border-border/50 bg-card p-2.5 text-center transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
            <action.icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold leading-tight">{action.label}</p>
            <p className="text-[10px] text-muted-foreground">{action.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ================================================================
   Action Center — groups urgent items by type from real tRPC data
   ================================================================ */
type ReminderItem = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  href: string;
  tone: string;
};

const ACTION_GROUPS: {
  key: string;
  label: string;
  icon: typeof Bell;
  types: string[];
  iconClass: string;
}[] = [
  {
    key: "leads",
    label: "Leads",
    icon: Flame,
    types: ["lead_followup"],
    iconClass: "text-rose-600 bg-rose-50 dark:bg-rose-900/30",
  },
  {
    key: "quotes",
    label: "Offertes",
    icon: Receipt,
    types: ["quote_followup"],
    iconClass: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30",
  },
  {
    key: "chats",
    label: "Chats",
    icon: MessageSquare,
    types: ["chat"],
    iconClass: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30",
  },
  {
    key: "bookings",
    label: "Bookings",
    icon: Calendar,
    types: ["booking_action"],
    iconClass: "text-blue-600 bg-blue-50 dark:bg-blue-900/30",
  },
  {
    key: "email",
    label: "E-mail",
    icon: Mail,
    types: ["email_followup", "email_failed"],
    iconClass: "text-violet-600 bg-violet-50 dark:bg-violet-900/30",
  },
];

function ActionCenter({
  kpis,
  loading,
}: {
  kpis:
    | {
        failedEmails: number;
        unreadChats: number;
        hotLeads: number;
      }
    | undefined;
  loading: boolean;
}) {
  const { data: reminders, isLoading: remindersLoading } =
    trpc.dashboard.getUnifiedReminders.useQuery(undefined, { staleTime: 60_000 });

  const items = useMemo<ReminderItem[]>(() => {
    const list: ReminderItem[] = [];
    if (kpis && kpis.failedEmails > 0) {
      list.push({
        id: "synthetic-email-failed",
        type: "email_failed",
        title: `${kpis.failedEmails} mislukte e-mails`,
        subtitle: "Ondernemen of opnieuw versturen",
        href: "/contacts",
        tone: "rose",
      });
    }
    if (kpis && kpis.unreadChats > 0) {
      list.push({
        id: "synthetic-chats-unread",
        type: "chat",
        title: `${kpis.unreadChats} ongelezen chat${kpis.unreadChats !== 1 ? "s" : ""}`,
        subtitle: "Bezoeker wacht op antwoord",
        href: "/chatbot",
        tone: "indigo",
      });
    }
    if (reminders?.items) {
      list.push(...(reminders.items as ReminderItem[]));
    }
    return list;
  }, [reminders, kpis]);

  const grouped = useMemo(() => {
    const out: Record<string, ReminderItem[]> = {};
    for (const group of ACTION_GROUPS) out[group.key] = [];
    for (const item of items) {
      const group = ACTION_GROUPS.find((g) => g.types.includes(item.type));
      if (group) out[group.key].push(item);
    }
    return out;
  }, [items]);

  const totalCount = items.length;
  const isLoading = loading || remindersLoading;

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-2.5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertOctagon className="h-4 w-4 text-primary" />
            Action Center
          </CardTitle>
          <Badge
            variant={totalCount > 0 ? "warning" : "success"}
            className="h-6 px-2"
          >
            {isLoading ? "…" : totalCount > 0 ? `${totalCount} open` : "Up to date"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : totalCount === 0 ? (
          <EmptyState
            icon={<CheckCircle />}
            title="Alles is rustig"
            description="Geen openstaande acties — gebruik de tijd voor nieuwe leads."
            size="sm"
          />
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {ACTION_GROUPS.map((group) => {
              const groupItems = grouped[group.key] ?? [];
              if (groupItems.length === 0) return null;
              const Icon = group.icon;
              return (
                <div
                  key={group.key}
                  className="rounded-lg border border-border/60 bg-muted/20 p-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-md ${group.iconClass}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-xs font-semibold">{group.label}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {groupItems.length}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {groupItems.slice(0, 3).map((item) => (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className="flex items-start justify-between gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-background"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium leading-tight">
                              {item.title}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {item.subtitle}
                            </p>
                          </div>
                          <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/60" />
                        </Link>
                      </li>
                    ))}
                    {groupItems.length > 3 ? (
                      <li className="px-1.5 text-[11px] text-muted-foreground">
                        +{groupItems.length - 3} meer
                      </li>
                    ) : null}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ================================================================
   Activity Feed
   ================================================================ */
function getActivityIcon(type?: string) {
  switch (type) {
    case "LEAD_CREATED":
      return UserPlus;
    case "LEAD_STATUS_CHANGED":
      return Zap;
    case "EMAIL_SENT":
      return Send;
    case "EMAIL_DRAFTED":
      return Mail;
    case "EMAIL_APPROVED":
      return UserCheck;
    case "NOTE_ADDED":
      return MessageSquare;
    case "LEAD_SCORED":
      return TrendingUp;
    case "CAMPAIGN_CREATED":
      return Target;
    case "REPORT_GENERATED":
      return FileText;
    case "QUOTE_CREATED":
      return Receipt;
    case "QUOTE_SENT":
      return Receipt;
    case "REVIEW_SENT":
      return Star;
    default:
      return ActivityIcon;
  }
}

function getActivityHref(activity: { lead?: { id: string } | null; metadata?: unknown }) {
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
    return <EmptyState icon={<ActivityIcon />} title="Nog geen activiteit" size="sm" />;
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
            className={`flex items-center gap-2.5 rounded-md p-1.5 text-sm transition-colors hover:bg-muted/50 ${!href ? "pointer-events-none" : ""}`}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{activity.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">
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
    return <EmptyState icon={<Users />} title="Nog geen leads met scores" size="sm" />;
  }

  const getScoreBg = (priority: string | null) => {
    switch (priority) {
      case "Hot":
        return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
      case "Warm":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400";
      default:
        return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
    }
  };

  return (
    <div className="space-y-0.5">
      {leads.map((lead: NonNullable<typeof leads>[number]) => (
        <Link
          key={lead.id}
          href={`/leads/${lead.id}`}
          className="flex items-center gap-2.5 rounded-md p-1.5 transition-colors hover:bg-muted/50"
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${getScoreBg(lead.scorePriority)}`}
          >
            {Math.round(lead.overallScore ?? 0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{lead.companyName}</p>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${getLeadStatusDotClass(lead.status)}`}
              />
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

  const total =
    stages?.reduce(
      (sum: number, stage: NonNullable<typeof stages>[number]) => sum + stage.count,
      0,
    ) ?? 0;

  if (!stages || stages.length === 0) {
    return <EmptyState icon={<Target />} title="Geen pipeline data" size="sm" />;
  }

  return (
    <div className="space-y-2.5">
      {stages.map((stage: NonNullable<typeof stages>[number]) => {
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
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: stage.color }}
              />
            </div>
          </div>
        );
      })}
      {total > 0 && (
        <div className="flex items-center justify-between border-t pt-1.5 text-xs">
          <span className="text-muted-foreground">Totaal</span>
          <span className="font-bold">{total}</span>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Follow-Up Widget — leads without follow-up
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
      <EmptyState
        icon={<TrendingUp />}
        title="Alle leads up-to-date"
        description="Geen leads die opvolging nodig hebben."
        size="sm"
      />
    );
  }

  return (
    <div className="space-y-0.5">
      {leads.slice(0, 5).map((lead: NonNullable<typeof leads>[number]) => (
        <div
          key={lead.id}
          className="flex items-center gap-2.5 rounded-md p-1.5 transition-colors hover:bg-muted/50"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30">
            <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{lead.companyName}</p>
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
          <div className="flex shrink-0 items-center gap-1.5">
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
   Tasks Today — bookings due today
   ================================================================ */
function TasksToday() {
  const { data: bookings, isLoading } = trpc.dashboard.getUpcomingBookings.useQuery();

  const todays = useMemo(() => {
    if (!bookings) return [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return bookings.filter((b: NonNullable<typeof bookings>[number]) => {
      const d = new Date(b.date);
      return d >= start && d < end;
    });
  }, [bookings]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  }

  if (todays.length === 0) {
    return <EmptyState icon={<Calendar />} title="Geen taken vandaag" size="sm" />;
  }

  return (
    <div className="space-y-0.5">
      {todays.map((b: (typeof todays)[number]) => (
        <Link
          key={b.id}
          href="/bookings"
          className="flex items-center gap-2.5 rounded-md p-1.5 transition-colors hover:bg-muted/50"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{b.clientName}</p>
            <p className="text-[11px] text-muted-foreground">
              {new Date(b.date).toLocaleTimeString("nl-BE", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · {b.duration}min
            </p>
          </div>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {b.status === "SCHEDULED"
              ? "Gepland"
              : b.status === "CONFIRMED"
                ? "Bevestigd"
                : b.status === "PENDING"
                  ? "Wachtend"
                  : b.status}
          </Badge>
        </Link>
      ))}
    </div>
  );
}

/* ================================================================
   Upcoming Bookings (all upcoming)
   ================================================================ */
function UpcomingBookings() {
  const { data: bookings, isLoading } = trpc.dashboard.getUpcomingBookings.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  }

  if (!bookings || bookings.length === 0) {
    return <EmptyState icon={<Calendar />} title="Geen aankomende afspraken" size="sm" />;
  }

  return (
    <div className="space-y-0.5">
      {bookings.map((booking: NonNullable<typeof bookings>[number]) => (
        <Link
          key={booking.id}
          href="/bookings"
          className="flex items-center gap-2.5 rounded-md p-1.5 transition-colors hover:bg-muted/50"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{booking.clientName}</p>
            <p className="text-[11px] text-muted-foreground">
              {formatDate(booking.date)} · {booking.duration}min
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
   Active Chats
   ================================================================ */
function ActiveChats() {
  const { data: chats, isLoading } = trpc.dashboard.getOpenChats.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  }

  if (!chats || chats.length === 0) {
    return <EmptyState icon={<MessageSquare />} title="Geen openstaande chats" size="sm" />;
  }

  return (
    <div className="space-y-0.5">
      {chats.map((chat: NonNullable<typeof chats>[number]) => (
        <Link
          key={chat.id}
          href={`/chatbot?session=${chat.id}`}
          className="flex items-center gap-2.5 rounded-md p-1.5 transition-colors hover:bg-muted/50"
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${chat.isRead ? "bg-muted" : "bg-indigo-50 dark:bg-indigo-900/30"}`}
          >
            <MessageSquare
              className={`h-3.5 w-3.5 ${chat.isRead ? "text-muted-foreground" : "text-indigo-600 dark:text-indigo-400"}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-xs font-semibold">{chat.visitorName}</p>
              {!chat.isRead && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
              )}
            </div>
            {chat.lastMessage ? (
              <p className="truncate text-[11px] text-muted-foreground">
                {chat.lastMessage.slice(0, 60)}
                {chat.lastMessage.length > 60 ? "..." : ""}
              </p>
            ) : null}
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
   Expiring Domains
   ================================================================ */
function ExpiringDomains() {
  const { data: domains, isLoading } = trpc.dashboard.getExpiringDomains.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  }

  if (!domains || domains.length === 0) {
    return (
      <EmptyState
        icon={<Globe2 />}
        title="Geen verlopende domeinen"
        description="Alle domeinen zijn nog ≥30 dagen geldig."
        size="sm"
      />
    );
  }

  return (
    <div className="space-y-0.5">
      {domains.map((domain: NonNullable<typeof domains>[number]) => {
        const days = Math.max(
          0,
          Math.ceil(
            (new Date(domain.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
          ),
        );
        return (
          <Link
            key={domain.id}
            href={`/domains/${domain.id}`}
            className="flex items-center gap-2.5 rounded-md p-1.5 transition-colors hover:bg-muted/50"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30">
              <Globe2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{domain.domainName}</p>
              <p className="text-[11px] text-muted-foreground">
                {domain.registrar ? `${domain.registrar} · ` : ""}
                Verloopt over {days} {days === 1 ? "dag" : "dagen"}
              </p>
            </div>
            <Badge
              variant={days <= 7 ? "destructive" : "warning"}
              className="h-5 px-1.5 text-[10px]"
            >
              {days}d
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
  const queueCount =
    (kpis?.pendingDrafts ?? 0) + (kpis?.failedEmails ?? 0) + (kpis?.pendingReviews ?? 0);

  const pipelineRevenue = kpis?.totalQuoteValue ?? 0;
  const formatEUR = (n: number) =>
    new Intl.NumberFormat("nl-BE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);

  // Primary KPIs — front-of-house metrics
  const primaryKpis: StatItem[] = [
    {
      label: "Totaal Leads",
      value: kpis?.totalLeads ?? 0,
      icon: <Users />,
      href: "/leads",
      hint: kpis ? `+${kpis.newLeads} deze week` : undefined,
      tone: "positive",
    },
    {
      label: "Hot Leads",
      value: kpis?.hotLeads ?? 0,
      icon: <Flame />,
      href: "/leads?priority=Hot",
      tone: (kpis?.hotLeads ?? 0) > 0 ? "warning" : "neutral",
    },
    {
      label: "Open Quotes",
      value: kpis?.activeQuotes ?? 0,
      icon: <Receipt />,
      href: "/quotes",
    },
    {
      label: "Quote Pipeline",
      value: formatEUR(pipelineRevenue),
      icon: <Euro />,
      hint: "Open + goedgekeurd",
      tone: pipelineRevenue > 0 ? "positive" : "neutral",
    },
    {
      label: "Active Chats",
      value: kpis?.unreadChats ?? 0,
      icon: <MessageSquare />,
      href: "/chatbot",
      tone: (kpis?.unreadChats ?? 0) > 0 ? "warning" : "neutral",
    },
    {
      label: "E-mails in Draft",
      value: kpis?.pendingDrafts ?? 0,
      icon: <Mail />,
      href: "/contacts/approval",
    },
    {
      label: "Mislukte E-mails",
      value: kpis?.failedEmails ?? 0,
      icon: <AlertTriangle />,
      href: "/contacts",
      tone: (kpis?.failedEmails ?? 0) > 0 ? "negative" : "neutral",
    },
    {
      label: "Pending Reviews",
      value: kpis?.pendingReviews ?? 0,
      icon: <Star />,
      href: "/reviews",
    },
  ];

  // Secondary metrics
  const secondaryKpis: StatItem[] = [
    {
      label: "Gemiddelde Score",
      value: kpis?.avgScore ?? 0,
      icon: <TrendingUp />,
    },
    {
      label: "Gewonnen Deals",
      value: kpis?.wonLeads ?? 0,
      icon: <Trophy />,
      href: "/leads?status=WON",
      tone: "positive",
    },
    {
      label: "Respons Rate",
      value: `${kpis?.responseRate ?? 0}%`,
      icon: <Send />,
    },
    {
      label: "Conversie Rate",
      value: `${kpis?.conversionRate ?? 0}%`,
      icon: <Trophy />,
      tone: (kpis?.conversionRate ?? 0) >= 10 ? "positive" : "neutral",
    },
    {
      label: "Active Campaign Leads",
      value: kpis?.activeCampaignLeadCount ?? 0,
      icon: <Target />,
      href: "/campaigns",
    },
    {
      label: "Geplande Drips",
      value: kpis?.scheduledEmails ?? 0,
      icon: <Clock />,
      href: "/campaigns",
    },
  ];

  return (
    <div className="app-page">
      {/* Header */}
      <div className="app-page-heading">
        <h1 className="app-page-title">Dashboard</h1>
        <p className="app-page-subtitle">Welkom terug. Hier is je overzicht.</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="h-6 px-2">
            {kpis?.totalLeads ?? 0} leads
          </Badge>
          <Badge variant={queueCount > 0 ? "warning" : "success"} className="h-6 px-2">
            {queueCount > 0 ? `${queueCount} items vragen actie` : "Geen open actie-items"}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-3">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3">
          {/* Action Center — top priority */}
          <ActionCenter
            kpis={
              kpis
                ? {
                    failedEmails: kpis.failedEmails,
                    unreadChats: kpis.unreadChats,
                    hotLeads: kpis.hotLeads,
                  }
                : undefined
            }
            loading={isLoading}
          />

          {/* Primary KPIs — compact grid */}
          <StatsCards items={primaryKpis} columns={4} loading={isLoading && !kpis} />

          {/* Today + Pipeline + Top Leads */}
          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2.5">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Bell className="h-4 w-4 text-primary" />
                  Tasks Today
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <TasksToday />
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2.5">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Leads zonder follow-up
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <FollowUpWidget />
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2.5">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Top Leads
                  </CardTitle>
                  <Link
                    href="/leads"
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    Alle
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <TopLeads />
              </CardContent>
            </Card>
          </div>

          {/* Quick actions + activity */}
          <div className="grid gap-3 lg:grid-cols-5">
            <div className="space-y-3 lg:col-span-3">
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2.5">
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
                <CardHeader className="pb-2.5">
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

            <div className="space-y-3 lg:col-span-2">
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2.5">
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
                <CardHeader className="pb-2.5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Globe2 className="h-4 w-4 text-amber-600" />
                      Verlopende Domeinen
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
                  <ExpiringDomains />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Bottom row: bookings + chats */}
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2.5">
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
              <CardHeader className="pb-2.5">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <MessageSquare className="h-4 w-4 text-indigo-600" />
                    Active Chats
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
                <ActiveChats />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="info" className="space-y-3">
          <StatsCards items={secondaryKpis} columns={3} loading={isLoading && !kpis} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
