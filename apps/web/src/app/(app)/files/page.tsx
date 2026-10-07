"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { userFacingError } from "@/lib/user-facing-error";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Skeleton } from "@digitify/ui";
import { Archive, CheckCircle2, Cloud, Download, FileText, FolderPlus, FolderOpen, HardDrive, Loader2, RefreshCcw, Search, Trash2, Upload, XCircle } from "lucide-react";

const ACCEPT = "image/*,video/mp4,video/quicktime,.pdf,.csv,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip";

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

type UploadState = { name: string; status: "uploading" | "done" | "error"; message?: string };

export default function FilesPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const relatedType = searchParams.get("relatedType") as "LEAD" | "QUOTE" | "CUSTOMER" | "PROJECT" | null;
  const relatedId = searchParams.get("relatedId");
  const [search, setSearch] = useState("");
  const [includeTrash, setIncludeTrash] = useState(false);
  const [provider, setProvider] = useState<"ALL" | "LOCAL" | "BLOB" | "DRIVE" | "BOTH">("ALL");
  const [uploadStates, setUploadStates] = useState<UploadState[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const files = trpc.file.list.useQuery({ search: search || undefined, relatedType: relatedType || undefined, relatedId: relatedId || undefined, includeTrash, storageProvider: provider === "DRIVE" ? "GOOGLE_DRIVE" : provider === "ALL" || provider === "BOTH" ? undefined : provider, sort: "createdAt", direction: "desc", limit: 200 });
  const summary = trpc.file.storageSummary.useQuery(undefined, { staleTime: 10_000 });
  const drive = trpc.file.driveStatus.useQuery(undefined, { staleTime: 30_000 });
  const remove = trpc.file.delete.useMutation({ onSuccess: () => { void utils.file.list.invalidate(); void utils.file.storageSummary.invalidate(); } });
  const restore = trpc.file.restore.useMutation({ onSuccess: () => void utils.file.list.invalidate() });
  const createFolder = trpc.file.createFolder.useMutation({ onSuccess: () => void utils.file.folders.invalidate() });
  const driveImport = trpc.file.driveImport.useMutation({ onSuccess: () => void utils.file.list.invalidate() });
  const driveCopy = trpc.file.driveCopy.useMutation({ onSuccess: () => void utils.file.list.invalidate() });

  const quota = summary.data?.quota;
  const quotaBytes = Number(quota?.quotaBytes ?? 0);
  const usedBytes = Number(quota?.usedBytes ?? 0);
  const reservedBytes = Number(quota?.reservedBytes ?? 0);
  const percent = quotaBytes ? Math.min(100, Math.round(((usedBytes + reservedBytes) / quotaBytes) * 100)) : 0;

  async function uploadFiles(selected: FileList | File[]) {
    const items = Array.from(selected);
    if (!items.length) return;
    setUploadError(null);
    setUploadStates(items.map((file) => ({ name: file.name, status: "uploading" })));
    for (const [index, file] of items.entries()) {
      try {
        const body = new FormData();
        body.set("file", file);
        body.set("storageProvider", provider === "DRIVE" ? "DRIVE" : provider === "BOTH" ? "BOTH" : provider === "ALL" ? "LOCAL" : provider);
        if (relatedType && relatedId) { body.set("relatedType", relatedType); body.set("relatedId", relatedId); }
        body.set("idempotencyKey", `${file.name}:${file.size}:${file.lastModified}:${crypto.randomUUID()}`);
        const response = await fetch("/api/files/upload", { method: "POST", body });
        const payload = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(payload.error || "Upload mislukt.");
        setUploadStates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, status: "done" } : item));
      } catch (error) {
        const message = userFacingError(error, "Upload mislukt. Controleer bestandstype en opslagruimte.");
        setUploadStates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, status: "error", message } : item));
        setUploadError(message);
      }
    }
    await Promise.all([utils.file.list.invalidate(), utils.file.storageSummary.invalidate()]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function newFolder() {
    const name = window.prompt("Naam van de map");
    if (name?.trim()) createFolder.mutate({ name: name.trim() });
  }

  function importDriveFile() {
    const driveFileId = window.prompt("Plak het Google Drive-bestands-ID");
    if (driveFileId?.trim()) driveImport.mutate({ driveFileId: driveFileId.trim() });
  }

  return <div className="app-page space-y-5">
    <div className="app-page-header flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="app-page-heading"><div className="mb-2 flex items-center gap-2 text-primary"><FolderOpen className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wide">Sales Workspace</span></div><h1 className="app-page-title">Bestanden</h1><p className="app-page-subtitle">Eén bibliotheek voor documenten, media en klantdossiers.</p></div>
      <div className="flex flex-wrap gap-2"><input ref={inputRef} type="file" multiple className="sr-only" accept={ACCEPT} onChange={(event) => { if (event.target.files) void uploadFiles(event.target.files); }} /><Button onClick={() => inputRef.current?.click()} disabled={uploadStates.some((item) => item.status === "uploading")}><Upload className="mr-2 h-4 w-4" />Uploaden</Button><Button variant="outline" onClick={newFolder} disabled={createFolder.isPending}><FolderPlus className="mr-2 h-4 w-4" />Map</Button>{drive.data?.connected ? <Button variant="outline" onClick={importDriveFile} disabled={driveImport.isPending}><Cloud className="mr-2 h-4 w-4" />Drive importeren</Button> : null}<Button variant="outline" asChild><a href="/api/integrations/google-drive/connect"><Cloud className="mr-2 h-4 w-4" />{drive.data?.connected ? "Drive opnieuw koppelen" : "Drive koppelen"}</a></Button></div>
    </div>

    <Card className="app-surface"><CardContent className="space-y-3 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-medium"><HardDrive className="h-4 w-4 text-primary" />Lokale opslag <span className="text-muted-foreground">(per gebruiker)</span></div><span className="text-sm text-muted-foreground">{formatSize(usedBytes + reservedBytes)} / {formatSize(quotaBytes || 1024 * 1024 * 1024)}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full transition-all ${percent >= 90 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${percent}%` }} /></div><div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{formatSize(Math.max(0, quotaBytes - usedBytes - reservedBytes))} beschikbaar</span><span>{reservedBytes ? `${formatSize(reservedBytes)} gereserveerd` : "Geen lopende reserveringen"}</span>{summary.data?.persistentLocal === false ? <span className="text-amber-600">! Lokale opslag is niet persistent op deze server</span> : null}</div></CardContent></Card>

    <div className="flex flex-col gap-3 md:flex-row md:items-center"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Zoek bestanden" value={search} onChange={(event) => setSearch(event.target.value)} /></div><select className="h-10 rounded-md border bg-background px-3 text-sm" value={provider} onChange={(event) => setProvider(event.target.value as typeof provider)}><option value="ALL">Alle opslag</option><option value="LOCAL">Lokaal</option><option value="BOTH">Lokaal + Drive</option><option value="BLOB">Blob-opslag</option><option value="DRIVE">Google Drive</option></select><Button variant={includeTrash ? "default" : "outline"} onClick={() => setIncludeTrash((value) => !value)}><Archive className="mr-2 h-4 w-4" />{includeTrash ? "Prullenbak" : "Actief"}</Button></div>

    {uploadStates.length ? <Card className="border-primary/20 bg-primary/5"><CardContent className="space-y-2 p-4">{uploadStates.map((item) => <div key={item.name} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate">{item.name}</span>{item.status === "uploading" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : item.status === "done" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="flex items-center gap-1 text-destructive"><XCircle className="h-4 w-4" />{item.message}</span>}</div>)}</CardContent></Card> : null}
    {uploadError ? <Card className="border-destructive/40 bg-destructive/5"><CardContent className="flex items-center justify-between gap-3 p-4 text-sm text-destructive"><span>{uploadError}</span><Button variant="ghost" size="sm" onClick={() => setUploadError(null)}><RefreshCcw className="mr-1 h-3.5 w-3.5" />Sluiten</Button></CardContent></Card> : null}
    {files.isLoading ? <div className="grid gap-3 md:grid-cols-2">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-28 rounded-xl" />)}</div> : files.error ? <QueryErrorState message={userFacingError(files.error, "Bestanden konden niet worden geladen. Probeer opnieuw.")} onRetry={() => files.refetch()} /> : (files.data ?? []).length === 0 ? <Card className="app-surface"><CardContent className="p-0"><EmptyState icon={includeTrash ? <Archive /> : <FileText />} title={includeTrash ? "Prullenbak is leeg" : "Nog geen bestanden"} description={includeTrash ? "Verwijderde bestanden blijven 30 dagen herstelbaar." : "Upload je eerste document, afbeelding of video voor Sales Workspace."} /></CardContent></Card> : <div className="grid gap-3 md:grid-cols-2">{files.data?.map((file) => <Card key={file.id} className="app-surface"><CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2"><div className="flex min-w-0 items-center gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><FileText className="h-4 w-4" /></div><div className="min-w-0"><CardTitle className="truncate text-base">{file.name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{formatSize(file.size)} · {new Date(file.createdAt).toLocaleDateString("nl-BE")}</p></div></div><Badge variant="outline">{file.storageProvider === "GOOGLE_DRIVE" ? "Drive" : file.contentType.split("/").pop()}</Badge></CardHeader><CardContent className="flex items-center justify-between gap-3"><p className="truncate text-xs text-muted-foreground">{file.uploadedBy.name || file.uploadedBy.email}{file.relatedType ? ` · ${file.relatedType}` : ""}</p><div className="flex shrink-0 gap-1">{includeTrash ? <Button variant="ghost" size="icon" aria-label="Bestand herstellen" title="Bestand herstellen" disabled={restore.isPending} onClick={() => restore.mutate({ id: file.id })}><RefreshCcw className="h-4 w-4" /></Button> : <>{drive.data?.connected && file.storageProvider !== "GOOGLE_DRIVE" && !file.driveWebUrl ? <Button variant="ghost" size="icon" aria-label="Kopie naar Drive" title="Opslaan in Google Drive" disabled={driveCopy.isPending} onClick={() => driveCopy.mutate({ id: file.id })}><Cloud className="h-4 w-4" /></Button> : null}<a href={`/api/files/${file.id}`} download className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" aria-label="Bestand downloaden" title="Bestand downloaden"><Download className="h-4 w-4" /></a></>}{!includeTrash ? <Button variant="ghost" size="icon" aria-label="Bestand verwijderen" title="Bestand naar prullenbak" disabled={remove.isPending} onClick={() => remove.mutate({ id: file.id })}><Trash2 className="h-4 w-4 text-destructive" /></Button> : null}</div></CardContent></Card>)}</div>}
    {(remove.error || restore.error || createFolder.error || driveImport.error || driveCopy.error) ? <p className="text-sm text-destructive">{userFacingError(remove.error || restore.error || createFolder.error || driveImport.error || driveCopy.error, "Bestandsactie mislukt. Probeer opnieuw.")}</p> : null}
  </div>;
}
