"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Label, Skeleton } from "@digitify/ui";
import { Clipboard, ExternalLink, FileInput, Globe2, Loader2, Plus } from "lucide-react";

const statusLabels = { DRAFT: "Concept", PUBLISHED: "Gepubliceerd", ARCHIVED: "Gearchiveerd" } as const;

export default function FormsPage() {
  const [name, setName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const forms = trpc.form.list.useQuery();
  const create = trpc.form.create.useMutation({ onSuccess: () => { setName(""); void utils.form.list.invalidate(); } });
  const setStatus = trpc.form.setStatus.useMutation({ onSuccess: () => void utils.form.list.invalidate() });

  function copy(value: string) {
    void navigator.clipboard.writeText(value);
    setCopied(value);
    window.setTimeout(() => setCopied(null), 1600);
  }

  return (
    <div className="app-page space-y-5">
      <div className="app-page-header flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="app-page-heading"><div className="mb-2 flex items-center gap-2 text-primary"><FileInput className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wide">Marketing</span></div><h1 className="app-page-title">Formulieren</h1><p className="app-page-subtitle">Ontvang aanvragen rechtstreeks als nieuwe lead in je CRM.</p></div>
        <Button onClick={() => document.getElementById("new-form-name")?.focus()}><Plus className="mr-2 h-4 w-4" />Nieuw formulier</Button>
      </div>

      <Card className="app-surface">
        <CardHeader className="pb-3"><CardTitle className="text-base">Formulier aanmaken</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2"><Label htmlFor="new-form-name">Naam</Label><Input id="new-form-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Contactaanvraag website" onKeyDown={(event) => { if (event.key === "Enter" && name.trim()) create.mutate({ name: name.trim() }); }} /></div>
          <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate({ name: name.trim() })}>{create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Aanmaken</Button>
        </CardContent>
        {create.error ? <p className="px-6 pb-4 text-sm text-destructive">{create.error.message}</p> : null}
      </Card>

      {forms.isLoading ? <div className="grid gap-3 md:grid-cols-2">{[1, 2].map((item) => <Skeleton key={item} className="h-44 rounded-xl" />)}</div> : forms.error ? <QueryErrorState message={forms.error.message} onRetry={() => forms.refetch()} /> : (forms.data ?? []).length === 0 ? <Card className="app-surface"><CardContent className="p-0"><EmptyState icon={<FileInput />} title="Nog geen formulieren" description="Maak een formulier aan om aanvragen uit je website rechtstreeks in Leads te ontvangen." /></CardContent></Card> : <div className="grid gap-3 md:grid-cols-2">{forms.data?.map((form) => { const publicUrl = `${window.location.origin}/api/public/forms/${form.publicKey}`; return <Card key={form.id} className="app-surface"><CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3"><div><CardTitle className="text-base">{form.name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{form._count.submissions} ontvangen aanvragen</p></div><Badge variant={form.status === "PUBLISHED" ? "default" : "outline"}>{statusLabels[form.status]}</Badge></CardHeader><CardContent className="space-y-3"><div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2 text-xs"><Globe2 className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{publicUrl}</span><Button variant="ghost" size="icon" title="URL kopiëren" aria-label="URL kopiëren" onClick={() => copy(publicUrl)}><Clipboard className="h-4 w-4" /></Button><a href={publicUrl} target="_blank" rel="noreferrer" aria-label="Formulier openen" title="Formulier openen" className="rounded-md p-2 hover:bg-muted"><ExternalLink className="h-4 w-4" /></a></div><div className="flex flex-wrap gap-2"><Button size="sm" variant={form.status === "PUBLISHED" ? "outline" : "default"} disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: form.id, status: form.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" })}>{form.status === "PUBLISHED" ? "Pauzeren" : "Publiceren"}</Button>{form.status !== "ARCHIVED" ? <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: form.id, status: "ARCHIVED" })}>Archiveren</Button> : null}{copied === publicUrl ? <span className="self-center text-xs text-emerald-600">Gekopieerd</span> : null}</div></CardContent></Card>; })}</div>}
      {setStatus.error ? <p className="text-sm text-destructive">{setStatus.error.message}</p> : null}
    </div>
  );
}
