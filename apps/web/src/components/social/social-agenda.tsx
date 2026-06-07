"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@digitify/ui";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Facebook,
  Film,
  ImageIcon,
  Instagram,
  Plus,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/feedback/toast-provider";
import { cn } from "@/lib/utils";
import {
  addDays,
  agendaRangeForView,
  formatDayHeader,
  formatDutchMonthYear,
  formatLongDutchDate,
  formatShortDay,
  formatTimeNl,
  fromDateKey,
  isSameDateKey,
  monthCalendarCells,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateKey,
  weekdayLabel,
} from "@/lib/calendar-date";

export type SocialAgendaPost = {
  id: string;
  caption: string;
  status: string;
  scheduledFor: string | Date | null;
  publishedAt: string | Date | null;
  imageUrl: string;
  targetPlatforms: string[];
  metadata?: unknown;
};

type CalendarView = "DAY" | "WEEK" | "MONTH";

const STATUS_META: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-slate-500/15 text-slate-700 dark:text-slate-200" },
  PENDING_APPROVAL: { label: "Approval", className: "bg-amber-500/15 text-amber-800 dark:text-amber-200" },
  SCHEDULED: { label: "Gepland", className: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" },
  PUBLISHING: { label: "Publiceren", className: "bg-violet-500/15 text-violet-800 dark:text-violet-200" },
  PUBLISHED: { label: "Live", className: "bg-sky-500/15 text-sky-800 dark:text-sky-200" },
  FAILED: { label: "Mislukt", className: "bg-red-500/15 text-red-800 dark:text-red-200" },
  CANCELLED: { label: "Geannuleerd", className: "bg-muted text-muted-foreground" },
};

