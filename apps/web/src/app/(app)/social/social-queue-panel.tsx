"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
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
import {
  AlertTriangle,
  CalendarDays,
  ExternalLink,
  Loader2,
  Megaphone,
  RefreshCcw,
  Trash2,
  Wand2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";

type RowStatus = "DRAFT" | "PENDING_APPROVAL" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "CANCELLED";

type PublishedRef = {
  id?: string;
  permalink?: string;
  verified?: boolean;
};

type QueueRow = {
  id: string;
  status: RowStatus;
  targetPlatforms: string[];
  retryCount?: number | null;
  metadata?: { headline?: string } | null;
  caption: string;
  scheduledFor?: string | Date | null;
  publishedAt?: string | Date | null;
  lastError?: string | null;
  externalPostIds?: unknown;
};

type DeletePostsInput = {
  ids?: string[];
  status?: RowStatus;
  all?: boolean;
};

type DeleteTarget =
  | { kind: "row"; row: QueueRow }
  | { kind: "bulk"; statusFilter: string; mayIncludePublished: boolean };

function metaPublishLinks(externalPostIds?: unknown) {
  if (!externalPostIds || typeof externalPostIds !== "object") return [];
  return Object.entries(externalPostIds as Record<string, PublishedRef | string>)
    .map(([key, value]) => {
      const ref = typeof value === "string" ? { id: value } : value;
      if (!ref?.permalink) return null;
      const numberedStory = key.match(/^(facebook|instagram)Story_(\d+)$/);
      const label =
        key === "facebook"
          ? "Facebook"
          : key === "instagram"
            ? "Instagram"
            : key === "facebookStory"
              ? "FB Story"
              : key === "instagramStory"
                ? "IG Story"
                : numberedStory
                  ? `${numberedStory[1] === "facebook" ? "FB" : "IG"} Story ${numberedStory[2]}`
                  : key === "instagramReel"
                    ? "IG Reel"
                    : key;
      return { label, url: ref.permalink, verified: ref.verified !== false };
    })
    .filter(Boolean) as Array<{ label: string; url: string; verified: boolean }>;
}

function statusLabel(status: RowStatus | string) {
  if (status === "PUBLISHED") return "gepubliceerde posts";
  if (status === "FAILED") return "mislukte posts";
  if (status === "SCHEDULED") return "ingeplande posts";
  if (status === "PENDING_APPROVAL") return "posts die wachten op goedkeuring";
  if (status === "PUBLISHING") return "posts die aan het publiceren zijn";
  if (status === "CANCELLED") return "geannuleerde posts";
  if (status === "DRAFT") return "drafts";
  return "posts";
}

function singularStatusLabel(status: RowStatus) {
  if (status === "PUBLISHED") return "gepubliceerde post";
  if (status === "FAILED") return "mislukte post";
  if (status === "SCHEDULED") return "ingeplande post";
  if (status === "PENDING_APPROVAL") return "post die wacht op goedkeuring";
  if (status === "PUBLISHING") return "post die aan het publiceren is";
  if (status === "CANCELLED") return "geannuleerde post";
  return "draft";
}

function isOverdueScheduled(row: QueueRow) {
  if (row.status !== "SCHEDULED" || !row.scheduledFor) return false;
  return new Date(row.scheduledFor).getTime() <= Date.now();
}

function statusBadge(status: RowStatus) {
  if (status === "PUBLISHED") return <Badge variant="success">Gepubliceerd</Badge>;
  if (status === "FAILED") return <Badge variant="warning">Mislukt</Badge>;
  if (status === "SCHEDULED") return <Badge variant="info">Ingepland</Badge>;
  if (status === "PENDING_APPROVAL") return <Badge variant="warning">Wacht op goedkeuring</Badge>;
  if (status === "PUBLISHING") return <Badge variant="secondary">Publiceren...</Badge>;
  if (status === "CANCELLED") return <Badge variant="outline">Geannuleerd</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

function prettyDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = new Date(value);
  return date.toLocaleString("nl-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function explainMetaError(message: string) {
  if (/Facebook Story \d+ video|Story video|video upload/i.test(message)) {
    return {
      title: "Facebook Story-video upload mislukt",
      description:
        "De Story-video URL moet publiek bereikbaar zijn als directe MP4/MOV. Controleer of de link zonder login opent en probeer opnieuw.",
    };
  }
  if (/code\s+10\b|does not have permission for this action/i.test(message)) {
    return {
      title: "Meta publicatierecht geweigerd",
      description:
        "Fout #10: Meta weigert deze actie door ontbrekende rechten op de app, user-token, Page-token of het gekozen Page/Instagram-account. Controleer Integraties en koppel Meta opnieuw met de juiste accounts aangevinkt.",
    };
  }
  if (/190|token expired|verlopen/i.test(message)) {
    return {
      title: "Meta token of rechten verlopen",
      description: "Koppel Meta opnieuw via Integraties en controleer of de app de juiste Pages/Instagram publishing scopes heeft.",
    };
  }
  if (/code\s+100|nonexisting field/i.test(message)) {
    return {
      title: "Meta parameter geweigerd",
      description:
        "Meta accepteerde een parameter of object niet. Controleer vooral of de media-URL publiek bereikbaar is en bij de gekozen Page/Instagram Business-account hoort.",
    };
  }
  if (/story-afbeelding|afbeeldingsverhouding.*stories|stories.*afbeelding|9:16/i.test(message)) {
    return {
      title: "Story-afbeelding ongeldig",
      description:
        message.length < 220
          ? message
          : "Stories werken het veiligst met een verticale 9:16-afbeelding. Gebruik bij voorkeur 1080x1920 en een publieke JPG/PNG/WebP URL.",
    };
  }
  if (/2207009|36003|aspect ratio|afbeeldingsverhouding/i.test(message)) {
    return {
      title: "Afbeeldingsratio ongeldig",
      description:
        "Instagram feed accepteert geen extreem brede of hoge beelden. Gebruik bij voorkeur 1080x1080, 1080x1440 of een ratio tussen 3:4 en 1.91:1.",
    };
  }
  return {
    title: "Publicatiefout",
    description: "Controleer de post-inhoud, afbeeldingen en Meta-koppeling.",
  };
}

export type SocialQueuePanelProps = {
  rows: QueueRow[];
  isLoading: boolean;
  statusFilter: string;
  selectedId: string | null;
  onStatusFilterChange: (value: string) => void;
  onOpenAgenda: () => void;
  onOpenComposer: () => void;
  onOpenRow: (row: QueueRow) => void;
  onRetry: (id: string) => void;
  onPublishNow?: (id: string) => void;
  publishingPostId?: string | null;
  onCancel: (id: string) => void;
  onDeletePosts: (input: DeletePostsInput) => void;
  isDeleting?: boolean;
};

export function SocialQueuePanel({
  rows,
  isLoading,
  statusFilter,
  selectedId,
  onStatusFilterChange,
  onOpenAgenda,
  onOpenComposer,
  onOpenRow,
  onRetry,
  onPublishNow,
  publishingPostId = null,
  onCancel,
  onDeletePosts,
  isDeleting = false,
}: SocialQueuePanelProps) {
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const deletableRows = useMemo(() => rows.filter((row) => row.status !== "PUBLISHING"), [rows]);
  const bulkDeleteDisabled = isDeleting || rows.length === 0 || deletableRows.length === 0 || statusFilter === "PUBLISHING";

  function confirmDeleteTarget() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "row") {
      onDeletePosts({ ids: [deleteTarget.row.id] });
    } else if (deleteTarget.statusFilter === "ALL") {
      onDeletePosts({ all: true });
    } else {
      onDeletePosts({ status: deleteTarget.statusFilter as RowStatus });
    }
    setDeleteTarget(null);
  }

  const deleteTitle =
    deleteTarget?.kind === "row"
      ? "Post uit queue verwijderen"
      : deleteTarget?.statusFilter === "ALL"
        ? "Alle queue-items verwijderen"
        : `${statusLabel(deleteTarget?.statusFilter || "")} verwijderen`;
  const deleteDescription =
    deleteTarget?.kind === "row"
      ? `Verwijder deze ${singularStatusLabel(deleteTarget.row.status)} definitief uit Social Planner. ${
          deleteTarget.row.status === "PUBLISHED"
            ? "De live post op Meta blijft online; dit verwijdert alleen de planner-registratie."
            : "Dit kan niet ongedaan worden gemaakt."
        }`
      : deleteTarget
        ? `Verwijder ${
            deleteTarget.statusFilter === "ALL" ? "alle niet-publicerende queue-items" : `alle ${statusLabel(deleteTarget.statusFilter)}`
          } definitief uit Social Planner. ${
            deleteTarget.statusFilter === "PUBLISHED" || deleteTarget.mayIncludePublished
              ? "Live posts op Meta blijven online; dit verwijdert alleen de planner-registratie."
              : "Posts die nu aan het publiceren zijn worden overgeslagen."
          }`
        : "";

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" /> Posts queue
            </CardTitle>
            <CardDescription>Status, planning, retries en duidelijke publicatiefouten.</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button size="sm" variant="outline" onClick={onOpenAgenda}>
              <CalendarDays className="mr-2 h-3.5 w-3.5" /> Agenda
            </Button>
            <Button size="sm" variant="outline" onClick={onOpenComposer}>
              <Wand2 className="mr-2 h-3.5 w-3.5" /> Nieuw bericht
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkDeleteDisabled}
              onClick={() =>
                setDeleteTarget({
                  kind: "bulk",
                  statusFilter,
                  mayIncludePublished: statusFilter === "ALL" || rows.some((row) => row.status === "PUBLISHED"),
                })
              }
              title={statusFilter === "PUBLISHING" ? "Lopende publicaties kunnen niet verwijderd worden" : undefined}
            >
              {isDeleting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-2 h-3.5 w-3.5" />}
              Verwijder filter
            </Button>
            <div className="w-full sm:w-56">
              <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Alle statussen</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PENDING_APPROVAL">Wacht op goedkeuring</SelectItem>
                  <SelectItem value="SCHEDULED">Ingepland</SelectItem>
                  <SelectItem value="PUBLISHED">Gepubliceerd</SelectItem>
                  <SelectItem value="FAILED">Mislukt</SelectItem>
                  <SelectItem value="CANCELLED">Geannuleerd</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Megaphone />}
              title="Nog geen social posts"
              description="Maak eerst een draft aan in Composer en stuur die door voor goedkeuring."
              action={
                <Button size="sm" onClick={onOpenComposer}>
                  <Wand2 className="mr-2 h-4 w-4" /> Naar Composer
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {rows.map((row) => {
                const errorHelp = row.lastError ? explainMetaError(row.lastError) : null;
                const isSelected = selectedId === row.id;
                const overdue = isOverdueScheduled(row);
                const publishLinks = metaPublishLinks(row.externalPostIds);
                return (
                  <div
                    key={row.id}
                    className={cn(
                      "rounded-2xl border bg-card p-3 transition hover:border-amber-300/70 hover:shadow-sm",
                      isSelected && "border-amber-400/80 ring-1 ring-amber-400/30",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {statusBadge(row.status)}
                          {overdue ? <Badge variant="warning">Wacht op Meta</Badge> : null}
                          <span className="text-xs text-muted-foreground">{row.targetPlatforms.join(" + ")}</span>
                          {row.retryCount ? <Badge variant="outline">Retry {row.retryCount}/3</Badge> : null}
                        </div>
                        <p className="line-clamp-2 text-sm font-medium">
                          {row.metadata?.headline ? `${row.metadata.headline} · ` : ""}
                          {row.caption}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Gepland: {prettyDate(row.scheduledFor)} · Gepubliceerd: {prettyDate(row.publishedAt)}
                        </p>
                        {publishLinks.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {publishLinks.map((link) => (
                              <a
                                key={link.url}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-500/15 dark:text-emerald-200"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Live op {link.label}
                              </a>
                            ))}
                          </div>
                        ) : null}
                        {row.lastError ? (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">
                            <p className="font-semibold">
                              <AlertTriangle className="mr-1 inline h-3.5 w-3.5" /> {errorHelp?.title}
                            </p>
                            <p className="mt-1">{errorHelp?.description}</p>
                            <p className="mt-2 break-words font-mono text-[11px] opacity-80">{row.lastError}</p>
                          </div>
                        ) : overdue ? (
                          <p className="text-xs text-violet-700 dark:text-violet-300">
                            Geplande tijd is voorbij — publicatie naar Meta loopt via de wachtrij.
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => onOpenRow(row)}>
                          {["SCHEDULED", "PENDING_APPROVAL", "FAILED"].includes(row.status) ? "Bewerken" : "Open"}
                        </Button>
                        {onPublishNow && ["SCHEDULED", "FAILED"].includes(row.status) ? (
                          <Button
                            size="sm"
                            disabled={Boolean(publishingPostId)}
                            onClick={() => onPublishNow(row.id)}
                          >
                            <RefreshCcw
                              className={cn(
                                "mr-2 h-3.5 w-3.5",
                                publishingPostId === row.id && "animate-spin",
                              )}
                            />
                            {publishingPostId === row.id ? "Publiceren..." : "Nu naar Meta"}
                          </Button>
                        ) : null}
                        {row.status === "FAILED" ? (
                          <Button size="sm" variant="outline" onClick={() => onRetry(row.id)}>
                            <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Retry
                          </Button>
                        ) : null}
                        {["SCHEDULED", "PENDING_APPROVAL"].includes(row.status) ? (
                          <Button size="sm" variant="outline" onClick={() => onCancel(row.id)}>
                            <XCircle className="mr-2 h-3.5 w-3.5" /> Annuleer
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isDeleting || row.status === "PUBLISHING"}
                          onClick={() => setDeleteTarget({ kind: "row", row })}
                          title={row.status === "PUBLISHING" ? "Wacht tot deze publicatie klaar is" : undefined}
                        >
                          {isDeleting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-2 h-3.5 w-3.5" />}
                          Verwijder
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTitle}
        description={deleteDescription}
        confirmLabel={deleteTarget?.kind === "bulk" ? "Verwijder filter" : "Verwijder post"}
        loading={isDeleting}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
        onConfirm={confirmDeleteTarget}
      />
    </>
  );
}
