"use client";

import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@digitify/ui";
import { Download, FileText, FolderOpen, Loader2, Upload, Trash2 } from "lucide-react";

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const utils = trpc.useUtils();
  const files = trpc.file.list.useQuery(undefined, { staleTime: 15_000 });
  const remove = trpc.file.delete.useMutation({ onSuccess: () => void utils.file.list.invalidate() });

  async function upload(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/files/upload", { method: "POST", body });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Upload mislukt.");
      await utils.file.list.invalidate();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload mislukt.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return <div className="app-page space-y-5">
    <div className="app-page-header flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="app-page-heading"><div className="mb-2 flex items-center gap-2 text-primary"><FolderOpen className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wide">Beheer</span></div><h1 className="app-page-title">Bestanden</h1><p className="app-page-subtitle">Workspacebestanden veilig bewaren en terugvinden.</p></div>
      <><input ref={inputRef} type="file" className="sr-only" accept="image/*,video/mp4,video/quicktime,.pdf,.csv,.txt,.docx,.xlsx" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /><Button onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Bestand uploaden</Button></>
    </div>
    {uploadError ? <Card className="border-destructive/40 bg-destructive/5"><CardContent className="p-4 text-sm text-destructive">{uploadError}</CardContent></Card> : null}
    {files.isLoading ? <div className="grid gap-3 md:grid-cols-2">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-28 rounded-xl" />)}</div> : files.error ? <QueryErrorState message={files.error.message} onRetry={() => files.refetch()} /> : (files.data ?? []).length === 0 ? <Card className="app-surface"><CardContent className="p-0"><EmptyState icon={<FileText />} title="Nog geen bestanden" description="Upload een document, afbeelding of video voor je workspace." /></CardContent></Card> : <div className="grid gap-3 md:grid-cols-2">{files.data?.map((file) => <Card key={file.id} className="app-surface"><CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2"><div className="flex min-w-0 items-center gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><FileText className="h-4 w-4" /></div><div className="min-w-0"><CardTitle className="truncate text-base">{file.name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{formatSize(file.size)} · {new Date(file.createdAt).toLocaleDateString("nl-BE")}</p></div></div><Badge variant="outline">{file.contentType.split("/").pop()}</Badge></CardHeader><CardContent className="flex items-center justify-between gap-3"><p className="truncate text-xs text-muted-foreground">{file.uploadedBy.name || file.uploadedBy.email}</p><div className="flex shrink-0 gap-1"><a href={`/api/files/${file.id}`} download className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" aria-label="Bestand downloaden" title="Bestand downloaden"><Download className="h-4 w-4" /></a><Button variant="ghost" size="icon" aria-label="Bestand verwijderen" title="Bestand verwijderen" disabled={remove.isPending} onClick={() => { if (window.confirm(`Bestand ${file.name} verwijderen?`)) remove.mutate({ id: file.id }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></CardContent></Card>)}</div>}
    {remove.error ? <p className="text-sm text-destructive">{remove.error.message}</p> : null}
  </div>;
}
