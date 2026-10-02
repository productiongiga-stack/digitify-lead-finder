"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc/client";
import { AdsCampaignEditor } from "./ads-campaign-editor";
import { GoogleEditorTargetPicker } from "./google-editor-target-picker";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Tabs, TabsContent, TabsList, TabsTrigger } from "@digitify/ui";

const statusLabel: Record<string, string> = { PENDING_APPROVAL: "Wacht op goedkeuring", APPROVED: "Goedgekeurd", APPLIED: "Gepubliceerd",
  REJECTED: "Afgekeurd", APPLYING: "Wordt gepubliceerd", CONFLICT: "Extern gewijzigd", RECONCILE_REQUIRED: "Controle vereist" };
const jobStatusLabel: Record<string, string> = { PENDING: "Ingepland", RUNNING: "Bezig", SUCCEEDED: "Geslaagd", FAILED: "Mislukt", CANCELLED: "Geannuleerd", BLOCKED: "Geblokkeerd", NEEDS_REVIEW: "Controle vereist" };

export default function AdsWorkflowPanel({ provider }: { provider: "GOOGLE" | "META" }) {
  const api = provider === "GOOGLE" ? trpc.googleAds : trpc.metaAds;
  const overview = api.workflowOverview.useQuery(undefined, { staleTime: 15000, retry: false });
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
  const optimize = api.workflowOptimize.useMutation({ onSuccess: async () => { setMessage("AI-analyse opgeslagen. Bekijk de voorstellen en de analyse."); await refresh(); }, onError });
  const settings = api.workflowSettings.useMutation({ onSuccess: async () => { setMessage("Automatiseringsinstellingen opgeslagen."); await refresh(); }, onError });
  const retryJob = api.workflowRetryJob.useMutation({ onSuccess: async () => { setMessage("Veilige achtergrondtaak opnieuw ingepland voor de volgende worker-run."); await refresh(); }, onError });
  const version = overview.data?.versions.find((v) => v.id === selected);
  const history = api.workflowHistory.useQuery({ campaignId: version?.campaignId || "" }, { enabled: Boolean(version) });
  const busy = sync.isPending || imported.isPending || optimize.isPending || publish.isPending;
  return <Card className="border-primary/20">
    <CardHeader><CardTitle>Advertentiebeheer & AI-optimalisatie</CardTitle>
      <CardDescription>Bewerk bestaande campagnes, vergelijk versies en keur wijzigingen goed voordat ze worden doorgestuurd.</CardDescription></CardHeader>
    <CardContent className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy || !canApprove} onClick={() => sync.mutate()}>Campagnes synchroniseren</Button>
        <Button disabled={busy || !overview.data?.versions.length} onClick={() => optimize.mutate()}>{optimize.isPending ? "AI analyseert…" : "AI-voorstellen maken"}</Button>
      </div>
      {overview.error ? <p role="alert" className="text-sm text-destructive">{overview.error.message}</p> : null}
      {overview.isLoading ? <p role="status">Advertentiebeheer laden…</p> : null}
      {message ? <p role="status" className="rounded-lg border bg-muted/30 p-3 text-sm">{message}</p> : null}
      <Tabs defaultValue="editor">
        <TabsList className="flex h-auto flex-wrap justify-start"><TabsTrigger value="editor">Editor</TabsTrigger><TabsTrigger value="approval">Goedkeuring</TabsTrigger>
          <TabsTrigger value="ai">AI-analyse</TabsTrigger><TabsTrigger value="history">Historiek</TabsTrigger><TabsTrigger value="settings">Automatisering</TabsTrigger></TabsList>
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
          {overview.data?.runs.map((run) => <div key={run.id} className="rounded-xl border p-4"><p className="font-medium">{run.status} · {new Date(run.createdAt).toLocaleString("nl-BE")}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{String((run.result as any)?.summary || run.lastError || "Analyse wordt verwerkt…")}</p>
            {(run.result as any)?.rejected?.length ? <p className="mt-2 text-sm text-amber-700">Niet opgeslagen: {(run.result as any).rejected.join(" · ")}</p> : null}</div>)}
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