function postCalendarDate(post: SocialAgendaPost): Date | null {
  const raw = post.scheduledFor || post.publishedAt;
  if (!raw) return null;
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function postDateKey(post: SocialAgendaPost) {
  const date = postCalendarDate(post);
  return date ? toDateKey(date) : null;
}

function postTimeLabel(post: SocialAgendaPost) {
  const date = postCalendarDate(post);
  if (!date) return "—";
  return formatTimeNl(date);
}

function hasReel(post: SocialAgendaPost) {
  const metadata = (post.metadata || {}) as { placements?: string[] };
  return metadata.placements?.includes("REEL");
}

type Props = {
  canReschedule?: boolean;
  onSelectPost: (post: SocialAgendaPost) => void;
  onPlanNew: (date: Date) => void;
};

function PostAgendaCard({
  post,
  draggable,
  onDragStart,
  onDragEnd,
  onClick,
  compact,
}: {
  post: SocialAgendaPost;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onClick: () => void;
  compact?: boolean;
}) {
  const status = STATUS_META[post.status] ?? STATUS_META.DRAFT;
  const platforms = post.targetPlatforms || [];

  return (
    <button
      type="button"
      data-agenda-card="true"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border border-border/60 bg-background/90 p-2 text-left shadow-sm transition-all hover:border-amber-300/60 hover:shadow-md",
        compact ? "p-1.5" : "p-2.5",
      )}
    >
      <div className="flex gap-2">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
          {post.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              {hasReel(post) ? <Film className="h-4 w-4 text-muted-foreground" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold tabular-nums text-amber-700 dark:text-amber-300">
              {postTimeLabel(post)}
            </span>
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", status.className)}>
              {status.label}
            </span>
          </div>
          <p className={cn("line-clamp-2 font-medium leading-snug text-foreground", compact ? "text-[11px]" : "text-xs")}>
            {post.caption || "Zonder caption"}
          </p>
          <div className="mt-1 flex gap-1">
            {platforms.includes("FACEBOOK") ? <Facebook className="h-3 w-3 text-blue-600" /> : null}
            {platforms.includes("INSTAGRAM") ? <Instagram className="h-3 w-3 text-pink-600" /> : null}
          </div>
        </div>
      </div>
    </button>
  );
}

export function SocialAgenda({ canReschedule = false, onSelectPost, onPlanNew }: Props) {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const [view, setView] = useState<CalendarView>("WEEK");
  const [currentDate, setCurrentDate] = useState(() => startOfDay(new Date()));
  const [draggingPostId, setDraggingPostId] = useState<string | null>(null);

  const range = useMemo(() => agendaRangeForView(view, currentDate), [view, currentDate]);

  const agendaQuery = trpc.social.getAgenda.useQuery({
    from: range.from,
    to: range.to,
  });

  const reschedulePost = trpc.social.reschedulePost.useMutation({
    onSuccess: async () => {
      await utils.social.getAgenda.invalidate();
      await utils.social.list.invalidate();
      showToast({ title: "Post verplaatst" });
    },
    onError: (error) =>
      showToast({ title: "Verplaatsen mislukt", description: error.message, variant: "error" }),
  });

  const postsByDate = useMemo(() => {
    const map = new Map<string, SocialAgendaPost[]>();
    for (const item of agendaQuery.data?.items ?? []) {
      const key = postDateKey(item as SocialAgendaPost);
      if (!key) continue;
      const bucket = map.get(key) ?? [];
      bucket.push(item as SocialAgendaPost);
      map.set(key, bucket);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const aDate = postCalendarDate(a)?.getTime() ?? 0;
        const bDate = postCalendarDate(b)?.getTime() ?? 0;
        return aDate - bDate;
      });
    }
    return map;
  }, [agendaQuery.data?.items]);

  const dayPosts = useMemo(() => {
    const key = toDateKey(currentDate);
    return postsByDate.get(key) ?? [];
  }, [currentDate, postsByDate]);

  const weekDates = useMemo(() => {
    const start = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [currentDate]);

  const monthCells = useMemo(() => monthCalendarCells(currentDate), [currentDate]);

  const unscheduled = (agendaQuery.data?.unscheduled ?? []) as SocialAgendaPost[];

  function shiftRange(direction: -1 | 1) {
    setCurrentDate((prev) => {
      if (view === "DAY") return addDays(prev, direction);
      if (view === "WEEK") return addDays(prev, direction * 7);
      return startOfDay(new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
    });
  }

  async function movePostToSlot(postId: string, dateKey: string, hour = 10) {
    const post = [...(agendaQuery.data?.items ?? []), ...unscheduled].find((item) => item.id === postId) as
      | SocialAgendaPost
      | undefined;
    if (!post || post.status !== "SCHEDULED" || !canReschedule) return;

    const existing = postCalendarDate(post);
    const next = fromDateKey(dateKey, existing?.getHours() ?? hour, existing?.getMinutes() ?? 0);
    await reschedulePost.mutateAsync({ id: postId, scheduledFor: next });
  }

  function rangeLabel() {
    if (view === "DAY") return formatLongDutchDate(currentDate);
    if (view === "WEEK") {
      const start = startOfWeek(currentDate);
      const end = addDays(start, 6);
      return `${formatShortDay(start)} – ${formatShortDay(end)}`;
    }
    return formatDutchMonthYear(currentDate);
  }

  const hourSlots = Array.from({ length: 17 }, (_, index) => index + 6);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-amber-200/50 shadow-sm dark:border-amber-900/30">
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-amber-50/80 via-background to-emerald-50/50 pb-4 dark:from-amber-950/20 dark:to-emerald-950/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
                  <CalendarDays className="h-5 w-5" />
                </span>
                Agenda
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Plan en bekijk je social posts per dag, week of maand.
                {canReschedule ? " Sleep ingeplande posts om ze te verplaatsen." : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(["DAY", "WEEK", "MONTH"] as const).map((entry) => (
                <Button
                  key={entry}
                  size="sm"
                  variant={view === entry ? "default" : "outline"}
                  className={view === entry ? "bg-amber-600 hover:bg-amber-500" : ""}
                  onClick={() => setView(entry)}
                >
                  {entry === "DAY" ? "Dag" : entry === "WEEK" ? "Week" : "Maand"}
                </Button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => shiftRange(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" className="min-w-[200px] font-medium" onClick={() => setCurrentDate(startOfDay(new Date()))}>
                {rangeLabel()}
              </Button>
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => shiftRange(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button size="sm" onClick={() => onPlanNew(currentDate)} className="bg-amber-600 hover:bg-amber-500">
              <Plus className="mr-2 h-4 w-4" />
              Post plannen
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {agendaQuery.isLoading ? (
            <div className="grid gap-3 md:grid-cols-7">
              {Array.from({ length: 7 }).map((_, index) => (
                <Skeleton key={index} className="h-32 rounded-xl" />
              ))}
            </div>
          ) : view === "DAY" ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground">{formatDayHeader(currentDate)}</p>
              <div className="space-y-2">
                {hourSlots.map((hour) => {
                  const slotPosts = dayPosts.filter((post) => (postCalendarDate(post)?.getHours() ?? -1) === hour);
                  return (
                    <div
                      key={hour}
                      className="grid grid-cols-[56px_1fr] gap-3 rounded-xl border border-border/40 p-2"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (!draggingPostId) return;
                        void movePostToSlot(draggingPostId, toDateKey(currentDate), hour);
                        setDraggingPostId(null);
                      }}
                    >
                      <div className="pt-1 text-xs font-medium tabular-nums text-muted-foreground">
                        {String(hour).padStart(2, "0")}:00
                      </div>
                      <div className="min-h-[52px] space-y-2">
                        {slotPosts.length ? (
                          slotPosts.map((post) => (
                            <PostAgendaCard
                              key={post.id}
                              post={post}
                              draggable={canReschedule && post.status === "SCHEDULED"}
                              onDragStart={() => setDraggingPostId(post.id)}
                              onDragEnd={() => setDraggingPostId(null)}
                              onClick={() => onSelectPost(post)}
                            />
                          ))
                        ) : (
                          <button
                            type="button"
                            onClick={() => onPlanNew(fromDateKey(toDateKey(currentDate), hour, 0))}
                            className="flex h-full min-h-[44px] w-full items-center justify-center rounded-lg border border-dashed border-transparent text-xs text-muted-foreground transition-colors hover:border-amber-300/50 hover:bg-amber-500/5 hover:text-foreground"
                          >
                            <Clock3 className="mr-1.5 h-3.5 w-3.5" />
                            Vrij slot
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : view === "WEEK" ? (
            <div className="grid gap-2 md:grid-cols-7">
              {weekDates.map((date) => {
                const dateKey = toDateKey(date);
                const isToday = isSameDateKey(dateKey, toDateKey(new Date()));
                const dayItems = postsByDate.get(dateKey) ?? [];
                return (
                  <div
                    key={dateKey}
                    className={cn(
                      "flex min-h-[280px] flex-col rounded-xl border p-2",
                      isToday ? "border-amber-400/60 bg-amber-500/5 shadow-sm" : "border-border/60 bg-background/40",
                    )}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (!draggingPostId) return;
                      void movePostToSlot(draggingPostId, dateKey);
                      setDraggingPostId(null);
                    }}
                  >
                    <div className="mb-2 flex items-center justify-between border-b border-border/40 pb-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {weekdayLabel(date)}
                        </p>
                        <p className="text-sm font-bold">{date.getDate()}</p>
                      </div>
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        {dayItems.length}
                      </Badge>
                    </div>
                    <div className="flex-1 space-y-2">
                      {dayItems.map((post) => (
                        <PostAgendaCard
                          key={post.id}
                          post={post}
                          compact
                          draggable={canReschedule && post.status === "SCHEDULED"}
                          onDragStart={() => setDraggingPostId(post.id)}
                          onDragEnd={() => setDraggingPostId(null)}
                          onClick={() => onSelectPost(post)}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => onPlanNew(date)}
                        className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border/70 py-2 text-[11px] text-muted-foreground transition-colors hover:border-amber-300/60 hover:bg-amber-500/5"
                      >
                        <Plus className="h-3 w-3" />
                        Toevoegen
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <div className="mb-2 grid grid-cols-7 gap-2">
                {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((label) => (
                  <div key={label} className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {monthCells.map((date, index) => {
                  if (!date) {
                    return <div key={`empty-${index}`} className="min-h-[110px] rounded-xl bg-muted/20" />;
                  }
                  const dateKey = toDateKey(date);
                  const isToday = isSameDateKey(dateKey, toDateKey(new Date()));
                  const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                  const dayItems = postsByDate.get(dateKey) ?? [];
                  return (
                    <div
                      key={dateKey}
                      className={cn(
                        "min-h-[110px] rounded-xl border p-1.5 transition-colors",
                        isToday ? "border-amber-400/70 bg-amber-500/5" : "border-border/50 bg-background/50",
                        !isCurrentMonth && "opacity-40",
                      )}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (!draggingPostId) return;
                        void movePostToSlot(draggingPostId, dateKey);
                        setDraggingPostId(null);
                      }}
                    >
                      <button
                        type="button"
                        className="mb-1 flex w-full items-center justify-between px-0.5"
                        onClick={() => {
                          setCurrentDate(date);
                          setView("DAY");
                        }}
                      >
                        <span className={cn("text-xs font-semibold", isToday && "text-amber-700 dark:text-amber-300")}>
                          {date.getDate()}
                        </span>
                        {dayItems.length ? (
                          <span className="rounded-full bg-amber-500/15 px-1.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
                            {dayItems.length}
                          </span>
                        ) : null}
                      </button>
                      <div className="space-y-1">
                        {dayItems.slice(0, 2).map((post) => (
                          <button
                            key={post.id}
                            type="button"
                            draggable={canReschedule && post.status === "SCHEDULED"}
                            onDragStart={() => setDraggingPostId(post.id)}
                            onDragEnd={() => setDraggingPostId(null)}
                            onClick={() => onSelectPost(post)}
                            className="block w-full truncate rounded-md bg-amber-500/10 px-1.5 py-0.5 text-left text-[10px] font-medium text-amber-900 hover:bg-amber-500/20 dark:text-amber-100"
                          >
                            {postTimeLabel(post)} · {(post.caption || "").slice(0, 28)}
                          </button>
                        ))}
                        {dayItems.length > 2 ? (
                          <button
                            type="button"
                            className="text-[10px] text-muted-foreground hover:underline"
                            onClick={() => {
                              setCurrentDate(date);
                              setView("DAY");
                            }}
                          >
                            +{dayItems.length - 2} meer
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Nog niet ingepland</CardTitle>
            <Badge variant="outline">{unscheduled.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Drafts, posts in approval en mislukte publicaties zonder datum.</p>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {unscheduled.length === 0 ? (
            <p className="text-sm text-muted-foreground sm:col-span-full">Alles staat in de agenda.</p>
          ) : (
            unscheduled.map((post) => (
              <PostAgendaCard key={post.id} post={post} onClick={() => onSelectPost(post)} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
