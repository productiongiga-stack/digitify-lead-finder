"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Textarea } from "@digitify/ui";
import { CheckCircle2, ChevronLeft, ChevronRight, FileText, Loader2, Plus, RefreshCw, Save, ShieldCheck, Sparkles, X } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/feedback/toast-provider";

type Provider = "META" | "GOOGLE";
type ProviderSelection = Provider | "BOTH";
type Step = "briefing" | "context" | "platform" | "review";

const STEPS: Array<{ id: Step; label: string }> = [
  { id: "briefing", label: "Briefing" },
  { id: "context", label: "Bedrijfscontext" },
  { id: "platform", label: "Platformplan" },
  { id: "review", label: "Controleren" },
];

type Project = {
  id: string;
  providerSelection: ProviderSelection;
  status: string;
  activeStep: string;
  name: string | null;
  brief: Record<string, string>;
  metaPlan?: unknown;
  googlePlan?: unknown;
  selectedAssetIds?: unknown;
  readiness?: unknown;
  revision: number;
  updatedAt: Date | string;
};

type CampaignVersion = {
  id: string;
  campaignId: string;
  accountId: string;
  snapshot: unknown;
};

type Strategy = {
  summary: string;
  assumptions: string[];
  unknowns: string[];
  confidence: number;
  evidenceRefs: string[];
  meta?: { angles: string[]; audiences: string[]; creativeDirections: string[]; callsToAction: string[] };
  google?: { keywordThemes: string[]; adGroups: string[]; headlineDirections: string[]; negativeKeywordThemes: string[] };
};

type GoogleSearchPlan = {
  finalUrl?: string;
  adGroups?: Array<{
    id?: string;
    name?: string;
    theme?: string;
    keywords?: Array<{ text?: string; source?: string; metrics?: Record<string, number> }>;
    negativeKeywords?: Array<{ text?: string; source?: string }>;
    headlines?: string[];
    descriptions?: string[];
  }>;
  summary?: string;
  confidence?: number;
  sourceStatus?: string;
  unknowns?: string[];
};

type PmaxAssetRole = "LANDSCAPE" | "SQUARE" | "PORTRAIT" | "LOGO" | "LANDSCAPE_LOGO" | "VIDEO";
type PerformanceMaxPlan = {
  campaignType?: "PERFORMANCE_MAX";
  campaignName?: string;
  assetGroupName?: string;
  finalUrl?: string;
  businessName?: string;
  headlines?: string[];
  longHeadlines?: string[];
  descriptions?: string[];
  searchThemes?: string[];
  audienceSignals?: string[];
  assets?: Array<{ id?: string; role?: PmaxAssetRole; url?: string; evidenceRefs?: string[] }>;
  unknowns?: string[];
  confidence?: number;
  sourceStatus?: string;
};

type MediaAsset = {
  id: string;
  type: string;
  model: string;
  prompt: string;
  blobUrl: string | null;
  metadata?: unknown;
  createdAt: Date | string;
};

function makeIdempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function providerLabel(provider: ProviderSelection) {
  return provider === "BOTH" ? "Meta + Google" : provider === "META" ? "Meta Ads" : "Google Ads";
}

function toProject(value: unknown): Project {
  const row = value as Project;
  return {
    ...row,
    brief: row.brief && typeof row.brief === "object" ? row.brief : {},
  };
}

function storedStrategy(value: Project) {
  const plan = value.providerSelection === "GOOGLE" ? value.googlePlan : value.metaPlan;
  if (!plan || typeof plan !== "object" || !("strategy" in plan)) return null;
  return (plan as { strategy?: Strategy | null }).strategy || null;
}

function storedGoogleSearchPlan(value: Project | null): GoogleSearchPlan | null {
  if (!value?.googlePlan || typeof value.googlePlan !== "object") return null;
  const plan = (value.googlePlan as { searchPlan?: unknown }).searchPlan;
  return plan && typeof plan === "object" ? plan as GoogleSearchPlan : null;
}

function storedPerformanceMaxPlan(value: Project | null): PerformanceMaxPlan | null {
  if (!value?.googlePlan || typeof value.googlePlan !== "object") return null;
  const plan = (value.googlePlan as { performanceMaxPlan?: unknown }).performanceMaxPlan;
  return plan && typeof plan === "object" ? plan as PerformanceMaxPlan : null;
}

function storedAssetIds(value: Project | null) {
  return value?.selectedAssetIds && Array.isArray(value.selectedAssetIds) ? value.selectedAssetIds.map(String) : [];
}

function readinessProposal(value: Project | null) {
  if (!value?.readiness || typeof value.readiness !== "object") return null;
  const proposal = (value.readiness as { proposal?: unknown }).proposal;
  return proposal && typeof proposal === "object"
    ? proposal as { status?: string; versionId?: string; changeSetId?: string; message?: string }
    : null;
}

function readinessDraft(value: Project | null, provider: Provider) {
  if (!value?.readiness || typeof value.readiness !== "object") return null;
  const readiness = value.readiness as { drafts?: unknown };
  const drafts = readiness.drafts && typeof readiness.drafts === "object" ? readiness.drafts as Record<string, unknown> : {};
  const draft = drafts[provider];
  return draft && typeof draft === "object"
    ? draft as { status?: string; draftId?: string; missing?: string[]; message?: string; providerStatus?: string; content?: { status?: string; message?: string; confidence?: number }; review?: { status?: string; score?: number; blockingIssues?: string[]; warnings?: string[]; draftUpdatedAt?: string }; approval?: { status?: string; submittedAt?: string; updatedAt?: string } }
    : null;
}

function readinessPerformanceMaxMissing(value: Project | null) {
  if (!value?.readiness || typeof value.readiness !== "object") return undefined;
  const item = (value.readiness as { googlePerformanceMaxPlan?: unknown }).googlePerformanceMaxPlan;
  if (!item || typeof item !== "object") return undefined;
  const missing = (item as { missing?: unknown }).missing;
  return Array.isArray(missing) ? missing.map(String) : undefined;
}

function sharedReview(value: Project | null) {
  if (!value?.readiness || typeof value.readiness !== "object") return null;
  const review = (value.readiness as { sharedReview?: unknown }).sharedReview;
  return review && typeof review === "object" ? review as { status?: string; blockers?: string[]; warnings?: string[]; platforms?: Record<string, { status?: string; blockers?: string[]; warnings?: string[]; draftStatus?: string }> } : null;
}

