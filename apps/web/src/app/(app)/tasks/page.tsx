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
import { CheckSquare, ExternalLink, Plus, Trash2 } from "lucide-react";

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
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
  onStatusChange,
  removing,
  updating,
}: {
  task: TaskItem;
  onRemove: () => void;
  onStatusChange: (status: TaskStatus) => void;
  removing: boolean;
  updating: boolean;
}) {
  const href = relatedHref(task);

  return (
    <div className="rounded-2xl border border-border/60 bg-background/45 p-3 transition-colors hover:border-primary/20">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{task.title}</p>
          {task.description ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{task.description}</p>
          ) : null}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={onRemove}
          disabled={removing}
          aria-label="Taak verwijderen"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge variant="outline">{PRIORITY_LABEL[task.priority]}</Badge>
        <Badge variant="secondary">{STATUS_LABEL[task.status]}</Badge>
        {task.relatedType && task.relatedLabel ? (
          href ? (
            <Link
              href={href}
              className="inline-flex items-center gap-1 rounded-full border border-transparent bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              {task.relatedType}: {task.relatedLabel}
              <ExternalLink className="h-3 w-3 opacity-60" />
            </Link>
          ) : (
            <Badge variant="secondary">
              {task.relatedType}: {task.relatedLabel}
            </Badge>
          )
        ) : null}
        {task.dueAt ? (
          <Badge variant="outline">
            Deadline {new Date(task.dueAt).toLocaleDateString("nl-BE")}
          </Badge>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {task.status !== "TODO" ? (
          <Button size="sm" variant="outline" disabled={updating} onClick={() => onStatusChange("TODO")}>
            Te doen
          </Button>
        ) : null}
        {task.status !== "IN_PROGRESS" ? (
          <Button size="sm" variant="outline" disabled={updating} onClick={() => onStatusChange("IN_PROGRESS")}>
            Bezig
          </Button>
        ) : null}
        {task.status !== "DONE" ? (
          <Button size="sm" variant="outline" disabled={updating} onClick={() => onStatusChange("DONE")}>
            Klaar
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function TasksPage() {
  const { showToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [relatedType, setRelatedType] = useState<"NONE" | "LEAD" | "QUOTE" | "BOOKING" | "CLIENT">("NONE");
  const [relatedId, setRelatedId] = useState("");
  const [dueAt, setDueAt] = useState("");
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
  const grouped = useMemo(() => {
    const buckets: Record<TaskStatus, TaskItem[]> = {
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
    };
    for (const item of items) {
      buckets[item.status].push(item);
    }
    return buckets;
  }, [items]);

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
      ) : statusFilter === "ALL" ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {(Object.keys(grouped) as TaskStatus[]).map((status) => (
            <Card key={status} className="app-surface">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">{STATUS_LABEL[status]}</CardTitle>
                  <Badge variant="outline" className="font-normal">
                    {grouped[status].length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {grouped[status].length === 0 ? (
                  <p className="text-xs text-muted-foreground">Geen taken</p>
                ) : (
                  grouped[status].map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      removing={removeTask.isPending}
                      updating={updateTask.isPending}
                      onRemove={() => removeTask.mutate({ id: task.id })}
                      onStatusChange={(next) => updateTask.mutate({ id: task.id, status: next })}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="app-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{STATUS_LABEL[statusFilter]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                removing={removeTask.isPending}
                updating={updateTask.isPending}
                onRemove={() => removeTask.mutate({ id: task.id })}
                onStatusChange={(next) => updateTask.mutate({ id: task.id, status: next })}
              />
            ))}
          </CardContent>
        </Card>
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
    </div>
  );
}
