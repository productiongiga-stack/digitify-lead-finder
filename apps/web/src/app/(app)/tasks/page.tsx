"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc/client";
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
import { CheckSquare, Plus, Trash2 } from "lucide-react";

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "Te doen",
  IN_PROGRESS: "Bezig",
  DONE: "Klaar",
};

export default function TasksPage() {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [relatedType, setRelatedType] = useState<"NONE" | "LEAD" | "QUOTE" | "BOOKING" | "CLIENT">("NONE");
  const [relatedId, setRelatedId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.task.list.useQuery(
    statusFilter === "ALL" ? {} : { status: statusFilter },
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
    },
  });

  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => utils.task.list.invalidate(),
  });

  const removeTask = trpc.task.remove.useMutation({
    onSuccess: () => utils.task.list.invalidate(),
  });

  const items = data?.items || [];
  const grouped = useMemo(() => {
    const buckets: Record<TaskStatus, typeof items> = {
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
    };
    for (const item of items) {
      buckets[item.status as TaskStatus].push(item);
    }
    return buckets;
  }, [items]);

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
              {status === "ALL"
                ? (data?.summary.total || 0)
                : status === "TODO"
                  ? (data?.summary.todo || 0)
                  : status === "IN_PROGRESS"
                    ? (data?.summary.inProgress || 0)
                    : (data?.summary.done || 0)}
            </Badge>
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Card className="app-surface">
          <CardContent className="p-6 text-sm text-muted-foreground">Taken laden...</CardContent>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CheckSquare />}
          title="Nog geen taken"
          description="Maak taken aan en link ze direct aan operationele objecten."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Eerste taak
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {(Object.keys(grouped) as TaskStatus[]).map((status) => (
            <Card key={status} className="app-surface">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{STATUS_LABEL[status]}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {grouped[status].length === 0 ? (
                  <p className="text-xs text-muted-foreground">Geen taken</p>
                ) : (
                  grouped[status].map((task) => (
                    <div key={task.id} className="rounded-2xl border border-border/60 bg-background/45 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{task.title}</p>
                          {task.description ? (
                            <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>
                          ) : null}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => removeTask.mutate({ id: task.id })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="outline">{task.priority}</Badge>
                        {task.relatedType && task.relatedLabel ? (
                          <Badge variant="secondary">{task.relatedType}: {task.relatedLabel}</Badge>
                        ) : null}
                        {task.dueAt ? (
                          <Badge variant="secondary">
                            Due {new Date(task.dueAt).toLocaleDateString("nl-BE")}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-2 flex gap-1.5">
                        {status !== "TODO" ? (
                          <Button size="sm" variant="outline" onClick={() => updateTask.mutate({ id: task.id, status: "TODO" })}>
                            Te doen
                          </Button>
                        ) : null}
                        {status !== "IN_PROGRESS" ? (
                          <Button size="sm" variant="outline" onClick={() => updateTask.mutate({ id: task.id, status: "IN_PROGRESS" })}>
                            Bezig
                          </Button>
                        ) : null}
                        {status !== "DONE" ? (
                          <Button size="sm" variant="outline" onClick={() => updateTask.mutate({ id: task.id, status: "DONE" })}>
                            Klaar
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Nieuwe taak"
        description="Maak een taak en link ze aan een lead, offerte, boeking of klant."
        submitLabel="Taak aanmaken"
        submitDisabled={!title.trim()}
        pending={createTask.isPending}
        onSubmit={() =>
          createTask.mutate({
            title: title.trim(),
            description: description.trim() || undefined,
            priority,
            dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
            relatedType: relatedType === "NONE" ? undefined : relatedType,
            relatedId: relatedType === "NONE" ? undefined : relatedId.trim() || undefined,
          })
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Titel</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Bijv. Follow-up offerte ACME" />
          </div>
          <div className="space-y-1.5">
            <Label>Beschrijving</Label>
            <Textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Prioriteit</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as "LOW" | "MEDIUM" | "HIGH")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">LOW</SelectItem>
                  <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                  <SelectItem value="HIGH">HIGH</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Deadline</Label>
              <Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Koppel type</Label>
              <Select
                value={relatedType}
                onValueChange={(value) => setRelatedType(value as "NONE" | "LEAD" | "QUOTE" | "BOOKING" | "CLIENT")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Geen koppeling</SelectItem>
                  <SelectItem value="LEAD">Lead</SelectItem>
                  <SelectItem value="QUOTE">Offerte</SelectItem>
                  <SelectItem value="BOOKING">Boeking</SelectItem>
                  <SelectItem value="CLIENT">Klant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Gekoppeld ID</Label>
              <Input value={relatedId} onChange={(event) => setRelatedId(event.target.value)} placeholder="cuid/id" disabled={relatedType === "NONE"} />
            </div>
          </div>
        </div>
      </CreateModal>
    </div>
  );
}
