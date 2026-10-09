"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc/client";
import { AdsCampaignEditor } from "./ads-campaign-editor";
import { AdsCampaignWizard } from "./ads-campaign-wizard";
import { GoogleEditorTargetPicker } from "./google-editor-target-picker";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Tabs, TabsContent, TabsList, TabsTrigger } from "@digitify/ui";
import { BarChart3, RefreshCw, Sparkles } from "lucide-react";

const statusLabel: Record<string, string> = { PENDING_APPROVAL: "Wacht op goedkeuring", APPROVED: "Goedgekeurd", APPLIED: "Gepubliceerd",
  REJECTED: "Afgekeurd", APPLYING: "Wordt gepubliceerd", CONFLICT: "Extern gewijzigd", RECONCILE_REQUIRED: "Controle vereist" };
const jobStatusLabel: Record<string, string> = { PENDING: "Ingepland", RUNNING: "Bezig", SUCCEEDED: "Geslaagd", FAILED: "Mislukt", CANCELLED: "Geannuleerd", BLOCKED: "Geblokkeerd", NEEDS_REVIEW: "Controle vereist" };
const formatMetric = (value: unknown, digits = 2) => typeof value === "number" && Number.isFinite(value)
  ? new Intl.NumberFormat("nl-BE", { maximumFractionDigits: digits }).format(value) : "—";

