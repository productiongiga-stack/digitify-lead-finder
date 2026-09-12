"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Textarea } from "@digitify/ui";
import { FileSignature, Loader2, Plus, Trash2 } from "lucide-react";

const labels = { DRAFT: "Concept", SENT: "Verstuurd", VIEWED: "Bekeken", SIGNED: "Ondertekend", DECLINED: "Geweigerd", EXPIRED: "Verlopen" } as const;
const nextStatuses: Record<string, Array<"SENT" | "VIEWED" | "SIGNED" | "DECLINED" | "EXPIRED">> = { DRAFT: ["SENT", "EXPIRED"], SENT: ["VIEWED", "DECLINED", "EXPIRED"], VIEWED: ["SIGNED", "DECLINED", "EXPIRED"] };

export default function ContractsPage() {
  const utils = trpc.useUtils();
  const contracts = trpc.contract.list.useQuery(undefined, { staleTime: 10_000 });
  const sources = trpc.contract.sources.useQuery(undefined, { staleTime: 10_000 });
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [content, setContent] = useState("");
  const [source, setSource] = useState("none");
  const create = trpc.contract.create.useMutation({ onSuccess: () => { setName(""); setClientName(""); setClientEmail(""); setContent(""); setSource("none"); void utils.contract.list.invalidate(); } });
  const updateStatus = trpc.contract.updateStatus.useMutation({ onSuccess: () => void utils.contract.list.invalidate() });
  const remove = trpc.contract.delete.useMutation({ onSuccess: () => void utils.contract.list.invalidate() });

  if (contracts.isLoading || sources.isLoading) return <div className="app-page space-y-5"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;
  if (contracts.error || sources.error) return <div className="app-page"><QueryErrorState message={(contracts.error ?? sources.error)?.message ?? "Contracten konden niet geladen worden."} onRetry={() => { void contracts.refetch(); void sources.refetch(); }} /></div>;
  const parts = source.split(":");
  const quote = parts[0] === "quote" ? sources.data?.quotes.find((item) => item.id === parts[1]) : undefined;
  const project = parts[0] === "project" ? sources.data?.projects.find((item) => item.id === parts[1]) : undefined;
  const submit = () => create.mutate({ name, clientName: clientName || quote?.clientName || project?.clientName || "", clientEmail: clientEmail || quote?.clientEmail || undefined, content, quoteId: quote?.id, projectId: project?.id });

  return <div className="app-page space-y-5">
    <div className="app-page-header flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div className="app-page-heading"><div className="mb-2 flex items-center gap-2 text-primary"><FileSignature className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wide">Verkoop</span></div><h1 className="app-page-title">Contracten</h1><p className="app-page-subtitle">Beheer contractversies en ondertekenstatus veilig bij je projecten en offertes.</p></div><Badge variant="outline">Ondertekening gebeurt voorlopig handmatig</Badge></div>
    <Card className="app-surface"><CardHeader className="pb-3"><CardTitle className="text-base">Nieuw contract</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="contract-source">Koppel aan</Label><Select value={source} onValueChange={(value) => { setSource(value); const [type, id] = value.split(":"); const item = type === "quote" ? sources.data?.quotes.find((row) => row.id === id) : sources.data?.projects.find((row) => row.id === id); if (item) { setClientName(item.clientName); if ("clientEmail" in item && item.clientEmail) setClientEmail(item.clientEmail); } }}><SelectTrigger id="contract-source"><SelectValue placeholder="Project of geaccepteerde offerte" /></SelectTrigger><SelectContent><SelectItem value="none">Geen koppeling</SelectItem>{sources.data?.projects.map((item) => <SelectItem key={item.id} value={`project:${item.id}`}>Project · {item.name}</SelectItem>)}{sources.data?.quotes.map((item) => <SelectItem key={item.id} value={`quote:${item.id}`}>Offerte {item.quoteNumber} · {item.clientName}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="contract-name">Contractnaam</Label><Input id="contract-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Onderhoudsovereenkomst" /></div><div className="space-y-2"><Label htmlFor="contract-client">Klant</Label><Input id="contract-client" value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Klantnaam" /></div><div className="space-y-2"><Label htmlFor="contract-email">E-mailadres</Label><Input id="contract-email" type="email" value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} placeholder="klant@bedrijf.be" /></div><div className="space-y-2 md:col-span-2"><Label htmlFor="contract-content">Inhoud</Label><Textarea id="contract-content" rows={5} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Beschrijf scope, looptijd, prijsafspraken en voorwaarden..." /></div><div className="md:col-span-2"><Button disabled={!name.trim() || !clientName.trim() || !content.trim() || create.isPending} onClick={submit}>{create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Contract opslaan</Button>{create.error ? <p className="mt-2 text-sm text-destructive">{create.error.message}</p> : null}</div></CardContent></Card>
    {(contracts.data ?? []).length === 0 ? <Card className="app-surface"><CardContent className="p-0"><EmptyState icon={<FileSignature />} title="Nog geen contracten" description="Maak een contract aan bij een project of geaccepteerde offerte." /></CardContent></Card> : <div className="grid gap-3 md:grid-cols-2">{contracts.data?.map((contract) => <Card key={contract.id} className="app-surface"><CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3"><div><CardTitle className="text-base">{contract.name}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{contract.clientName}{contract.clientEmail ? ` · ${contract.clientEmail}` : ""}</p></div><Badge variant={contract.status === "SIGNED" ? "default" : "outline"}>{labels[contract.status]}</Badge></CardHeader><CardContent className="space-y-3"><p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{contract.content}</p><p className="text-xs text-muted-foreground">Versie {contract.version} · bijgewerkt {new Date(contract.updatedAt).toLocaleDateString("nl-BE")}</p><div className="flex flex-wrap gap-2">{(nextStatuses[contract.status] ?? []).map((status) => <Button key={status} size="sm" variant={status === "SIGNED" ? "default" : "outline"} disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ id: contract.id, status })}>{labels[status]}</Button>)}<Button size="sm" variant="ghost" title="Verwijderen" onClick={() => remove.mutate({ id: contract.id })}><Trash2 className="mr-1.5 h-4 w-4" />Verwijderen</Button></div></CardContent></Card>)}</div>}
  </div>;
}
