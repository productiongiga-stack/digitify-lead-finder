"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@digitify/ui";
import { AlertTriangle, BarChart3, CheckCircle2, Loader2, PauseCircle, RefreshCcw, Save, Search, Send, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { useToast } from "@/components/feedback/toast-provider";

type PlanStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "PUSHING" | "PUSHED_PAUSED" | "FAILED" | "CANCELLED";

function eur(cents?: number | null, currency = "EUR") {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency }).format(Number(cents || 0) / 100);
}

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function prettyDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("nl-BE", { dateStyle: "short", timeStyle: "short" });
}

function statusBadge(status: PlanStatus) {
  if (status === "PUSHED_PAUSED") return <Badge variant="success">Gepusht als paused</Badge>;
  if (status === "FAILED") return <Badge variant="warning">Mislukt</Badge>;
  if (status === "PUSHING") return <Badge variant="secondary">Pushen...</Badge>;
  if (status === "APPROVED") return <Badge variant="info">Goedgekeurd</Badge>;
  if (status === "PENDING_APPROVAL") return <Badge variant="warning">Wacht op approval</Badge>;
  if (status === "CANCELLED") return <Badge variant="outline">Geannuleerd</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

function parseJson(value: string, label: string) {
  if (!value.trim()) return {};
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} bevat geen geldige JSON.`);
  }
}

export default function GoogleAdsPage() {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [name, setName] = useState("Digitify search campagne");
  const [campaignType, setCampaignType] = useState("SEARCH");
  const [currency, setCurrency] = useState("EUR");
  const [dailyBudget, setDailyBudget] = useState("2500");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [product, setProduct] = useState("Lead generation voor lokale bedrijven");
  const [audience, setAudience] = useState("Belgische KMO-eigenaars en zaakvoerders");
  const [creativeJson, setCreativeJson] = useState(JSON.stringify({
    finalUrl: "https://leads.digitify.be",
    headlines: ["Meer kwalitatieve leads", "Digitify lead generation", "Vraag vandaag een demo"],
    descriptions: ["Automatiseer leadgeneratie voor Belgische KMO's.", "Campagne wordt veilig als gepauzeerd aangemaakt."],
    imageUrl: "",
  }, null, 2));
  const [targetingJson, setTargetingJson] = useState(JSON.stringify({
    geoTargetConstants: ["geoTargetConstants/2056"],
    keywords: ["lead generatie belgie", "digitify leads"],
    languageConstants: ["languageConstants/1010"],
  }, null, 2));

  const connection = trpc.googleAds.connectionStatus.useQuery(undefined, { refetchInterval: 30_000 });
  const customers = trpc.googleAds.listCustomers.useQuery(undefined, { enabled: Boolean(connection.data?.connected) });
  const campaigns = trpc.googleAds.listCampaigns.useQuery(undefined, { enabled: Boolean(connection.data?.selectedCustomerId), refetchInterval: 60_000 });
  const insights = trpc.googleAds.getInsights.useQuery(undefined, { enabled: Boolean(connection.data?.selectedCustomerId), refetchInterval: 60_000 });
  const drafts = trpc.googleAds.listDrafts.useQuery(undefined, { refetchInterval: 20_000 });

  const invalidate = async () => {
    await Promise.all([
      utils.googleAds.connectionStatus.invalidate(),
      utils.googleAds.listDrafts.invalidate(),
      utils.googleAds.listCampaigns.invalidate(),
      utils.googleAds.getInsights.invalidate(),
      utils.googleAds.listCustomers.invalidate(),
    ]);
  };

  const createDraft = trpc.googleAds.createDraft.useMutation({
    onSuccess: async (row: any) => {
      setSelectedPlanId(row.id);
      await invalidate();
      showToast({ title: "Google Ads draft aangemaakt" });
    },
    onError: (error) => showToast({ title: "Draft mislukt", description: error.message, variant: "error" }),
  });

  const updateDraft = trpc.googleAds.updateDraft.useMutation({
    onSuccess: async () => {
      await invalidate();
      showToast({ title: "Draft opgeslagen" });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const generateSuggestion = trpc.googleAds.generateSuggestion.useMutation({
    onSuccess: (payload: any) => {
      setName(payload.name || name);
      if (payload.campaignType) setCampaignType(payload.campaignType);
      setCreativeJson(JSON.stringify(payload.creatives || JSON.parse(creativeJson || "{}"), null, 2));
      setTargetingJson(JSON.stringify(payload.targeting || {}, null, 2));
      showToast({ title: "AI draftvoorstel gegenereerd" });
    },
    onError: (error) => showToast({ title: "Suggestie mislukt", description: error.message, variant: "error" }),
  });

  const submitForApproval = trpc.googleAds.submitForApproval.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Indienen mislukt", description: e.message, variant: "error" }) });
  const approveDraft = trpc.googleAds.approveDraft.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Goedkeuren mislukt", description: e.message, variant: "error" }) });
  const pushPaused = trpc.googleAds.pushPausedToGoogle.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Push mislukt", description: e.message, variant: "error" }) });
  const retryFailed = trpc.googleAds.retryFailed.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Retry mislukt", description: e.message, variant: "error" }) });
  const rejectDraft = trpc.googleAds.rejectDraft.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Afkeuren mislukt", description: e.message, variant: "error" }) });
  const cancelDraft = trpc.googleAds.cancelDraft.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Annuleren mislukt", description: e.message, variant: "error" }) });
  const selectCustomer = trpc.googleAds.selectCustomer.useMutation({
    onSuccess: async () => {
      await invalidate();
      showToast({ title: "Google Ads customer geselecteerd" });
    },
    onError: (error) => showToast({ title: "Selecteren mislukt", description: error.message, variant: "error" }),
  });

  const setAutoadsEnabled = trpc.googleAds.setAutoadsEnabled.useMutation({
    onSuccess: async () => {
      await invalidate();
      showToast({ title: "Google Ads module bijgewerkt" });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const rows = drafts.data ?? [];
  const selectedPlan = rows.find((row: any) => row.id === selectedPlanId) || rows[0] || null;
  const totalSpend = useMemo(() => (insights.data || []).reduce((sum: number, row: any) => sum + Number(row.spend || 0), 0), [insights.data]);
  const totalClicks = useMemo(() => (insights.data || []).reduce((sum: number, row: any) => sum + Number(row.clicks || 0), 0), [insights.data]);

  function buildPayload() {
    return {
      name,
      campaignType: campaignType as "SEARCH" | "PERFORMANCE_MAX",
      dailyBudgetCents: numberValue(dailyBudget),
      currency,
      startTime: startTime ? new Date(startTime) : null,
      endTime: endTime ? new Date(endTime) : null,
      targeting: parseJson(targetingJson, "Targeting"),
      creatives: parseJson(creativeJson, "Creative"),
    };
  }

  function saveDraft() {
    try {
      const payload = buildPayload();
      if (selectedPlan && ["DRAFT", "FAILED", "CANCELLED"].includes(selectedPlan.status)) {
        updateDraft.mutate({ id: selectedPlan.id, ...payload });
      } else {
        createDraft.mutate(payload);
      }
    } catch (error) {
      showToast({ title: "Controleer je velden", description: error instanceof Error ? error.message : "Ongeldige input", variant: "error" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Google Ads</h1>
              <p className="text-sm text-muted-foreground">Search & Performance Max — drafts, approval en push als paused.</p>
            </div>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href="/settings/integrations">Google Ads koppeling</Link>
        </Button>
      </div>

      {!connection.data?.hasDeveloperToken ? (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="p-4 text-sm text-amber-950 dark:text-amber-100">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            Zet <span className="font-mono">GOOGLE_ADS_DEVELOPER_TOKEN</span> in Vercel (Google Ads API Center).
          </CardContent>
        </Card>
      ) : null}

      {!connection.data?.autoadsEnabled ? (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="p-4 text-sm">
            <p className="font-medium text-destructive">Google Ads module staat uit</p>
            <p className="mt-1 text-muted-foreground">Zet de module hieronder aan om drafts naar Google te kunnen pushen.</p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-amber-500/30 bg-amber-500/10">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-700" />
            <div>
              <p className="font-medium text-amber-950 dark:text-amber-100">Safety first: campagnes worden gepauzeerd aangemaakt in Google Ads.</p>
              <p className="text-sm text-amber-900/80 dark:text-amber-100/80">Live zetten doe je in Google Ads of later via een strengere flow.</p>
            </div>
          </div>
          {connection.data?.selectedCustomerId ? <Badge variant="success">Customer actief</Badge> : <Badge variant="warning">Customer kiezen</Badge>}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Koppeling</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">{connection.data?.connected ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />} Google OAuth</div>
            <div className="font-mono text-xs text-muted-foreground">{connection.data?.selectedCustomerName || connection.data?.selectedCustomerId || connection.data?.accountEmail || "Geen customer geselecteerd"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Budget guard</CardTitle></CardHeader>
          <CardContent className="text-sm">
            Max per campagne: <span className="font-semibold">{eur(connection.data?.maxDailyBudgetCents, connection.data?.defaultCurrency || "EUR")}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Laatste 30 dagen</CardTitle></CardHeader>
          <CardContent className="text-sm">
            Spend: <span className="font-semibold">{new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(totalSpend)}</span> · Clicks: <span className="font-semibold">{totalClicks}</span>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="campaigns">Campagnes</TabsTrigger>
          <TabsTrigger value="drafts">Drafts</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="settings">Instellingen</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Draft builder</CardTitle>
              <CardDescription>Search of Performance Max. Pushen naar Google kan pas na approval.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2"><Label>Campagnenaam</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-2"><Label>Campagnetype</Label><Select value={campaignType} onValueChange={setCampaignType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SEARCH">Search</SelectItem><SelectItem value="PERFORMANCE_MAX">Performance Max</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Dagbudget in cent</Label><Input type="number" min="100" value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} /></div>
                <div className="space-y-2"><Label>Valuta</Label><Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} /></div>
                <div className="space-y-2"><Label>Start</Label><Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
                <div className="space-y-2"><Label>Einde</Label><Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2"><Label>Product voor AI</Label><Input value={product} onChange={(e) => setProduct(e.target.value)} /></div>
                <div className="space-y-2"><Label>Doelgroep voor AI</Label><Input value={audience} onChange={(e) => setAudience(e.target.value)} /></div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-2"><Label>Creative JSON</Label><Textarea className="min-h-48 font-mono text-xs" value={creativeJson} onChange={(e) => setCreativeJson(e.target.value)} /></div>
                <div className="space-y-2"><Label>Targeting JSON</Label><Textarea className="min-h-48 font-mono text-xs" value={targetingJson} onChange={(e) => setTargetingJson(e.target.value)} /></div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => generateSuggestion.mutate({ product, audience })} variant="outline" disabled={generateSuggestion.isPending}>{generateSuggestion.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} AI voorstel</Button>
                <Button onClick={saveDraft} disabled={createDraft.isPending || updateDraft.isPending}>{createDraft.isPending || updateDraft.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Draft opslaan</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Approval queue</CardTitle>
              <CardDescription>OWNER/ADMIN keurt goed en pusht daarna als gepauzeerd naar Google.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {drafts.isLoading ? <Skeleton className="h-32 w-full" /> : rows.length ? rows.slice(0, 6).map((row: any) => (
                <div key={row.id} className={`rounded-xl border p-3 ${selectedPlan?.id === row.id ? "border-primary bg-primary/5" : "bg-card"}`}>
                  <button type="button" className="w-full text-left" onClick={() => setSelectedPlanId(row.id)}>
                    <div className="flex items-center justify-between gap-2"><p className="font-medium">{row.name}</p>{statusBadge(row.status)}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{eur(row.dailyBudgetCents, row.currency)} · bijgewerkt {prettyDate(row.updatedAt)}</p>
                    {row.lastError ? <p className="mt-2 text-xs text-destructive">{row.lastError}</p> : null}
                  </button>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.status === "DRAFT" || row.status === "FAILED" || row.status === "CANCELLED" ? <Button size="sm" variant="outline" onClick={() => submitForApproval.mutate({ id: row.id })}>Indienen</Button> : null}
                    {row.status === "PENDING_APPROVAL" ? <Button size="sm" onClick={() => approveDraft.mutate({ id: row.id })}>Goedkeuren</Button> : null}
                    {row.status === "APPROVED" ? (
                      <Button
                        size="sm"
                        disabled={!connection.data?.autoadsEnabled || pushPaused.isPending}
                        onClick={() => pushPaused.mutate({ id: row.id })}
                      >
                        <Send className="mr-2 h-3 w-3" /> Push paused
                      </Button>
                    ) : null}
                    {row.status === "FAILED" ? <Button size="sm" variant="outline" onClick={() => retryFailed.mutate({ id: row.id })}><RefreshCcw className="mr-2 h-3 w-3" /> Retry</Button> : null}
                    {!["PUSHING", "PUSHED_PAUSED", "CANCELLED"].includes(row.status) ? <Button size="sm" variant="outline" onClick={() => rejectDraft.mutate({ id: row.id, reason: "Aanpassing gevraagd" })}>Afkeuren</Button> : null}
                    {!["PUSHING", "PUSHED_PAUSED", "CANCELLED"].includes(row.status) ? <Button size="sm" variant="outline" onClick={() => cancelDraft.mutate({ id: row.id })}>Annuleren</Button> : null}
                  </div>
                </div>
              )) : <EmptyState title="Nog geen Google Ads drafts" description="Maak je eerste draft aan via de builder." icon={<PauseCircle className="h-8 w-8" />} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns">
          <Card>
            <CardHeader><CardTitle>Google campagnes</CardTitle><CardDescription>Campagnes uit het geselecteerde Google Ads customer account.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {campaigns.isLoading ? <Skeleton className="h-32 w-full" /> : (campaigns.data || []).length ? (campaigns.data || []).map((campaign: any) => (
                <div key={campaign.id} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="font-medium">{campaign.name}</p><p className="text-xs text-muted-foreground">{campaign.channelType} · {campaign.status}</p></div>
                  <Badge variant={campaign.status === "ENABLED" || campaign.status === 2 ? "success" : "secondary"}>{String(campaign.status)}</Badge>
                </div>
              )) : <EmptyState title="Geen campagnes geladen" description="Kies eerst een customer of koppel Google Ads opnieuw." icon={<Search className="h-8 w-8" />} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drafts">
          <Card>
            <CardHeader><CardTitle>Alle drafts</CardTitle><CardDescription>Interne plannen met approval- en push-status.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {rows.map((row: any) => <div key={row.id} className="rounded-xl border p-4"><div className="flex items-center justify-between"><p className="font-medium">{row.name}</p>{statusBadge(row.status)}</div><p className="mt-1 text-sm text-muted-foreground">{row.campaignType} · {eur(row.dailyBudgetCents, row.currency)} · {prettyDate(row.createdAt)}</p></div>)}
              {!rows.length ? <EmptyState title="Geen drafts" description="Je drafts verschijnen hier zodra je er een opslaat." icon={<Save className="h-8 w-8" />} /> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Insights</CardTitle><CardDescription>Campaign-level performance van de laatste 30 dagen.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {(insights.data || []).map((row: any) => <div key={row.campaign_id || row.campaign_name} className="grid gap-2 rounded-xl border p-3 text-sm sm:grid-cols-4"><div className="font-medium">{row.campaign_name || row.campaign_id}</div><div>Impressies: {row.impressions || 0}</div><div>Clicks: {row.clicks || 0}</div><div>Spend: €{row.spend || 0}</div></div>)}
              {!(insights.data || []).length ? <EmptyState title="Geen inzichten" description="Google geeft nog geen data terug voor dit account of deze periode." icon={<BarChart3 className="h-8 w-8" />} /> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader><CardTitle>Google Ads instellingen</CardTitle><CardDescription>Selecteer exact één customer ID per workspace.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Google Ads module</p>
                    <p className="text-xs text-muted-foreground">Vereist om Push paused naar Google te gebruiken.</p>
                  </div>
                  <Switch
                    checked={Boolean(connection.data?.autoadsEnabled)}
                    disabled={setAutoadsEnabled.isPending}
                    onCheckedChange={(enabled) => setAutoadsEnabled.mutate({ enabled })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Beschikbare Google Ads customers</Label>
                {customers.isLoading ? <Skeleton className="h-20 w-full" /> : (customers.data || []).map((account: any) => (
                  <div key={account.customerId} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="font-medium">{account.name}</p><p className="font-mono text-xs text-muted-foreground">{account.customerId} · {account.currency}</p></div>
                    <Button size="sm" variant={connection.data?.selectedCustomerId === account.customerId ? "secondary" : "default"} onClick={() => selectCustomer.mutate({ customerId: account.customerId, name: account.name, currency: account.currency, timezoneName: account.timezone })}>{connection.data?.selectedCustomerId === account.customerId ? "Geselecteerd" : "Selecteren"}</Button>
                  </div>
                ))}
                {!(customers.data || []).length ? <EmptyState title="Geen customers gevonden" description="Koppel Google Ads met adwords-scope en controleer API-toegang." icon={<Search className="h-8 w-8" />} /> : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
