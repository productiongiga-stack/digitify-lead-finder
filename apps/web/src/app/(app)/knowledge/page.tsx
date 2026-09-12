"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Label, Skeleton, Textarea } from "@digitify/ui";
import { BookOpen, CheckCircle2, Loader2, Plus, Save } from "lucide-react";

const statusLabels = { DRAFT: "Concept", PUBLISHED: "Gepubliceerd", ARCHIVED: "Gearchiveerd" } as const;

export default function KnowledgePage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const utils = trpc.useUtils();
  const entries = trpc.knowledge.list.useQuery(undefined, { staleTime: 10_000 });
  const create = trpc.knowledge.create.useMutation({ onSuccess: () => { setTitle(""); setContent(""); void utils.knowledge.list.invalidate(); } });
  const setStatus = trpc.knowledge.setStatus.useMutation({ onSuccess: () => void utils.knowledge.list.invalidate() });

  return <div className="app-page space-y-5">
    <div className="app-page-header flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div className="app-page-heading"><div className="mb-2 flex items-center gap-2 text-primary"><BookOpen className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wide">Automatisering</span></div><h1 className="app-page-title">Kennisbank</h1><p className="app-page-subtitle">Bedrijfsinformatie, diensten en FAQ voor je team en AI-context.</p></div><Badge variant="outline"><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Alleen gepubliceerde kennis wordt gedeeld</Badge></div>
    <Card className="app-surface"><CardHeader className="pb-3"><CardTitle className="text-base">Nieuw kennisitem</CardTitle></CardHeader><CardContent className="space-y-3"><div className="space-y-2"><Label htmlFor="knowledge-title">Titel</Label><Input id="knowledge-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Onze diensten" /></div><div className="space-y-2"><Label htmlFor="knowledge-content">Inhoud</Label><Textarea id="knowledge-content" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Beschrijf diensten, werkwijze of veelgestelde vragen..." rows={5} /></div><Button disabled={!title.trim() || !content.trim() || create.isPending} onClick={() => create.mutate({ title: title.trim(), content: content.trim() })}>{create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Opslaan als concept</Button>{create.error ? <p className="text-sm text-destructive">{create.error.message}</p> : null}</CardContent></Card>
    {entries.isLoading ? <div className="grid gap-3 md:grid-cols-2">{[1, 2].map((item) => <Skeleton key={item} className="h-40 rounded-xl" />)}</div> : entries.error ? <QueryErrorState message={entries.error.message} onRetry={() => entries.refetch()} /> : (entries.data ?? []).length === 0 ? <Card className="app-surface"><CardContent className="p-0"><EmptyState icon={<BookOpen />} title="Nog geen kennisitems" description="Maak een eerste item voor je bedrijfsinformatie of FAQ." /></CardContent></Card> : <div className="grid gap-3 md:grid-cols-2">{entries.data?.map((entry) => <Card key={entry.id} className="app-surface"><CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3"><div><CardTitle className="text-base">{entry.title}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{entry._count.versions} versie(s) · bijgewerkt {new Date(entry.updatedAt).toLocaleDateString("nl-BE")}</p></div><Badge variant={entry.status === "PUBLISHED" ? "default" : "outline"}>{statusLabels[entry.status]}</Badge></CardHeader><CardContent className="flex flex-wrap gap-2"><Button size="sm" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: entry.id, status: entry.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" })}>{entry.status === "PUBLISHED" ? <><Save className="mr-1.5 h-3.5 w-3.5" />Terug naar concept</> : <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Publiceren</>}</Button>{entry.status !== "ARCHIVED" ? <Button size="sm" variant="ghost" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: entry.id, status: "ARCHIVED" })}>Archiveren</Button> : null}</CardContent></Card>)}</div>}
  </div>;
}