function storedPmaxAssetRoles(value: Project | null) {
  const generated = storedPerformanceMaxPlan(value)?.assets || [];
  const roles = Object.fromEntries(generated.flatMap((asset) => asset.id && asset.role ? [[asset.id, asset.role] as const] : []));
  if (Object.keys(roles).length) return roles;
  const readiness = value?.readiness && typeof value.readiness === "object" ? value.readiness as { performanceMaxAssetRoles?: unknown } : {};
  const saved = readiness.performanceMaxAssetRoles;
  return saved && typeof saved === "object" ? Object.fromEntries(Object.entries(saved).filter(([, role]) => typeof role === "string")) as Record<string, PmaxAssetRole> : {};
}

function GoogleSearchPlanCard({ plan, onGenerate, disabled }: { plan: GoogleSearchPlan | null; onGenerate: () => void; disabled: boolean }) {
  if (!plan) {
    return <div className="mt-3 rounded-xl border border-dashed border-primary/30 bg-primary/[0.02] p-4">
      <p className="text-xs text-muted-foreground">Maak eerst het Google Search-plan. AI-suggesties krijgen geen verzonnen zoekvolume of CPC.</p>
      <Button type="button" size="sm" variant="outline" className="mt-2" onClick={onGenerate} disabled={disabled}>
        <Sparkles className="mr-2 h-4 w-4" />Google Search-plan maken
      </Button>
    </div>;
  }
  const groups = plan.adGroups || [];
  const keywordCount = groups.reduce((total, group) => total + (group.keywords || []).length, 0);
  const measuredCount = groups.reduce((total, group) => total + (group.keywords || []).filter((keyword) => (keyword.source === "SEO" || keyword.source === "SEARCH_CONSOLE") && Boolean(keyword.metrics && Object.keys(keyword.metrics).length)).length, 0);
  return <div className="mt-3 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.05] to-card p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">Google Search-plan</p><Badge variant="secondary">{plan.sourceStatus === "AI_SUGGESTIONS" ? "AI-suggesties" : plan.sourceStatus === "MIXED" ? "Gemengd" : "Gemeten"}</Badge></div>
    <p className="mt-1 text-xs text-muted-foreground">{groups.length} advertentiegroep{groups.length === 1 ? "" : "en"} · {keywordCount} keywords · {measuredCount} met bronmetrics · confidence {plan.confidence ?? 0}/100</p>
    <div className="mt-2 space-y-1">{groups.slice(0, 3).map((group) => <p key={group.id || group.name} className="text-xs"><span className="font-medium">{group.name}</span> · {(group.keywords || []).length} keywords · {(group.headlines || []).length} headlines · {(group.descriptions || []).length} descriptions</p>)}</div>
    {plan.unknowns?.length ? <p className="mt-2 text-xs text-amber-700">! {plan.unknowns.slice(0, 2).join(" · ")}</p> : null}
    <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={onGenerate} disabled={disabled}><RefreshCw className="mr-2 h-4 w-4" />Opnieuw genereren</Button>
  </div>;
}

function MediaAssetsCard({ assets, selectedIds, assetRoles, onToggle, onRoleChange, showPmaxRoles, disabled, isLoading, isError }: { assets: MediaAsset[]; selectedIds: string[]; assetRoles: Record<string, PmaxAssetRole>; onToggle: (id: string) => void; onRoleChange: (id: string, role: PmaxAssetRole) => void; showPmaxRoles: boolean; disabled: boolean; isLoading: boolean; isError: boolean }) {
  return <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">Media voor je advertentie</p><p className="text-xs text-muted-foreground">Kies alleen media die al duurzaam in de bibliotheek staat. Nieuwe betaalde generatie start je bewust in Creative Studio.</p></div><Badge variant={selectedIds.length ? "secondary" : "outline"}>{selectedIds.length} geselecteerd</Badge></div>
    {isLoading ? <p className="text-sm text-muted-foreground">Beschikbare media laden…</p> : null}
    {isError ? <p role="alert" className="text-sm text-destructive">Media konden niet worden geladen. Probeer opnieuw.</p> : null}
    {!isLoading && !isError && !assets.length ? <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Nog geen duurzaam opgeslagen media. Open Creative Studio om eerst een afbeelding of video te maken.</p> : null}
    <div className="grid gap-2 sm:grid-cols-2">{assets.slice(0, 12).map((asset) => {
      const selected = selectedIds.includes(asset.id);
      return <div key={asset.id} className="space-y-1">
        <button type="button" onClick={() => onToggle(asset.id)} disabled={disabled} aria-pressed={selected} className={`w-full rounded-xl border p-3 text-left transition ${selected ? "border-primary bg-primary/10 shadow-sm" : "border-border/70 hover:-translate-y-0.5 hover:bg-muted/50"}`}>
          <div className="flex items-center justify-between gap-2"><span className="font-medium text-sm">{asset.type} · {asset.model}</span>{selected ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : null}</div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{asset.prompt || "Opgeslagen media"}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">{new Date(asset.createdAt).toLocaleDateString("nl-BE")}</p>
        </button>
        {showPmaxRoles && selected ? <label className="block text-xs text-muted-foreground"><span className="sr-only">PMax-rol voor asset</span><select className="w-full rounded-md border bg-background px-2 py-1.5" value={assetRoles[asset.id] || "SQUARE"} onChange={(event) => onRoleChange(asset.id, event.target.value as PmaxAssetRole)} disabled={disabled}><option value="LANDSCAPE">Liggend beeld</option><option value="SQUARE">Vierkant beeld</option><option value="PORTRAIT">Portretbeeld</option><option value="LOGO">Logo</option><option value="LANDSCAPE_LOGO">Liggend logo</option><option value="VIDEO">Video (later)</option></select></label> : null}
      </div>;
    })}</div>
    <a className="text-xs font-medium text-primary underline-offset-4 hover:underline" href="/creative-studio?tab=history">Open Creative Studio →</a>
  </div>;
}

