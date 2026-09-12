"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@digitify/ui";
import { CalendarDays, CheckCircle2, Clock3, ExternalLink, ListTodo, RefreshCw } from "lucide-react";

type ViewFilter = "ALL" | "TASK" | "BOOKING";
type AgendaItem = {
  id: string;
  kind: "TASK" | "BOOKING";
  title: string;
  date: Date;
  detail?: string;
  status: string;
  href: string;
  leadId?: string | null;
  priority?: string;
};

function formatDate(date: Date) {
  return date.toLocaleDateString("nl-BE", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function AgendaPageInner() {
  const [filter, setFilter] = useState<ViewFilter>("ALL");
  const [horizon, setHorizon] = useState("30");
  const utils = trpc.useUtils();
  const tasks = trpc.task.list.useQuery(
    { page: 1, pageSize: 100, syncGoogleCalendar: false },
    { staleTime: 10_000 },
  );
  const bookings = trpc.booking.list.useQuery(
    { page: 1, pageSize: 100 },
    { staleTime: 10_000 },
  );
  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => utils.task.list.invalidate(),
  });

  const items = useMemo<AgendaItem[]>(() => {
    const from = startOfToday();
    const to = addDays(from, Number(horizon));
    const taskItems: AgendaItem[] = (tasks.data?.items ?? [])
      .filter((task) => task.dueAt)
      .map((task) => ({
        id: task.id,
        kind: "TASK",
        title: task.title,
        date: new Date(task.dueAt!),
        detail: task.relatedLabel ?? undefined,
        status: task.status,
        href: task.relatedType === "LEAD" && task.relatedId ? `/leads/${task.relatedId}` : "/tasks",
        leadId: task.relatedType === "LEAD" ? task.relatedId : null,
        priority: task.priority,
      }));
    const bookingItems: AgendaItem[] = (bookings.data?.bookings ?? []).map((booking) => ({
      id: booking.id,
      kind: "BOOKING",
      title: booking.clientName,
      date: new Date(booking.date),
      detail: booking.lead?.companyName ?? booking.eventType?.name ?? undefined,
      status: booking.status,
      href: "/bookings",
      leadId: booking.lead?.id,
    }));

    return [...taskItems, ...bookingItems]
      .filter((item) => item.date >= from && item.date < to)
      .filter((item) => filter === "ALL" || item.kind === filter)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [bookings.data?.bookings, filter, horizon, tasks.data?.items]);

  const isLoading = tasks.isLoading || bookings.isLoading;
  const error = tasks.error ?? bookings.error;
  const refresh = () => {
    void tasks.refetch();
    void bookings.refetch();
  };

  return (
    <div className="app-page space-y-5">
      <div className="app-page-header flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="app-page-heading">
          <div className="mb-2 flex items-center gap-2 text-primary">
            <CalendarDays className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Werkdag</span>
          </div>
          <h1 className="app-page-title">Agenda</h1>
          <p className="app-page-subtitle">Taken, afspraken en deadlines op één plek.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filter} onValueChange={(value) => setFilter(value as ViewFilter)}>
            <SelectTrigger className="w-[145px]" aria-label="Agenda filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Alles</SelectItem>
              <SelectItem value="TASK">Taken</SelectItem>
              <SelectItem value="BOOKING">Afspraken</SelectItem>
            </SelectContent>
          </Select>
          <Select value={horizon} onValueChange={setHorizon}>
            <SelectTrigger className="w-[145px]" aria-label="Agenda periode"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Komende 7 dagen</SelectItem>
              <SelectItem value="30">Komende 30 dagen</SelectItem>
              <SelectItem value="90">Komende 90 dagen</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={refresh} disabled={tasks.isFetching || bookings.isFetching} title="Agenda verversen" aria-label="Agenda verversen">
            <RefreshCw className={(tasks.isFetching || bookings.isFetching) ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="app-surface"><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">In beeld</p><p className="mt-2 text-2xl font-semibold">{isLoading ? "—" : items.length}</p><p className="mt-1 text-xs text-muted-foreground">geplande items</p></CardContent></Card>
        <Card className="app-surface"><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Taken</p><p className="mt-2 text-2xl font-semibold">{tasks.isLoading ? "—" : tasks.data?.summary.todo ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">openstaand</p></CardContent></Card>
        <Card className="app-surface"><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Afspraken</p><p className="mt-2 text-2xl font-semibold">{bookings.isLoading ? "—" : bookings.data?.total ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">in je werkruimte</p></CardContent></Card>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)}</div>
      ) : error ? (
        <QueryErrorState message={error.message} onRetry={refresh} />
      ) : items.length === 0 ? (
        <Card className="app-surface"><CardContent className="p-0"><EmptyState icon={<CalendarDays />} title="Geen geplande items" description="Voor deze periode zijn er geen taken of afspraken gevonden." /></CardContent></Card>
      ) : (
        <Card className="app-surface">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
            <CardTitle className="text-base">Komende planning</CardTitle>
            <span className="text-xs text-muted-foreground">{formatDate(items[0].date)} als volgende</span>
          </CardHeader>
          <CardContent className="divide-y divide-border/60 p-0">
            {items.map((item) => {
              const isDone = item.kind === "TASK" && item.status === "DONE";
              return (
                <div key={`${item.kind}-${item.id}`} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={item.kind === "TASK" ? "rounded-lg bg-primary/10 p-2 text-primary" : "rounded-lg bg-emerald-50 p-2 text-emerald-700"}>
                      {item.kind === "TASK" ? <ListTodo className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={isDone ? "truncate text-sm text-muted-foreground line-through" : "truncate text-sm font-semibold"}>{item.title}</p>
                        <Badge variant={item.kind === "TASK" ? "secondary" : "outline"}>{item.kind === "TASK" ? "Taak" : "Afspraak"}</Badge>
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{formatDate(item.date)} om {formatTime(item.date)}{item.detail ? ` · ${item.detail}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:shrink-0">
                    {item.priority ? <Badge variant={item.priority === "HIGH" ? "destructive" : "secondary"}>{item.priority === "HIGH" ? "Hoog" : item.priority === "MEDIUM" ? "Normaal" : "Laag"}</Badge> : null}
                    {item.kind === "TASK" && !isDone ? <Button variant="outline" size="sm" onClick={() => updateTask.mutate({ id: item.id, status: "DONE" })} disabled={updateTask.isPending}><CheckCircle2 className="mr-2 h-3.5 w-3.5" />Gereed</Button> : null}
                    <Button asChild variant="ghost" size="icon" title="Openen" aria-label={`${item.title} openen`}><Link href={item.leadId ? `/leads/${item.leadId}` : item.href}><ExternalLink className="h-4 w-4" /></Link></Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
