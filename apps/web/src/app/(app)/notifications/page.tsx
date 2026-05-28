"use client";

import { useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from "@digitify/ui";
import {
  AlertOctagon,
  ArrowRight,
  Calendar,
  CheckCircle,
  Flame,
  Globe2,
  Mail,
  MessageSquare,
  Receipt,
  SendHorizonal,
  Star,
  type LucideIcon,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

type AttentionItem = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  href: string;
  tone: string;
  dueAt?: Date | string | null;
};

const NOTIFICATION_GROUPS: {
  key: string;
  label: string;
  icon: LucideIcon;
  types: string[];
  iconClass: string;
}[] = [
  {
    key: "outbound",
    label: "Outbound",
    icon: SendHorizonal,
    types: [
      "outbound_approval",
      "outbound_ready",
      "outbound_failed",
      "outbound_rejected",
      "email_followup",
      "email_failed",
    ],
    iconClass: "text-violet-600 bg-violet-50 dark:bg-violet-900/30",
  },
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
    key: "bookings",
    label: "Boekingen",
    icon: Calendar,
    types: ["booking_action"],
    iconClass: "text-blue-600 bg-blue-50 dark:bg-blue-900/30",
  },
  {
    key: "chats",
    label: "Chats",
    icon: MessageSquare,
    types: ["chat_unread"],
    iconClass: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30",
  },
  {
    key: "reviews",
    label: "Reviews",
    icon: Star,
    types: ["review_pending"],
    iconClass: "text-amber-600 bg-amber-50 dark:bg-amber-900/30",
  },
  {
    key: "domains",
    label: "Domeinen",
    icon: Globe2,
    types: ["domain_expiring"],
    iconClass: "text-orange-600 bg-orange-50 dark:bg-orange-900/30",
  },
];

const TONE_BORDER: Record<string, string> = {
  amber: "border-l-amber-500",
  blue: "border-l-blue-500",
  rose: "border-l-rose-500",
  violet: "border-l-violet-500",
  emerald: "border-l-emerald-500",
  indigo: "border-l-indigo-500",
  yellow: "border-l-yellow-500",
  orange: "border-l-orange-500",
};

function NotificationItemRow({ item }: { item: AttentionItem }) {
  const borderClass = TONE_BORDER[item.tone] ?? "border-l-primary";

  return (
    <Link
      href={item.href}
      className={`notification-item-row flex items-start justify-between gap-3 rounded-xl border border-border/60 border-l-[3px] bg-card/80 px-3 py-2.5 transition-colors hover:bg-accent/40 ${borderClass}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{item.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.subtitle}</p>
        {item.dueAt ? (
          <p className="mt-1 text-[11px] text-muted-foreground/80">
            {formatRelativeTime(item.dueAt)}
          </p>
        ) : null}
      </div>
      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
    </Link>
  );
}

export default function NotificationsPage() {
  const { data, isLoading } = trpc.dashboard.getAttentionQueue.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const grouped = useMemo(() => {
    const items = (data?.items ?? []) as AttentionItem[];
    const out: Record<string, AttentionItem[]> = {};
    for (const group of NOTIFICATION_GROUPS) out[group.key] = [];
    for (const item of items) {
      const group = NOTIFICATION_GROUPS.find((entry) => entry.types.includes(item.type));
      if (group) out[group.key].push(item);
    }
    return out;
  }, [data?.items]);

  const totalCount = data?.totalCount ?? 0;
  const activeGroups = NOTIFICATION_GROUPS.filter(
    (group) => (grouped[group.key]?.length ?? 0) > 0,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Meldingen</h1>
          <p className="text-sm text-muted-foreground">
            Alles wat aandacht vereist — goedkeuringen, follow-ups, chats en meer
          </p>
        </div>
        <Badge
          variant={totalCount > 0 ? "warning" : "success"}
          className="h-8 px-3 text-xs"
        >
          {isLoading ? "…" : totalCount > 0 ? `${totalCount} open` : "Alles bijgewerkt"}
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : totalCount === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12">
            <EmptyState
              icon={<CheckCircle />}
              title="Geen open meldingen"
              description="Alles is bijgewerkt. Nieuwe items verschijnen hier automatisch."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activeGroups.map((group) => {
            const groupItems = grouped[group.key] ?? [];
            const Icon = group.icon;
            return (
              <Card key={group.key} className="overflow-hidden border-border/50 bg-card/90 shadow-sm">
                <CardHeader className="border-b border-border/40 bg-muted/20 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-lg ${group.iconClass}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {group.label}
                    </CardTitle>
                    <Badge variant="secondary" className="h-6 px-2 text-[11px]">
                      {groupItems.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 p-3 pt-3">
                  {groupItems.map((item) => (
                    <NotificationItemRow key={item.id} item={item} />
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!isLoading && totalCount > 0 ? (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-dashed border-border/60 bg-muted/15 p-3">
          <p className="w-full text-xs font-medium text-muted-foreground">Snelle links</p>
          <Link
            href="/contacts/approval"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
          >
            <Mail className="h-3.5 w-3.5" />
            Goedkeuringswachtrij
          </Link>
          <Link
            href="/contacts"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
          >
            <SendHorizonal className="h-3.5 w-3.5" />
            Outbound Center
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
          >
            <AlertOctagon className="h-3.5 w-3.5" />
            Dashboard
          </Link>
        </div>
      ) : null}
    </div>
  );
}