function PerformanceMaxPlanCard({ plan, onGenerate, disabled, selectedAssetCount, missing }: { plan: PerformanceMaxPlan | null; onGenerate: () => void; disabled: boolean; selectedAssetCount: number; missing?: string[] }) {
  if (!plan) return <div className="mt-3 rounded-xl border border-dashed border-amber-300/70 bg-amber-50/30 p-4 dark:border-amber-900/50 dark:bg-amber-950/20"><p className="text-xs text-muted-foreground">Maak een PMax-plan met copy en expliciete assetrollen. Er wordt niets naar Google gestuurd.</p><Button type="button" size="sm" variant="outline" className="mt-3 rounded-lg" onClick={onGenerate} disabled={disabled}><Sparkles className="mr-2 h-4 w-4" />Performance Max-plan maken</Button></div>;
  const assets = plan.assets || [];
  const roleCount = new Set(assets.map((asset) => asset.role).filter(Boolean)).size;
  return <div className="mt-3 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.06] to-card p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">Performance Max-plan</p><Badge variant="secondary">{plan.sourceStatus === "AI_SUGGESTIONS" ? "AI-suggesties" : "Gemengd"}</Badge></div>
    <p className="mt-1 text-xs text-muted-foreground">{assets.length} assets · {roleCount} rollen · confidence {plan.confidence ?? 0}/100 · lokale draft</p>
    <div className="mt-2 grid gap-1 text-xs"><p>Copy: {(plan.headlines || []).length} headlines · {(plan.longHeadlines || []).length} long headlines · {(plan.descriptions || []).length} descriptions</p><p>Assetgroep: {plan.assetGroupName || "nog te benoemen"} · bedrijfsnaam: {plan.businessName || "ontbreekt"}</p></div>
    {missing?.length || plan.unknowns?.length ? <p className="mt-2 text-xs text-amber-700">! {(missing || plan.unknowns || []).slice(0, 4).join(" · ")}</p> : null}
    {selectedAssetCount === 0 ? <p className="mt-2 text-xs text-muted-foreground">Selecteer eerst bestaande media en kies per asset een PMax-rol.</p> : null}
    <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={onGenerate} disabled={disabled}><RefreshCw className="mr-2 h-4 w-4" />Opnieuw genereren</Button>
  </div>;
}

function campaignLabel(value: CampaignVersion) {
  const snapshot = value.snapshot as { name?: unknown; campaign?: { name?: unknown } } | null;
  return String(snapshot?.name || snapshot?.campaign?.name || value.campaignId);
}

const EMPTY_META_PLAN = { angles: [], audiences: [], creativeDirections: [], callsToAction: [] };
const EMPTY_GOOGLE_PLAN = { keywordThemes: [], adGroups: [], headlineDirections: [], negativeKeywordThemes: [] };

function lines(value: string[]) {
  return value.join("\n");
}

function parseLines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 20);
}

function planWithStrategy(existing: unknown, strategy: Strategy, platform: "META" | "GOOGLE") {
  const base = existing && typeof existing === "object" ? existing as Record<string, unknown> : {};
  return {
    ...base,
    source: base.source || "AI_STRATEGY",
    strategy,
    platformPlan: platform === "META" ? strategy.meta || null : strategy.google || null,
  };
}