export default function AdsWorkflowPanel({ provider }: { provider: "GOOGLE" | "META" }) {
  const api = provider === "GOOGLE" ? trpc.googleAds : trpc.metaAds;
  const overview = api.workflowOverview.useQuery(undefined, { staleTime: 15000, gcTime: 60000, refetchOnWindowFocus: false, refetchOnReconnect: false, retry: false });
  const capabilities = api.workflowCapabilities.useQuery(undefined, { staleTime: 300000 });
  const { data: session } = useSession();
  const user = session?.user as { workspaceRole?: string; role?: string; isViewingAs?: boolean } | undefined;
  const canApprove = !user?.isViewingAs && ["OWNER", "ADMIN"].includes(user?.workspaceRole || user?.role || "");
  const [selected, setSelected] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [message, setMessage] = useState("");
  const [maxPercent, setMaxPercent] = useState<string | null>(null);
  const [cpl, setCpl] = useState<string | null>(null);
  const [roas, setRoas] = useState<string | null>(null);
  const [daily, setDaily] = useState<boolean | null>(null);
  const optimizeRunKey = useRef<string | null>(null);
  const onError = (error: { message: string }) => setMessage(error.message);
  const refresh = async () => { await overview.refetch(); };
  const sync = api.workflowSync.useMutation({ onSuccess: async (result) => {
    setMessage(result.errors.length ? "Gesynchroniseerd met " + result.errors.length + " fouten. " + result.errors[0]?.message
      : result.truncated ? "Eerste 20 campagnes gesynchroniseerd. Importeer overige campagnes afzonderlijk." : "Campagnes en prestaties gesynchroniseerd.");
    await refresh();
  }, onError });
  const imported = api.workflowImport.useMutation({ onSuccess: async (version) => { setSelected(version.id); await refresh(); }, onError });
  const propose = api.workflowPropose.useMutation({ onSuccess: async () => { setMessage("Voorstel opgeslagen. Open Goedkeuring om de wijziging te controleren."); await refresh(); }, onError });
  const approve = api.workflowApprove.useMutation({ onSuccess: refresh, onError });
  const publish = api.workflowPublish.useMutation({ onSuccess: async () => { setMessage("Wijziging doorgestuurd. Vervangende creatives blijven gepauzeerd."); await refresh(); }, onError });
  const reconcile = api.workflowReconcile.useMutation({ onSuccess: async (v) => { setSelected(v.id); setMessage("Controle afgerond. De actuele externe versie is opgehaald; maak indien nodig een nieuw voorstel."); await refresh(); }, onError });
  const replacementSwitch = api.workflowReplacementSwitch.useMutation({ onSuccess: async () => { setMessage("Overstapvoorstel opgeslagen. Keur deze afzonderlijke versie goed voordat je activeert."); await refresh(); }, onError });
  const optimize = api.workflowOptimize.useMutation({
    onSuccess: async () => { optimizeRunKey.current = null; setMessage("AI-analyse opgeslagen. Bekijk de voorstellen en de analyse."); await refresh(); },
    onError: (error) => { optimizeRunKey.current = null; onError(error); },
  });
  const settings = api.workflowSettings.useMutation({ onSuccess: async () => { setMessage("Automatiseringsinstellingen opgeslagen."); await refresh(); }, onError });
  const retryJob = api.workflowRetryJob.useMutation({ onSuccess: async () => { setMessage("Veilige achtergrondtaak opnieuw ingepland voor de volgende worker-run."); await refresh(); }, onError });
  const version = overview.data?.versions.find((v) => v.id === selected);
  const history = api.workflowHistory.useQuery({ campaignId: version?.campaignId || "" }, { enabled: Boolean(version), staleTime: 30000, refetchOnWindowFocus: false });
  const busy = sync.isPending || imported.isPending || optimize.isPending || publish.isPending || propose.isPending || approve.isPending || reconcile.isPending || replacementSwitch.isPending || settings.isPending || retryJob.isPending;
  const startOptimization = () => {
    const runKey = optimizeRunKey.current ?? (globalThis.crypto?.randomUUID?.() || `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    optimizeRunKey.current = runKey;
    optimize.mutate({ runKey });
  };
  return <Card className="overflow-hidden border-border/60 bg-card shadow-sm">
    <CardHeader className="border-b border-border/60 bg-gradient-to-br from-primary/[0.08] via-card to-card pb-5">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10"><BarChart3 className="h-3.5 w-3.5" /></span>Editor & AI</div><CardTitle className="text-xl tracking-tight">Advertentiebeheer & AI-optimalisatie</CardTitle>
      <CardDescription className="mt-1 max-w-2xl">Bewerk campagnes, vergelijk versies en keur elke wijziging goed voordat ze wordt doorgestuurd.</CardDescription></div><span className="rounded-full border border-emerald-200/70 bg-emerald-50/80 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">Veilige conceptflow</span></div></CardHeader>
    <CardContent className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="rounded-xl" disabled={busy || !canApprove} onClick={() => sync.mutate()}><RefreshCw className={sync.isPending ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />{sync.isPending ? "Synchroniseren…" : "Campagnes synchroniseren"}</Button>
        <Button className="rounded-xl shadow-sm" disabled={busy || !overview.data?.versions.length} onClick={startOptimization}><Sparkles className={optimize.isPending ? "mr-2 h-4 w-4 animate-pulse" : "mr-2 h-4 w-4"} />{optimize.isPending ? "AI analyseert…" : "AI-voorstellen maken"}</Button>
      </div>
      {overview.error ? <p role="alert" className="text-sm text-destructive">{overview.error.message}</p> : null}
      {overview.isLoading ? <p role="status">Advertentiebeheer laden…</p> : null}
      {message ? <p role="status" aria-live="polite" className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">{message}</p> : null}
      {overview.data?.performance ? <div className="rounded-xl border bg-muted/20 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div><h3 className="font-semibold">Prestatie-overzicht</h3><p className="text-xs text-muted-foreground">Alleen gemeten gegevens uit de laatst gesynchroniseerde campagnes.</p></div>
          <span className="text-xs text-muted-foreground">{overview.data.performance.withMetrics}/{overview.data.performance.campaignCount} campagnes met metrics{overview.data.performance.latestAt ? ` · ${new Date(overview.data.performance.latestAt).toLocaleDateString("nl-BE")}` : ""}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          <div><p className="text-xs text-muted-foreground">Vertoningen</p><p className="font-medium">{formatMetric(overview.data.performance.measured.impressions, 0)}</p></div>
          <div><p className="text-xs text-muted-foreground">Klikken</p><p className="font-medium">{formatMetric(overview.data.performance.measured.clicks, 0)}</p></div>
          <div><p className="text-xs text-muted-foreground">CTR</p><p className="font-medium">{formatMetric(overview.data.performance.derived.ctr)}{overview.data.performance.derived.ctr == null ? "" : "%"}</p></div>
          <div><p className="text-xs text-muted-foreground">Kosten</p><p className="font-medium">{formatMetric(overview.data.performance.measured.spend)}{overview.data.performance.measured.spend == null ? "" : " €"}</p></div>
          <div><p className="text-xs text-muted-foreground">Conversies</p><p className="font-medium">{formatMetric(overview.data.performance.measured.conversions, 0)}</p></div>
        </div>
      </div> : null}
      <Tabs defaultValue="new">
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted/50 p-1"><TabsTrigger className="rounded-lg px-3 py-2 text-xs sm:text-sm" value="new">Nieuwe campagne</TabsTrigger><TabsTrigger className="rounded-lg px-3 py-2 text-xs sm:text-sm" value="editor">Bestaande campagne</TabsTrigger><TabsTrigger className="rounded-lg px-3 py-2 text-xs sm:text-sm" value="approval">Goedkeuring</TabsTrigger>
          <TabsTrigger className="rounded-lg px-3 py-2 text-xs sm:text-sm" value="ai">AI-analyse</TabsTrigger><TabsTrigger className="rounded-lg px-3 py-2 text-xs sm:text-sm" value="history">Historiek</TabsTrigger><TabsTrigger className="rounded-lg px-3 py-2 text-xs sm:text-sm" value="settings">Automatisering</TabsTrigger></TabsList>
        <TabsContent value="new"><AdsCampaignWizard provider={provider === "GOOGLE" ? "GOOGLE" : "META"} /></TabsContent>
        <TabsContent value="editor" className="space-y-4">
          <Label htmlFor={"campaign-id-" + provider}>Externe campagne-ID</Label>
          <div className="flex flex-wrap gap-2"><Input id={"campaign-id-" + provider} className="max-w-xs" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} placeholder="Campagne-ID uit Google of Meta" />
            <Button variant="outline" disabled={!/^\d+$/.test(campaignId) || busy} onClick={() => imported.mutate({ campaignId })}>Campagne ophalen</Button></div>
          <Label htmlFor={"campaign-select-" + provider}>Gesynchroniseerde campagne</Label>
          <select id={"campaign-select-" + provider} className="w-full rounded-md border bg-background p-3" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Kies een campagne</option>{overview.data?.versions.map((v) => <option key={v.id} value={v.id}>
              {String((v.snapshot as any).name || (v.snapshot as any).campaign?.name || v.campaignId)} · {v.accountId}
              {(v.snapshot as any).editorTarget?.adId ? " · RSA " + (v.snapshot as any).editorTarget.adId : (v.snapshot as any).editorTarget?.assetGroupId ? " · Assetgroep " + (v.snapshot as any).editorTarget.assetGroupId : ""}
            </option>)}
          </select>
          {provider === "GOOGLE" && version ? <GoogleEditorTargetPicker key={version.campaignId} campaignId={version.campaignId} pending={imported.isPending}
            onSelect={(target) => imported.mutate({ campaignId: version.campaignId, target })} /> : null}
          {version ? <AdsCampaignEditor key={version.id} provider={provider} snapshot={version.snapshot as Record<string, any>} pending={propose.isPending}
            onSubmit={(patches, reason) => propose.mutateAsync({ versionId: version.id, patches, reason })} />
          : <p className="text-sm text-muted-foreground">Koppel je advertentieaccount via Integraties en synchroniseer daarna je campagnes. De campagne-wizard blijft beschikbaar voor nieuwe campagnes.</p>}
          <details className="text-sm"><summary className="cursor-pointer font-medium">Bewerkbare en alleen-lezen instellingen</summary>
            <p className="mt-2">Bewerkbaar: {capabilities.data?.editable.join(", ")}</p><p className="mt-2 text-muted-foreground">Alleen-lezen: {capabilities.data?.readOnly.join(", ")}</p></details>
        </TabsContent>
        <TabsContent value="approval" className="space-y-4">
          {!overview.data?.changes.length ? <p className="text-sm text-muted-foreground">Nog geen wijzigingsvoorstellen.</p> : null}
          {overview.data?.changes.map((change) => <div key={change.id} className="space-y-3 rounded-xl border p-4">
            <div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">Campagne {change.campaignId}</span><span className="text-sm">{statusLabel[change.status] || change.status} · {change.source}</span></div>
            <p className="text-sm">{change.reason}</p>
            {change.source === "AI" || change.source === "RESEARCH" ? <p className="text-xs text-muted-foreground">AI-confidence {change.confidence == null ? "onbekend" : `${Math.round(change.confidence)}/100`} · bewijs {Array.isArray(change.evidenceRefs) ? change.evidenceRefs.length : 0}</p> : null}
            <p className="text-xs text-muted-foreground">Risico: {change.risk} · Provider controleert advertentiebeleid bij publicatie.</p>
            <details><summary className="cursor-pointer text-sm font-medium">Wijzigingen bekijken</summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted p-3 text-xs">{JSON.stringify((change.checks as any).patches, null, 2)}</pre>
              <div className="mt-3 grid gap-3 md:grid-cols-2"><details><summary>Voor</summary><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(change.before, null, 2)}</pre></details>
                <details><summary>Na</summary><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(change.after, null, 2)}</pre></details></div></details>
            {canApprove && change.status === "PENDING_APPROVAL" ? <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate({ id: change.id, approve: true })}>Deze versie goedkeuren</Button>
              <Button size="sm" variant="outline" disabled={approve.isPending} onClick={() => approve.mutate({ id: change.id, approve: false })}>Afwijzen</Button></div> : null}
            {canApprove && change.status === "APPROVED" ? <Button size="sm" disabled={busy} onClick={() => publish.mutate({ id: change.id })}>Goedgekeurde wijziging publiceren</Button> : null}
            {canApprove && provider === "META" && change.status === "APPLIED" && overview.data?.operations.some((op) => op.changeSetId === change.id && (op.response as any)?.journal?.some((entry: any) => entry.action === "CREATE_PAUSED_REPLACEMENT")) ? <Button size="sm" variant="outline" disabled={replacementSwitch.isPending} onClick={() => replacementSwitch.mutate({ id: change.id })}>Overstap naar vervanger ter goedkeuring voorbereiden</Button> : null}
            {change.status === "CONFLICT" || change.status === "RECONCILE_REQUIRED" ? <p className="text-sm text-amber-700">Synchroniseer de campagne en vergelijk de externe gegevens voordat je een nieuw voorstel maakt.</p> : null}
            {canApprove && (change.status === "RECONCILE_REQUIRED" || change.status === "APPLYING") ? <Button size="sm" variant="outline" disabled={reconcile.isPending}
              onClick={() => {
                if (window.confirm("Heb je de externe campagne en eventuele gedeeltelijk toegepaste wijzigingen gecontroleerd? De huidige campagne wordt opnieuw opgehaald. Dit voorstel wordt afgesloten en niet opnieuw gepubliceerd.")) reconcile.mutate({ id: change.id });
              }}>Externe controle afronden</Button> : null}
          </div>)}
        </TabsContent>
        <TabsContent value="ai" className="space-y-3">
          {!overview.data?.runs.length ? <p className="text-sm text-muted-foreground">Nog geen AI-analyses. De AI gebruikt gesynchroniseerde prestaties van de laatste 30 dagen.</p> : null}
          {overview.data?.runs.map((run) => { const result = run.result as any; const recommendations = Array.isArray(result?.recommendations) ? result.recommendations : [];
            return <div key={run.id} className="rounded-xl border p-4"><p className="font-medium">{run.status} · {new Date(run.createdAt).toLocaleString("nl-BE")}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{String(result?.summary || run.lastError || "Analyse wordt verwerkt…")}</p>
              {recommendations.length ? <div className="mt-3 space-y-2"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Voorstellen voor controle</p>{recommendations.map((recommendation: any, index: number) => <div key={`${run.id}-${index}`} className="rounded-lg bg-muted/30 p-3 text-sm">
                <p className="font-medium">{recommendation.reason}</p><p className="mt-1 text-xs text-muted-foreground">Risico: {recommendation.risk} · Verwachte impact: {recommendation.expectedImpact || "niet aangegeven"} · {Array.isArray(recommendation.patches) ? recommendation.patches.length : 0} wijziging(en)</p>
              </div>)}</div> : null}
              {(result?.proposals?.length) ? <p className="mt-2 text-xs text-muted-foreground">{result.proposals.length} voorstel(len) aangemaakt in Goedkeuring.</p> : null}
              {(result?.rejected?.length) ? <p className="mt-2 text-sm text-amber-700">Niet opgeslagen: {result.rejected.join(" · ")}</p> : null}</div>;
          })}
        </TabsContent>
        <TabsContent value="history" className="space-y-3">
          <p className="text-sm text-muted-foreground">Kies een campagne in de editor om opgeslagen versies te bekijken.</p>
          {history.data?.map((v) => <details key={v.id} className="rounded-lg border p-3"><summary className="cursor-pointer text-sm">{new Date(v.syncedAt).toLocaleString("nl-BE")} · {v.fingerprint.slice(0, 12)}</summary>
            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(v.snapshot, null, 2)}</pre></details>)}
          {overview.data?.operations.map((op) => <p key={op.id} className="rounded-lg border p-3 text-sm">{op.status} · {op.lastError || "Publicatie geregistreerd"} · {op.attempts} poging(en)</p>)}
        </TabsContent>
        <TabsContent value="settings" className="space-y-4">
          <label className="flex items-center gap-2"><input type="checkbox" checked={daily ?? overview.data?.settings.enabled ?? false} onChange={(e) => setDaily(e.target.checked)} />Dagelijks analyseren na synchronisatie</label>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><Label htmlFor="max-budget-change">Max. budgetvoorstel (%)</Label><Input id="max-budget-change" type="number" min={0} max={20} value={maxPercent ?? String(overview.data?.settings.maxBudgetChangePercent ?? 20)} onChange={(e) => setMaxPercent(e.target.value)} /></div>
            <div><Label htmlFor="target-cpl">Doel CPL/CPA (€)</Label><Input id="target-cpl" type="number" min={0} value={cpl ?? String(overview.data?.settings.targetCpl ?? "")} onChange={(e) => setCpl(e.target.value)} /></div>
            <div><Label htmlFor="target-roas">Doel ROAS</Label><Input id="target-roas" type="number" min={0} value={roas ?? String(overview.data?.settings.targetRoas ?? "")} onChange={(e) => setRoas(e.target.value)} /></div>
          </div>
          <p className="text-sm text-muted-foreground">AI maakt voorstellen. Goedkeuring en publicatie blijven aparte handmatige stappen. Advertentiebudgetten en kosten van AI-providers blijven voor jouw account.</p>
          <Button disabled={!canApprove || settings.isPending} onClick={() => settings.mutate({ enabled: daily ?? overview.data?.settings.enabled ?? false,
            maxBudgetChangePercent: Number(maxPercent ?? overview.data?.settings.maxBudgetChangePercent ?? 20),
            targetCpl: Number(cpl ?? overview.data?.settings.targetCpl) || null, targetRoas: Number(roas ?? overview.data?.settings.targetRoas) || null,
          })}>Instellingen opslaan</Button>
          <div className="space-y-3 border-t pt-4">
            <h3 className="font-semibold">Achtergrondtaken</h3>
            <p className="text-sm text-muted-foreground">Synchronisatie, providercontrole, analyse en herinneringen worden apart opgeslagen. AI en advertentiepublicaties worden nooit blind opnieuw uitgevoerd.</p>
            {!overview.data?.jobs.length ? <p className="text-sm text-muted-foreground">Nog geen geplande taken. De lokale scheduler is niet automatisch actief.</p> : null}
            {overview.data?.jobs.map((job) => <div className="space-y-2 rounded-lg border p-3 text-sm" key={job.id}>
              <div className="flex flex-wrap justify-between gap-2"><span>{({ SYNC: "Campagnes en prestaties synchroniseren", OPTIMIZE: "AI-optimalisatie", PROVIDER_CHECK: "Providercontrole", REMINDERS: "Goedkeuringsherinneringen", RECOVERY: "Onderbroken publicaties controleren" } as Record<string, string>)[job.kind] || job.kind}</span><span>{jobStatusLabel[job.status] || job.status} · poging {job.attempts}</span></div>
              {job.lastError ? <p role="status" className="text-destructive">{job.lastError}</p> : null}
              {canApprove && job.status === "FAILED" && job.kind !== "OPTIMIZE" ? <Button size="sm" variant="outline" disabled={retryJob.isPending} onClick={() => retryJob.mutate({ id: job.id })}>Veilige taak opnieuw inplannen</Button> : null}
            </div>)}
          </div>
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>;
}
