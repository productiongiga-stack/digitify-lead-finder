"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@digitify/ui";
import { CheckCircle2, ExternalLink, Loader2, RefreshCcw, Sparkles, TriangleAlert } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/feedback/toast-provider";

type Provider = "META" | "GOOGLE";

export function AdsCopilotPanel({ provider, campaignIds = [] }: { provider: Provider; campaignIds?: string[] }) {
  const { showToast } = useToast();
  const [sourceMode, setSourceMode] = useState<"ACCOUNT_DATA" | "ACCOUNT_AND_WEB">("ACCOUNT_DATA");
  const [objective, setObjective] = useState("");
  const status = trpc.adsCopilot.status.useQuery(undefined, { staleTime: 60_000 });
  const runs = trpc.adsCopilot.listResearchRuns.useQuery({ provider }, { refetchInterval: 10_000 });
  const latest = runs.data?.[0];
  const run = trpc.adsCopilot.getResearchRun.useQuery({ id: latest?.id || "" }, {
    enabled: Boolean(latest?.id),
    refetchInterval: latest && ["PENDING", "RUNNING"].includes(latest.status) ? 3_000 : false,
  });
  const start = trpc.adsCopilot.startResearch.useMutation({
    onSuccess: async () => { await runs.refetch(); showToast({ title: "Research gestart", description: "De Copilot verzamelt accountdata en onderbouwde inzichten." }); },
    onError: (error) => showToast({ title: "Research niet gestart", description: error.message, variant: "error" }),
  });
  const retry = trpc.adsCopilot.retryResearch.useMutation({
    onSuccess: async () => { await runs.refetch(); showToast({ title: "Research opnieuw ingepland" }); },
    onError: (error) => showToast({ title: "Retry mislukt", description: error.message, variant: "error" }),
  });
  const createProposal = trpc.adsCopilot.generateCampaignProposal.useMutation({
    onSuccess: () => showToast({ title: "Voorstel aangemaakt", description: "Controleer het voorstel in Goedkeuring voordat je publiceert." }),
    onError: (error) => showToast({ title: "Voorstel mislukt", description: error.message, variant: "error" }),
  });
  const result = run.data?.result as Record<string, unknown> | null | undefined;
  const recommendations = Array.isArray(result?.recommendations) ? result.recommendations as Array<Record<string, unknown>> : [];
  const evidence = run.data?.evidence || [];
  const busy = start.isPending || retry.isPending;
  const canUseWeb = Boolean(status.data?.webResearchConfigured);
  const campaignIdList = useMemo(() => [...new Set(campaignIds.filter(Boolean))].slice(0, 20), [campaignIds]);

  useEffect(() => {
    if (!canUseWeb && sourceMode === "ACCOUNT_AND_WEB") setSourceMode("ACCOUNT_DATA");
  }, [canUseWeb, sourceMode]);

  function startResearch() {
    start.mutate({ provider, sourceMode, objective: objective.trim() || undefined, campaignIds: campaignIdList });
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Copilot voor {provider === "META" ? "Meta" : "Google"} Ads</CardTitle>
            <CardDescription>Analyseer je account met bewijs. De Copilot maakt alleen voorstellen en publiceert niets.</CardDescription>
          </div>
          <Badge variant="secondary">Approval verplicht</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto] md:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium">Focus (optioneel)</label>
            <Textarea value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="bv. lagere CPA, betere leadkwaliteit of nieuwe doelgroep" className="min-h-20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Bronnen</label>
            <Select value={sourceMode} onValueChange={(value) => setSourceMode(value as typeof sourceMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACCOUNT_DATA">Eigen accountdata</SelectItem>
                <SelectItem value="ACCOUNT_AND_WEB" disabled={!canUseWeb}>Accountdata + webresearch</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={startResearch} disabled={busy || (sourceMode === "ACCOUNT_AND_WEB" && !canUseWeb)}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Analyseer account
          </Button>
        </div>

        {!canUseWeb ? <p className="text-xs text-muted-foreground">Live webresearch is nog niet geconfigureerd. Eigen accountdata blijft beschikbaar.</p> : null}
        {latest ? <div className="rounded-xl border bg-background/70 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2"><span className="font-medium">Laatste analyse</span><Badge variant={latest.status === "COMPLETED" ? "default" : latest.status === "FAILED" || latest.status === "BLOCKED" ? "destructive" : "secondary"}>{latest.status}</Badge></div>
            <span className="text-xs text-muted-foreground">Profiel v{latest.profileVersion || 1} · {latest.createdAt ? new Date(latest.createdAt).toLocaleString("nl-BE") : ""}</span>
          </div>
          {latest.lastError ? <p className="mt-2 flex items-start gap-2 text-xs text-destructive"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{latest.lastError}</p> : null}
          {["FAILED", "BLOCKED"].includes(latest.status) ? <Button size="sm" variant="outline" className="mt-3" onClick={() => retry.mutate({ id: latest.id })} disabled={retry.isPending}><RefreshCcw className="mr-2 h-3.5 w-3.5" />Opnieuw proberen</Button> : null}
        </div> : <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Nog geen analyse. Start een run om kansen, risico’s en concrete wijzigingen te zien.</p>}

        {run.data?.status === "COMPLETED" && result ? <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border bg-background/70 p-3"><p className="text-xs text-muted-foreground">Samenvatting</p><p className="mt-1 text-sm">{String(result.summary || "Geen samenvatting")}</p></div>
            <div className="rounded-xl border bg-background/70 p-3"><p className="text-xs text-muted-foreground">Kansen</p><p className="mt-1 text-sm">{Array.isArray(result.opportunities) ? (result.opportunities as unknown[]).slice(0, 3).map(String).join(" · ") || "Geen kansen" : "Geen kansen"}</p></div>
            <div className="rounded-xl border bg-background/70 p-3"><p className="text-xs text-muted-foreground">Risico’s</p><p className="mt-1 text-sm">{Array.isArray(result.risks) ? (result.risks as unknown[]).slice(0, 3).map(String).join(" · ") || "Geen risico’s" : "Geen risico’s"}</p></div>
          </div>
          <div className="rounded-xl border bg-background/70 p-3 text-sm"><div className="flex items-center justify-between gap-2"><span className="font-medium">Voorstellen</span><span className="text-xs text-muted-foreground">{evidence.length} bronnen</span></div>
            {recommendations.length ? <div className="mt-2 space-y-2">{recommendations.map((item, index) => <div key={`${String(item.versionId || "proposal")}-${index}`} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{String(item.reason || "Campagneverbetering")}</p><p className="text-xs text-muted-foreground">Confidence {Math.round(Number(item.confidence || 0))}/100 · risico {String(item.risk || "MEDIUM")}</p></div><Button size="sm" variant="outline" onClick={() => createProposal.mutate({ researchRunId: latest!.id, versionId: String(item.versionId || "") })} disabled={!item.versionId || createProposal.isPending}><CheckCircle2 className="mr-2 h-3.5 w-3.5" />Voorstel maken</Button></div>)}</div> : <p className="mt-2 text-xs text-muted-foreground">Geen automatische wijziging voorgesteld. Gebruik de inzichten als briefing of synchroniseer eerst een actuele campagneversie.</p>}
          </div>
          {evidence.length ? <details className="rounded-xl border p-3 text-xs"><summary className="cursor-pointer font-medium">Bewijs en bronnen bekijken</summary><div className="mt-2 space-y-2">{evidence.slice(0, 12).map((item) => <div key={item.id} className="flex gap-2"><ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span>{item.title || item.kind}{item.url ? ` · ${item.url}` : ""}</span></div>)}</div></details> : null}
        </div> : null}
      </CardContent>
    </Card>
  );
}