export function AdsCampaignWizard({ provider }: { provider: Provider }) {
  const { showToast } = useToast();
  const projects = trpc.adsWizard.list.useQuery({ includeArchived: false }, { staleTime: 5_000, retry: false });
  const [project, setProject] = useState<Project | null>(null);
  const [step, setStep] = useState<Step>("briefing");
  const [selection, setSelection] = useState<ProviderSelection>(provider);
  const [name, setName] = useState("");
  const [brief, setBrief] = useState({ objective: "", product: "", audience: "", website: "", tone: "professioneel", notes: "" });
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [pmaxAssetRoles, setPmaxAssetRoles] = useState<Record<string, PmaxAssetRole>>({});
  const providerApi = provider === "GOOGLE" ? trpc.googleAds : trpc.metaAds;
  const campaigns = providerApi.workflowOverview.useQuery(undefined, { enabled: Boolean(project), staleTime: 15_000, retry: false });
  const assets = trpc.adsWizard.listAssets.useQuery(undefined, { enabled: Boolean(project), staleTime: 30_000, retry: false });

  const create = trpc.adsWizard.create.useMutation({
    onSuccess: async (value) => {
      const next = toProject(value);
      setProject(next);
      setStrategy(storedStrategy(next));
      setSelectedVersionId("");
      setSelectedAssetIds(storedAssetIds(next));
      setPmaxAssetRoles(storedPmaxAssetRoles(next));
      setStep("briefing");
      await projects.refetch();
      showToast({ title: "Campagneconcept gestart", description: "Je briefing wordt per stap bewaard." });
    },
    onError: (error) => showToast({ title: "Concept starten mislukt", description: error.message, variant: "error" }),
  });
  const save = trpc.adsWizard.save.useMutation({
    onSuccess: async (value) => {
      if (value) setProject(toProject(value));
      await projects.refetch();
    },
    onError: (error) => showToast({ title: "Concept opslaan mislukt", description: error.message, variant: "error" }),
  });
  const generateStrategy = trpc.adsWizard.generateStrategy.useMutation({
    onSuccess: async (value) => {
      if (value.project) setProject(toProject(value.project));
      setStrategy(value.strategy as Strategy);
      await projects.refetch();
      showToast({ title: "AI-strategie opgeslagen", description: `Profiel v${value.profileVersion} · confidence ${value.strategy.confidence}/100` });
    },
    onError: (error) => showToast({ title: "AI-strategie mislukt", description: error.message, variant: "error" }),
  });
  const generateCampaignProposal = trpc.adsWizard.generateCampaignProposal.useMutation({
    onSuccess: async (value) => {
      if (value.project) setProject(toProject(value.project));
      await projects.refetch();
      showToast({ title: "Wijzigingsvoorstel aangemaakt", description: "Bekijk de before/after-diff in Goedkeuring voordat je publiceert." });
    },
    onError: async (error) => {
      const refreshed = await projects.refetch();
      const latest = (refreshed.data || []).find((row) => row.id === project?.id) as unknown as Project | undefined;
      if (latest) setProject(toProject(latest));
      showToast({ title: "Voorstel maken mislukt", description: error.message, variant: "error" });
    },
  });
  const createNativeDraft = trpc.adsWizard.createNativeDraft.useMutation({
    onSuccess: async (value) => {
      if (value.project) setProject(toProject(value.project));
      await projects.refetch();
      const label = value.provider === "META" ? "Meta" : "Google";
      showToast({ title: `${label}-draft opgeslagen`, description: value.reused ? "De bestaande draft is hergebruikt." : "Open de advertentiemodule om budget, account en creatives verder in te vullen." });
    },
    onError: (error) => showToast({ title: "Advertentiedraft maken mislukt", description: error.message, variant: "error" }),
  });
  const generateDraftContent = trpc.adsWizard.generateDraftContent.useMutation({
    onSuccess: async (value) => {
      if (value.project) setProject(toProject(value.project));
      await projects.refetch();
      const label = "campaignType" in value.draft ? "Google" : "Meta";
      showToast({ title: label === "Meta" ? "Meta-campagneplan ingevuld" : `${label}-inhoud ingevuld`, description: label === "Meta" ? "Adsets, varianten en copy staan klaar. Controleer targeting, tracking en assets." : "Controleer de tekst, doel-URL en ontbrekende assets in de advertentiemodule." });
    },
    onError: (error) => showToast({ title: "AI-inhoud maken mislukt", description: error.message, variant: "error" }),
  });
  const generateGoogleSearchPlan = trpc.adsWizard.generateGoogleSearchPlan.useMutation({
    onSuccess: async (value) => {
      if (value.project) setProject(toProject(value.project));
      await projects.refetch();
      showToast({ title: "Google Search-plan opgeslagen", description: value.measuredCount ? `${value.measuredCount} bronresultaten verwerkt. AI-suggesties blijven zonder metrics.` : "AI-suggesties staan klaar. Koppel een keywordbron voor echte metrics." });
    },
    onError: (error) => showToast({ title: "Google Search-plan mislukt", description: error.message, variant: "error" }),
  });
  const generatePerformanceMaxPlan = trpc.adsWizard.generatePerformanceMaxPlan.useMutation({
    onSuccess: async (value) => {
      if (value.project) setProject(toProject(value.project));
      await projects.refetch();
      showToast({ title: "Performance Max-plan opgeslagen", description: value.missing.length ? "Het plan staat klaar; vul de gemarkeerde assets en Google-instellingen nog aan." : "Copy en assets staan klaar voor controle in de Google Ads-editor." });
    },
    onError: (error) => showToast({ title: "Performance Max-plan mislukt", description: error.message, variant: "error" }),
  });
  const reviewNativeDraft = trpc.adsWizard.reviewNativeDraft.useMutation({
    onSuccess: async (value) => {
      if (value.project) setProject(toProject(value.project));
      await projects.refetch();
      showToast({ title: "Draft gecontroleerd", description: value.review.status === "BLOCKED" ? "Er zijn nog verplichte acties." : "De draft kan verder naar de bestaande provider-editor." });
    },
    onError: (error) => showToast({ title: "Draftcontrole mislukt", description: error.message, variant: "error" }),
  });
  const submitNativeDraftForApproval = trpc.adsWizard.submitNativeDraftForApproval.useMutation({
    onSuccess: async (value) => {
      if (value.project) setProject(toProject(value.project));
      await projects.refetch();
      showToast({ title: "Draft ingediend", description: "De bestaande approvalflow bepaalt nu wie kan goedkeuren. Publicatie blijft apart." });
    },
    onError: (error) => showToast({ title: "Indienen mislukt", description: error.message, variant: "error" }),
  });
  const syncNativeDraftStatus = trpc.adsWizard.syncNativeDraftStatus.useMutation({
    onSuccess: async (value) => {
      if (value.project) setProject(toProject(value.project));
      await projects.refetch();
      if (value.changed) showToast({ title: "Status bijgewerkt", description: "De wizard gebruikt nu de nieuwste status uit de provider-editor." });
    },
    onError: (error) => showToast({ title: "Status vernieuwen mislukt", description: error.message, variant: "error" }),
  });
  const reviewProject = trpc.adsWizard.reviewProject.useMutation({
    onSuccess: async (value) => {
      if (value.project) setProject(toProject(value.project));
      await projects.refetch();
      showToast({ title: "Gedeelde controle afgerond", description: value.review.status === "BLOCKED" ? "Er zijn nog acties per platform." : "Meta en Google zijn afzonderlijk gecontroleerd." });
    },
    onError: (error) => showToast({ title: "Gedeelde controle mislukt", description: error.message, variant: "error" }),
  });
  const archive = trpc.adsWizard.archive.useMutation({
    onSuccess: async () => {
      setProject(null);
      setStrategy(null);
      setSelectedVersionId("");
      setSelectedAssetIds([]);
      setPmaxAssetRoles({});
      await projects.refetch();
      showToast({ title: "Concept gearchiveerd" });
    },
    onError: (error) => showToast({ title: "Archiveren mislukt", description: error.message, variant: "error" }),
  });

  const rows = (projects.data || []) as unknown as Project[];
  const campaignRows = (campaigns.data?.versions || []) as unknown as CampaignVersion[];
  const ready = Boolean(brief.objective.trim() && brief.product.trim());
  const activeIndex = STEPS.findIndex((item) => item.id === step);
  const busy = create.isPending || save.isPending || archive.isPending || generateStrategy.isPending || generateCampaignProposal.isPending || createNativeDraft.isPending || generateDraftContent.isPending || generateGoogleSearchPlan.isPending || generatePerformanceMaxPlan.isPending || reviewNativeDraft.isPending || submitNativeDraftForApproval.isPending || syncNativeDraftStatus.isPending || reviewProject.isPending;
  const proposalState = readinessProposal(project);
  const sharedReviewState = sharedReview(project);

  function start() {
    create.mutate({
      providerSelection: selection,
      name: name.trim() || undefined,
      brief,
      idempotencyKey: makeIdempotencyKey(),
    });
  }

  function open(value: Project) {
    setProject(value);
    setStrategy(storedStrategy(value));
    setSelectedVersionId(readinessProposal(value)?.versionId || "");
    setSelectedAssetIds(storedAssetIds(value));
    setPmaxAssetRoles(storedPmaxAssetRoles(value));
    setSelection(value.providerSelection);
    setName(value.name || "");
    setBrief({
      objective: value.brief.objective || "",
      product: value.brief.product || "",
      audience: value.brief.audience || "",
      website: value.brief.website || "",
      tone: value.brief.tone || "professioneel",
      notes: value.brief.notes || "",
    });
    setStep(STEPS.some((item) => item.id === value.activeStep) ? value.activeStep as Step : "briefing");
  }

  async function saveAndMove(nextStep: Step) {
    if (!project) return;
    const planUpdates = strategy ? {
      ...(selection === "META" || selection === "BOTH" ? { metaPlan: planWithStrategy(project.metaPlan, strategy, "META") } : {}),
      ...(selection === "GOOGLE" || selection === "BOTH" ? { googlePlan: planWithStrategy(project.googlePlan, strategy, "GOOGLE") } : {}),
    } : {};
    await save.mutateAsync({
      id: project.id,
      expectedRevision: project.revision,
      providerSelection: selection,
      activeStep: nextStep,
      name: name.trim() || null,
      brief,
      status: nextStep === "review" && ready ? "READY" : "DRAFT",
      readiness: {
        ...(project.readiness && typeof project.readiness === "object" ? project.readiness as Record<string, unknown> : {}),
        checks: readiness,
        ready,
        performanceMaxAssetRoles: pmaxAssetRoles,
      },
      selectedAssetIds,
      ...planUpdates,
    });
    setStep(nextStep);
  }

  function makeCampaignProposal() {
    if (!project || !selectedVersionId) return;
    generateCampaignProposal.mutate({ projectId: project.id, versionId: selectedVersionId, expectedRevision: project.revision });
  }

  function toggleAsset(id: string) {
    const selected = selectedAssetIds.includes(id);
    setSelectedAssetIds((current) => selected ? current.filter((item) => item !== id) : [...current, id].slice(0, 12));
    setPmaxAssetRoles((roles) => {
      if (selected) {
        const next = { ...roles };
        delete next[id];
        return next;
      }
      return roles[id] ? roles : { ...roles, [id]: "SQUARE" };
    });
  }

  function changePmaxAssetRole(id: string, role: PmaxAssetRole) {
    setPmaxAssetRoles((current) => ({ ...current, [id]: role }));
  }

  function makeNativeDraft(target: Provider) {
    if (!project || !strategy) return;
    createNativeDraft.mutate({ projectId: project.id, provider: target, expectedRevision: project.revision });
  }

  function makeDraftContent(target: Provider) {
    if (!project || !strategy) return;
    generateDraftContent.mutate({ projectId: project.id, provider: target, expectedRevision: project.revision });
  }

  function makeGoogleSearchPlan() {
    if (!project || !(selection === "GOOGLE" || selection === "BOTH")) return;
    generateGoogleSearchPlan.mutate({ projectId: project.id, expectedRevision: project.revision, includeSeoData: true, replaceGenerated: false });
  }

  function makePerformanceMaxPlan() {
    if (!project || !(selection === "GOOGLE" || selection === "BOTH")) return;
    generatePerformanceMaxPlan.mutate({
      projectId: project.id,
      expectedRevision: project.revision,
      assetRoles: selectedAssetIds.flatMap((id) => pmaxAssetRoles[id] ? [{ id, role: pmaxAssetRoles[id]! }] : []),
      includeExistingSignals: true,
      replaceGenerated: false,
    });
  }

  function reviewDraft(target: Provider) {
    if (!project) return;
    reviewNativeDraft.mutate({ projectId: project.id, provider: target, expectedRevision: project.revision });
  }

  function submitDraft(target: Provider) {
    if (!project) return;
    const draft = readinessDraft(project, target);
    const hasWarnings = draft?.review?.status === "READY_WITH_WARNINGS";
    if (draft?.review?.status === "BLOCKED" || !draft?.review?.status) return;
    if (hasWarnings && typeof window !== "undefined" && !window.confirm("Er zijn nog waarschuwingen. Heb je deze gecontroleerd en wil je de draft indienen?")) return;
    submitNativeDraftForApproval.mutate({ projectId: project.id, provider: target, expectedRevision: project.revision, confirmWarnings: Boolean(hasWarnings) });
  }

  function refreshDraftStatus(target: Provider) {
    if (!project) return;
    syncNativeDraftStatus.mutate({ projectId: project.id, provider: target, expectedRevision: project.revision });
  }

  function runSharedReview() {
    if (!project) return;
    reviewProject.mutate({ projectId: project.id, expectedRevision: project.revision });
  }

  const readiness = useMemo(() => [
    { label: "Doel en aanbod", ok: Boolean(brief.objective.trim() && brief.product.trim()) },
    { label: "Website of landingspagina", ok: !brief.website.trim() || /^https?:\/\//i.test(brief.website.trim()) },
    { label: "Budget", ok: false },
    { label: "Advertentieaccount", ok: false },
  ], [brief.objective, brief.product, brief.website]);

  if (!project) {
    return (
      <Card className="overflow-hidden border-border/60 bg-card shadow-sm">
        <CardHeader className="border-b border-border/60 bg-gradient-to-br from-primary/[0.09] via-card to-card pb-5">
          <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></span><div><CardTitle className="tracking-tight">Nieuwe campagne maken met AI</CardTitle>
          <CardDescription className="mt-1">Start met een korte briefing. Je concept blijft lokaal bewaard en kan later worden aangevuld.</CardDescription></div></div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Waar wil je adverteren?</p><div className="mt-2 flex flex-wrap gap-2">
            {([provider, "BOTH"] as ProviderSelection[]).filter((item, index, all) => all.indexOf(item) === index).map((item) => (
              <Button key={item} type="button" size="sm" variant={selection === item ? "default" : "outline"} aria-pressed={selection === item} className="rounded-lg" onClick={() => setSelection(item)}>{providerLabel(item)}</Button>
            ))}
          </div></div>
          {projects.isError ? <p role="alert" className="text-sm text-destructive">Campagneconcepten laden mislukt. Probeer opnieuw.</p> : null}
          {rows.length ? (
            <div className="grid gap-2">
              <p className="text-sm font-medium">Verder werken</p>
              {rows.slice(0, 5).map((row) => <button key={row.id} type="button" onClick={() => open(row)} className="group flex items-center justify-between rounded-xl border border-border/70 bg-card p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/[0.03]">
                <span><span className="block font-medium">{row.name || row.brief.product || "Naamloos concept"}</span><span className="text-xs text-muted-foreground">{providerLabel(row.providerSelection)} · stap {STEPS.find((item) => item.id === row.activeStep)?.label || "Briefing"}</span></span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>)}
            </div>
          ) : null}
          <div className="grid gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:grid-cols-2">
            <div><Label htmlFor={`ads-wizard-name-${provider}`}>Naam van concept</Label><Input id={`ads-wizard-name-${provider}`} value={name} onChange={(event) => setName(event.target.value)} placeholder="Bijv. Zomeractie" /></div>
            <div className="flex items-end"><Button type="button" className="w-full sm:w-auto" onClick={start} disabled={busy}><Plus className="mr-2 h-4 w-4" />Nieuwe briefing starten</Button></div>
          </div>
          <p className="text-xs text-muted-foreground">De AI-strategie maakt alleen een voorstel met jouw workspacecontext. Providerpublicatie blijft een aparte goedgekeurde actie.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-border/60 bg-card shadow-sm">
      <CardHeader className="space-y-4 border-b border-border/60 bg-gradient-to-br from-primary/[0.06] via-card to-card pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary"><FileText className="h-3.5 w-3.5" />Campagneconcept</div><CardTitle className="tracking-tight">{name || brief.product || "Nieuw campagneconcept"}</CardTitle><CardDescription className="mt-1">{providerLabel(selection)} · revision {project.revision}</CardDescription></div><Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={() => { setProject(null); setStrategy(null); setSelectedVersionId(""); setSelectedAssetIds([]); setPmaxAssetRoles({}); }}><X className="mr-1 h-4 w-4" />Sluiten</Button></div>
        <div className="grid gap-2 sm:grid-cols-4" aria-label="Voortgang campagnewizard">{STEPS.map((item, index) => {
          const unavailable = !(index <= activeIndex || ready);
          return <button key={item.id} type="button" onClick={() => void saveAndMove(item.id)} disabled={busy || unavailable} aria-current={item.id === step ? "step" : undefined} className={`rounded-xl border px-3 py-2.5 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${item.id === step ? "border-primary bg-primary/10 font-semibold text-primary shadow-sm" : index < activeIndex ? "border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20" : "bg-muted/20 hover:bg-muted/40"}`}><span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Stap {index + 1}</span>{item.label}</button>;
        })}</div>
      </CardHeader>
      <CardContent className="space-y-5">
        {step === "briefing" ? <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ads-wizard-objective">Wat wil je promoten?</Label><Textarea id="ads-wizard-objective" value={brief.objective} onChange={(event) => setBrief((value) => ({ ...value, objective: event.target.value }))} placeholder="Bijv. meer offerteaanvragen voor dakrenovaties" rows={3} /></div>
          <div className="space-y-1.5"><Label htmlFor="ads-wizard-product">Product of dienst</Label><Input id="ads-wizard-product" value={brief.product} onChange={(event) => setBrief((value) => ({ ...value, product: event.target.value }))} /></div>
          <div className="space-y-1.5"><Label htmlFor="ads-wizard-audience">Doelgroep</Label><Input id="ads-wizard-audience" value={brief.audience} onChange={(event) => setBrief((value) => ({ ...value, audience: event.target.value }))} placeholder="Optioneel" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ads-wizard-website">Website of landingspagina</Label><Input id="ads-wizard-website" type="url" value={brief.website} onChange={(event) => setBrief((value) => ({ ...value, website: event.target.value }))} placeholder="https://voorbeeld.be" /></div>
        </div> : null}
        {step === "context" ? <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="ads-wizard-tone">Tone of voice</Label><Input id="ads-wizard-tone" value={brief.tone} onChange={(event) => setBrief((value) => ({ ...value, tone: event.target.value }))} /></div><div><Label htmlFor="ads-wizard-notes">Aanvullende context</Label><Textarea id="ads-wizard-notes" value={brief.notes} onChange={(event) => setBrief((value) => ({ ...value, notes: event.target.value }))} rows={4} placeholder="Claims, aanbod of beperkingen die de AI moet kennen" /></div><p className="text-sm text-muted-foreground sm:col-span-2">Bestaande merkinformatie wordt server-side uit je actieve workspace geladen. Voeg hier alleen bevestigde informatie toe.</p></div><MediaAssetsCard assets={(assets.data || []) as unknown as MediaAsset[]} selectedIds={selectedAssetIds} assetRoles={pmaxAssetRoles} onToggle={toggleAsset} onRoleChange={changePmaxAssetRole} showPmaxRoles={selection === "GOOGLE" || selection === "BOTH"} disabled={busy} isLoading={assets.isLoading} isError={assets.isError} /></div> : null}
        {step === "platform" ? <div className="space-y-4">
          <div><Label>Platformen</Label><div className="mt-2 flex flex-wrap gap-2">{(["META", "GOOGLE", "BOTH"] as ProviderSelection[]).map((item) => <Button key={item} type="button" size="sm" variant={selection === item ? "default" : "outline"} onClick={() => setSelection(item)}>{providerLabel(item)}</Button>)}</div></div>
          {strategy ? <div className="grid gap-4 lg:grid-cols-2">
            {(selection === "META" || selection === "BOTH") ? <div className="space-y-3 rounded-lg border p-4"><div><Badge variant="secondary">Meta</Badge><p className="mt-1 text-xs text-muted-foreground">Pas de AI-richtingen aan. Elke regel wordt één voorstel.</p></div><label className="block text-sm"><span className="mb-1 block text-xs font-medium">Invalshoeken</span><Textarea value={lines(strategy.meta?.angles || EMPTY_META_PLAN.angles)} onChange={(event) => setStrategy((current) => current ? { ...current, meta: { ...(current.meta || EMPTY_META_PLAN), angles: parseLines(event.target.value) } } : current)} rows={3} /></label><label className="block text-sm"><span className="mb-1 block text-xs font-medium">Doelgroepen</span><Textarea value={lines(strategy.meta?.audiences || EMPTY_META_PLAN.audiences)} onChange={(event) => setStrategy((current) => current ? { ...current, meta: { ...(current.meta || EMPTY_META_PLAN), audiences: parseLines(event.target.value) } } : current)} rows={3} /></label><label className="block text-sm"><span className="mb-1 block text-xs font-medium">Calls-to-action</span><Textarea value={lines(strategy.meta?.callsToAction || EMPTY_META_PLAN.callsToAction)} onChange={(event) => setStrategy((current) => current ? { ...current, meta: { ...(current.meta || EMPTY_META_PLAN), callsToAction: parseLines(event.target.value) } } : current)} rows={3} /></label></div> : null}
            {(selection === "GOOGLE" || selection === "BOTH") ? <div className="space-y-3 rounded-lg border p-4"><div><Badge variant="secondary">Google</Badge><p className="mt-1 text-xs text-muted-foreground">Pas Search-richtingen aan. Zoekvolume en CPC worden nooit verzonnen.</p></div><label className="block text-sm"><span className="mb-1 block text-xs font-medium">Keywordthema’s</span><Textarea value={lines(strategy.google?.keywordThemes || EMPTY_GOOGLE_PLAN.keywordThemes)} onChange={(event) => setStrategy((current) => current ? { ...current, google: { ...(current.google || EMPTY_GOOGLE_PLAN), keywordThemes: parseLines(event.target.value) } } : current)} rows={3} /></label><label className="block text-sm"><span className="mb-1 block text-xs font-medium">Advertentiegroepen</span><Textarea value={lines(strategy.google?.adGroups || EMPTY_GOOGLE_PLAN.adGroups)} onChange={(event) => setStrategy((current) => current ? { ...current, google: { ...(current.google || EMPTY_GOOGLE_PLAN), adGroups: parseLines(event.target.value) } } : current)} rows={3} /></label><label className="block text-sm"><span className="mb-1 block text-xs font-medium">Uitsluitingsthema’s</span><Textarea value={lines(strategy.google?.negativeKeywordThemes || EMPTY_GOOGLE_PLAN.negativeKeywordThemes)} onChange={(event) => setStrategy((current) => current ? { ...current, google: { ...(current.google || EMPTY_GOOGLE_PLAN), negativeKeywordThemes: parseLines(event.target.value) } } : current)} rows={3} /></label></div> : null}
          </div> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Maak eerst de AI-strategie in de controlestap om platformspecifieke richtingen te bewerken.</p>}
        </div> : null}
        {step === "review" ? <div className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="font-medium">{brief.product || "Nog geen aanbod ingevuld"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{brief.objective || "Nog geen doel ingevuld"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{providerLabel(selection)}{brief.website ? ` · ${brief.website}` : ""}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {readiness.map((item) => <div key={item.label} className="flex items-center gap-2 text-sm">{item.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="h-4 w-4 rounded-full border border-amber-500" />}{item.label}{!item.ok ? <span className="text-xs text-muted-foreground">actie vereist</span> : null}</div>)}
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">Gedeelde controle</p><p className="text-xs text-muted-foreground">Meta en Google houden hun eigen budget, account en publicatiestatus. Deze controle doet geen externe write.</p></div><Button type="button" variant="outline" onClick={runSharedReview} disabled={busy}>{reviewProject.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Controleren</Button></div>
            {sharedReviewState ? <div className="mt-3 space-y-2"><p className={`text-sm font-medium ${sharedReviewState.status === "BLOCKED" ? "text-destructive" : sharedReviewState.status === "READY_WITH_WARNINGS" ? "text-amber-700" : "text-emerald-700"}`}>{sharedReviewState.status === "BLOCKED" ? "Actie vereist" : sharedReviewState.status === "READY_WITH_WARNINGS" ? "Klaar met waarschuwingen" : "Klaar"}</p><div className="grid gap-2 sm:grid-cols-2">{Object.entries(sharedReviewState.platforms || {}).map(([platform, item]) => <div key={platform} className="rounded-md border bg-background p-2 text-xs"><p className="font-medium">{platform === "META" ? "Meta" : "Google"}: {item.status || "onbekend"}</p><p className="text-muted-foreground">Draft: {item.draftStatus || "nog niet gemaakt"}</p>{item.blockers?.slice(0, 2).map((message) => <p key={message} className="text-destructive">• {message}</p>)}{item.warnings?.slice(0, 1).map((message) => <p key={message} className="text-amber-700">! {message}</p>)}</div>)}</div></div> : <p className="mt-2 text-xs text-muted-foreground">Voer de controle uit nadat je de platformdrafts hebt voorbereid.</p>}
          </div>
          {strategy ? <div className="rounded-lg border border-primary/30 bg-primary/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">AI-strategie · confidence {strategy.confidence}/100</p><Badge variant="secondary">bewijs: {strategy.evidenceRefs.length}</Badge></div>
            <p className="mt-2 text-sm">{strategy.summary}</p>
            {strategy.unknowns.length ? <p className="mt-2 text-xs text-amber-700">Nog te controleren: {strategy.unknowns.slice(0, 3).join(" · ")}</p> : null}
          </div> : null}
          {strategy ? <div className="grid gap-3 sm:grid-cols-2">
            {(["META", "GOOGLE"] as Provider[]).filter((item) => selection === "BOTH" || selection === item).map((item) => {
              const draft = readinessDraft(project, item);
              const label = item === "META" ? "Meta" : "Google";
              return <div key={item} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2"><p className="font-medium">{label}-draft</p>{draft?.status === "READY" ? <Badge variant="secondary">opgeslagen</Badge> : null}</div>
                <p className="mt-1 text-xs text-muted-foreground">Lokale draft, zonder publicatie. Budget en account blijven bewust leeg tot je ze controleert.</p>
                {item === "GOOGLE" ? <><GoogleSearchPlanCard plan={storedGoogleSearchPlan(project)} onGenerate={makeGoogleSearchPlan} disabled={busy} /><PerformanceMaxPlanCard plan={storedPerformanceMaxPlan(project)} onGenerate={makePerformanceMaxPlan} disabled={busy} selectedAssetCount={selectedAssetIds.length} missing={readinessPerformanceMaxMissing(project)} /></> : null}
                {draft?.missing?.length ? <p className="mt-2 text-xs text-amber-700">Nog nodig: {draft.missing.join(" · ")}</p> : null}
                <Button type="button" className="mt-3" variant="outline" onClick={() => makeNativeDraft(item)} disabled={busy || draft?.status === "READY"}>
                  {createNativeDraft.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {draft?.status === "READY" ? `${label}-draft staat klaar` : `${label}-draft maken`}
                </Button>
                {draft?.status === "READY" ? <Button type="button" className="mt-3 ml-2" variant="default" onClick={() => makeDraftContent(item)} disabled={busy || draft.content?.status === "READY" || draft.content?.status === "RUNNING"}>
                  {generateDraftContent.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {draft.content?.status === "READY" ? item === "META" ? "Meta-plan staat klaar" : "AI-inhoud staat klaar" : draft.content?.status === "RUNNING" ? "AI-inhoud wordt gemaakt…" : item === "META" ? "Meta-campagneplan maken" : "AI-inhoud invullen"}
                </Button> : null}
                {draft?.content?.status === "READY" && draft.content.confidence != null ? <p className="mt-2 text-xs text-emerald-700">AI-inhoud gecontroleerd · confidence {draft.content.confidence}/100</p> : null}
                {draft?.content?.status === "FAILED" ? <p role="alert" className="mt-2 text-xs text-destructive">{draft.content.message || "AI-inhoud mislukt. Probeer opnieuw."}</p> : null}
                {draft?.status === "READY" ? <Button type="button" className="mt-3 ml-2" variant="outline" onClick={() => reviewDraft(item)} disabled={busy}>
                  {reviewNativeDraft.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Draft controleren
                </Button> : null}
                {draft?.review?.status ? <div className={`mt-2 rounded-md p-2 text-xs ${draft.review.status === "BLOCKED" ? "bg-destructive/10 text-destructive" : "bg-emerald-50 text-emerald-700"}`}>
                  <p className="font-medium">Controle: {draft.review.score ?? 0}/100 · {draft.review.status === "BLOCKED" ? "actie vereist" : draft.review.status === "READY_WITH_WARNINGS" ? "waarschuwingen" : "klaar"}</p>
                  {draft.review.blockingIssues?.slice(0, 2).map((issue) => <p key={issue}>• {issue}</p>)}
                  {draft.review.warnings?.slice(0, 1).map((warning) => <p key={warning}>! {warning}</p>)}
                </div> : null}
                {draft?.approval?.status ? <p className="mt-2 text-xs text-muted-foreground">Approvalstatus: <span className="font-medium">{draft.approval.status === "PENDING" ? "wacht op goedkeuring" : draft.approval.status === "APPROVED" ? "goedgekeurd" : draft.approval.status === "PUBLISHED" ? "gepubliceerd/gepauzeerd" : draft.approval.status === "REJECTED" ? "afgekeurd — controleer opnieuw" : draft.approval.status.toLowerCase()}</span></p> : null}
                {draft?.status === "READY" && draft.review?.status && draft.review.status !== "BLOCKED" && !["PENDING", "APPROVED", "PUBLISHED"].includes(draft.approval?.status || "") ? <Button type="button" className="mt-3 ml-2" variant="default" onClick={() => submitDraft(item)} disabled={busy}>
                  {submitNativeDraftForApproval.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  {draft.approval?.status === "REJECTED" ? "Opnieuw indienen" : "Indienen ter goedkeuring"}
                </Button> : null}
                {draft?.approval?.status === "PENDING" ? <p className="mt-2 text-xs text-emerald-700">Ingediend. Goedkeuring en publicatie gebeuren in de bestaande providerflow.</p> : null}
                {draft?.status === "READY" ? <Button type="button" className="mt-3 ml-2" variant="ghost" onClick={() => refreshDraftStatus(item)} disabled={busy}>
                  {syncNativeDraftStatus.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Status vernieuwen
                </Button> : null}
                {draft?.status === "READY" && draft.draftId ? <a className="ml-3 text-xs font-medium text-primary underline-offset-4 hover:underline" href={`${item === "META" ? "/meta-ads" : "/google-ads"}?tab=builder&planId=${encodeURIComponent(draft.draftId)}`}>Open {label}-editor</a> : null}
              </div>;
            })}
          </div> : null}
          <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" onClick={() => generateStrategy.mutate({ id: project.id, expectedRevision: project.revision })} disabled={busy || !ready}>{generateStrategy.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}AI-strategie maken</Button><span className="text-xs text-muted-foreground">Gebruikt alleen je workspaceprofiel en bevestigde briefingdata.</span></div>
          {strategy ? <div className="space-y-3 rounded-lg border p-4">
            <div><p className="font-medium">Voorstel voor een bestaande campagne</p><p className="text-xs text-muted-foreground">De AI gebruikt de actuele geïmporteerde versie. Het resultaat komt als before/after-diff in Goedkeuring.</p></div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 text-sm"><span className="mb-1 block text-xs font-medium">Campagneversie</span><select className="w-full rounded-md border bg-background p-2.5" value={selectedVersionId} onChange={(event) => setSelectedVersionId(event.target.value)} disabled={busy || campaigns.isLoading}><option value="">Kies een geïmporteerde campagne</option>{campaignRows.map((version) => <option key={version.id} value={version.id}>{campaignLabel(version)} · {version.accountId}</option>)}</select></label>
              <Button type="button" variant="outline" onClick={makeCampaignProposal} disabled={busy || !selectedVersionId}>{generateCampaignProposal.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Voorstel maken</Button>
            </div>
            {campaigns.isError ? <p role="alert" className="text-xs text-destructive">Campagnes konden niet worden geladen. Synchroniseer of importeer eerst een actuele versie.</p> : null}
            {proposalState?.status === "RUNNING" ? <p role="status" className="text-xs text-muted-foreground">AI maakt een voorstel…</p> : null}
            {proposalState?.status === "READY" ? <p role="status" className="text-xs text-emerald-700">Voorstel aangemaakt. Open Goedkeuring om de before/after-diff te controleren.</p> : null}
            {proposalState?.status === "FAILED" || proposalState?.status === "BLOCKED" ? <p role="alert" className="text-xs text-destructive">{proposalState.message || "Voorstel kon niet worden gemaakt."}</p> : null}
          </div> : null}
          <p className="text-sm text-muted-foreground">Opslaan maakt nog geen externe campagne aan. AI maakt alleen een voorstel; publicatie blijft een aparte goedgekeurde actie.</p>
        </div> : null}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => activeIndex > 0 && setStep(STEPS[activeIndex - 1]!.id)} disabled={activeIndex === 0 || busy}><ChevronLeft className="mr-1 h-4 w-4" />Vorige</Button><div className="flex gap-2"><Button type="button" variant="ghost" onClick={() => archive.mutate({ id: project.id })} disabled={busy}>Archiveren</Button>{activeIndex < STEPS.length - 1 ? <Button type="button" onClick={() => void saveAndMove(STEPS[activeIndex + 1]!.id)} disabled={busy || (step === "briefing" && !ready)}>{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChevronRight className="mr-1 h-4 w-4" />}Opslaan en verder</Button> : <Button type="button" onClick={() => void saveAndMove("review")} disabled={busy}><Save className="mr-2 h-4 w-4" />Concept opslaan</Button>}</div></div>
      </CardContent>
    </Card>
  );
}
