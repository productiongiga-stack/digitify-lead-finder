"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Textarea,
} from "@digitify/ui";
import {
  CheckCircle2,
  Clock3,
  Loader2,
  Megaphone,
  RefreshCcw,
  Save,
  Send,
  Settings2,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { useToast } from "@/components/feedback/toast-provider";

type Platform = "FACEBOOK" | "INSTAGRAM";
type RowStatus = "DRAFT" | "PENDING_APPROVAL" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "CANCELLED";

function statusBadge(status: RowStatus) {
  if (status === "PUBLISHED") return <Badge variant="success">Gepubliceerd</Badge>;
  if (status === "FAILED") return <Badge variant="warning">Mislukt</Badge>;
  if (status === "SCHEDULED") return <Badge variant="info">Ingepland</Badge>;
  if (status === "PENDING_APPROVAL") return <Badge variant="warning">Wacht op goedkeuring</Badge>;
  if (status === "PUBLISHING") return <Badge variant="secondary">Publiceren...</Badge>;
  if (status === "CANCELLED") return <Badge variant="outline">Geannuleerd</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function prettyDate(value?: string | Date | null) {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleString("nl-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SocialPage() {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [template, setTemplate] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [targetFacebook, setTargetFacebook] = useState(true);
  const [targetInstagram, setTargetInstagram] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [uploading, setUploading] = useState(false);

  const listQuery = trpc.social.list.useQuery(
    statusFilter === "ALL" ? undefined : { status: statusFilter as any },
    { refetchInterval: 20_000 },
  );
  const connectionStatus = trpc.social.connectionStatus.useQuery();

  const createDraft = trpc.social.createDraft.useMutation({
    onSuccess: async () => {
      await listQuery.refetch();
      showToast({ title: "Draft aangemaakt" });
    },
    onError: (error) => {
      const message = error.message.includes("social_posts")
        ? "Database mist de tabel social_posts. Voer packages/db/prisma/manual/social-posts-and-meta-ads.sql uit in Supabase SQL Editor (zie docs/VERCEL.md)."
        : error.message;
      showToast({ title: "Aanmaken mislukt", description: message, variant: "error" });
    },
  });

  const updateDraft = trpc.social.updateDraft.useMutation({
    onSuccess: async () => {
      await listQuery.refetch();
      showToast({ title: "Draft bijgewerkt" });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const submitApproval = trpc.social.submitForApproval.useMutation({
    onSuccess: async () => {
      await listQuery.refetch();
      showToast({ title: "Ter goedkeuring ingediend" });
    },
    onError: (error) => showToast({ title: "Indienen mislukt", description: error.message, variant: "error" }),
  });

  const approveAndSchedule = trpc.social.approveAndSchedule.useMutation({
    onSuccess: async () => {
      await listQuery.refetch();
      showToast({ title: "Post ingepland" });
    },
    onError: (error) => showToast({ title: "Inplannen mislukt", description: error.message, variant: "error" }),
  });

  const rejectPost = trpc.social.reject.useMutation({
    onSuccess: async () => {
      await listQuery.refetch();
      showToast({ title: "Post afgekeurd" });
    },
    onError: (error) => showToast({ title: "Afkeuren mislukt", description: error.message, variant: "error" }),
  });

  const retryFailed = trpc.social.retryFailed.useMutation({
    onSuccess: async () => {
      await listQuery.refetch();
      showToast({ title: "Retry ingepland" });
    },
    onError: (error) => showToast({ title: "Retry mislukt", description: error.message, variant: "error" }),
  });

  const cancelScheduled = trpc.social.cancelScheduled.useMutation({
    onSuccess: async () => {
      await listQuery.refetch();
      showToast({ title: "Planning geannuleerd" });
    },
    onError: (error) => showToast({ title: "Annuleren mislukt", description: error.message, variant: "error" }),
  });

  const generateSuggestion = trpc.social.generateSuggestion.useMutation({
    onSuccess: (payload) => {
      setCaption(payload.caption);
      showToast({ title: "Suggestie gegenereerd" });
    },
    onError: (error) => showToast({ title: "Generatie mislukt", description: error.message, variant: "error" }),
  });

  const disconnectMeta = trpc.social.disconnect.useMutation({
    onSuccess: async () => {
      await connectionStatus.refetch();
      showToast({ title: "Meta koppeling verwijderd" });
    },
    onError: (error) => showToast({ title: "Loskoppelen mislukt", description: error.message, variant: "error" }),
  });

  const rows = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);

  const selected = rows.find((row: any) => row.id === selectedId) || null;

  async function onUpload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Upload mislukt");
      }
      setImageUrl(payload.url);
      showToast({ title: "Afbeelding geüpload" });
    } catch (error) {
      showToast({
        title: "Upload mislukt",
        description: error instanceof Error ? error.message : "Onbekende fout",
        variant: "error",
      });
    } finally {
      setUploading(false);
    }
  }

  function selectedTargets(): Platform[] {
    const targets: Platform[] = [];
    if (targetFacebook) targets.push("FACEBOOK");
    if (targetInstagram) targets.push("INSTAGRAM");
    return targets;
  }

  async function handleCreateOrUpdate() {
    const targets = selectedTargets();
    if (!caption.trim() || !imageUrl.trim() || targets.length === 0) {
      showToast({
        title: "Onvolledig",
        description: "Caption, afbeelding en minstens één platform zijn verplicht.",
        variant: "error",
      });
      return;
    }

    if (!selected) {
      await createDraft.mutateAsync({
        caption: caption.trim(),
        imageUrl: imageUrl.trim(),
        targetPlatforms: targets,
      });
      return;
    }

    await updateDraft.mutateAsync({
      id: selected.id,
      caption: caption.trim(),
      imageUrl: imageUrl.trim(),
      targetPlatforms: targets,
    });
  }

  function loadRow(row: any) {
    setSelectedId(row.id);
    setCaption(row.caption || "");
    setImageUrl(row.imageUrl || "");
    setTargetFacebook((row.targetPlatforms || []).includes("FACEBOOK"));
    setTargetInstagram((row.targetPlatforms || []).includes("INSTAGRAM"));
    setScheduledFor(toDateTimeLocal(row.scheduledFor));
  }

  function resetEditor() {
    setSelectedId(null);
    setCaption("");
    setImageUrl("");
    setTemplate("");
    setScheduledFor("");
    setTargetFacebook(true);
    setTargetInstagram(true);
  }

  const isBusy =
    createDraft.isPending ||
    updateDraft.isPending ||
    submitApproval.isPending ||
    approveAndSchedule.isPending ||
    rejectPost.isPending ||
    retryFailed.isPending ||
    cancelScheduled.isPending;

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div className="app-page-heading">
          <h1 className="app-page-title">Social Planner</h1>
          <p className="app-page-subtitle">Plan Facebook/Instagram posts met goedkeuringsflow en automatische publicatie.</p>
        </div>
        <div className="app-page-actions">
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/integrations">
              <Settings2 className="mr-2 h-4 w-4" />
              Integraties
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={resetEditor}>Nieuw draft</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Planner & Draft editor</CardTitle>
            <CardDescription>V1 ondersteunt tekst + 1 afbeelding op Facebook en Instagram.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Template prompt (optioneel)</Label>
              <Textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder="Zomercampagne: focus op lokale zichtbaarheid en gratis intake call..."
                rows={3}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={generateSuggestion.isPending || !template.trim()}
                onClick={() => generateSuggestion.mutate({ template: template.trim() })}
              >
                {generateSuggestion.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Megaphone className="mr-2 h-3 w-3" />}
                AI suggestie
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Caption</Label>
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={7} placeholder="Schrijf je posttekst..." />
            </div>

            <div className="space-y-2">
              <Label>Afbeelding URL</Label>
              <div className="flex gap-2">
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onUpload(file);
                    e.currentTarget.value = "";
                  }}
                />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <input type="checkbox" checked={targetFacebook} onChange={(e) => setTargetFacebook(e.target.checked)} />
                Facebook
              </label>
              <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <input type="checkbox" checked={targetInstagram} onChange={(e) => setTargetInstagram(e.target.checked)} />
                Instagram
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button onClick={handleCreateOrUpdate} disabled={isBusy}>
                {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {selected ? "Draft opslaan" : "Draft aanmaken"}
              </Button>

              {selected ? (
                <Button
                  variant="outline"
                  disabled={isBusy || selected.status === "PENDING_APPROVAL"}
                  onClick={() => submitApproval.mutate({ id: selected.id })}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Ter goedkeuring
                </Button>
              ) : null}
            </div>

            {selected ? (
              <div className="space-y-2 rounded-lg border p-3">
                <Label>Planning (goedkeuring OWNER/ADMIN)</Label>
                <Input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={isBusy || !scheduledFor}
                    onClick={() => approveAndSchedule.mutate({ id: selected.id, scheduledFor: new Date(scheduledFor) })}
                  >
                    <Clock3 className="mr-2 h-3.5 w-3.5" />
                    Goedkeuren & plannen
                  </Button>
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => rejectPost.mutate({ id: selected.id })}>
                    <XCircle className="mr-2 h-3.5 w-3.5" />
                    Afkeuren
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meta connectie</CardTitle>
            <CardDescription>Koppel je Facebook Page en Instagram Business-account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {connectionStatus.isLoading ? (
              <Skeleton className="h-20" />
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {connectionStatus.data?.connected ? (
                    <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" /> Verbonden</Badge>
                  ) : (
                    <Badge variant="secondary">Niet verbonden</Badge>
                  )}
                  <Badge variant={connectionStatus.data?.autopostEnabled ? "success" : "warning"}>
                    Autopost {connectionStatus.data?.autopostEnabled ? "aan" : "uit"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Page: {connectionStatus.data?.pageId || "—"}<br />
                  Instagram Business: {connectionStatus.data?.instagramBusinessId || "—"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" asChild>
                    <a href="/api/integrations/meta/connect">Meta koppelen</a>
                  </Button>
                  {connectionStatus.data?.connected ? (
                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => disconnectMeta.mutate()}>
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Loskoppelen
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Posts</CardTitle>
            <CardDescription>Status, planning en publicatielog.</CardDescription>
          </div>
          <div className="w-56">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Alle statussen</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PENDING_APPROVAL">Pending approval</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Megaphone />}
              title="Nog geen social posts"
              description="Maak eerst een draft aan en stuur die door voor goedkeuring."
            />
          ) : (
            <div className="space-y-2">
              {rows.map((row: any) => (
                <div key={row.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {statusBadge(row.status)}
                        <span className="text-xs text-muted-foreground">{row.targetPlatforms.join(" + ")}</span>
                      </div>
                      <p className="line-clamp-2 text-sm">{row.caption}</p>
                      <p className="text-xs text-muted-foreground">
                        Gepland: {prettyDate(row.scheduledFor)} · Gepubliceerd: {prettyDate(row.publishedAt)}
                      </p>
                      {row.lastError ? (
                        <p className="text-xs text-destructive">{row.lastError}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => loadRow(row)}>
                        Bewerken
                      </Button>
                      {row.status === "FAILED" ? (
                        <Button size="sm" variant="outline" onClick={() => retryFailed.mutate({ id: row.id })}>
                          <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Retry
                        </Button>
                      ) : null}
                      {["SCHEDULED", "PENDING_APPROVAL"].includes(row.status) ? (
                        <Button size="sm" variant="outline" onClick={() => cancelScheduled.mutate({ id: row.id })}>
                          <XCircle className="mr-2 h-3.5 w-3.5" /> Annuleer
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
