"use client";
import { useSearchParams } from "next/navigation";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { useMutationGeneration } from "@/lib/use-mutation-generation";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Switch, Tabs, TabsContent, Textarea, TooltipProvider } from "@digitify/ui";
import { BarChart3, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Eye, Layers, Megaphone, Languages, Image as ImageIcon, Loader2, PauseCircle, PencilLine, Plus, RefreshCcw, Save, Search, Send, Settings2, ShieldCheck, Sparkles, Target, Play, Trash2 } from "lucide-react";
import { AdsStudioStatsStrip, adsStudioStatIcons } from "@/components/ads/ads-studio-stats-strip";
import { AdsCopilotPanel } from "@/components/ads/ads-copilot-panel";
import { AdsStudioTabsNav } from "@/components/ads/ads-studio-tabs-nav";
import { useToast } from "@/components/feedback/toast-provider";
import { AdsWorkflowPanel, PlanStatus, CampaignType, BuilderStep, MatchType, BiddingStrategy, GOOGLE_ADS_NAV_TABS, CURRENCY_OPTIONS, PmaxImageKind, BUILDER_STEP_ORDER, STEPS, BIDDING_OPTIONS, detectLocationPreset, eur, numberValue, budgetCentsOrNull, prettyDate, statusBadge, asRecord, linesToList, csvToList, listToLines, parseJson, explainGoogleError, ErrorHint, googleCampaignStatusLabel, googleCampaignIsEnabled, googleCampaignIsPaused, describeOperationalRequirement, HelpLabel, WizardSection, CopyAssetListEditor, AudienceSignalsEditor, SearchKeywordsEditor, GeoLocationEditor, LanguageTargetingEditor, ReviewRow, StepButton, CollapsibleCard, CheckRow, GoogleAiBriefingInput, GoogleAiBriefingAction, GoogleAiBriefingDialog, GoogleAdsSetupNotice, GoogleAdsPausedPublishNotice, GoogleAdsHeroStat, FieldCounter, PmaxVisualAssetsPanel, SearchPreview, PerformanceMaxPreview } from "./google-ads-studio-components";

