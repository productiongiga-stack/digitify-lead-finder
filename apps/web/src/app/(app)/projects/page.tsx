"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Textarea } from "@digitify/ui";
import { FolderKanban, Loader2, Plus, Trash2 } from "lucide-react";

const labels = { PLANNED: "Gepland", ACTIVE: "Actief", ON_HOLD: "On hold", COMPLETED: "Afgerond", ARCHIVED: "Gearchiveerd" } as const;

export default function ProjectsPage() {
  const utils = trpc.useUtils();
  const projects = trpc.project.list.useQuery(undefined, { staleTime: 10_000 });
  const sources = trpc.project.sources.useQuery(undefined, { staleTime: 10_000 });
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [source, setSource] = useState("none");
  const [description, setDescription] = useState("");
  const create = trpc.project.create.useMutation({ onSuccess: () => { setName(""); setClientName(""); setDescription(""); setSource("none"); void utils.project.list.invalidate(); } });
  const update = trpc.project.update.useMutation({ onSuccess: () => void utils.project.list.invalidate() });
  const remove = trpc.project.delete.useMutation({ onSuccess: () => void utils.project.list.invalidate() });

  if (projects.isLoading || sources.isLoading) return <div className="app-page space-y-5"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-56 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;
  if (projects.error || sources.error) return <div className="app-page"><QueryErrorState message={(projects.error ?? sources.error)?.message ?? "Projecten konden niet geladen worden."} onRetry={() => { void projects.refetch(); void sources.refetch(); }} /></div>;
  const sourceParts = source.split(":");
  const selectedLead = sourceParts[0] === "lead" ? sources.data?.leads.find((item) => item.id === sourceParts[1]) : undefined;
  const selectedQuote = sourceParts[0] === "quote" ? sources.data?.quotes.find((item) => item.id === sourceParts[1]) : undefined;
  const submit = () => create.mutate({ name, clientName: clientName || selectedQuote?.clientName || selectedLead?.companyName || "", description: description || undefined, leadId: selectedLead?.id, quoteId: selectedQuote?.id });

  return <div className="app-page space-y-5">
    <div className="app-page-header flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div className="app-page-heading"><div className="mb-2 flex items-center gap-2 text-primary"><FolderKanban className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wide">Beheer</span></div><h1 className="app-page-title">Projecten</h1><p className="app-page-subtitle">Zet gewonnen verkoop om naar duidelijke uitvoering en opvolging.</p></div><Badge variant="outline">Gebaseerd op gewonnen leads en geaccepteerde offertes</Badge></div>
    <Card className="app-surface"><CardHeader className="pb-3"><CardTitle className="text-base">Nieuw project</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="project-source">Start vanuit</Label><Select value={source} onValueChange={(value) => { setSource(value); const [type, id] = value.split(":"); const item = type === "lead" ? sources.data?.leads.find((lead) => lead.id === id) : sources.data?.quotes.find((quote) => quote.id === id); if (item) setClientName("companyName" in item ? item.companyName : item.clientName); }}><SelectTrigger id="project-source"><SelectValue placeholder="Kies een gewonnen lead of offerte" /></SelectTrigger><SelectContent><SelectItem value="none">Geen bron, handmatig</SelectItem>{sources.data?.leads.map((lead) => <SelectItem key={lead.id} value={`lead:${lead.id}`}>Lead · {lead.companyName}</SelectItem>)}{sources.data?.quotes.map((quote) => <SelectItem key={quote.id} value={`quote:${quote.id}`}>Offerte {quote.quoteNumber} · {quote.clientName}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="project-name">Projectnaam</Label><Input id="project-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Website redesign" /></div><div className="space-y-2"><Label htmlFor="project-client">Klant</Label><Input id="project-client" value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Klantnaam" /></div><div className="space-y-2 md:col-span-2"><Label htmlFor="project-description">Omschrijving</Label><Textarea id="project-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Doel, scope en eerstvolgende stap..." /></div><div className="md:col-span-2"><Button disabled={!name.trim() || !clientName.trim() || create.isPending} onClick={submit}>{create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Project aanmaken</Button>{create.error ? <p className="mt-2 text-sm text-destructive">{create.error.message}</p> : null}</div></CardContent></Card>
    {(projects.data ?? []).length === 0 ? <Card className="app-surface"><CardContent className="p-0"><EmptyState icon={<FolderKanban />} title="Nog geen projecten" description="Maak een project vanuit een gewonnen lead of geaccepteerde offerte." /></CardContent></Card> : <div className="grid gap-3 md:grid-cols-2">{projects.data?.map((project) => <Card key={project.id} className="app-surface"><CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3"><div><CardTitle className="text-base">{project.name}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{project.clientName}</p></div><Badge variant={project.status === "ACTIVE" ? "default" : "outline"}>{labels[project.status]}</Badge></CardHeader><CardContent className="space-y-3"><p className="min-h-10 text-sm text-muted-foreground">{project.description || "Nog geen omschrijving."}</p><div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{project.leadCompany ? <span>Lead: {project.leadCompany}</span> : null}{project.quote ? <span>Offerte: {project.quote.number}</span> : null}</div><div className="flex flex-wrap gap-2"><Button size="sm" variant={project.status === "ACTIVE" ? "outline" : "default"} onClick={() => update.mutate({ id: project.id, status: project.status === "ACTIVE" ? "ON_HOLD" : "ACTIVE" })}>{project.status === "ACTIVE" ? "Pauzeren" : "Activeren"}</Button><Button size="sm" variant="ghost" title="Verwijderen" onClick={() => remove.mutate({ id: project.id })}><Trash2 className="mr-1.5 h-4 w-4" />Verwijderen</Button></div></CardContent></Card>)}</div>}
  </div>;
}
