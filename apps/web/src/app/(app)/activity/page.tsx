"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from "@digitify/ui";
import { Activity as ActivityIcon, ShieldCheck } from "lucide-react";

const typeLabels: Record<string, string> = {
  LEAD_CREATED: "Lead aangemaakt", LEAD_UPDATED: "Lead bijgewerkt", LEAD_STATUS_CHANGED: "Leadstatus gewijzigd",
  LEAD_SCORED: "Lead gescoord", EMAIL_DRAFTED: "E-maildraft gemaakt", EMAIL_APPROVED: "E-mail goedgekeurd",
  EMAIL_SENT: "E-mail verzonden", QUOTE_CREATED: "Offerte aangemaakt", QUOTE_SENT: "Offerte verzonden",
  FILE_UPLOADED: "Bestand geüpload", FILE_DELETED: "Bestand verwijderd", MODULE_UPDATED: "Module gewijzigd",
  VIEW_AS_STARTED: "Account bekeken als", VIEW_AS_ENDED: "Accountweergave beëindigd",
};

export default function ActivityPage() {
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [actorUserId, setActorUserId] = useState("all");
  const [resource, setResource] = useState("");
  const [result, setResult] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const activity = trpc.activity.list.useQuery({
    type: type === "all" ? undefined : type,
    actorUserId: actorUserId === "all" ? undefined : actorUserId,
    resource: resource.trim() || undefined,
    result: result === "all" ? undefined : result as "SUCCESS" | "DENIED" | "FAILED",
    from: from ? new Date(`${from}T00:00:00`) : undefined,
    to: to ? new Date(`${to}T23:59:59.999`) : undefined,
    limit: 100,
  }, { staleTime: 10_000 });
  const items = (activity.data?.items ?? []).filter((item) => {
    const value = `${item.title} ${item.resource ?? ""} ${item.reason ?? ""}`.toLowerCase();
    return !search.trim() || value.includes(search.trim().toLowerCase());
  });

  return <div className="app-page space-y-5">
    <div className="app-page-header flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div className="app-page-heading"><div className="mb-2 flex items-center gap-2 text-primary"><ActivityIcon className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wide">Beheer</span></div><h1 className="app-page-title">Activiteitenlog</h1><p className="app-page-subtitle">Een chronologisch overzicht van werk en beveiligingsacties in deze workspace.</p></div>{activity.data?.includesSecurityEvents ? <Badge variant="outline"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Security-events inbegrepen</Badge> : null}</div>
    <Card className="app-surface"><CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Zoek in activiteiten" aria-label="Zoek in activiteiten" /><Select value={type} onValueChange={setType}><SelectTrigger aria-label="Filter op actie"><SelectValue placeholder="Alle acties" /></SelectTrigger><SelectContent><SelectItem value="all">Alle acties</SelectItem><SelectItem value="LEAD_CREATED">Lead aangemaakt</SelectItem><SelectItem value="EMAIL_SENT">E-mail verzonden</SelectItem><SelectItem value="QUOTE_CREATED">Offerte verzonden</SelectItem><SelectItem value="FILE_UPLOADED">Bestand geüpload</SelectItem></SelectContent></Select><Select value={actorUserId} onValueChange={setActorUserId}><SelectTrigger aria-label="Filter op gebruiker"><SelectValue placeholder="Alle gebruikers" /></SelectTrigger><SelectContent><SelectItem value="all">Alle gebruikers</SelectItem>{(activity.data?.actors ?? []).map((actor) => <SelectItem key={actor.id} value={actor.id}>{actor.name || actor.email}</SelectItem>)}</SelectContent></Select><Input value={resource} onChange={(event) => setResource(event.target.value)} placeholder="Resource of module" aria-label="Filter op resource of module" /><Select value={result} onValueChange={setResult}><SelectTrigger aria-label="Filter op resultaat"><SelectValue placeholder="Alle resultaten" /></SelectTrigger><SelectContent><SelectItem value="all">Alle resultaten</SelectItem><SelectItem value="SUCCESS">Geslaagd</SelectItem><SelectItem value="DENIED">Geweigerd</SelectItem><SelectItem value="FAILED">Mislukt</SelectItem></SelectContent></Select><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Vanaf datum" /><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Tot en met datum" /></CardContent></Card>
    {activity.isLoading ? <Card className="app-surface"><CardContent className="space-y-3 p-5">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-12 w-full" />)}</CardContent></Card> : activity.error ? <QueryErrorState message={activity.error.message} onRetry={() => activity.refetch()} /> : items.length === 0 ? <Card className="app-surface"><CardContent className="p-0"><EmptyState icon={<ActivityIcon />} title="Nog geen activiteiten" description="Nieuwe leads, wijzigingen en beveiligingsacties verschijnen hier automatisch." /></CardContent></Card> : <Card className="app-surface"><CardHeader className="pb-3"><CardTitle className="text-base">Recente activiteit</CardTitle></CardHeader><CardContent className="divide-y p-0">{items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"><div className="flex min-w-0 items-start gap-3"><div className={item.kind === "security" ? "mt-0.5 rounded-full bg-amber-100 p-1.5 text-amber-700" : "mt-0.5 rounded-full bg-muted p-1.5 text-muted-foreground"}>{item.kind === "security" ? <ShieldCheck className="h-3.5 w-3.5" /> : <ActivityIcon className="h-3.5 w-3.5" />}</div><div className="min-w-0"><p className="truncate text-sm font-medium">{typeLabels[item.type] ?? item.title}</p><p className="truncate text-xs text-muted-foreground">{item.resource ?? item.title}{item.actor ? ` · ${item.actor.name || item.actor.email}` : ""}{item.reason ? ` · ${item.reason}` : ""}</p></div></div><div className="flex shrink-0 items-center gap-2"><Badge variant={item.kind === "security" && item.result !== "SUCCESS" ? "destructive" : "outline"}>{item.kind === "security" ? (item.result === "SUCCESS" ? "Geslaagd" : item.result === "DENIED" ? "Geweigerd" : "Mislukt") : "Activiteit"}</Badge><time className="text-xs text-muted-foreground" dateTime={item.createdAt.toISOString()}>{new Date(item.createdAt).toLocaleString("nl-BE")}</time></div></div>)}</CardContent></Card>}
  </div>;
}
