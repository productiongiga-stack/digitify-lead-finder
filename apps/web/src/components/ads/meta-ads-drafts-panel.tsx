"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  ChevronDown,
  Copy,
  FileText,
  PencilLine,
  Plus,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@digitify/ui";
import { cn } from "@/lib/utils";

type DraftRow = {
  id: string;
  name: string;
  status: string;
  objective?: string | null;
  dailyBudgetCents?: number | null;
  currency?: string | null;
  createdAt?: string | Date | null;
  lastError?: string | null;
};

function planStatusBadge(status: string) {
  if (status === "PUSHED_PAUSED") return <Badge variant="success">Gepusht</Badge>;
  if (status === "FAILED") return <Badge variant="warning">Mislukt</Badge>;
  if (status === "PUSHING") return <Badge variant="secondary">Pushen</Badge>;
  if (status === "APPROVED") return <Badge variant="info">Goedgekeurd</Badge>;
  if (status === "PENDING_APPROVAL") return <Badge variant="warning">Approval</Badge>;
  if (status === "CANCELLED") return <Badge variant="outline">Geannuleerd</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

export function MetaAdsDraftsPanel({
  rows,
  formatBudget,
  formatDate,
  renderErrorHint,
  onEdit,
  onDuplicate,
  onArchive,
  onStartNew,
  duplicatePending,
  archivePending,
}: {
  rows: DraftRow[];
  formatBudget: (row: DraftRow) => string;
  formatDate: (row: DraftRow) => string;
  renderErrorHint?: (raw?: string | null) => ReactNode;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string) => void;
  onStartNew?: () => void;
  duplicatePending?: boolean;
  archivePending?: boolean;
}) {
  const [open, setOpen] = useState(rows.length > 0);
  const [selectedId, setSelectedId] = useState(rows[0]?.id ?? "");

  useEffect(() => {
    if (!rows.length) {
      setSelectedId("");
      return;
    }
    if (!rows.some((row) => row.id === selectedId)) {
      setSelectedId(rows[0].id);
    }
  }, [rows, selectedId]);

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? rows[0] ?? null, [rows, selectedId]);

  const preview = selected
    ? `${selected.name} · ${selected.status}`
    : "Geen opgeslagen drafts";

  return (
    <Card className="border-border/60">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-muted/15 sm:px-5",
          open && "border-b border-border/50",
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1877F2]/10 text-[#1877F2]">
          <FileText className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base">Drafts</CardTitle>
          {open ? (
            <CardDescription className="mt-1">
              {rows.length} opgeslagen plan{rows.length === 1 ? "" : "nen"} · approval en push-status
            </CardDescription>
          ) : (
            <p className="mt-1 truncate text-sm text-muted-foreground">{preview}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {rows.length > 0 ? (
            <Badge variant="secondary" className="tabular-nums">
              {rows.length}
            </Badge>
          ) : null}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition", open && "rotate-180")} />
        </div>
      </button>

      {open ? (
        <CardContent className="space-y-3 pt-4 sm:pt-5">
          {!rows.length ? (
            <EmptyState
              title="Geen drafts"
              description="Sla je campagne op in de wizard om hem hier terug te vinden."
              icon={<FileText className="h-8 w-8" />}
              action={
                onStartNew ? (
                  <Button size="sm" onClick={onStartNew}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nieuwe campagne
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              {rows.length > 1 ? (
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger className="h-10 w-full rounded-xl" aria-label="Kies een draft">
                    <SelectValue placeholder="Kies draft" />
                  </SelectTrigger>
                  <SelectContent>
                    {rows.map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        <span className="flex w-full items-center justify-between gap-2">
                          <span className="truncate">{row.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{row.status}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              {selected ? (
                <div className="rounded-xl border border-[#1877F2]/15 bg-gradient-to-br from-slate-50/80 via-background to-blue-50/25 p-4 dark:from-slate-950 dark:to-blue-950/15">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold">{selected.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selected.objective || "—"} · {formatBudget(selected)} · {formatDate(selected)}
                      </p>
                    </div>
                    {planStatusBadge(selected.status)}
                  </div>

                  {renderErrorHint?.(selected.lastError)}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => onEdit(selected.id)}>
                      <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                      Bewerken
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDuplicate(selected.id)}
                      disabled={duplicatePending}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Dupliceren
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onArchive(selected.id)}
                      disabled={archivePending}
                    >
                      <Archive className="mr-1.5 h-3.5 w-3.5" />
                      Archiveren
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