export function GoogleAdsPageInner() {
  const creativeParams = useSearchParams();
  const creativeJobId = creativeParams.get("creativeJob");
  const leadId = creativeParams.get("leadId");
  const seoContext = creativeParams.get("seoContext");
  const seoTargetUrl = creativeParams.get("targetUrl");
  const seoKeywords = creativeParams.get("seoKeywords");
  const targetCreativePlanId = creativeParams.get("planId");
  const [appliedCreativeJob, setAppliedCreativeJob] = useState<string | null>(null);

  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const { beginGeneration, isCurrentGeneration } = useMutationGeneration();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [loadedPlanId, setLoadedPlanId] = useState<string | null>(null);
  const creativeJob = trpc.media.getJobStatus.useQuery({jobId:creativeJobId || ""}, {enabled:Boolean(creativeJobId) && (!targetCreativePlanId || loadedPlanId === targetCreativePlanId) && appliedCreativeJob !== creativeJobId});
  const [editingLiveCampaignId, setEditingLiveCampaignId] = useState<string | null>(null);
  const [editingLiveCampaignStatus, setEditingLiveCampaignStatus] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<BuilderStep>("setup");
  const [adsTab, setAdsTab] = useState("campaigns");
  const [approvalFilter, setApprovalFilter] = useState<"ALL" | PlanStatus>("ALL");
  const [name, setName] = useState("");
  const [campaignType, setCampaignType] = useState<CampaignType>("SEARCH");
  const [currency, setCurrency] = useState("EUR");
  const [dailyBudget, setDailyBudget] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [biddingStrategy, setBiddingStrategy] = useState<BiddingStrategy>("MAXIMIZE_CONVERSIONS");
  const [targetCpaCents, setTargetCpaCents] = useState("");
  const [targetRoas, setTargetRoas] = useState("");
  const [conversionAction, setConversionAction] = useState("");
  const [trackingTemplate, setTrackingTemplate] = useState("");
  const [finalUrlSuffix, setFinalUrlSuffix] = useState("utm_source=google&utm_medium=cpc&utm_campaign={campaignid}");
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("");
  const [aiTone, setAiTone] = useState("professioneel");
  const [aiBriefingDialogOpen, setAiBriefingDialogOpen] = useState(false);
  const [aiBriefingAction, setAiBriefingAction] = useState<GoogleAiBriefingAction>("suggestion");
  const [finalUrl, setFinalUrl] = useState("");
  const [headlinesText, setHeadlinesText] = useState("");
  const [longHeadlinesText, setLongHeadlinesText] = useState("");
  const [descriptionsText, setDescriptionsText] = useState("");
  const [headlinePin1, setHeadlinePin1] = useState("");
  const [descriptionPin1, setDescriptionPin1] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [path1, setPath1] = useState("");
  const [path2, setPath2] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [squareImageUrl, setSquareImageUrl] = useState("");
  const [portraitImageUrl, setPortraitImageUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [landscapeLogoUrl, setLandscapeLogoUrl] = useState("");
  const [callToAction, setCallToAction] = useState("Meer informatie");
  const [assetGroupName, setAssetGroupName] = useState("");
  const [brandGuidelinesEnabled, setBrandGuidelinesEnabled] = useState(false);
  const [finalUrlExpansion, setFinalUrlExpansion] = useState(false);
  const [keywordsText, setKeywordsText] = useState("");
  const [negativeKeywordsText, setNegativeKeywordsText] = useState("");
  const [matchType, setMatchType] = useState<MatchType>("PHRASE");
  const [adGroupName, setAdGroupName] = useState("");
  const [geoTargets, setGeoTargets] = useState("");
  const [languages, setLanguages] = useState("");
  const [locationPreset, setLocationPreset] = useState("CUSTOM");
  const [audienceSignalsText, setAudienceSignalsText] = useState("");
  const [searchPartners, setSearchPartners] = useState(true);
  const [displayExpansion, setDisplayExpansion] = useState(false);
  const [advancedCreativeJson, setAdvancedCreativeJson] = useState("{}");
  const [advancedTargetingJson, setAdvancedTargetingJson] = useState("{}");
  const [uploadingAsset, setUploadingAsset] = useState<PmaxImageKind | null>(null);
  const [loginCustomerIdInput, setLoginCustomerIdInput] = useState("");
  const leadContext = trpc.lead.getById.useQuery({ id: leadId || "" }, { enabled: Boolean(leadId), staleTime: 120_000 });
  const [appliedLeadContext, setAppliedLeadContext] = useState<string | null>(null);
  useEffect(() => {
    if (!leadId || appliedLeadContext === leadId || !leadContext.data) return;
    const lead = leadContext.data;
    setProduct(lead.companyName || lead.industry || "");
    setAudience([lead.industry, lead.city].filter(Boolean).join(" · "));
    if (!name) setName(`${lead.companyName} campagne`);
    if (!finalUrl && lead.website) setFinalUrl(lead.website);
    setAppliedLeadContext(leadId);
    showToast({ title: "Leadcontext geladen", description: "De advertentiedraft gebruikt deze lead als briefing." });
  }, [leadId, appliedLeadContext, leadContext.data, name, finalUrl, showToast]);
  useEffect(() => {
    if (!seoContext) return;
    setProduct((current) => current || seoContext);
    setName((current) => current || `${seoContext} Search campagne`);
    setFinalUrl((current) => current || seoTargetUrl || "");
    setKeywordsText((current) => current || seoKeywords || seoContext);
    setAdsTab("builder");
  }, [seoContext, seoTargetUrl, seoKeywords]);
  useEffect(() => {
    if (!creativeJobId || appliedCreativeJob === creativeJobId || creativeJob.data?.type !== "IMAGE" || !creativeJob.data.blobUrl) return;
    const assetUrl = creativeParams.get("creativeAssetUrl") || creativeJob.data.blobUrl;
    if (creativeParams.get("creativeSlot") === "square") setSquareImageUrl(assetUrl); else setImageUrl(assetUrl);
    setAppliedCreativeJob(creativeJobId); setCampaignType("PERFORMANCE_MAX"); setAdsTab("builder"); setActiveStep("creative");
    showToast({title:"Creative Studio-afbeelding toegevoegd"});
  }, [creativeJobId,appliedCreativeJob,creativeJob.data,creativeParams,showToast]);


  const connection = trpc.googleAds.connectionStatus.useQuery(undefined, { refetchInterval: 30_000 });
  const customers = trpc.googleAds.listCustomers.useQuery(undefined, { enabled: Boolean(connection.data?.connected) });
  const campaigns = trpc.googleAds.listCampaigns.useQuery(undefined, {
    enabled: Boolean(connection.data?.selectedCustomerId && connection.data?.connected),
    refetchInterval: 60_000,
  });
  const insights = trpc.googleAds.getInsights.useQuery(undefined, {
    enabled: Boolean(connection.data?.selectedCustomerId && connection.data?.connected),
    refetchInterval: 60_000,
  });
  const drafts = trpc.googleAds.listDrafts.useQuery(undefined, { refetchInterval: 20_000 });
  const liveCampaignDetails = trpc.googleAds.getCampaignDetails.useQuery(
    { campaignId: editingLiveCampaignId || "" },
    { enabled: Boolean(editingLiveCampaignId) },
  );

  const rows = useMemo(() => drafts.data ?? [], [drafts.data]);
  const heroStats = useMemo(
    () => ({
      pending: rows.filter((row: { status: string }) => row.status === "PENDING_APPROVAL").length,
      approved: rows.filter((row: { status: string }) => row.status === "APPROVED").length,
      failed: rows.filter((row: { status: string }) => row.status === "FAILED").length,
    }),
    [rows],
  );
  const filteredRows = approvalFilter === "ALL" ? rows : rows.filter((row: any) => row.status === approvalFilter);
  useEffect(()=>{if(targetCreativePlanId && rows.some((row:{id:string})=>row.id === targetCreativePlanId)) {setSelectedPlanId(targetCreativePlanId);setAdsTab("builder");}},[targetCreativePlanId,rows]);
  const selectedPlan = rows.find((row: any) => row.id === selectedPlanId) || null;
  const totalSpend = useMemo(() => (insights.data || []).reduce((sum: number, row: any) => sum + Number(row.spend || 0), 0), [insights.data]);
  const totalClicks = useMemo(() => (insights.data || []).reduce((sum: number, row: any) => sum + Number(row.clicks || 0), 0), [insights.data]);
  const totalConversions = useMemo(() => (insights.data || []).reduce((sum: number, row: any) => sum + Number(row.conversions || 0), 0), [insights.data]);
  const headlines = linesToList(headlinesText, 15);
  const longHeadlines = linesToList(longHeadlinesText, 5);
  const descriptions = linesToList(descriptionsText, 5);
  const keywords = linesToList(keywordsText, 80);
  const negativeKeywords = linesToList(negativeKeywordsText, 80);
  const audienceSignals = linesToList(audienceSignalsText, 25);

  const canSaveDraft = Boolean(name.trim().length >= 2);
  const setupComplete = Boolean(name.trim() && Number(dailyBudget) >= 100);
  const searchCreativeComplete = headlines.length >= 3 && descriptions.length >= 2 && finalUrl.trim().startsWith("https://");
  const pmaxCreativeComplete = headlines.length >= 3 && longHeadlines.length >= 1 && descriptions.length >= 2 && Boolean(imageUrl.trim()) && Boolean(squareImageUrl.trim()) && Boolean(logoUrl.trim()) && !brandGuidelinesEnabled && businessName.trim().length > 0 && businessName.trim().length <= 25;
  const creativeComplete = campaignType === "SEARCH" ? searchCreativeComplete : pmaxCreativeComplete;
  const targetingComplete = campaignType === "SEARCH" ? keywords.length > 0 : audienceSignals.length > 0;
  const readyToSave = setupComplete && creativeComplete && targetingComplete;
  const operationalRequirements = useMemo(
    () => ((connection.data?.missingOperationalRequirements || []) as string[]).map(describeOperationalRequirement),
    [connection.data?.missingOperationalRequirements],
  );
  const insightCoach = useMemo(() => {
    const ctr = totalClicks > 0 && (insights.data || []).reduce((sum: number, row: any) => sum + Number(row.impressions || 0), 0) > 0
      ? (totalClicks / (insights.data || []).reduce((sum: number, row: any) => sum + Number(row.impressions || 0), 0)) * 100
      : 0;
    const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const tips: string[] = [];
    if (!(insights.data || []).length) tips.push("Er zijn nog geen Google Ads inzichten om op te sturen.");
    if (campaignType === "SEARCH" && ctr > 0 && ctr < 3) tips.push("CTR lijkt laag voor Search. Test scherpere headlines en strakkere keywords.");
    if (campaignType === "PERFORMANCE_MAX" && totalSpend > 0 && totalConversions === 0) tips.push("Performance Max geeft nog geen conversies terug. Controleer conversion action, assets en landingspagina.");
    if (totalSpend > 0 && totalClicks === 0) tips.push("Er is spend zonder clicks. Controleer targeting, assets en accountstatus.");
    if (keywords.length < 5 && campaignType === "SEARCH") tips.push("Voeg meer koopintentie-keywords toe om Search beter te laten leren.");
    if (!tips.length) tips.push("De basis staat goed. Focus nu op sterkere varianten en betere landingspagina-alignment.");
    return { ctr, cpc, tips: tips.slice(0, 4) };
  }, [insights.data, totalClicks, totalSpend, totalConversions, campaignType, keywords.length]);

  function canOpenStep(step: BuilderStep) {
    if (step === "setup") return true;
    if (step === "creative") return setupComplete;
    if (step === "targeting") return setupComplete && creativeComplete;
    if (step === "review") return setupComplete && creativeComplete && targetingComplete;
    return false;
  }

  const activeStepMeta = STEPS.find((step) => step.id === activeStep) ?? STEPS[0];
  const activeStepIndex = BUILDER_STEP_ORDER.indexOf(activeStep);
  const pendingApprovalCount = useMemo(
    () => rows.filter((row: { status: string }) => row.status === "PENDING_APPROVAL").length,
    [rows],
  );
  const dailyBudgetEuros = dailyBudget.trim() ? numberValue(dailyBudget) / 100 : NaN;

  function goToBuilderStep(step: BuilderStep) {
    if (canOpenStep(step)) setActiveStep(step);
  }

  function goToAdjacentBuilderStep(direction: -1 | 1) {
    const next = BUILDER_STEP_ORDER[activeStepIndex + direction];
    if (next && canOpenStep(next)) setActiveStep(next);
  }

  function openDraftForEditing(planId: string, step: BuilderStep = "setup") {
    setSelectedPlanId(planId);
    setLoadedPlanId(null);
    setAdsTab("dashboard");
    setActiveStep(step);
    showToast({ title: "Google Ads draft geopend in Studio" });
  }

  function resetBuilderForNewCampaign() {
    setSelectedPlanId(null);
    setLoadedPlanId(null);
    setEditingLiveCampaignId(null);
    setEditingLiveCampaignStatus(null);
    setActiveStep("setup");
    setAdsTab("dashboard");
    setName("");
    setCampaignType("SEARCH");
    setCurrency(connection.data?.defaultCurrency || "EUR");
    setDailyBudget("");
    setStartTime("");
    setEndTime("");
    setBiddingStrategy("MAXIMIZE_CONVERSIONS");
    setTargetCpaCents("");
    setTargetRoas("");
    setConversionAction("");
    setTrackingTemplate("");
    setFinalUrlSuffix("utm_source=google&utm_medium=cpc&utm_campaign={campaignid}");
    setProduct("");
    setAudience("");
    setAiTone("professioneel");
    setFinalUrl("");
    setHeadlinesText("");
    setLongHeadlinesText("");
    setDescriptionsText("");
    setHeadlinePin1("");
    setDescriptionPin1("");
    setBusinessName("");
    setPath1("");
    setPath2("");
    setImageUrl("");
    setSquareImageUrl("");
    setPortraitImageUrl("");
    setLogoUrl("");
    setLandscapeLogoUrl("");
    setCallToAction("Meer informatie");
    setAssetGroupName("");
    setBrandGuidelinesEnabled(false);
    setFinalUrlExpansion(false);
    setKeywordsText("");
    setNegativeKeywordsText("");
    setMatchType("PHRASE");
    setAdGroupName("");
    setGeoTargets("");
    setLanguages("");
    setLocationPreset("CUSTOM");
    setAudienceSignalsText("");
    setSearchPartners(true);
    setDisplayExpansion(false);
    setAdvancedCreativeJson("{}");
    setAdvancedTargetingJson("{}");
  }

  function startNewCampaign() {
    resetBuilderForNewCampaign();
    showToast({ title: "Nieuwe campagne", description: "Vul een nieuwe campagnenaam en instellingen in." });
  }

  const applyPlanPayloadToForm = useCallback((payload: {
    name?: string;
    campaignType?: string;
    dailyBudgetCents?: number | null;
    currency?: string;
    targeting?: unknown;
    creatives?: unknown;
  }) => {
    const creative = asRecord(payload.creatives);
    const targeting = asRecord(payload.targeting);
    const campaignSettings = asRecord(targeting.campaignSettings);
    setName((previous) => payload.name || previous);
    setCampaignType((payload.campaignType || "SEARCH") as CampaignType);
    setCurrency(payload.currency || "EUR");
    setDailyBudget(payload.dailyBudgetCents ? String(payload.dailyBudgetCents) : "");
    setBiddingStrategy((campaignSettings.biddingStrategy || creative.biddingStrategy || "MAXIMIZE_CONVERSIONS") as BiddingStrategy);
    setTargetCpaCents(String(campaignSettings.targetCpaCents || ""));
    setTargetRoas(String(campaignSettings.targetRoas || ""));
    setConversionAction(String(campaignSettings.conversionAction || ""));
    setTrackingTemplate(String(campaignSettings.trackingTemplate || ""));
    setFinalUrlSuffix(String(campaignSettings.finalUrlSuffix || "utm_source=google&utm_medium=cpc&utm_campaign={campaignid}"));
    setFinalUrl(String(creative.finalUrl || creative.linkUrl || ""));
    setHeadlinesText(listToLines(creative.headlines || creative.headline, []));
    setLongHeadlinesText(listToLines(creative.longHeadlines || creative.longHeadline, []));
    setDescriptionsText(listToLines(creative.descriptions || creative.description, []));
    setHeadlinePin1(String(creative.headlinePin1 || ""));
    setDescriptionPin1(String(creative.descriptionPin1 || ""));
    setImageUrl(String(creative.imageUrl || creative.marketingImageUrl || ""));
    setSquareImageUrl(String(creative.squareImageUrl || creative.squareMarketingImageUrl || ""));
    setPortraitImageUrl(String(creative.portraitImageUrl || ""));
    setLogoUrl(String(creative.logoUrl || ""));
    setLandscapeLogoUrl(String(creative.landscapeLogoUrl || ""));
    setBusinessName(String(creative.businessName || ""));
    setCallToAction(String(creative.callToAction || "Meer informatie"));
    setAssetGroupName(String(creative.assetGroupName || ""));
    setBrandGuidelinesEnabled(Boolean(creative.brandGuidelinesEnabled));
    setFinalUrlExpansion(Boolean(creative.finalUrlExpansion));
    setPath1(String(creative.path1 || ""));
    setPath2(String(creative.path2 || ""));
    setKeywordsText(listToLines(targeting.keywords, []));
    setNegativeKeywordsText(listToLines(targeting.negativeKeywords, []));
    setMatchType((targeting.matchType || "PHRASE") as MatchType);
    setAdGroupName(String(targeting.adGroupName || ""));
    const geoText = listToLines(targeting.geoTargetConstants, []);
    const languageText = listToLines(targeting.languageConstants, []);
    setGeoTargets(geoText);
    setLanguages(languageText);
    setLocationPreset(detectLocationPreset(geoText, languageText));
    setAudienceSignalsText(listToLines(targeting.audienceSignals, []));
    setSearchPartners(targeting.searchPartners !== false);
    setDisplayExpansion(Boolean(targeting.displayExpansion));
    setAdvancedCreativeJson("{}");
    setAdvancedTargetingJson("{}");
  }, []);

  function openLiveCampaignEditor(campaign: Record<string, any>) {
    setSelectedPlanId(null);
    setLoadedPlanId(null);
    setEditingLiveCampaignId(String(campaign.id || ""));
    setEditingLiveCampaignStatus(String(campaign.status || ""));
    setAdsTab("dashboard");
    setActiveStep("setup");
    showToast({
      title: "Live campagne geladen",
      description: "Gegevens worden opgehaald uit Google Ads…",
    });
  }

  useEffect(() => {
    if (!liveCampaignDetails.data || !editingLiveCampaignId) return;
    const liveKey = `live_${editingLiveCampaignId}`;
    if (loadedPlanId === liveKey) return;
    const details = liveCampaignDetails.data;
    applyPlanPayloadToForm(details);
    setEditingLiveCampaignStatus(details.status || null);
    setLoadedPlanId(liveKey);
    showToast({
      title: "Campagne geladen uit Google Ads",
      description: `${details.name} · wijzigingen worden eerst ter goedkeuring opgeslagen.`,
    });
  }, [liveCampaignDetails.data, editingLiveCampaignId, loadedPlanId, showToast, applyPlanPayloadToForm]);

  useEffect(() => {
    if (!selectedPlan || selectedPlan.id === loadedPlanId || editingLiveCampaignId) return;
    applyPlanPayloadToForm(selectedPlan);
    setStartTime(selectedPlan.startTime ? new Date(selectedPlan.startTime).toISOString().slice(0, 16) : "");
    setEndTime(selectedPlan.endTime ? new Date(selectedPlan.endTime).toISOString().slice(0, 16) : "");
    setLoadedPlanId(selectedPlan.id);
  }, [selectedPlan, loadedPlanId, editingLiveCampaignId, applyPlanPayloadToForm]);

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
    onSuccess: async (row) => {
      await invalidate();
      setSelectedPlanId(row.id);
      setLoadedPlanId(row.id);
      showToast({
        title: "Google Ads draft aangemaakt",
        description: "Je campagne is opgeslagen — je kunt verder bouwen wanneer je wilt.",
      });
    },
    onError: (error) => showToast({ title: "Draft mislukt", description: explainGoogleError(error.message)?.message || error.message, variant: "error" }),
  });
  const updateDraft = trpc.googleAds.updateDraft.useMutation({
    onSuccess: async (row) => {
      await invalidate();
      setSelectedPlanId(row.id);
      setLoadedPlanId(row.id);
      showToast({
        title: "Draft opgeslagen",
        description: "Je wijzigingen zijn bewaard — je kunt verder bouwen wanneer je wilt.",
      });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: explainGoogleError(error.message)?.message || error.message, variant: "error" }),
  });
  const generateSearchKeywords = trpc.googleAds.generateSearchKeywords.useMutation({
    onError: (error) => showToast({ title: "AI-keywords mislukt", description: error.message, variant: "error" }),
  });

  const generateAudienceSignals = trpc.googleAds.generateAudienceSignals.useMutation({
    onError: (error) => showToast({ title: "AI-signalen mislukt", description: error.message, variant: "error" }),
  });

  const generateSuggestion = trpc.googleAds.generateSuggestion.useMutation({
    onError: (error) => showToast({ title: "AI-voorstel mislukt", description: error.message, variant: "error" }),
  });

  const submitForApproval = trpc.googleAds.submitForApproval.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Indienen mislukt", description: e.message, variant: "error" }) });
  const approveDraft = trpc.googleAds.approveDraft.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Goedkeuren mislukt", description: e.message, variant: "error" }) });
  const pushPaused = trpc.googleAds.pushPausedToGoogle.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Push mislukt", description: explainGoogleError(e.message)?.message || e.message, variant: "error" }) });
  const retryFailed = trpc.googleAds.retryFailed.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Retry mislukt", description: e.message, variant: "error" }) });
  const reconcilePush = trpc.googleAds.reconcilePush.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Controle mislukt", description: e.message, variant: "error" }) });
  const rejectDraft = trpc.googleAds.rejectDraft.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Afkeuren mislukt", description: e.message, variant: "error" }) });
  const cancelDraft = trpc.googleAds.cancelDraft.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Annuleren mislukt", description: e.message, variant: "error" }) });
  const selectCustomer = trpc.googleAds.selectCustomer.useMutation({
    onSuccess: async () => {
      await invalidate();
      showToast({ title: "Google Ads customer geselecteerd" });
    },
    onError: (error) => showToast({ title: "Selecteren mislukt", description: error.message, variant: "error" }),
  });
  const setLoginCustomerId = trpc.googleAds.setLoginCustomerId.useMutation({
    onSuccess: async () => {
      await invalidate();
      showToast({ title: "Manager customer ID opgeslagen" });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });
  const pauseCampaign = trpc.googleAds.pauseInGoogle.useMutation({
    onSuccess: async () => {
      await invalidate();
      showToast({ title: "Pauzevoorstel aangemaakt", description: "Open Goedkeuring om dit naar Google Ads door te zetten." });
    },
    onError: (error) => showToast({ title: "Pauzeren mislukt", description: explainGoogleError(error.message)?.message || error.message, variant: "error" }),
  });
  const resumeCampaign = trpc.googleAds.resumeInGoogle.useMutation({
    onSuccess: async () => {
      await invalidate();
      showToast({ title: "Voorstel om te hervatten aangemaakt", description: "Open Goedkeuring om dit naar Google Ads door te zetten." });
    },
    onError: (error) => showToast({ title: "Activeren mislukt", description: explainGoogleError(error.message)?.message || error.message, variant: "error" }),
  });
  const removeCampaign = trpc.googleAds.removeCampaign.useMutation({
    onSuccess: async () => {
      await invalidate();
      showToast({ title: "Verwijdervoorstel aangemaakt", description: "Open Goedkeuring om dit naar Google Ads door te zetten." });
    },
    onError: (error) => showToast({ title: "Verwijderen mislukt", description: explainGoogleError(error.message)?.message || error.message, variant: "error" }),
  });
  const updateCampaignName = trpc.googleAds.updateCampaignName.useMutation({
    onSuccess: async () => {
      await invalidate();
      showToast({ title: "Naamvoorstel aangemaakt", description: "Open Goedkeuring om dit naar Google Ads door te zetten." });
    },
    onError: (error) => showToast({ title: "Naam wijzigen mislukt", description: explainGoogleError(error.message)?.message || error.message, variant: "error" }),
  });
  const saveCampaignToGoogle = trpc.googleAds.saveCampaignToGoogle.useMutation({
    onSuccess: async (_result) => {
      await invalidate();
      showToast({
        title: "Wijzigingsvoorstel opgeslagen",
        description: "Open Editor & AI → Goedkeuring om deze versie te controleren en te publiceren.",
      });
    },
    onError: (error) =>
      showToast({
        title: "Opslaan naar Google mislukt",
        description: explainGoogleError(error.message)?.message || error.message,
        variant: "error",
      }),
  });
  const setAutoadsEnabled = trpc.googleAds.setAutoadsEnabled.useMutation({
    onSuccess: async () => {
      await invalidate();
      showToast({ title: "Google Ads module bijgewerkt" });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  useEffect(() => {
    setLoginCustomerIdInput(connection.data?.loginCustomerId || "");
  }, [connection.data?.loginCustomerId]);

  const campaignActionPending =
    pauseCampaign.isPending ||
    resumeCampaign.isPending ||
    removeCampaign.isPending ||
    updateCampaignName.isPending ||
    saveCampaignToGoogle.isPending;

  function handleRenameCampaign(campaign: { id: string; name: string }) {
    const nextName = window.prompt("Nieuwe campagnenaam", campaign.name)?.trim();
    if (!nextName || nextName === campaign.name) return;
    updateCampaignName.mutate({ campaignId: campaign.id, name: nextName });
  }

  function handleRemoveCampaign(campaign: { id: string; name: string }) {
    if (!window.confirm(`Campagne "${campaign.name}" verwijderen in Google Ads? Dit kan niet ongedaan worden gemaakt.`)) return;
    removeCampaign.mutate({ campaignId: campaign.id });
  }

  const aiBriefingPending =
    generateSuggestion.isPending || generateSearchKeywords.isPending || generateAudienceSignals.isPending;
  const approvalActionPending = submitForApproval.isPending || approveDraft.isPending;

  function applySearchKeywordsSuccess(payload: {
    keywords: string[];
    negativeKeywords: string[];
    adGroupName?: string;
    aiUsed: boolean;
  }) {
    setAiBriefingDialogOpen(false);
    if (payload.keywords?.length) setKeywordsText(payload.keywords.join("\n"));
    if (payload.negativeKeywords?.length) setNegativeKeywordsText(payload.negativeKeywords.join("\n"));
    if (payload.adGroupName) setAdGroupName(payload.adGroupName);
    showToast({
      title: payload.aiUsed ? "AI-keywords toegevoegd" : "Geen nieuwe keywords",
      description: payload.aiUsed
        ? `${payload.keywords.length} zoekwoord${payload.keywords.length === 1 ? "" : "en"} · ${payload.negativeKeywords.length} uitsluiting${payload.negativeKeywords.length === 1 ? "" : "en"}`
        : "AI gaf geen bruikbare keywords terug.",
      variant: payload.aiUsed ? "success" : "error",
    });
  }

  function applyAudienceSignalsSuccess(payload: { audienceSignals?: string[]; aiUsed: boolean }) {
    setAiBriefingDialogOpen(false);
    const nextSignals = payload.audienceSignals?.length ? payload.audienceSignals : linesToList(audienceSignalsText, 25);
    setAudienceSignalsText(nextSignals.join("\n"));
    showToast({
      title: payload.aiUsed ? "AI-signalen toegevoegd" : "Geen nieuwe signalen",
      description: payload.aiUsed
        ? `${nextSignals.length} signaal${nextSignals.length === 1 ? "" : "en"} in je lijst.`
        : "AI gaf geen bruikbare signalen terug — vul handmatig aan of probeer opnieuw.",
      variant: payload.aiUsed ? "success" : "error",
    });
  }

  function applySuggestionSuccess(payload: any) {
    setAiBriefingDialogOpen(false);
    const creative = asRecord(payload.creatives);
    const targeting = asRecord(payload.targeting);
    const geoText = listToLines(targeting.geoTargetConstants, []);
    const languageText = listToLines(targeting.languageConstants, []);

    setName(payload.name || name);
    if (payload.campaignType) setCampaignType(payload.campaignType);
    if (creative.finalUrl) setFinalUrl(String(creative.finalUrl));
    if (creative.headlines) setHeadlinesText(listToLines(creative.headlines, headlines));
    if (creative.longHeadlines) setLongHeadlinesText(listToLines(creative.longHeadlines, longHeadlines));
    if (creative.descriptions) setDescriptionsText(listToLines(creative.descriptions, descriptions));
    if (creative.path1) setPath1(String(creative.path1));
    if (creative.path2) setPath2(String(creative.path2));
    if (targeting.keywords) setKeywordsText(listToLines(targeting.keywords, keywords));
    if (targeting.negativeKeywords) setNegativeKeywordsText(listToLines(targeting.negativeKeywords, negativeKeywords));
    if (targeting.adGroupName) setAdGroupName(String(targeting.adGroupName));
    setGeoTargets(geoText);
    setLanguages(languageText);
    setLocationPreset(detectLocationPreset(geoText, languageText));
    setActiveStep("creative");
    showToast({
      title: payload.aiUsed ? "AI-voorstel gegenereerd" : "Basisvoorstel geladen",
      description: payload.aiUsed
        ? payload.imageBrief
          ? `Visual tip: ${String(payload.imageBrief).slice(0, 100)}`
          : payload.keywordBrief
            ? String(payload.keywordBrief).slice(0, 120)
            : "Controleer headlines, keywords en landing page."
        : "AI-antwoord kon niet volledig worden gelezen — basisvoorstel ingevuld.",
    });
  }

  function openAiBriefingDialog(action: GoogleAiBriefingAction) {
    setAiBriefingAction(action);
    setAiBriefingDialogOpen(true);
  }

  function handleAiBriefingConfirm(brief: GoogleAiBriefingInput) {
    setProduct(brief.product);
    setAudience(brief.audience);
    setAiTone(brief.tone);
    const trimmedProduct = brief.product.trim();
    if (trimmedProduct.length < 2) return;

    const gen = beginGeneration();
    const guardSuccess =
      <T,>(apply: (value: T) => void) =>
      (value: T) => {
        if (!isCurrentGeneration(gen)) return;
        apply(value);
      };

    if (aiBriefingAction === "suggestion") {
      generateSuggestion.mutate(
        {
          product: trimmedProduct,
          audience: brief.audience.trim() || undefined,
          campaignType,
          tone: brief.tone,
          leadId: leadId || undefined,
        },
        { onSuccess: guardSuccess(applySuggestionSuccess) },
      );
      return;
    }
    if (aiBriefingAction === "keywords") {
      generateSearchKeywords.mutate(
        {
          product: trimmedProduct,
          audience: brief.audience.trim() || undefined,
          tone: brief.tone,
          existingKeywords: keywords,
          existingNegativeKeywords: negativeKeywords,
        },
        { onSuccess: guardSuccess(applySearchKeywordsSuccess) },
      );
      return;
    }
    generateAudienceSignals.mutate(
      {
        product: trimmedProduct,
        audience: brief.audience.trim() || undefined,
        tone: brief.tone,
        existingSignals: audienceSignals,
      },
      { onSuccess: guardSuccess(applyAudienceSignalsSuccess) },
    );
  }

  function handleAiSuggestion() {
    openAiBriefingDialog("suggestion");
  }

  function handleAiSearchKeywords() {
    openAiBriefingDialog("keywords");
  }

  function handleAiAudienceSignals() {
    openAiBriefingDialog("audience");
  }

  async function uploadAsset(slot: PmaxImageKind, file: File) {
    setUploadingAsset(slot);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Upload mislukt");
      }
      if (slot === "landscape") setImageUrl(payload.url);
      if (slot === "square") setSquareImageUrl(payload.url);
      if (slot === "portrait") setPortraitImageUrl(payload.url);
      if (slot === "logo") setLogoUrl(payload.url);
      if (slot === "landscapeLogo") setLandscapeLogoUrl(payload.url);
      showToast({ title: "Afbeelding geüpload" });
    } catch (error) {
      showToast({
        title: "Upload mislukt",
        description: error instanceof Error ? error.message : "Onbekende fout",
        variant: "error",
      });
    } finally {
      setUploadingAsset(null);
    }
  }

  function buildPayload(strict = true) {
    if (!strict && name.trim().length < 2) {
      throw new Error("Vul minstens een campagnenaam in (min. 2 tekens).");
    }
    if (strict && !finalUrl.trim().startsWith("https://")) throw new Error("Gebruik een volledige https final URL.");
    if (strict && headlines.length < 3) throw new Error("Google vereist minstens 3 headlines.");
    if (strict && descriptions.length < 2) throw new Error("Google vereist minstens 2 beschrijvingen.");
    if (strict && campaignType === "SEARCH" && !keywords.length) throw new Error("Search vereist minstens 1 keyword.");
    if (strict && campaignType === "PERFORMANCE_MAX") {
      if (!longHeadlines.length) throw new Error("Performance Max vereist minstens 1 long headline.");
      if (!editingLiveCampaignId && (!imageUrl.trim() || !squareImageUrl.trim())) {
        throw new Error("Performance Max vereist minstens een landscape en square image URL.");
      }
      if (!editingLiveCampaignId && (!businessName.trim() || businessName.trim().length > 25)) {
        throw new Error("Performance Max business name is verplicht en maximaal 25 tekens.");
      }
    }
    const advancedCreative = parseJson(advancedCreativeJson, "Advanced creative");
    const advancedTargeting = parseJson(advancedTargetingJson, "Advanced targeting");
    return {
      name: name.trim(),
      campaignType,
      dailyBudgetCents: budgetCentsOrNull(dailyBudget),
      currency,
      startTime: startTime ? new Date(startTime) : null,
      endTime: endTime ? new Date(endTime) : null,
      targeting: {
        geoTargetConstants: csvToList(geoTargets),
        languageConstants: csvToList(languages),
        keywords,
        negativeKeywords,
        matchType,
        adGroupName: adGroupName.trim(),
        searchPartners,
        displayExpansion,
        audienceSignals,
        campaignSettings: {
          biddingStrategy,
          targetCpaCents: numberValue(targetCpaCents) || null,
          targetRoas: Number(targetRoas) || null,
          conversionAction: conversionAction.trim() || null,
          trackingTemplate: trackingTemplate.trim() || null,
          finalUrlSuffix: finalUrlSuffix.trim() || null,
        },
        ...advancedTargeting,
      },
      creatives: {
        brandKitId: creativeParams.get("brandKitId") || undefined,
        finalUrl: finalUrl.trim(),
        headlines,
        longHeadlines,
        descriptions,
        headlinePin1: headlinePin1.trim(),
        descriptionPin1: descriptionPin1.trim(),
        businessName: businessName.trim(),
        path1: path1.trim(),
        path2: path2.trim(),
        imageUrl: imageUrl.trim(),
        marketingImageUrl: imageUrl.trim(),
        squareImageUrl: squareImageUrl.trim(),
        squareMarketingImageUrl: squareImageUrl.trim(),
        portraitImageUrl: portraitImageUrl.trim(),
        logoUrl: logoUrl.trim(),
        landscapeLogoUrl: landscapeLogoUrl.trim(),
        callToAction: callToAction.trim(),
        assetGroupName: assetGroupName.trim(),
        brandGuidelinesEnabled,
        finalUrlExpansion,
        ...advancedCreative,
      },
    };
  }

  function saveToGoogle(publishStatus?: "ENABLED" | "PAUSED") {
    if (!editingLiveCampaignId) return;
    try {
      const payload = buildPayload(true);
      saveCampaignToGoogle.mutate({
        campaignId: editingLiveCampaignId,
        ...payload,
        publishStatus,
      });
    } catch (error) {
      showToast({ title: "Controleer je velden", description: error instanceof Error ? error.message : "Ongeldige input", variant: "error" });
    }
  }

  function saveDraft() {
    try {
      const payload = buildPayload(false);
      if (selectedPlan && ["DRAFT", "FAILED", "CANCELLED"].includes(selectedPlan.status)) {
        updateDraft.mutate({ id: selectedPlan.id, ...payload });
      } else {
        createDraft.mutate(payload);
      }
    } catch (error) {
      showToast({ title: "Controleer je velden", description: error instanceof Error ? error.message : "Ongeldige input", variant: "error" });
    }
  }

  const queueContent = (
    <Card>
      <CardHeader>
        <CardTitle>Goedkeuringswachtrij</CardTitle>
        <CardDescription>Keur drafts goed en push ze daarna als gepauzeerd naar Google Ads — zoals een veilig publicatiemoment.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(["ALL", "DRAFT", "PENDING_APPROVAL", "APPROVED", "FAILED", "PUSHED_PAUSED"] as const).map((status) => (
            <Button key={status} size="sm" variant={approvalFilter === status ? "default" : "outline"} onClick={() => setApprovalFilter(status)}>
              {status === "ALL" ? "Alles" : status}
            </Button>
          ))}
        </div>
        {drafts.isLoading ? <Skeleton className="h-32 w-full" /> : filteredRows.length ? filteredRows.slice(0, 20).map((row: any) => (
          <div key={row.id} className={`rounded-xl border p-3 ${selectedPlan?.id === row.id ? "border-primary bg-primary/5" : "bg-card"}`}>
            <button type="button" className="w-full text-left" onClick={() => { setSelectedPlanId(row.id); setLoadedPlanId(null); }}>
              <div className="flex items-center justify-between gap-2"><p className="font-medium">{row.name}</p>{statusBadge(row.status)}</div>
              <p className="mt-1 text-xs text-muted-foreground">{row.campaignType} · {eur(row.dailyBudgetCents, row.currency)} · bijgewerkt {prettyDate(row.updatedAt)}</p>
              <ErrorHint raw={row.lastError} />
            </button>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => openDraftForEditing(row.id, "setup")}>
                <PencilLine className="mr-2 h-3 w-3" />
                Bewerken
              </Button>
              {row.status === "DRAFT" || row.status === "FAILED" || row.status === "CANCELLED" ? (
                <Button size="sm" variant="outline" disabled={approvalActionPending} onClick={() => submitForApproval.mutate({ id: row.id })}>
                  Indienen
                </Button>
              ) : null}
              {row.status === "PENDING_APPROVAL" ? (
                <Button size="sm" disabled={approvalActionPending} onClick={() => approveDraft.mutate({ id: row.id })}>
                  Goedkeuren
                </Button>
              ) : null}
              {row.status === "APPROVED" ? <Button size="sm" disabled={!connection.data?.autoadsEnabled || pushPaused.isPending} onClick={() => pushPaused.mutate({ id: row.id })}><Send className="mr-2 h-3 w-3" /> Push paused</Button> : null}
              {row.status === "FAILED" && row.lastError?.startsWith("EXTERNAL_WRITE_UNCERTAIN") ? <Button size="sm" variant="outline" disabled={reconcilePush.isPending} onClick={() => reconcilePush.mutate({ id: row.id })}><RefreshCcw className="mr-2 h-3 w-3" /> Controleer Google</Button> : null}
              {row.status === "FAILED" && !row.lastError?.startsWith("EXTERNAL_WRITE_UNCERTAIN") ? <Button size="sm" variant="outline" disabled={retryFailed.isPending} onClick={() => retryFailed.mutate({ id: row.id })}><RefreshCcw className="mr-2 h-3 w-3" /> Retry</Button> : null}
              {!["PUSHING", "PUSHED_PAUSED", "CANCELLED"].includes(row.status) ? <Button size="sm" variant="outline" onClick={() => rejectDraft.mutate({ id: row.id, reason: "Aanpassing gevraagd" })}>Afkeuren</Button> : null}
              {!["PUSHING", "PUSHED_PAUSED", "CANCELLED"].includes(row.status) ? <Button size="sm" variant="outline" onClick={() => cancelDraft.mutate({ id: row.id })}>Annuleren</Button> : null}
            </div>
          </div>
        )) : <EmptyState title="Nog geen Google Ads drafts" description="Maak je eerste draft aan via de wizard." icon={<PauseCircle className="h-8 w-8" />} />}
      </CardContent>
    </Card>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-emerald-200/60 bg-[radial-gradient(circle_at_12%_8%,rgba(52,211,153,0.3),transparent_30%),radial-gradient(circle_at_88%_0%,rgba(59,130,246,0.2),transparent_28%),linear-gradient(135deg,#f0fdf4_0%,#f8fafc_46%,#eff6ff_100%)] p-5 shadow-[0_28px_70px_rgba(4,120,87,0.12)] dark:border-emerald-400/15 dark:bg-[radial-gradient(circle_at_12%_8%,rgba(16,185,129,0.22),transparent_30%),linear-gradient(135deg,#022c22_0%,#0f172a_52%,#082f49_100%)] sm:p-6">
        <div className="pointer-events-none absolute -right-6 top-6 hidden h-36 w-36 rounded-full bg-emerald-400/25 blur-3xl sm:block" />
        <div className="pointer-events-none absolute bottom-2 left-1/3 hidden h-24 w-24 rounded-full bg-sky-400/20 blur-2xl sm:block" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-3 border-emerald-300/70 bg-white/70 text-emerald-900 backdrop-blur dark:bg-white/10 dark:text-emerald-100">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Search + Performance Max · alles blijft PAUSED
            </Badge>
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-lg shadow-emerald-900/20 ring-4 ring-white/60 dark:ring-white/10">
                <Search className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">Google Ads studio</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700 dark:text-slate-200">
                  Maak Search of Performance Max drafts met duidelijke stappen, asset-checks, preview, approval en budget guard.
                </p>
              </div>
            </div>
          </div>
          <div className="grid min-w-[260px] grid-cols-3 gap-2">
            <GoogleAdsHeroStat label="Drafts" value={String(rows.length)} />
            <GoogleAdsHeroStat label="Te review" value={String(heroStats.pending)} />
            <GoogleAdsHeroStat label="Goedgekeurd" value={String(heroStats.approved)} />
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild className="bg-white/75 backdrop-blur dark:bg-white/10">
            <Link href="/settings/integrations">
              <Settings2 className="mr-2 h-4 w-4" />
              Google Ads koppeling
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-white/75 backdrop-blur dark:bg-white/10"
            disabled={!canOpenStep("review")}
            onClick={() => setActiveStep("review")}
          >
            Naar review
          </Button>
          <Badge variant={connection.data?.connected ? "success" : "warning"} className="px-3 py-1.5">
            {connection.data?.connected ? "Google verbonden" : "Niet gekoppeld"}
          </Badge>
          <Badge variant={connection.data?.autoadsEnabled ? "success" : "warning"} className="px-3 py-1.5">
            Module {connection.data?.autoadsEnabled ? "aan" : "uit"}
          </Badge>
          {heroStats.failed > 0 ? (
            <Badge variant="warning" className="px-3 py-1.5">
              {heroStats.failed} mislukt
            </Badge>
          ) : null}
        </div>
      </section>

      <AdsCopilotPanel provider="GOOGLE" campaignIds={editingLiveCampaignId ? [editingLiveCampaignId] : []} />

      {connection.data && !connection.data.autoadsEnabled ? (
        <div className="space-y-2">
          {!connection.data?.autoadsEnabled ? (
            <GoogleAdsSetupNotice
              tone="emerald"
              icon={PauseCircle}
              title="Google Ads module staat uit"
              badge="Alleen lokaal"
              summary="Drafts, wizard en approval blijven beschikbaar. Push vereist inschakelen."
              headerAction={
                <Button size="sm" type="button" className="h-8 bg-emerald-700 hover:bg-emerald-800" onClick={() => setAdsTab("settings")}>
                  <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                  Inschakelen
                </Button>
              }
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-100/80 bg-emerald-50/30 px-3 py-2.5 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/80 dark:text-emerald-200/80">Nu beschikbaar</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Campagnes opbouwen, reviewen, goedkeuren en lokaal opslaan in de studio.
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/20 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Na inschakelen</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Goedgekeurde campagnes pushen als <span className="font-medium text-foreground">paused</span> — live zetten doe je in Google Ads.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" className="bg-emerald-700 hover:bg-emerald-800" onClick={() => setAdsTab("settings")}>
                  <Settings2 className="mr-2 h-4 w-4" />
                  Module inschakelen
                </Button>
                <Button variant="outline" className="border-emerald-200/80 bg-background/80" asChild>
                  <Link href="/settings/integrations">Google-koppeling</Link>
                </Button>
              </div>
            </GoogleAdsSetupNotice>
          ) : null}
        </div>
      ) : null}

      <AdsStudioStatsStrip
        studio="google"
        items={[
          {
            id: "connection",
            label: "Koppeling",
            icon: adsStudioStatIcons.connection,
            primary: "Google OAuth",
            secondary:
              connection.data?.selectedCustomerName ||
              connection.data?.selectedCustomerId ||
              connection.data?.accountEmail ||
              "Geen customer geselecteerd",
            connected: Boolean(connection.data?.connected),
          },
          {
            id: "performance",
            label: "CTR (30d)",
            icon: adsStudioStatIcons.performance,
            primary: totalClicks > 0 || (insights.data || []).length ? `${insightCoach.ctr.toFixed(2)}%` : "—",
            secondary:
              totalClicks > 0
                ? `CPC ${new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(insightCoach.cpc)}`
                : (insights.data || []).length
                  ? `${(insights.data || []).length} campagne${(insights.data || []).length === 1 ? "" : "s"}`
                  : "Geen data in periode",
          },
          {
            id: "insights",
            label: "30 dagen",
            icon: adsStudioStatIcons.insights,
            primary: new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(totalSpend),
            secondary: `${totalClicks} klik${totalClicks === 1 ? "" : "s"} · ${totalConversions} conv.`,
          },
        ]}
      />

        <Tabs value={adsTab} onValueChange={setAdsTab} className="space-y-4">
          <AdsStudioTabsNav
            value={adsTab}
            onValueChange={setAdsTab}
            tabs={GOOGLE_ADS_NAV_TABS}
            studio="google"
            mobileNavLabel="Google Ads Studio navigatie"
            approvalTabValue="queue"
            getBadgeCount={(tabValue) =>
              tabValue === "queue" ? pendingApprovalCount : tabValue === "drafts" ? rows.length : 0
            }
          />
        <TabsContent value="workflow"><AdsWorkflowPanel provider="GOOGLE" /></TabsContent>
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            {STEPS.map((step, index) => (
              <StepButton
                key={step.id}
                step={step}
                stepIndex={index}
                activeStep={activeStep}
                complete={step.id === "setup" ? setupComplete : step.id === "creative" ? creativeComplete : step.id === "targeting" ? targetingComplete : readyToSave}
                locked={!canOpenStep(step.id)}
                onClick={() => goToBuilderStep(step.id)}
              />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardHeader className="border-b bg-muted/20">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Stap {activeStepIndex + 1} van {BUILDER_STEP_ORDER.length} · {activeStepMeta.googleHint}
                    </p>
                    <CardTitle className="mt-1">{activeStepMeta.label}</CardTitle>
                    <CardDescription>{activeStepMeta.description}</CardDescription>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {campaignType === "SEARCH" ? "Zoekcampagne" : "Performance Max"}
                  </Badge>
                  {editingLiveCampaignId ? (
                    <Badge variant="secondary" className="shrink-0">
                      Live bewerken · {googleCampaignStatusLabel(editingLiveCampaignStatus)}
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-5 sm:pt-5">
                {editingLiveCampaignId && liveCampaignDetails.isLoading ? (
                  <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Campagnegegevens ophalen uit Google Ads…
                  </div>
                ) : null}
                {editingLiveCampaignId && liveCampaignDetails.error ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                    <p className="font-medium text-destructive">Live campagne laden mislukt</p>
                    <p className="mt-1 text-muted-foreground">{liveCampaignDetails.error.message}</p>
                  </div>
                ) : null}
                {activeStep === "setup" ? (
                  <div className="space-y-4">
                    <WizardSection
                      title="Campagne"
                      description="Naam en campagnetype — overeenkomstig met de eerste stap in Google Ads."
                      icon={Megaphone}
                      defaultOpen
                      preview={name.trim() || "Campagnenaam invullen"}
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                          <HelpLabel label="Campagnenaam" help="Wordt de campagnenaam in Google Ads. Kies iets herkenbaars voor je team." />
                          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. Leadgen BE – Search Q2" />
                        </div>
                        <div className="space-y-2">
                          <HelpLabel label="Campagnetype" help="Zoek = keywords + responsive search ads. Performance Max = asset group over meerdere kanalen." />
                          <Select value={campaignType} onValueChange={(value) => setCampaignType(value as CampaignType)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SEARCH">Zoekcampagne (Search)</SelectItem>
                              <SelectItem value="PERFORMANCE_MAX">Performance Max</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <HelpLabel label="Valuta" help="Moet overeenkomen met je Google Ads-account." />
                          <Select value={currency} onValueChange={setCurrency}>
                            <SelectTrigger>
                              <SelectValue placeholder="Kies valuta" />
                            </SelectTrigger>
                            <SelectContent>
                              {CURRENCY_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.symbol} {option.label} ({option.value})
                                </SelectItem>
                              ))}
                              {!CURRENCY_OPTIONS.some((option) => option.value === currency) ? (
                                <SelectItem value={currency}>{currency}</SelectItem>
                              ) : null}
                            </SelectContent>
                          </Select>
                          {connection.data?.defaultCurrency ? (
                            <p className="text-xs text-muted-foreground">
                              Google-account: {connection.data.defaultCurrency}
                              {connection.data.defaultCurrency !== currency ? (
                                <span className="ml-1 font-medium text-amber-700 dark:text-amber-300">
                                  — wijkt af van je selectie
                                </span>
                              ) : null}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </WizardSection>

                    <WizardSection
                      title="Budget en planning"
                      description="Dagbudget en optionele start- of einddatum."
                      icon={CalendarDays}
                      preview={
                        Number.isFinite(dailyBudgetEuros)
                          ? `${eur(numberValue(dailyBudget), currency)}/dag${startTime || endTime ? " · planning ingesteld" : ""}`
                          : "Dagbudget nog niet ingevuld"
                      }
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <HelpLabel label="Dagbudget" help="Het bedrag dat Google maximaal per dag mag uitgeven. Minimum €1,00 per dag." />
                          <div className="relative">
                            <Input
                              type="number"
                              min="1"
                              step="0.01"
                              placeholder="Bijv. 25.00"
                              value={Number.isFinite(dailyBudgetEuros) ? dailyBudgetEuros : ""}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (!raw.trim()) {
                                  setDailyBudget("");
                                  return;
                                }
                                setDailyBudget(String(Math.max(100, Math.round(Number(raw) * 100))));
                              }}
                              className="pr-14"
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currency}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Workspace-limiet: {eur(connection.data?.maxDailyBudgetCents, connection.data?.defaultCurrency || "EUR")} per campagne
                          </p>
                        </div>
                        <div className="space-y-2">
                          <HelpLabel label="Budgettype" help="V1 gebruikt een dagbudget. Levensduurbudget komt later." />
                          <Input disabled value="Dagelijks (standaard)" className="bg-muted/50" />
                        </div>
                        <div className="space-y-2">
                          <HelpLabel label="Startdatum" help="Optioneel. Leeg = geen vaste start in de draft." />
                          <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <HelpLabel label="Einddatum" help="Optioneel. Handig voor acties met vaste einddatum." />
                          <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                        </div>
                      </div>
                    </WizardSection>

                    <WizardSection
                      title="Bieden"
                      description="Biedstrategie op campagneniveau — zoals in Google Ads onder 'Bieden'."
                      icon={Target}
                      preview={BIDDING_OPTIONS.find((option) => option.value === biddingStrategy)?.label || "Biedstrategie kiezen"}
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                          <HelpLabel label="Biedstrategie" help="Kies de strategie die past bij je doel. Target-velden verschijnen alleen waar relevant." />
                          <Select value={biddingStrategy} onValueChange={(value) => setBiddingStrategy(value as BiddingStrategy)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {BIDDING_OPTIONS.filter((option) => campaignType === "SEARCH" || option.value !== "MANUAL_CPC").map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            {BIDDING_OPTIONS.find((option) => option.value === biddingStrategy)?.hint}
                          </p>
                        </div>
                        {biddingStrategy === "MAXIMIZE_CONVERSIONS" ? (
                          <div className="space-y-2">
                            <HelpLabel label="Target-CPA (optioneel)" help="Maximale kosten per conversie in euro. Laat leeg voor automatisch leren." />
                            <div className="relative">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={targetCpaCents ? String(Number(targetCpaCents) / 100) : ""}
                                onChange={(e) => setTargetCpaCents(e.target.value ? String(Math.round(Number(e.target.value) * 100)) : "")}
                                placeholder="Bijv. 35"
                                className="pr-10"
                              />
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                            </div>
                          </div>
                        ) : null}
                        {biddingStrategy === "MAXIMIZE_CONVERSION_VALUE" ? (
                          <div className="space-y-2">
                            <HelpLabel label="Target-ROAS (optioneel)" help="Doel-return on ad spend, bijv. 3.5 = €3,50 omzet per €1 spend." />
                            <Input value={targetRoas} onChange={(e) => setTargetRoas(e.target.value)} placeholder="Bijv. 3.5" />
                          </div>
                        ) : null}
                        <div className="space-y-2 sm:col-span-2">
                          <HelpLabel
                            label="Conversieactie (optioneel)"
                            helpClassName="max-w-sm"
                            help={`Een conversieactie is wat Google als succes telt: een ingevuld formulier, telefoontje, aankoop, enz.

Laat dit veld leeg — Google gebruikt dan alle actieve conversieacties in je account. Dat is in de meeste gevallen het beste.

Vul het alleen in als deze campagne één specifieke actie moet volgen (bijv. alleen "Leadformulier", niet ook "Telefoon").

Waar vind je het ID? In Google Ads: Doelen → Conversies → klik op de actie → Instellingen. Kopieer het resource-ID (formaat customers/…/conversionActions/…).`}
                          />
                          <Input
                            value={conversionAction}
                            onChange={(e) => setConversionAction(e.target.value)}
                            placeholder="Meestal leeg laten"
                            className="font-mono text-xs"
                          />
                          <p className="text-xs text-muted-foreground">
                            Standaard optimaliseert Google op alle conversies in je account. Alleen invullen als je bewust één conversie wilt kiezen.
                          </p>
                        </div>
                      </div>
                    </WizardSection>

                    <details className="group rounded-2xl border border-dashed border-border/80 bg-muted/10 open:bg-muted/20">
                      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                        Geavanceerd tracking (optioneel)
                      </summary>
                      <div className="space-y-4 border-t border-border/50 px-4 pb-4 pt-3">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <HelpLabel label="Tracking template" help="Custom click tracking URL. Meestal leeg laten." />
                            <Input value={trackingTemplate} onChange={(e) => setTrackingTemplate(e.target.value)} placeholder="Optioneel" />
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Final URL suffix" help="UTM-parameters of andere suffix die Google aan je landingspagina-URL toevoegt." />
                            <Input value={finalUrlSuffix} onChange={(e) => setFinalUrlSuffix(e.target.value)} className="font-mono text-xs" />
                          </div>
                        </div>
                      </div>
                    </details>

                  </div>
                ) : null}

                {activeStep === "creative" ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <FieldCounter label="Headlines" count={headlines.length} min={3} max={15} />
                      <FieldCounter label="Descriptions" count={descriptions.length} min={2} max={campaignType === "SEARCH" ? 4 : 5} />
                      {campaignType === "PERFORMANCE_MAX" ? (
                        <>
                          <FieldCounter label="Long headlines" count={longHeadlines.length} min={1} max={5} />
                          <Badge variant={imageUrl && squareImageUrl && logoUrl ? "success" : "warning"}>PMax-beelden</Badge>
                        </>
                      ) : null}
                    </div>

                    <WizardSection
                      title={campaignType === "SEARCH" ? "Responsive Search Ad" : "Asset group — tekst"}
                      description={campaignType === "SEARCH" ? "Final URL, headlines en descriptions zoals in Google Ads onder Advertenties." : "Tekstassets voor je Performance Max asset group."}
                      icon={Layers}
                      defaultOpen
                    >
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <HelpLabel label="Finale URL" help="Landingspagina na de klik. Verplicht https:// in Google Ads." />
                          <Input value={finalUrl} onChange={(e) => setFinalUrl(e.target.value)} placeholder="https://jouwdomein.be/landing" />
                        </div>
                        {campaignType === "SEARCH" ? (
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <HelpLabel label="Weergavepad 1" help="Zichtbaar in de advertentie-URL (max. 15 tekens)." />
                              <Input value={path1} onChange={(e) => setPath1(e.target.value)} placeholder="offerte" maxLength={15} />
                            </div>
                            <div className="space-y-2">
                              <HelpLabel label="Weergavepad 2" help="Tweede padsegment in de advertentie-URL." />
                              <Input value={path2} onChange={(e) => setPath2(e.target.value)} placeholder="demo" maxLength={15} />
                            </div>
                          </div>
                        ) : null}
                        <div className="space-y-2">
                          <CopyAssetListEditor
                            label="Headlines"
                            help="Google Ads: min. 3, max. 15 headlines · max. 30 tekens elk."
                            value={headlinesText}
                            onChange={setHeadlinesText}
                            minItems={3}
                            maxItems={15}
                            maxChars={30}
                            itemLabel="Headline"
                            defaultOpen
                            placeholders={["Headline 1", "Headline 2", "Headline 3"]}
                          />
                          <CopyAssetListEditor
                            label="Descriptions"
                            help={`Google Ads: min. 2 descriptions · max. 90 tekens elk · max. ${campaignType === "SEARCH" ? 4 : 5} stuks.`}
                            value={descriptionsText}
                            onChange={setDescriptionsText}
                            minItems={2}
                            maxItems={campaignType === "SEARCH" ? 4 : 5}
                            maxChars={90}
                            itemLabel="Description"
                            placeholders={["Description 1", "Description 2"]}
                          />
                        {campaignType === "PERFORMANCE_MAX" ? (
                          <CopyAssetListEditor
                            label="Long headlines"
                            help="Verplicht voor PMax · min. 1, max. 5 · max. 90 tekens elk."
                            value={longHeadlinesText}
                            onChange={setLongHeadlinesText}
                            minItems={1}
                            maxItems={5}
                            maxChars={90}
                            itemLabel="Long headline"
                            placeholders={["Long headline 1"]}
                          />
                        ) : null}
                        </div>
                        {campaignType === "SEARCH" ? (
                          <details className="rounded-xl border border-dashed px-3 py-2">
                            <summary className="cursor-pointer text-sm font-medium">Vastzetten (pinning) — optioneel</summary>
                            <div className="mt-3 grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <HelpLabel label="Headline vastzetten" help="Exacte headline-tekst die op positie 1 moet blijven." />
                                <Input value={headlinePin1} onChange={(e) => setHeadlinePin1(e.target.value)} placeholder="Exacte headline" />
                              </div>
                              <div className="space-y-2">
                                <HelpLabel label="Description vastzetten" help="Exacte description die vast moet blijven." />
                                <Input value={descriptionPin1} onChange={(e) => setDescriptionPin1(e.target.value)} placeholder="Exacte description" />
                              </div>
                            </div>
                          </details>
                        ) : null}
                      </div>
                    </WizardSection>

                    {campaignType === "PERFORMANCE_MAX" ? (
                      <WizardSection
                        title="Asset group — beelden & merk"
                        description="Compacte upload met Google-afmetingen. Checklist toont wat verplicht is voor push (V1)."
                        icon={ImageIcon}
                      >
                        <PmaxVisualAssetsPanel
                          assetGroupName={assetGroupName}
                          onAssetGroupNameChange={setAssetGroupName}
                          businessName={businessName}
                          onBusinessNameChange={setBusinessName}
                          callToAction={callToAction}
                          onCallToActionChange={setCallToAction}
                          brandGuidelinesEnabled={brandGuidelinesEnabled}
                          onBrandGuidelinesChange={setBrandGuidelinesEnabled}
                          finalUrlExpansion={finalUrlExpansion}
                          onFinalUrlExpansionChange={setFinalUrlExpansion}
                          headlines={headlines}
                          longHeadlines={longHeadlines}
                          descriptions={descriptions}
                          imageUrl={imageUrl}
                          squareImageUrl={squareImageUrl}
                          portraitImageUrl={portraitImageUrl}
                          logoUrl={logoUrl}
                          landscapeLogoUrl={landscapeLogoUrl}
                          onImageUrlChange={setImageUrl}
                          onSquareImageUrlChange={setSquareImageUrl}
                          onPortraitImageUrlChange={setPortraitImageUrl}
                          onLogoUrlChange={setLogoUrl}
                          onLandscapeLogoUrlChange={setLandscapeLogoUrl}
                          uploadingAsset={uploadingAsset}
                          onUpload={uploadAsset}
                        />
                      </WizardSection>
                    ) : (
                      <div className="space-y-2">
                        <HelpLabel label="Bedrijfsnaam (optioneel)" help="Sommige extensies tonen je merknaam." />
                        <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                      </div>
                    )}
                  </div>
                ) : null}

                {activeStep === "targeting" ? (
                  <div className="space-y-4">
                    <WizardSection title="Locaties" description="Waar je advertenties mogen verschijnen — campagneniveau in Google Ads." icon={Target}>
                      <GeoLocationEditor
                        geoTargets={geoTargets}
                        languages={languages}
                        onGeoTargetsChange={setGeoTargets}
                        onLocationPresetChange={setLocationPreset}
                        googleSearchEnabled={Boolean(connection.data?.connected && connection.data?.selectedCustomerId)}
                      />
                    </WizardSection>

                    <WizardSection title="Talen" description="Taal van gebruikers die je advertentie zien." icon={Languages}>
                      <LanguageTargetingEditor
                        geoTargets={geoTargets}
                        languages={languages}
                        locationPreset={locationPreset}
                        onLanguagesChange={setLanguages}
                        onLocationPresetChange={setLocationPreset}
                      />
                    </WizardSection>

                    {campaignType === "SEARCH" ? (
                      <WizardSection title="Netwerken" description="Waar Search-advertenties mogen draaien." icon={Search}>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="flex items-center justify-between rounded-xl border bg-background/80 p-3">
                            <div>
                              <p className="text-sm font-medium">Zoekpartners</p>
                              <p className="text-xs text-muted-foreground">Google Zoeken + partnerzoekmachines.</p>
                            </div>
                            <Switch checked={searchPartners} onCheckedChange={setSearchPartners} />
                          </div>
                          <div className="flex items-center justify-between rounded-xl border bg-background/80 p-3">
                            <div>
                              <p className="text-sm font-medium">Display Expansion</p>
                              <p className="text-xs text-muted-foreground">Extra bereik buiten zoekresultaten.</p>
                            </div>
                            <Switch checked={displayExpansion} onCheckedChange={setDisplayExpansion} />
                          </div>
                        </div>
                      </WizardSection>
                    ) : null}

                    {campaignType === "SEARCH" ? (
                      <WizardSection
                        title="Advertentiegroep & zoekwoorden"
                        description="Ad group, match type en keywordlijst — kern van Search-campagnes."
                        icon={Search}
                      >
                        <SearchKeywordsEditor
                          adGroupName={adGroupName}
                          onAdGroupNameChange={setAdGroupName}
                          matchType={matchType}
                          onMatchTypeChange={setMatchType}
                          keywordsText={keywordsText}
                          onKeywordsChange={setKeywordsText}
                          negativeKeywordsText={negativeKeywordsText}
                          onNegativeKeywordsChange={setNegativeKeywordsText}
                          onAiSuggest={handleAiSearchKeywords}
                          aiPending={generateSearchKeywords.isPending}
                          aiDisabled={false}
                        />
                      </WizardSection>
                    ) : (
                      <WizardSection title="Doelgroepsignalen (PMax)" description="Richtinggevende signalen — geen harde targeting zoals in Search." icon={Target} defaultOpen>
                        <AudienceSignalsEditor
                          value={audienceSignalsText}
                          onChange={setAudienceSignalsText}
                          onAiSuggest={handleAiAudienceSignals}
                          aiPending={generateAudienceSignals.isPending}
                          aiDisabled={false}
                        />
                      </WizardSection>
                    )}
                  </div>
                ) : null}

                {activeStep === "review" ? (
                  <div className="space-y-4">
                    <GoogleAdsPausedPublishNotice />

                    <WizardSection title="Samenvatting" description="Controleer of alles klopt vóór opslaan en approval." icon={Eye} defaultOpen>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <ReviewRow label="Campagne" value={name || "—"} />
                        <ReviewRow label="Type" value={campaignType === "SEARCH" ? "Zoekcampagne" : "Performance Max"} />
                        <ReviewRow label="Dagbudget" value={numberValue(dailyBudget) >= 100 ? eur(numberValue(dailyBudget), currency) : "—"} />
                        <ReviewRow label="Bieden" value={BIDDING_OPTIONS.find((o) => o.value === biddingStrategy)?.label || biddingStrategy} />
                        <ReviewRow label="Finale URL" value={<span className="break-all font-mono text-xs">{finalUrl || "—"}</span>} />
                        <ReviewRow label="Headlines" value={`${headlines.length} stuks`} />
                        {campaignType === "SEARCH" ? (
                          <ReviewRow label="Keywords" value={`${keywords.length} + ${negativeKeywords.length} negatief`} />
                        ) : (
                          <ReviewRow label="PMax assets" value={imageUrl && squareImageUrl && logoUrl ? "Beelden OK" : "Beelden ontbreken"} />
                        )}
                      </div>
                    </WizardSection>

                    <WizardSection title="Vereisten" description="Wat nog moet kloppen voor approval en push." icon={CheckCircle2}>
                      <div className="grid gap-3 md:grid-cols-2">
                        <CheckRow ok={setupComplete} label="Campagne & budget" hint="Naam, type en min. €1/dag." />
                        <CheckRow ok={creativeComplete} label="Advertentie-assets" hint={campaignType === "SEARCH" ? "RSA: 3+ headlines, 2+ descriptions, https URL." : "PMax: tekst + landscape/square/logo + bedrijfsnaam."} />
                        <CheckRow ok={targetingComplete} label="Doelgroep" hint={campaignType === "SEARCH" ? "Minstens 1 zoekwoord." : "Minstens 1 audience-signaal."} />
                        <CheckRow ok={Boolean(connection.data?.selectedCustomerId)} label="Google-account" hint="Selecteer een customer onder Instellingen." />
                      </div>
                    </WizardSection>

                    <details className="rounded-2xl border border-dashed border-border/80 bg-muted/10">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Geavanceerd JSON (power users)</summary>
                      <div className="grid gap-4 border-t border-border/50 p-4 lg:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-xs">Creative JSON merge</Label>
                          <Textarea className="min-h-32 font-mono text-xs" value={advancedCreativeJson} onChange={(e) => setAdvancedCreativeJson(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Targeting JSON merge</Label>
                          <Textarea className="min-h-32 font-mono text-xs" value={advancedTargetingJson} onChange={(e) => setAdvancedTargetingJson(e.target.value)} />
                        </div>
                      </div>
                    </details>
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={activeStepIndex === 0} onClick={() => goToAdjacentBuilderStep(-1)}>
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Vorige
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={activeStepIndex >= BUILDER_STEP_ORDER.length - 1 || !canOpenStep(BUILDER_STEP_ORDER[activeStepIndex + 1]!)}
                      onClick={() => goToAdjacentBuilderStep(1)}
                    >
                      Volgende
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={handleAiSuggestion}
                      variant="outline"
                      size="sm"
                      disabled={aiBriefingPending}
                    >
                      {aiBriefingPending && aiBriefingAction === "suggestion" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      AI voorstel
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={startNewCampaign}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nieuwe campagne
                    </Button>
                    {editingLiveCampaignId ? (
                      <>
                        <Button
                          onClick={() => saveToGoogle()}
                          size="sm"
                          disabled={saveCampaignToGoogle.isPending || !readyToSave}
                        >
                          {saveCampaignToGoogle.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                          Opslaan in Google
                        </Button>
                        <Button
                          onClick={() => saveToGoogle("ENABLED")}
                          size="sm"
                          variant="default"
                          className="bg-emerald-700 hover:bg-emerald-800"
                          disabled={saveCampaignToGoogle.isPending || !readyToSave}
                        >
                          {saveCampaignToGoogle.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                          Publiceren
                        </Button>
                        <Button
                          onClick={() => saveToGoogle("PAUSED")}
                          size="sm"
                          variant="outline"
                          disabled={saveCampaignToGoogle.isPending || !readyToSave}
                        >
                          <PauseCircle className="mr-2 h-4 w-4" />
                          Pauzeren
                        </Button>
                      </>
                    ) : (
                      <Button onClick={saveDraft} size="sm" disabled={createDraft.isPending || updateDraft.isPending || !canSaveDraft}>
                        {createDraft.isPending || updateDraft.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Draft opslaan
                      </Button>
                    )}
                    {readyToSave ? <Badge variant="success">{editingLiveCampaignId ? "Klaar om op te slaan" : "Klaar voor approval"}</Badge> : null}
                  </div>
                </div>
                {!readyToSave ? (
                  <p className="text-xs text-muted-foreground">
                    {editingLiveCampaignId
                      ? "Vul alle stappen in om live op te slaan naar Google Ads."
                      : "Je kunt tussentijds opslaan. Voor de goedkeuringswachtrij moeten alle stappen groen zijn."}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <div className="space-y-4">
              {campaignType === "PERFORMANCE_MAX" ? (
                <PerformanceMaxPreview
                  finalUrl={finalUrl}
                  headlines={headlines}
                  longHeadlines={longHeadlines}
                  descriptions={descriptions}
                  imageUrl={imageUrl}
                  squareImageUrl={squareImageUrl}
                  portraitImageUrl={portraitImageUrl}
                  logoUrl={logoUrl}
                  landscapeLogoUrl={landscapeLogoUrl}
                  businessName={businessName}
                  callToAction={callToAction}
                />
              ) : (
                <SearchPreview finalUrl={finalUrl} headlines={headlines} descriptions={descriptions} path1={path1} path2={path2} keywords={keywords} headlinePin1={headlinePin1} descriptionPin1={descriptionPin1} />
              )}
              <CollapsibleCard
                title="Google Ads-vereisten"
                description="Minimale assets zoals in het echte Google Ads-scherm."
                preview={`${[
                  headlines.length >= 3,
                  descriptions.length >= 2,
                  campaignType === "SEARCH" || Boolean(imageUrl && squareImageUrl && logoUrl && businessName.trim() && !brandGuidelinesEnabled),
                  finalUrl.startsWith("https://"),
                ].filter(Boolean).length}/4 vereisten OK`}
              >
                <CheckRow ok={headlines.length >= 3} label="Headlines" hint="Minstens 3 nodig. Meer variatie geeft Google betere combinaties." />
                <CheckRow ok={descriptions.length >= 2} label="Descriptions" hint="Minstens 2 nodig. Zorg voor duidelijke value proposition en CTA." />
                <CheckRow ok={campaignType === "SEARCH" || Boolean(imageUrl && squareImageUrl && logoUrl && businessName.trim() && !brandGuidelinesEnabled)} label="PMax visuals" hint="Voor Performance Max: landscape, square, logo, business name en brand guidelines uit zijn nodig in v1." />
                <CheckRow ok={finalUrl.startsWith("https://")} label="Landing page" hint="Gebruik een publieke https URL die snel laadt en inhoudelijk past bij je advertentie." />
              </CollapsibleCard>
              <CollapsibleCard
                title="Operationele checks"
                description="Wat nog moet kloppen voor een echte push naar Google."
                preview={
                  operationalRequirements.length
                    ? `${operationalRequirements.length} blokkade${operationalRequirements.length === 1 ? "" : "s"} open`
                    : "Geen blokkades gedetecteerd"
                }
              >
                {operationalRequirements.length ? operationalRequirements.map((requirement) => (
                  <div key={requirement.code} className="rounded-xl border bg-card p-3">
                    <p className="font-medium">{requirement.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{requirement.description}</p>
                    <p className="mt-2 text-xs font-medium">{requirement.nextStep}</p>
                  </div>
                )) : <p className="text-sm text-muted-foreground">Geen blokkades gedetecteerd.</p>}
              </CollapsibleCard>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="queue">{queueContent}</TabsContent>

        <TabsContent value="campaigns">
          <Card>
            <CardHeader>
              <CardTitle>Google campagnes</CardTitle>
              <CardDescription>Campagnes uit het geselecteerde Google Ads customer account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {campaigns.error ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                  <p className="font-medium text-destructive">Campagnes laden mislukt</p>
                  <p className="mt-1 text-muted-foreground">{campaigns.error.message}</p>
                </div>
              ) : campaigns.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (campaigns.data || []).length ? (
                (campaigns.data || []).map((campaign: any) => (
                  <div key={campaign.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {campaign.channelType} · {googleCampaignStatusLabel(campaign.status)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={googleCampaignIsEnabled(campaign.status) ? "success" : "secondary"}>
                        {googleCampaignStatusLabel(campaign.status)}
                      </Badge>
                      {googleCampaignIsEnabled(campaign.status) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={campaignActionPending}
                          onClick={() => pauseCampaign.mutate({ campaignId: campaign.id })}
                        >
                          <PauseCircle className="mr-2 h-3.5 w-3.5" />
                          Pauzeren
                        </Button>
                      ) : googleCampaignIsPaused(campaign.status) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={campaignActionPending}
                          onClick={() => resumeCampaign.mutate({ campaignId: campaign.id })}
                        >
                          <Play className="mr-2 h-3.5 w-3.5" />
                          Activeren
                        </Button>
                      ) : null}
                      <Button size="sm" variant="outline" disabled={campaignActionPending} onClick={() => handleRenameCampaign(campaign)}>
                        <PencilLine className="mr-2 h-3.5 w-3.5" />
                        Naam
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openLiveCampaignEditor(asRecord(campaign))}>
                        <PencilLine className="mr-2 h-3.5 w-3.5" />
                        Live bewerken
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        disabled={campaignActionPending}
                        onClick={() => handleRemoveCampaign(campaign)}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Verwijderen
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="Geen campagnes geladen"
                  description={
                    connection.data?.selectedCustomerId
                      ? "Er staan nog geen campagnes in dit Google Ads-account."
                      : "Kies eerst een customer in Instellingen of koppel Google Ads opnieuw."
                  }
                  icon={<Search className="h-8 w-8" />}
                  action={
                    <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={startNewCampaign}>
                      <Plus className="mr-2 h-4 w-4" />
                      Maak campagne
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="drafts">
          <Card>
            <CardHeader>
              <CardTitle>Alle drafts</CardTitle>
              <CardDescription>Interne plannen met approval- en push-status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {rows.map((row: any) => (
                <div key={row.id} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{row.name}</p>
                    {statusBadge(row.status)}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{row.campaignType} · {eur(row.dailyBudgetCents, row.currency)} · {prettyDate(row.createdAt)}</p>
                  <ErrorHint raw={row.lastError} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openDraftForEditing(row.id, "setup")}>
                      <PencilLine className="mr-2 h-3.5 w-3.5" />
                      Bewerken in Studio
                    </Button>
                  </div>
                </div>
              ))}
              {!rows.length ? <EmptyState title="Geen drafts" description="Je drafts verschijnen hier zodra je er een opslaat." icon={<Save className="h-8 w-8" />} /> : null}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="insights"><Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Insights</CardTitle><CardDescription>Campaign-level performance van de laatste 30 dagen.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 md:grid-cols-4"><div className="rounded-xl border bg-muted/30 p-3 text-sm"><p className="text-xs uppercase text-muted-foreground">Campaigns</p><p className="text-2xl font-semibold">{(insights.data || []).length}</p></div><div className="rounded-xl border bg-muted/30 p-3 text-sm"><p className="text-xs uppercase text-muted-foreground">CTR</p><p className="text-2xl font-semibold">{insightCoach.ctr.toFixed(2)}%</p></div><div className="rounded-xl border bg-muted/30 p-3 text-sm"><p className="text-xs uppercase text-muted-foreground">Gem. CPC</p><p className="text-2xl font-semibold">€{insightCoach.cpc.toFixed(2)}</p></div><div className="rounded-xl border bg-muted/30 p-3 text-sm"><p className="text-xs uppercase text-muted-foreground">Conversies</p><p className="text-2xl font-semibold">{totalConversions}</p></div></div><Card className="border-primary/20 bg-primary/5"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" /> AI coach</CardTitle><CardDescription>Praktische interpretatie van de huidige Google Ads resultaten.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm">{insightCoach.tips.map((tip) => <p key={tip} className="rounded-xl border bg-card px-3 py-2">{tip}</p>)}</CardContent></Card>{(insights.data || []).map((row: any) => <div key={row.campaign_id || row.campaign_name} className="grid gap-2 rounded-xl border p-3 text-sm md:grid-cols-6"><div className="font-medium">{row.campaign_name || row.campaign_id}</div><div>Impressies: {row.impressions || 0}</div><div>Clicks: {row.clicks || 0}</div><div>CTR: {Number(row.ctr || 0).toFixed(2)}%</div><div>CPC: €{Number(row.cpc || 0).toFixed(2)}</div><div>Conv: {row.conversions || 0} · Spend: €{row.spend || 0}</div></div>)}{!(insights.data || []).length ? <EmptyState title="Geen inzichten" description="Google geeft nog geen data terug voor dit account of deze periode." icon={<BarChart3 className="h-8 w-8" />} /> : null}</CardContent></Card></TabsContent>
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Google Ads instellingen</CardTitle>
              <CardDescription>Selecteer exact één customer ID per workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Card className="border-amber-500/30 bg-amber-500/10">
                <CardContent className="flex gap-3 p-4 text-sm">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-700" />
                  <div>
                    <p className="font-medium text-amber-950 dark:text-amber-100">Nieuwe campagnes worden gepauzeerd aangemaakt in Google Ads.</p>
                    <p className="text-amber-900/80 dark:text-amber-100/80">Activeren, pauzeren en verwijderen kan rechtstreeks vanuit het tabblad Campagnes.</p>
                  </div>
                </CardContent>
              </Card>

              <div className="rounded-xl border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Google Ads module</p>
                    <p className="text-xs text-muted-foreground">Vereist om drafts naar Google te pushen.</p>
                  </div>
                  <Switch
                    checked={Boolean(connection.data?.autoadsEnabled)}
                    disabled={setAutoadsEnabled.isPending}
                    onCheckedChange={(enabled) => setAutoadsEnabled.mutate({ enabled })}
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-xl border p-3">
                <Label>Manager customer ID (MCC)</Label>
                <p className="text-xs text-muted-foreground">
                  Alleen nodig als je via een manager-account werkt. Wordt automatisch ingevuld bij selectie waar mogelijk.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={loginCustomerIdInput}
                    onChange={(event) => setLoginCustomerIdInput(event.target.value.replace(/\D/g, ""))}
                    placeholder="Bijv. 1234567890"
                  />
                  <Button
                    variant="outline"
                    disabled={setLoginCustomerId.isPending}
                    onClick={() => setLoginCustomerId.mutate({ loginCustomerId: loginCustomerIdInput })}
                  >
                    Opslaan
                  </Button>
                </div>
                {connection.data?.loginCustomerId ? (
                  <p className="text-xs text-muted-foreground">Actief: {connection.data.loginCustomerId}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Beschikbare Google Ads customers</Label>
                {customers.error ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                    <p className="font-medium text-destructive">Customers laden mislukt</p>
                    <p className="mt-1 text-muted-foreground">{customers.error.message}</p>
                  </div>
                ) : customers.isLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : (customers.data || []).map((account: any) => (
                  <div key={account.customerId} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{account.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {account.customerId} · {account.currency}
                        {account.isManager ? " · Manager" : ""}
                        {account.loginCustomerId ? ` · login ${account.loginCustomerId}` : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={connection.data?.selectedCustomerId === account.customerId ? "secondary" : "default"}
                      disabled={selectCustomer.isPending}
                      onClick={() =>
                        selectCustomer.mutate({
                          customerId: account.customerId,
                          name: account.name,
                          currency: account.currency,
                          timezoneName: account.timezone,
                          loginCustomerId: account.loginCustomerId,
                        })
                      }
                    >
                      {connection.data?.selectedCustomerId === account.customerId ? "Geselecteerd" : "Selecteren"}
                    </Button>
                  </div>
                ))}
                {!customers.isLoading && !customers.error && !(customers.data || []).length ? (
                  <EmptyState
                    title="Geen customers gevonden"
                    description="Koppel Google Ads met de adwords-scope, selecteer een customer en controleer API-toegang in Google Cloud Console."
                    icon={<Search className="h-8 w-8" />}
                  />
                ) : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>

      <GoogleAiBriefingDialog
        open={aiBriefingDialogOpen}
        onOpenChange={setAiBriefingDialogOpen}
        action={aiBriefingAction}
        initialBrief={{ product, audience, tone: aiTone }}
        onConfirm={handleAiBriefingConfirm}
        pending={aiBriefingPending}
      />
    </TooltipProvider>
  );
}
