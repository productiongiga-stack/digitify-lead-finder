"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { useToast } from "@/components/feedback/toast-provider";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CreateModal,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@digitify/ui";
import { CheckSquare, ChevronLeft, ChevronRight, ExternalLink, Plus, Trash2 } from "lucide-react";

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
type CalendarView = "DAY" | "WEEK" | "MONTH";
type TaskItem = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueAt: string | null;
  relatedType: "LEAD" | "QUOTE" | "BOOKING" | "CLIENT" | null;
  relatedId: string | null;
  relatedLabel: string | null;
};

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(base: Date, amount: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + amount);
  return next;
}

function toDateKey(date: Date) {
  const local = startOfDay(date);
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return startOfDay(addDays(date, diff));
}

function startOfMonth(date: Date) {
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
}

function isSameDateKey(a: string, b: string) {
  return a === b;
}

function formatDayHeader(date: Date) {
  return date.toLocaleDateString("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatLongDutchDate(date: Date) {
  const raw = date.toLocaleDateString("nl-BE", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return raw
    .split(" ")
    .map((part) => (/\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

function formatDutchMonthYear(date: Date) {
  const raw = date.toLocaleDateString("nl-BE", {
    month: "long",
    year: "numeric",
  });
  return raw
    .split(" ")
    .map((part) => (/\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "Te doen",
  IN_PROGRESS: "Bezig",
  DONE: "Klaar",
};

const PRIORITY_LABEL = {
  LOW: "Laag",
  MEDIUM: "Normaal",
  HIGH: "Hoog",
} as const;

function relatedHref(task: Pick<TaskItem, "relatedType" | "relatedId">) {
  if (!task.relatedType || !task.relatedId) return null;
  if (task.relatedType === "LEAD" || task.relatedType === "CLIENT") return `/leads/${task.relatedId}`;
  if (task.relatedType === "QUOTE") return `/quotes/${task.relatedId}`;
  if (task.relatedType === "BOOKING") return `/bookings`;
  return null;
}

function TaskCard({
  task,
  onRemove,
  onOpenDetails,
  removing,
  draggable = false,
  onDragStart,
  onDragEnd,
}: {
  task: TaskItem;
  onRemove: () => void;
  onOpenDetails: () => void;
  removing: boolean;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const href = relatedHref(task);

  return (
    <div
      data-task-card="true"
      className="rounded-xl border border-border/60 bg-background/45 p-2.5 transition-colors hover:border-primary/20"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-1 text-[13px] font-semibold leading-tight">{task.title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {task.dueAt
              ? `Deadline ${new Date(task.dueAt).toLocaleDateString("nl-BE")}`
              : "Geen deadline"}
          </p>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <Badge variant="outline" className="px-2 py-0 text-[10px]">{PRIORITY_LABEL[task.priority]}</Badge>
        <Badge variant="secondary" className="px-2 py-0 text-[10px]">{STATUS_LABEL[task.status]}</Badge>
        {task.relatedType && task.relatedLabel ? (
          <Badge variant="secondary" className="max-w-full truncate px-2 py-0 text-[10px]">
            {task.relatedType}
            {href ? (
              <Link href={href} className="ml-1 inline-flex items-center gap-1 hover:underline">
                {task.relatedLabel}
                <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
              </Link>
            ) : (
              <span className="ml-1">{task.relatedLabel}</span>
            )}
          </Badge>
        ) : null}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <Button size="sm" variant="outline" className="h-7 flex-1 rounded-md px-2 text-xs" onClick={onOpenDetails}>
          Meer info
        </Button>
        <Button size="icon" variant="destructive" className="h-7 w-7 rounded-md" onClick={onRemove} disabled={removing} aria-label="Verwijder taak">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function TasksPageInner() {
  const { showToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [relatedType, setRelatedType] = useState<"NONE" | "LEAD" | "QUOTE" | "BOOKING" | "CLIENT">("NONE");
  const [relatedId, setRelatedId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [view, setView] = useState<CalendarView>("WEEK");
  const [currentDate, setCurrentDate] = useState<Date>(() => startOfDay(new Date()));
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [detailsTaskId, setDetailsTaskId] = useState<string | null>(null);
  const [detailsTitle, setDetailsTitle] = useState("");
  const [detailsDescription, setDetailsDescription] = useState("");
  const [detailsPriority, setDetailsPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [detailsStatus, setDetailsStatus] = useState<TaskStatus>("TODO");
  const [detailsDueAt, setDetailsDueAt] = useState("");
  const utils = trpc.useUtils();

  const { data, isLoading, isError, error, refetch } = trpc.task.list.useQuery(
    statusFilter === "ALL" ? {} : { status: statusFilter },
  );

  const leadsQuery = trpc.lead.list.useQuery(
    { page: 1, pageSize: 50 },
    { enabled: createOpen && (relatedType === "LEAD" || relatedType === "CLIENT") },
  );
  const quotesQuery = trpc.quote.list.useQuery(
    { page: 1, perPage: 50 },
    { enabled: createOpen && relatedType === "QUOTE" },
  );
  const bookingsQuery = trpc.booking.list.useQuery(
    { page: 1, pageSize: 50 },
    { enabled: createOpen && relatedType === "BOOKING" },
  );

  const createTask = trpc.task.create.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setRelatedType("NONE");
      setRelatedId("");
      setDueAt("");
      showToast({ title: "Taak aangemaakt", variant: "success" });
    },
    onError: (err) => {
      showToast({ title: "Taak aanmaken mislukt", description: err.message, variant: "error" });
    },
  });

  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      showToast({ title: "Taak bijgewerkt", variant: "success" });
    },
    onError: (err) => {
      showToast({ title: "Bijwerken mislukt", description: err.message, variant: "error" });
    },
  });

  const removeTask = trpc.task.remove.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      showToast({ title: "Taak verwijderd", variant: "success" });
    },
    onError: (err) => {
      showToast({ title: "Verwijderen mislukt", description: err.message, variant: "error" });
    },
  });

  const items = (data?.items || []) as TaskItem[];
  const dueByDate = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const item of items) {
      if (!item.dueAt) continue;
      const key = toDateKey(new Date(item.dueAt));
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.status !== b.status) return a.status.localeCompare(b.status);
        return a.title.localeCompare(b.title);
      });
    }
    return map;
  }, [items]);

  const unscheduledTasks = useMemo(() => items.filter((item) => !item.dueAt), [items]);
  const selectedDetailsTask = useMemo(
    () => items.find((item) => item.id === detailsTaskId) || null,
    [items, detailsTaskId],
  );

  const visibleDates = useMemo(() => {
    if (view === "DAY") return [startOfDay(currentDate)];
    if (view === "WEEK") {
      const start = startOfWeek(currentDate);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const start = startOfMonth(currentDate);
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => addDays(start, i));
  }, [view, currentDate]);

  const relatedOptions = useMemo(() => {
    if (relatedType === "LEAD" || relatedType === "CLIENT") {
      return (leadsQuery.data?.items || []).map((lead) => ({
        id: lead.id,
        label: lead.companyName || lead.email || lead.id,
      }));
    }
    if (relatedType === "QUOTE") {
      return (quotesQuery.data?.quotes || []).map((quote) => ({
        id: quote.id,
        label: `${quote.quoteNumber} • ${quote.clientCompany || quote.clientName}`,
      }));
    }
    if (relatedType === "BOOKING") {
      return (bookingsQuery.data?.bookings || []).map((booking) => ({
        id: booking.id,
        label: `${booking.clientName} • ${new Date(booking.date).toLocaleDateString("nl-BE")}`,
      }));
    }
    return [];
  }, [relatedType, leadsQuery.data, quotesQuery.data, bookingsQuery.data]);

  const relatedPickerLoading =
    (relatedType === "LEAD" || relatedType === "CLIENT") && leadsQuery.isLoading
      || relatedType === "QUOTE" && quotesQuery.isLoading
      || relatedType === "BOOKING" && bookingsQuery.isLoading;

  function summaryCount(status: typeof statusFilter) {
    if (!data?.summary) return 0;
    if (status === "ALL") return data.summary.total;
    if (status === "TODO") return data.summary.todo;
    if (status === "IN_PROGRESS") return data.summary.inProgress;
    return data.summary.done;
  }

  async function moveTaskToDate(taskId: string, dateKey: string | null) {
    const task = items.find((item) => item.id === taskId);
    if (!task) return;
    const nextDueAt = dateKey ? fromDateKey(dateKey).toISOString() : undefined;
    const currentKey = task.dueAt ? toDateKey(new Date(task.dueAt)) : null;
    if (currentKey === dateKey) return;
    await updateTask.mutateAsync({ id: taskId, dueAt: nextDueAt });
  }

  function shiftRange(direction: -1 | 1) {
    setCurrentDate((prev) => {
      if (view === "DAY") return addDays(prev, direction);
      if (view === "WEEK") return addDays(prev, direction * 7);
      return startOfDay(new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
    });
  }

  function openCreateForDate(date: Date) {
    const dateValue = toDateKey(date);
    setDueAt(dateValue);
    setCreateOpen(true);
  }

  function openTaskDetails(task: TaskItem) {
    setDetailsTaskId(task.id);
    setDetailsTitle(task.title);
    setDetailsDescription(task.description || "");
    setDetailsPriority(task.priority);
    setDetailsStatus(task.status);
    setDetailsDueAt(task.dueAt ? toDateKey(new Date(task.dueAt)) : "");
  }

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div className="app-page-heading">
          <h1 className="app-page-title">Taken</h1>
          <p className="app-page-subtitle">Plan en volg werk op gekoppeld aan leads, offertes, boekingen en klanten.</p>
        </div>
        <div className="app-page-actions">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nieuwe taak
          </Button>
        </div>
      </div>

      <div className="app-page-filters">
        <div className="flex flex-wrap gap-2">
          {(["ALL", "TODO", "IN_PROGRESS", "DONE"] as const).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={statusFilter === status ? "default" : "outline"}
              onClick={() => setStatusFilter(status)}
            >
              {status === "ALL" ? "Alle" : STATUS_LABEL[status]}
              <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1 text-xs">
                {summaryCount(status)}
              </Badge>
            </Button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {(["DAY", "WEEK", "MONTH"] as const).map((entry) => (
            <Button
              key={entry}
              size="sm"
              variant={view === entry ? "default" : "outline"}
              onClick={() => setView(entry)}
            >
              {entry === "DAY" ? "Dag" : entry === "WEEK" ? "Week" : "Maand"}
            </Button>
          ))}
        </div>
      </div>

      {isError ? (
        <QueryErrorState
          message={error?.message || "Taken konden niet geladen worden. Controleer of de database-migratie is uitgevoerd."}
          onRetry={() => refetch()}
        />
      ) : isLoading ? (
        <Card className="app-surface">
          <CardContent className="p-6 text-sm text-muted-foreground">Taken laden...</CardContent>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CheckSquare />}
          title={statusFilter === "ALL" ? "Nog geen taken" : `Geen taken met status “${STATUS_LABEL[statusFilter as TaskStatus]}”`}
          description={
            statusFilter === "ALL"
              ? "Maak taken aan en link ze direct aan operationele objecten."
              : "Pas het filter aan of maak een nieuwe taak in deze status."
          }
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {statusFilter === "ALL" ? "Eerste taak" : "Nieuwe taak"}
            </Button>
          }
        />
      ) : (
        <>
          <Card className="app-surface">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm">
                    {view === "DAY" ? "Dagplanner" : view === "WEEK" ? "Weekplanner" : "Maandplanner"}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">Sleep taken naar een andere dag om de deadline te wijzigen.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => shiftRange(-1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCurrentDate(startOfDay(new Date()))}>
                    {view === "MONTH" ? formatDutchMonthYear(currentDate) : formatLongDutchDate(currentDate)}
                  </Button>
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => shiftRange(1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className={view === "MONTH" ? "grid gap-2 md:grid-cols-7" : view === "WEEK" ? "grid gap-2 md:grid-cols-7" : "grid gap-2"}>
                {visibleDates.map((date) => {
                  const dateKey = toDateKey(date);
                  const isToday = isSameDateKey(dateKey, toDateKey(new Date()));
                  const dayTasks = dueByDate.get(dateKey) ?? [];
                  return (
                    <div
                      key={dateKey}
                      className={`rounded-xl border p-2 ${isToday ? "border-primary/50 bg-primary/5" : "border-border/60 bg-background/40"}`}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest("[data-task-card='true']")) return;
                        openCreateForDate(date);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openCreateForDate(date);
                        }
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={async () => {
                        if (!draggingTaskId) return;
                        await moveTaskToDate(draggingTaskId, dateKey);
                        setDraggingTaskId(null);
                      }}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] font-semibold leading-snug text-muted-foreground">
                          {formatDayHeader(date)}
                        </p>
                        <Badge variant="outline" className="h-5 min-w-5 px-1 text-[10px]">
                          {dayTasks.length}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {dayTasks.slice(0, view === "MONTH" ? 3 : 8).map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            removing={removeTask.isPending}
                            draggable
                            onDragStart={() => setDraggingTaskId(task.id)}
                            onDragEnd={() => setDraggingTaskId(null)}
                            onRemove={() => removeTask.mutate({ id: task.id })}
                            onOpenDetails={() => openTaskDetails(task)}
                          />
                        ))}
                        {view === "MONTH" && dayTasks.length > 3 ? (
                          <p className="text-xs text-muted-foreground">+{dayTasks.length - 3} meer</p>
                        ) : null}
                        {dayTasks.length === 0 ? <p className="text-xs text-muted-foreground">Geen taken</p> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Zonder deadline</CardTitle>
                <Badge variant="outline">{unscheduledTasks.length}</Badge>
              </div>
            </CardHeader>
            <CardContent
              className="space-y-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={async () => {
                if (!draggingTaskId) return;
                await moveTaskToDate(draggingTaskId, null);
                setDraggingTaskId(null);
              }}
            >
              {unscheduledTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">Geen taken zonder deadline</p>
              ) : (
                unscheduledTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    removing={removeTask.isPending}
                    draggable
                    onDragStart={() => setDraggingTaskId(task.id)}
                    onDragEnd={() => setDraggingTaskId(null)}
                    onRemove={() => removeTask.mutate({ id: task.id })}
                    onOpenDetails={() => openTaskDetails(task)}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}

      <CreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Nieuwe taak"
        description="Maak een taak en koppel ze optioneel aan een lead, offerte, boeking of klant."
        submitLabel="Taak aanmaken"
        submitDisabled={!title.trim() || (relatedType !== "NONE" && !relatedId)}
        pending={createTask.isPending}
        asForm
        onSubmit={async () => {
          await createTask.mutateAsync({
            title: title.trim(),
            description: description.trim() || undefined,
            priority,
            dueAt: dueAt ? new Date(`${dueAt}T12:00:00`).toISOString() : undefined,
            relatedType: relatedType === "NONE" ? undefined : relatedType,
            relatedId: relatedType === "NONE" ? undefined : relatedId,
          });
        }}
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Titel</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Bijv. Follow-up offerte ACME"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-description">Beschrijving</Label>
            <Textarea
              id="task-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Prioriteit</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as "LOW" | "MEDIUM" | "HIGH")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Laag</SelectItem>
                  <SelectItem value="MEDIUM">Normaal</SelectItem>
                  <SelectItem value="HIGH">Hoog</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Deadline</Label>
              <Input id="task-due" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Koppeling</Label>
              <Select
                value={relatedType}
                onValueChange={(value) => {
                  const next = value as typeof relatedType;
                  setRelatedType(next);
                  setRelatedId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Geen koppeling</SelectItem>
                  <SelectItem value="LEAD">Lead</SelectItem>
                  <SelectItem value="QUOTE">Offerte</SelectItem>
                  <SelectItem value="BOOKING">Boeking</SelectItem>
                  <SelectItem value="CLIENT">Klant (lead)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Gekoppeld object</Label>
              {relatedType === "NONE" ? (
                <Input disabled placeholder="Kies eerst een koppeling" />
              ) : (
                <Select value={relatedId || undefined} onValueChange={setRelatedId} disabled={relatedPickerLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder={relatedPickerLoading ? "Laden..." : "Selecteer..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {relatedOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>
      </CreateModal>

      <Dialog open={!!detailsTaskId} onOpenChange={(open) => !open && setDetailsTaskId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Taak details</DialogTitle>
            <DialogDescription>Bekijk en bewerk deze taak zonder de planner te verlaten.</DialogDescription>
          </DialogHeader>
          {selectedDetailsTask ? (
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Titel</Label>
                <Input value={detailsTitle} onChange={(e) => setDetailsTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Beschrijving</Label>
                <Textarea rows={3} value={detailsDescription} onChange={(e) => setDetailsDescription(e.target.value)} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={detailsStatus} onValueChange={(value) => setDetailsStatus(value as TaskStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODO">Te doen</SelectItem>
                      <SelectItem value="IN_PROGRESS">Bezig</SelectItem>
                      <SelectItem value="DONE">Klaar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Prioriteit</Label>
                  <Select value={detailsPriority} onValueChange={(value) => setDetailsPriority(value as "LOW" | "MEDIUM" | "HIGH")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Laag</SelectItem>
                      <SelectItem value="MEDIUM">Normaal</SelectItem>
                      <SelectItem value="HIGH">Hoog</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Deadline</Label>
                <Input type="date" value={detailsDueAt} onChange={(e) => setDetailsDueAt(e.target.value)} />
              </div>
              {selectedDetailsTask.relatedType && selectedDetailsTask.relatedLabel ? (
                <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  Gekoppeld: <strong>{selectedDetailsTask.relatedType}</strong> · {selectedDetailsTask.relatedLabel}
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="flex-wrap justify-between gap-2">
            <Button
              variant="destructive"
              onClick={() => {
                if (!selectedDetailsTask) return;
                removeTask.mutate({ id: selectedDetailsTask.id });
                setDetailsTaskId(null);
              }}
              disabled={!selectedDetailsTask || removeTask.isPending}
            >
              Verwijderen
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDetailsTaskId(null)}>
                Sluiten
              </Button>
              <Button
                onClick={async () => {
                  if (!selectedDetailsTask) return;
                  await updateTask.mutateAsync({
                    id: selectedDetailsTask.id,
                    title: detailsTitle.trim(),
                    description: detailsDescription,
                    priority: detailsPriority,
                    status: detailsStatus,
                    dueAt: detailsDueAt ? fromDateKey(detailsDueAt).toISOString() : null,
                  });
                  setDetailsTaskId(null);
                }}
                disabled={!selectedDetailsTask || !detailsTitle.trim() || updateTask.isPending}
              >
                Opslaan
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
