"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useMutationGeneration } from "@/lib/use-mutation-generation";
import { useBranding } from "@/lib/branding";
import { AdsStudioStatsStrip, adsStudioStatIcons } from "@/components/ads/ads-studio-stats-strip";
import { AdsCopilotPanel } from "@/components/ads/ads-copilot-panel";
import { AdsStudioTabsNav } from "@/components/ads/ads-studio-tabs-nav";
import { MetaAdsDashboardOverview } from "@/components/ads/meta-ads-dashboard-overview";
import { MetaAdsDraftsPanel } from "@/components/ads/meta-ads-drafts-panel";
import { MetaAdsStudioSummary } from "@/components/ads/meta-ads-studio-summary";
import { AdsModuleSetupNotice, adsModuleSetupToneStyles } from "@/components/ads/ads-module-setup-notice";
import { MetaAdsBrandMark } from "@/components/social/social-platform-avatars";
import { eur, numberValue, budgetCentsOrNull, normalizeCampaignNameKey, asRecord } from "./meta-ads-format-utils";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Switch, Tabs, TabsContent, Textarea, TooltipProvider } from "@digitify/ui";
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Image as ImageIcon, FileText, Globe2, Layers3, Loader2, Megaphone, PauseCircle, PencilLine, Plus, RefreshCcw, Save, Settings2, ShieldCheck, Sparkles, Target, Wand2 } from "lucide-react";
import { useToast } from "@/components/feedback/toast-provider";
import { buildCampaignScore, buildCampaignScoreEntries } from "@/lib/meta-ads-campaign-score";
import { AdsWorkflowPanel, PlanStatus, PlacementKey, BuilderStep, BidStrategy, OptimizationGoal, DestinationType, AssetSlot, AiTone, AdsetDraft, CreativeVariantDraft, META_ADS_NAV_TABS, BUILDER_STEP_ORDER, STEPS, META_CURRENCY_OPTIONS, META_BUYING_TYPE_OPTIONS, META_BILLING_EVENT_OPTIONS, META_CUSTOM_EVENT_OPTIONS, META_SPECIAL_AD_CATEGORY_OPTIONS, PLACEMENTS, META_DEFAULT_AGE_MIN, META_DEFAULT_AGE_MAX, metaPlanStatusLabelClient, prettyDate, csvToList, adsetHasGeoTargeting, adsetsSectionPreview, adsPerAdsetSectionPreview, AdsetCreativeAccordionCard, VariantAccordionCard, AdsetAccordionCard, parseJson, createAdset, createCreativeVariant, mergeVariantWithBase, targetingToAdset, ctaLabelFromType, liveAdsetToDraft, trpcErrorDescription, explainMetaError, resolvePublishImage, describeOperationalRequirement, buildMergedVariantPayload, buildInsightCoachRows, buildTargetingFromAdset, CampaignScorePanel, HelpLabel, AdsetAudienceOptionalSection, MetaCampaignUrlTagsField, CompactHelpLabel, VariantCreativeForm, ErrorHint, metaDeliveryPreview, META_OBJECTIVE_LABELS, metaAdvertentiesPreview, BuilderSection, MetaBuilderChecklist, MetaAiBriefingInput, MetaAiCampaignBriefingDialog, MetaLocationEditor, CollapsibleCard, BuilderStepper, TogglePill, CheckRow, MetaPreview, ApprovalQueue, MetaOAuthScopesAlert } from "./meta-ads-studio-components";

export function MetaAdsPageInner() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  const { beginGeneration, isCurrentGeneration } = useMutationGeneration();
  const { branding } = useBranding();
  const pageAvatarUrl = branding.faviconUrl.trim() || branding.logoUrl.trim();

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [loadedPlanId, setLoadedPlanId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<BuilderStep>("campaign");
  const [adsTab, setAdsTab] = useState("campaigns");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [insightLevel, setInsightLevel] = useState<"campaign" | "adset" | "ad">("campaign");
  const [approvalFilter, setApprovalFilter] = useState<"ALL" | PlanStatus>("ALL");
  const [activeCreativeRef, setActiveCreativeRef] = useState<{ adsetId: string; variantId: string } | null>(null);

  const [name, setName] = useState("");
  const [objective, setObjective] = useState("OUTCOME_TRAFFIC");
  const [currency, setCurrency] = useState("EUR");
  const [dailyBudget, setDailyBudget] = useState("");
  const [lifetimeBudget, setLifetimeBudget] = useState("");
  const [campaignSpendCap, setCampaignSpendCap] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [bidStrategy, setBidStrategy] = useState<BidStrategy>("LOWEST_COST_WITHOUT_CAP");
  const [bidAmount, setBidAmount] = useState("");
  const [buyingType, setBuyingType] = useState("AUCTION");
  const [specialAdCategories, setSpecialAdCategories] = useState("");
  const [advertiserName, setAdvertiserName] = useState("");
  const [advertiserPayerDifferent, setAdvertiserPayerDifferent] = useState(false);
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("");
  const [aiTone, setAiTone] = useState<AiTone>("professioneel");
  const [aiCampaignDialogOpen, setAiCampaignDialogOpen] = useState(false);

  const [adName, setAdName] = useState("");
  const [primaryText, setPrimaryText] = useState("");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [displayUrl, setDisplayUrl] = useState("");
  const [feedImageUrl, setFeedImageUrl] = useState("");
  const [squareImageUrl, setSquareImageUrl] = useState("");
  const [storyImageUrl, setStoryImageUrl] = useState("");
  const [publishAsset, setPublishAsset] = useState<AssetSlot>("feed");
  const [ctaType, setCtaType] = useState("LEARN_MORE");
  const [ctaLabel, setCtaLabel] = useState("");
  const [urlTags, setUrlTags] = useState("");
  const [optimizationGoal, setOptimizationGoal] = useState<OptimizationGoal>("AUTO");
  const [destinationType, setDestinationType] = useState<DestinationType>("AUTO");
  const [billingEvent, setBillingEvent] = useState("IMPRESSIONS");
  const [pixelId, setPixelId] = useState("");
  const [customEventType, setCustomEventType] = useState("LEAD");
  const [adsets, setAdsets] = useState<AdsetDraft[]>([]);
  const [advancedCreativeJson, setAdvancedCreativeJson] = useState("{}");
  const [advancedTargetingJson, setAdvancedTargetingJson] = useState("{}");
  const [uploadingVariantAsset, setUploadingVariantAsset] = useState<string | null>(null);
  const [aiTrainingNotes, setAiTrainingNotes] = useState("");
  const leadId = searchParams.get("leadId");
  const seoContext = searchParams.get("seoContext");
  const seoTargetUrl = searchParams.get("targetUrl");
  const leadContext = trpc.lead.getById.useQuery({ id: leadId || "" }, { enabled: Boolean(leadId), staleTime: 120_000 });
  const [appliedLeadContext, setAppliedLeadContext] = useState<string | null>(null);

  const pendingAdJobId = searchParams.get("adJob");
  const targetCreativePlanId = searchParams.get("planId");
  const [appliedAdJobId, setAppliedAdJobId] = useState<string | null>(null);
  const importCreativeAd = trpc.media.importToBlob.useMutation();
  const creativeAdJob = trpc.media.getJobStatus.useQuery(
    { jobId: pendingAdJobId || "" },
    { enabled: Boolean(pendingAdJobId) && (!targetCreativePlanId || loadedPlanId === targetCreativePlanId) && appliedAdJobId !== pendingAdJobId },
  );

  useEffect(() => {
    if (!leadId || appliedLeadContext === leadId || !leadContext.data) return;
    const lead = leadContext.data;
    setProduct(lead.companyName || lead.industry || "");
    setAudience([lead.industry, lead.city].filter(Boolean).join(" · "));
    if (!name) setName(`${lead.companyName} campagne`);
    if (!linkUrl && lead.website) setLinkUrl(lead.website);
    setAppliedLeadContext(leadId);
    showToast({ title: "Leadcontext geladen", description: "De advertentiedraft gebruikt deze lead als briefing." });
  }, [leadId, appliedLeadContext, leadContext.data, name, linkUrl, showToast]);
  useEffect(() => {
    if (!seoContext) return;
    setProduct((current) => current || seoContext);
    setName((current) => current || `${seoContext} campagne`);
    setLinkUrl((current) => current || seoTargetUrl || "");
    setAdsTab("builder");
  }, [seoContext, seoTargetUrl]);

  const connection = trpc.metaAds.connectionStatus.useQuery(undefined, { refetchInterval: 30_000 });
  const metaAdAccountName = (connection.data?.selectedAdAccountName ?? "").trim();
  const metaPublisher = connection.data?.publisherIdentity;
  const facebookPublisherName = useMemo(
    () =>
      (metaPublisher?.facebookPublisherName ?? "").trim() ||
      metaAdAccountName ||
      branding.companyName.trim() ||
      "Facebook-pagina",
    [metaPublisher?.facebookPublisherName, metaAdAccountName, branding.companyName],
  );
  const instagramPublisherName = useMemo(
    () => (metaPublisher?.instagramPublisherName ?? "").trim() || facebookPublisherName,
    [metaPublisher?.instagramPublisherName, facebookPublisherName],
  );
  const metaHasInstagram = Boolean(metaPublisher?.hasInstagram);
  const aiTrainingNotesQuery = trpc.metaAds.getAiTrainingNotes.useQuery();
  const updateAiTrainingNotes = trpc.metaAds.updateAiTrainingNotes.useMutation({
    onSuccess: async () => {
      await aiTrainingNotesQuery.refetch();
      showToast({ title: "AI-training opgeslagen" });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });
  const adAccounts = trpc.metaAds.listAdAccounts.useQuery(undefined, { enabled: Boolean(connection.data?.connected) });
  const campaigns = trpc.metaAds.listCampaigns.useQuery(undefined, {
    enabled: Boolean(connection.data?.selectedAdAccountId),
    refetchInterval: 60_000,
  });
  const insights = trpc.metaAds.listInsights.useQuery({ datePreset: "last_30d", level: insightLevel }, {
    enabled: Boolean(connection.data?.selectedAdAccountId),
    refetchInterval: 60_000,
  });
  const campaignDetails = trpc.metaAds.getCampaignDetails.useQuery(
    { campaignId: selectedCampaignId || "" },
    { enabled: Boolean(selectedCampaignId && connection.data?.selectedAdAccountId) },
  );
  const drafts = trpc.metaAds.listDrafts.useQuery(undefined, { refetchInterval: 20_000 });

  useEffect(() => {
    if (!pendingAdJobId || appliedAdJobId === pendingAdJobId || !creativeAdJob.data) return;
    const status = creativeAdJob.data;
    if (status.status !== "COMPLETED" || (!status.outputUrl && !status.blobUrl)) return;

    let cancelled = false;

    async function applyCreativeAdJob() {
      try {
        let mediaUrl = status.blobUrl || status.outputUrl;
        if (!mediaUrl) return;

        if (!status.blobUrl) {
          const imported = await importCreativeAd.mutateAsync({ jobId: pendingAdJobId! });
          mediaUrl = imported.blobUrl || mediaUrl;
        }

        if (cancelled) return;
        const metadata = status.metadata as Record<string, unknown> | null;
        const poster = status.type === "IMAGE" ? mediaUrl : typeof metadata?.imageUrl === "string" ? metadata.imageUrl : Array.isArray(metadata?.imagesList) ? String(metadata.imagesList[0] || "") : "";
        const variant = { ...createCreativeVariant("Creative Studio"), primaryText: status.prompt || "", videoUrl: status.type === "IMAGE" ? "" : mediaUrl, feedImageUrl: poster, squareImageUrl: poster, storyImageUrl: poster };
        const fresh = { ...createAdset("Creative Studio"), variants: [variant] };
        setAdsets(current => current.length ? current.map((adset,index) => index === 0 ? {...adset,variants:[...adset.variants,variant]} : adset) : [fresh]);
        setAdsTab("builder");
        setActiveStep("ads");
        setAppliedAdJobId(pendingAdJobId);
        showToast({ title: "Creative Studio-advertentie geladen in builder" });
      } catch (error) {
        if (!cancelled) {
          showToast({
            title: "Advertentie laden mislukt",
            description: error instanceof Error ? error.message : "Onbekende fout",
            variant: "error",
          });
        }
      }
    }

    void applyCreativeAdJob();
    return () => {
      cancelled = true;
    };
  }, [
    appliedAdJobId,
    creativeAdJob.data,
    importCreativeAd,
    pendingAdJobId,
    showToast,
  ]);

  const rows = useMemo(() => drafts.data ?? [], [drafts.data]);
  const pendingApprovalCount = useMemo(
    () => rows.filter((row: { status: string }) => row.status === "PENDING_APPROVAL").length,
    [rows],
  );
  const filteredRows = approvalFilter === "ALL" ? rows : rows.filter((row: any) => row.status === approvalFilter);
  useEffect(()=>{if(targetCreativePlanId && rows.some((row:{id:string})=>row.id === targetCreativePlanId)) {setSelectedPlanId(targetCreativePlanId);setAdsTab("builder");}},[targetCreativePlanId,rows]);
  const selectedPlan = selectedPlanId ? rows.find((row: any) => row.id === selectedPlanId) || null : null;
  const totalSpend = useMemo(() => (insights.data || []).reduce((sum: number, row: any) => sum + Number(row.spend || 0), 0), [insights.data]);
  const totalClicks = useMemo(() => (insights.data || []).reduce((sum: number, row: any) => sum + Number(row.clicks || 0), 0), [insights.data]);

  const selectedPlacements = useMemo(
    () => [...new Set(adsets.flatMap((adset) => adset.placements))] as PlacementKey[],
    [adsets],
  );
  const totalVariants = useMemo(() => adsets.reduce((sum, adset) => sum + adset.variants.length, 0), [adsets]);
  const activeVariant = useMemo(() => {
    if (activeCreativeRef) {
      const activeAdset = adsets.find((item) => item.id === activeCreativeRef.adsetId);
      const variant = activeAdset?.variants.find((item) => item.id === activeCreativeRef.variantId);
      if (variant) return variant;
    }
    return adsets[0]?.variants[0] || null;
  }, [activeCreativeRef, adsets]);
  const previewCreative = useMemo(
    () =>
      mergeVariantWithBase(
        {
          adName,
          primaryText,
          headline,
          description,
          linkUrl,
          displayUrl,
          feedImageUrl,
          squareImageUrl,
          storyImageUrl,
          publishAsset,
          ctaType,
          ctaLabel,
          urlTags,
        },
        activeVariant,
        { inheritAssets: false, inheritCopy: false },
      ),
    [adName, primaryText, headline, description, linkUrl, displayUrl, feedImageUrl, squareImageUrl, storyImageUrl, publishAsset, ctaType, ctaLabel, urlTags, activeVariant],
  );
  const primaryPublishImage = resolvePublishImage(publishAsset, { feedImageUrl, squareImageUrl, storyImageUrl });
  const campaignNameConflict = useMemo(() => {
    const normalized = normalizeCampaignNameKey(name);
    if (normalized.length < 2) return null;

    const planConflict = rows.find(
      (row: { id: string; name: string; status: string }) =>
        row.status !== "CANCELLED" &&
        row.id !== selectedPlan?.id &&
        normalizeCampaignNameKey(row.name) === normalized,
    );
    if (planConflict) {
      return `Er bestaat al een campagne met de naam "${planConflict.name}" (${metaPlanStatusLabelClient(planConflict.status)}).`;
    }

    const linkedCampaignId = String(asRecord(selectedPlan?.externalIds).campaignId || "");
    const liveCampaigns = campaigns.data ?? [];
    const liveConflict = liveCampaigns.find(
      (campaign) =>
        normalizeCampaignNameKey(String(campaign.name ?? "")) === normalized &&
        String(campaign.id ?? "") !== linkedCampaignId,
    );
    if (liveConflict) {
      return `Er staat al een live Meta-campagne met de naam "${String(liveConflict.name || name.trim())}".`;
    }

    return null;
  }, [name, rows, campaigns.data, selectedPlan]);
  const canSaveDraft = Boolean(name.trim().length >= 2 && !campaignNameConflict);
  const campaignComplete = Boolean(name.trim() && objective && buyingType.trim() && (numberValue(dailyBudget) >= 100 || numberValue(lifetimeBudget) >= 100));
  const adsetsComplete = Boolean(
    adsets.length &&
      adsets.every(
        (adset) =>
          adsetHasGeoTargeting(adset) &&
          numberValue(adset.ageMin) >= 13 &&
          numberValue(adset.ageMax) >= numberValue(adset.ageMin) &&
          adset.placements.length,
      ),
  );
  const adsComplete = Boolean(
    Boolean(metaAdAccountName || connection.data?.socialConnected) &&
      adsets.length &&
      adsets.every((adset) =>
        adset.variants.length &&
        adset.variants.every((variant) => {
          const merged = mergeVariantWithBase(
            {
              adName,
              primaryText,
              headline,
              description,
              linkUrl,
              displayUrl,
              feedImageUrl,
              squareImageUrl,
              storyImageUrl,
              publishAsset,
              ctaType,
              ctaLabel,
              urlTags,
            },
            variant,
            { inheritAssets: false, inheritCopy: false },
          );
          const resolvedImage = resolvePublishImage(merged.publishAsset, {
            feedImageUrl: merged.feedImageUrl,
            squareImageUrl: merged.squareImageUrl,
            storyImageUrl: merged.storyImageUrl,
          });
          const adsetNeedsStoryImage = adset.placements.some((placement) => ["facebook_story", "facebook_reels", "instagram_story", "instagram_reels"].includes(placement));
          return Boolean(
            merged.primaryText.trim() &&
              merged.headline.trim() &&
              merged.linkUrl.trim().startsWith("https://") &&
              (resolvedImage.trim() || merged.videoUrl) &&
              (!adsetNeedsStoryImage || merged.storyImageUrl.trim() || merged.videoUrl),
          );
        }),
      ),
  );
  const readyToSave = campaignComplete && adsetsComplete && adsComplete;
  const activeStepIndex = BUILDER_STEP_ORDER.indexOf(activeStep);
  const activeStepMeta = STEPS[activeStepIndex];
  const builderCompletionPercent = useMemo(() => {
    let completed = 0;
    if (campaignComplete) completed += 1;
    if (adsetsComplete) completed += 1;
    if (adsComplete) completed += 1;
    if (readyToSave) completed += 1;
    return Math.round((completed / BUILDER_STEP_ORDER.length) * 100);
  }, [campaignComplete, adsetsComplete, adsComplete, readyToSave]);
  const dailyBudgetEur = eur(numberValue(dailyBudget), currency);
  const lifetimeBudgetEur = lifetimeBudget.trim() ? eur(numberValue(lifetimeBudget), currency) : null;

  function isStepComplete(step: BuilderStep) {
    if (step === "campaign") return campaignComplete;
    if (step === "adsets") return adsetsComplete;
    if (step === "ads") return adsComplete;
    if (step === "review") return readyToSave;
    return false;
  }

  const studioStepTodos = useMemo(() => {
    const campaign: string[] = [];
    if (!name.trim()) campaign.push("Vul een campagnenaam in.");
    if (!objective) campaign.push("Kies een campagne-doelstelling (objective).");
    if (!buyingType.trim()) campaign.push("Stel het buying type in.");
    if (numberValue(dailyBudget) < 100 && numberValue(lifetimeBudget) < 100) {
      campaign.push("Budget: minimaal €1,00 dagbudget of lifetime budget.");
    }

    const adsetTodos: string[] = [];
    if (!adsets.length) {
      adsetTodos.push("Voeg minstens één advertentieset toe.");
    } else {
      adsets.forEach((adset, index) => {
        const label = adset.name.trim() || `Ad set ${index + 1}`;
        if (!adsetHasGeoTargeting(adset)) adsetTodos.push(`${label}: kies land, regio of stad.`);
        if (numberValue(adset.ageMin) < 13) adsetTodos.push(`${label}: minimumleeftijd minstens 13.`);
        if (numberValue(adset.ageMax) < numberValue(adset.ageMin)) {
          adsetTodos.push(`${label}: max. leeftijd moet ≥ min. leeftijd zijn.`);
        }
        if (!adset.placements.length) adsetTodos.push(`${label}: selecteer minstens één placement.`);
        if (!adset.variants.length) adsetTodos.push(`${label}: voeg minstens één advertentievariant toe.`);
      });
    }

    const adsTodos: string[] = [];
    if (!metaAdAccountName && !connection.data?.socialConnected) {
      adsTodos.push("Koppel een Meta-ad account of pagina (Instellingen).");
    }
    if (!adsets.length) {
      adsTodos.push("Maak eerst een advertentieset aan.");
    } else {
      adsets.forEach((adset, adsetIndex) => {
        const adsetLabel = adset.name.trim() || `Ad set ${adsetIndex + 1}`;
        const needsStory = adset.placements.some((placement) =>
          ["facebook_story", "facebook_reels", "instagram_story", "instagram_reels"].includes(placement),
        );
        adset.variants.forEach((variant, variantIndex) => {
          const variantLabel = variant.name.trim() || variant.adName.trim() || `Variant ${variantIndex + 1}`;
          const prefix = `${adsetLabel} · ${variantLabel}`;
          const merged = mergeVariantWithBase(
            {
              adName,
              primaryText,
              headline,
              description,
              linkUrl,
              displayUrl,
              feedImageUrl,
              squareImageUrl,
              storyImageUrl,
              publishAsset,
              ctaType,
              ctaLabel,
              urlTags,
            },
            variant,
            { inheritAssets: false, inheritCopy: false },
          );
          if (!merged.primaryText.trim()) adsTodos.push(`${prefix}: primaire tekst ontbreekt.`);
          if (!merged.headline.trim()) adsTodos.push(`${prefix}: headline ontbreekt.`);
          if (!merged.linkUrl.trim().startsWith("https://")) adsTodos.push(`${prefix}: link moet met https:// beginnen.`);
          const image = resolvePublishImage(merged.publishAsset, {
            feedImageUrl: merged.feedImageUrl,
            squareImageUrl: merged.squareImageUrl,
            storyImageUrl: merged.storyImageUrl,
          });
          if (!image.trim() && !merged.videoUrl) adsTodos.push(`${prefix}: upload een publish-beeld.`);
          if (needsStory && !merged.storyImageUrl.trim() && !merged.videoUrl) {
            adsTodos.push(`${prefix}: story/reels-plaatsing vereist 9:16-beeld.`);
          }
        });
      });
    }

    return { campaign, adsets: adsetTodos, ads: adsTodos };
  }, [
    adName,
    adsets,
    buyingType,
    connection.data?.socialConnected,
    ctaLabel,
    ctaType,
    dailyBudget,
    description,
    displayUrl,
    feedImageUrl,
    headline,
    lifetimeBudget,
    linkUrl,
    metaAdAccountName,
    name,
    objective,
    primaryText,
    publishAsset,
    squareImageUrl,
    storyImageUrl,
    urlTags,
  ]);
  const operationalRequirements = useMemo(
    () =>
      [...new Set((connection.data?.missingOperationalRequirements || []) as string[])].map(describeOperationalRequirement),
    [connection.data?.missingOperationalRequirements],
  );
  const insightCoach = useMemo(
    () => buildInsightCoachRows((insights.data || []) as any[], insightLevel),
    [insights.data, insightLevel],
  );
  const editorScoreInput = useMemo(() => {
    const variantBase = {
      adName,
      primaryText,
      headline,
      description,
      linkUrl,
      displayUrl,
      feedImageUrl,
      squareImageUrl,
      storyImageUrl,
      publishAsset,
      ctaType,
      ctaLabel,
      urlTags,
    };
    const firstVariantForScore = adsets[0]?.variants[0]
      ? mergeVariantWithBase(variantBase, adsets[0].variants[0], { inheritAssets: false, inheritCopy: false })
      : variantBase;
    return {
      name,
      dailyBudget,
      lifetimeBudget,
      primaryText: firstVariantForScore.primaryText,
      headline: firstVariantForScore.headline,
      description: firstVariantForScore.description,
      linkUrl: firstVariantForScore.linkUrl,
      feedImageUrl: firstVariantForScore.feedImageUrl,
      squareImageUrl: firstVariantForScore.squareImageUrl,
      storyImageUrl: firstVariantForScore.storyImageUrl,
      publishAsset: firstVariantForScore.publishAsset,
      pixelId,
      objective,
      adsets: adsets.map((adset) => ({
        customAudiencesText: adset.customAudiencesText,
        notes: adset.notes,
        variants: adset.variants.map((variant) => {
          const merged = mergeVariantWithBase(variantBase, variant, { inheritAssets: false, inheritCopy: false });
          return {
            primaryText: merged.primaryText,
            headline: merged.headline,
            linkUrl: merged.linkUrl,
            feedImageUrl: merged.feedImageUrl,
            squareImageUrl: merged.squareImageUrl,
            storyImageUrl: merged.storyImageUrl,
          };
        }),
      })),
    };
  }, [
    adName,
    primaryText,
    headline,
    description,
    linkUrl,
    displayUrl,
    feedImageUrl,
    squareImageUrl,
    storyImageUrl,
    publishAsset,
    ctaType,
    ctaLabel,
    urlTags,
    name,
    dailyBudget,
    lifetimeBudget,
    objective,
    pixelId,
    adsets,
  ]);

  const score = useMemo(() => buildCampaignScore(editorScoreInput), [editorScoreInput]);

  const campaignScoreEntries = useMemo(
    () =>
      buildCampaignScoreEntries({
        draftPlans: rows,
        liveCampaigns: campaigns.data || [],
      }),
    [rows, campaigns.data],
  );

  function openScoredPlan(planId: string) {
    setSelectedPlanId(planId);
    setLoadedPlanId(null);
    setAdsTab("builder");
    setActiveStep("review");
  }

  function openDraftForEditing(planId: string, step: BuilderStep = "campaign") {
    setSelectedPlanId(planId);
    setLoadedPlanId(null);
    setAdsTab("builder");
    setActiveStep(step);
    showToast({ title: "Draft geopend in Studio" });
  }

  function openLiveCampaign(campaignId: string) {
    setSelectedCampaignId(campaignId);
    setAdsTab("campaigns");
  }

  function openLiveCampaignAsDraft() {
    const details = asRecord(campaignDetails.data);
    const campaign = asRecord(details.campaign);
    if (!campaign.id && !campaign.name) {
      showToast({ title: "Geen campagne geselecteerd", description: "Selecteer eerst een live Meta campagne.", variant: "error" });
      return;
    }

    const importedAdsets = Array.isArray(details.adsets) && details.adsets.length
      ? details.adsets.map((adset: any, index: number) => liveAdsetToDraft(asRecord(adset), index))
      : [createAdset("Geimporteerde doelgroep", `live-${String(campaign.id || Date.now())}-adset-1`)];
    const firstVariant = importedAdsets[0]?.variants[0];

    setSelectedPlanId(`__meta_live_import_${String(campaign.id || Date.now())}`);
    setLoadedPlanId(null);
    setName(`${String(campaign.name || "Meta campagne")} (bewerking)`);
    setObjective(String(campaign.objective || "OUTCOME_TRAFFIC"));
    setCurrency(connection.data?.defaultCurrency || currency || "EUR");
    setDailyBudget(campaign.daily_budget ? String(campaign.daily_budget) : "");
    setLifetimeBudget(String(campaign.lifetime_budget || ""));
    setStartTime("");
    setEndTime("");
    setBuyingType(String(campaign.buying_type || "AUCTION"));
    setCampaignSpendCap("");
    setSpecialAdCategories("");
    setAdvertiserName(advertiserName || facebookPublisherName || "");
    setAdvertiserPayerDifferent(false);
    setOptimizationGoal("AUTO");
    setDestinationType("AUTO");
    setBillingEvent("IMPRESSIONS");
    setAdsets(importedAdsets);
    setActiveCreativeRef(firstVariant ? { adsetId: importedAdsets[0].id, variantId: firstVariant.id } : null);
    if (firstVariant) {
      setAdName(firstVariant.adName);
      setPrimaryText(firstVariant.primaryText);
      setHeadline(firstVariant.headline);
      setDescription(firstVariant.description);
      setLinkUrl(firstVariant.linkUrl || "");
      setDisplayUrl(firstVariant.displayUrl || "");
      setCtaType(firstVariant.ctaType || "LEARN_MORE");
      setCtaLabel(firstVariant.ctaLabel || "");
      setUrlTags(firstVariant.urlTags || "");
      setPublishAsset(firstVariant.publishAsset || "feed");
      setFeedImageUrl("");
      setSquareImageUrl("");
      setStoryImageUrl("");
    }
    setAdvancedCreativeJson("{}");
    setAdvancedTargetingJson("{}");
    setAdsTab("builder");
    setActiveStep("campaign");
    showToast({ title: "Live Meta campagne als draft geopend", description: "Controleer vooral afbeeldingen per Ad voordat je opslaat." });
  }

  function canOpenStep(step: BuilderStep) {
    if (step === "campaign") return true;
    if (step === "adsets") return campaignComplete;
    if (step === "ads") return campaignComplete && adsetsComplete;
    if (step === "review") return campaignComplete && adsetsComplete && adsComplete;
    return false;
  }

  useEffect(() => {
    if (aiTrainingNotesQuery.data?.notes !== undefined) setAiTrainingNotes(aiTrainingNotesQuery.data.notes);
  }, [aiTrainingNotesQuery.data?.notes]);

  useEffect(() => {
    if (selectedPlanId || loadedPlanId) return;
    const accountCurrency = connection.data?.defaultCurrency;
    if (accountCurrency) setCurrency(accountCurrency);
  }, [connection.data?.defaultCurrency, selectedPlanId, loadedPlanId]);

  useEffect(() => {
    if (!selectedPlan || selectedPlan.id === loadedPlanId) return;

    const creative = asRecord(selectedPlan.creatives);
    const targeting = asRecord(selectedPlan.targeting);
    const campaignSettings = asRecord(targeting.campaignSettings);

    setName(selectedPlan.name || "");
    setObjective(selectedPlan.objective || "OUTCOME_TRAFFIC");
    setCurrency(selectedPlan.currency || connection.data?.defaultCurrency || "EUR");
    setDailyBudget(selectedPlan.dailyBudgetCents ? String(selectedPlan.dailyBudgetCents) : "");
    setLifetimeBudget(String(selectedPlan.lifetimeBudgetCents || ""));
    setStartTime(selectedPlan.startTime ? new Date(selectedPlan.startTime).toISOString().slice(0, 16) : "");
    setEndTime(selectedPlan.endTime ? new Date(selectedPlan.endTime).toISOString().slice(0, 16) : "");
    setBidStrategy((campaignSettings.bidStrategy || "LOWEST_COST_WITHOUT_CAP") as BidStrategy);
    setBidAmount(String(campaignSettings.bidAmount || ""));
    setBuyingType(String(campaignSettings.buyingType || "AUCTION"));
    setCampaignSpendCap(String(campaignSettings.campaignSpendCap || ""));
    setSpecialAdCategories(Array.isArray(campaignSettings.specialAdCategories) ? campaignSettings.specialAdCategories.join(", ") : "");
    setAdvertiserName(String(campaignSettings.advertiserName || creative.pageName || ""));
    setAdvertiserPayerDifferent(Boolean(campaignSettings.advertiserPayerDifferent));
    setAiTone((creative.aiTone || "professioneel") as AiTone);
    const aiBrief = asRecord(creative.aiBrief);
    if (aiBrief.product) setProduct(String(aiBrief.product));
    if (aiBrief.audience) setAudience(String(aiBrief.audience));

    setAdName(String(creative.adName || ""));
    setPrimaryText(String(creative.message || creative.primaryText || ""));
    setHeadline(String(creative.headline || creative.name || ""));
    setDescription(String(creative.description || ""));
    setLinkUrl(String(creative.linkUrl || creative.url || ""));
    setDisplayUrl(String(creative.displayUrl || ""));
    setFeedImageUrl(String(creative.feedImageUrl || creative.imageUrl || ""));
    setSquareImageUrl(String(creative.squareImageUrl || ""));
    setStoryImageUrl(String(creative.storyImageUrl || ""));
    setPublishAsset((creative.publishAsset || "feed") as AssetSlot);
    setCtaType(String(creative.ctaType || "LEARN_MORE"));
    setCtaLabel(String(creative.cta || creative.ctaLabel || ""));
    setUrlTags(String(creative.urlTags || ""));

    setOptimizationGoal((campaignSettings.optimizationGoal || "AUTO") as OptimizationGoal);
    setDestinationType((campaignSettings.destinationType || "AUTO") as DestinationType);
    setBillingEvent(String(campaignSettings.billingEvent || "IMPRESSIONS"));
    setPixelId(String(campaignSettings.pixelId || ""));
    setCustomEventType(String(campaignSettings.customEventType || "LEAD"));

    const rootVariantFallback = {
      adName: String(creative.adName || ""),
      primaryText: String(creative.message || creative.primaryText || ""),
      headline: String(creative.headline || creative.name || ""),
      description: String(creative.description || ""),
      linkUrl: String(creative.linkUrl || creative.url || ""),
      displayUrl: String(creative.displayUrl || ""),
      feedImageUrl: String(creative.feedImageUrl || creative.imageUrl || ""),
      squareImageUrl: String(creative.squareImageUrl || ""),
      storyImageUrl: String(creative.storyImageUrl || ""),
      publishAsset: (creative.publishAsset || "feed") as AssetSlot,
      ctaType: String(creative.ctaType || "LEARN_MORE"),
      ctaLabel: String(creative.cta || creative.ctaLabel || ""),
      urlTags: String(creative.urlTags || ""),
      angle: "",
    };
    const creativeGroups = Array.isArray(creative.adsets) ? creative.adsets : [];
    const adsetRows = (Array.isArray(targeting.adsets) && targeting.adsets.length
      ? targeting.adsets.map((item: any, index: number) => {
          const adsetId = String(asRecord(item).id || `loaded-adset-${index + 1}`);
          const group = creativeGroups.find((entry: any) => String(asRecord(entry).adsetId || "") === adsetId) || creativeGroups[index];
          const variants = Array.isArray(asRecord(group).variants) && asRecord(group).variants.length
            ? asRecord(group).variants.map((variant: any, variantIndex: number) => {
                const variantRecord = asRecord(variant);
                return {
                  ...createCreativeVariant(`Variant ${variantIndex + 1}`, String(variantRecord.id || `${adsetId}-variant-${variantIndex + 1}`)),
                  name: String(variantRecord.name || variantRecord.adName || `Variant ${variantIndex + 1}`),
                  adName: String(variantRecord.adName || variantRecord.name || rootVariantFallback.adName || `Variant ${variantIndex + 1}`),
                  primaryText: String(variantRecord.primaryText || variantRecord.message || rootVariantFallback.primaryText),
                  headline: String(variantRecord.headline || rootVariantFallback.headline),
                  description: String(variantRecord.description || rootVariantFallback.description),
                  linkUrl: String(variantRecord.linkUrl || variantRecord.url || rootVariantFallback.linkUrl),
                  displayUrl: String(variantRecord.displayUrl || rootVariantFallback.displayUrl),
                  feedImageUrl: String(variantRecord.feedImageUrl || variantRecord.imageUrl || rootVariantFallback.feedImageUrl),
                  squareImageUrl: String(variantRecord.squareImageUrl || rootVariantFallback.squareImageUrl),
                  videoUrl: String(variantRecord.videoUrl || ""),
                  storyImageUrl: String(variantRecord.storyImageUrl || rootVariantFallback.storyImageUrl),
                  publishAsset: (variantRecord.publishAsset || rootVariantFallback.publishAsset) as AssetSlot,
                  ctaType: String(variantRecord.ctaType || rootVariantFallback.ctaType),
                  ctaLabel: String(variantRecord.ctaLabel || variantRecord.cta || rootVariantFallback.ctaLabel),
                  urlTags: String(variantRecord.urlTags || rootVariantFallback.urlTags),
                  angle: String(variantRecord.angle || ""),
                };
              })
            : [{ ...createCreativeVariant("Variant 1", `${adsetId}-variant-1`), ...rootVariantFallback, name: rootVariantFallback.adName || "Variant 1" }];
          return {
            ...targetingToAdset(asRecord(item), String(asRecord(item).name || `Doelgroep ${index + 1}`), adsetId),
            variants,
          };
        })
      : []) as AdsetDraft[];
    setAdsets(adsetRows);
    setActiveCreativeRef(adsetRows[0]?.variants[0] ? { adsetId: adsetRows[0].id, variantId: adsetRows[0].variants[0].id } : null);

    setAdvancedCreativeJson("{}");
    setAdvancedTargetingJson("{}");
    setLoadedPlanId(selectedPlan.id);
  }, [selectedPlan, loadedPlanId, connection.data?.defaultCurrency]);

  useEffect(() => {
    if (selectedCampaignId || !(campaigns.data || []).length) return;
    const first = (campaigns.data || [])[0] as any;
    if (first?.id) setSelectedCampaignId(String(first.id));
  }, [campaigns.data, selectedCampaignId]);

  const invalidate = async () => {
    await Promise.all([
      utils.metaAds.connectionStatus.invalidate(),
      utils.metaAds.listDrafts.invalidate(),
      utils.metaAds.listCampaigns.invalidate(),
      utils.metaAds.getInsights.invalidate(),
      utils.metaAds.listInsights.invalidate(),
      utils.metaAds.getCampaignDetails.invalidate(),
      utils.metaAds.listAdAccounts.invalidate(),
    ]);
  };

  function resetBuilderForNewCampaign() {
    setSelectedPlanId(null);
    setLoadedPlanId(null);
    setActiveStep("campaign");
    setActiveCreativeRef(null);
    setName("");
    setObjective("OUTCOME_TRAFFIC");
    setCurrency(connection.data?.defaultCurrency || "EUR");
    setDailyBudget("");
    setLifetimeBudget("");
    setCampaignSpendCap("");
    setStartTime("");
    setEndTime("");
    setBidStrategy("LOWEST_COST_WITHOUT_CAP");
    setBidAmount("");
    setBuyingType("AUCTION");
    setSpecialAdCategories("");
    setAdvertiserName("");
    setAdvertiserPayerDifferent(false);
    setProduct("");
    setAudience("");
    setAiTone("professioneel");
    setAdName("");
    setPrimaryText("");
    setHeadline("");
    setDescription("");
    setLinkUrl("");
    setDisplayUrl("");
    setFeedImageUrl("");
    setSquareImageUrl("");
    setStoryImageUrl("");
    setPublishAsset("feed");
    setCtaType("LEARN_MORE");
    setCtaLabel("");
    setUrlTags("");
    setOptimizationGoal("AUTO");
    setDestinationType("AUTO");
    setBillingEvent("IMPRESSIONS");
    setPixelId("");
    setCustomEventType("LEAD");
    setAdsets([]);
    setAdvancedCreativeJson("{}");
    setAdvancedTargetingJson("{}");
  }

  function startNewCampaign() {
    resetBuilderForNewCampaign();
    setAdsTab("builder");
    showToast({ title: "Nieuwe campagne", description: "Vul campagne, advertentieset en advertenties stap voor stap in." });
  }

  function getMetaAiProductInput(): string | null {
    const trimmedProduct = product.trim();
    if (trimmedProduct.length >= 2) return trimmedProduct;
    setAiCampaignDialogOpen(true);
    showToast({
      title: "Beschrijf je aanbod eerst",
      description: "Vul product of aanbod in de AI-briefing (min. 2 tekens).",
      variant: "error",
    });
    return null;
  }

  function openAiCampaignDialog() {
    setAiCampaignDialogOpen(true);
  }

  const createDraft = trpc.metaAds.createDraft.useMutation({
    onSuccess: async (row) => {
      await invalidate();
      setSelectedPlanId(row.id);
      setLoadedPlanId(row.id);
      showToast({
        title: "Meta Ads draft aangemaakt",
        description: "Je campagne is opgeslagen — je kunt verder bouwen wanneer je wilt.",
      });
    },
    onError: (error) => showToast({ title: "Draft mislukt", description: explainMetaError(error.message)?.message || error.message, variant: "error" }),
  });
  const updateDraft = trpc.metaAds.updateDraft.useMutation({
    onSuccess: async (row) => {
      await invalidate();
      setSelectedPlanId(row.id);
      setLoadedPlanId(row.id);
      showToast({
        title: "Draft opgeslagen",
        description: "Je wijzigingen zijn bewaard — je kunt verder bouwen wanneer je wilt.",
      });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: explainMetaError(error.message)?.message || error.message, variant: "error" }),
  });
  const generateSuggestion = trpc.metaAds.generateSuggestion.useMutation({
    onError: (error) =>
      showToast({ title: "Suggestie mislukt", description: trpcErrorDescription(error.message), variant: "error" }),
  });
  const generateVariantSuggestion = trpc.metaAds.generateVariantSuggestion.useMutation({
    onError: (error) =>
      showToast({ title: "Variant suggestie mislukt", description: trpcErrorDescription(error.message), variant: "error" }),
  });
  const submitForApproval = trpc.metaAds.submitForApproval.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Indienen mislukt", description: e.message, variant: "error" }) });
  const approveDraft = trpc.metaAds.approveDraft.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Goedkeuren mislukt", description: e.message, variant: "error" }) });
  const approvalActionPending = submitForApproval.isPending || approveDraft.isPending;

  function applyMetaSuggestionSuccess(payload: any) {
    setAiCampaignDialogOpen(false);
    setName(payload.name || name);
    setObjective(payload.objective || objective);
    setPrimaryText(payload.primaryText || primaryText);
    setHeadline(payload.headline || headline);
    setDescription(payload.description || description);
    setCtaType(payload.ctaType || "LEARN_MORE");
    setCtaLabel(String(payload.ctaLabel || ""));
    if (payload.linkUrl) setLinkUrl(String(payload.linkUrl));
    const targeting = asRecord(payload.targeting);
    const firstAiAd = {
      ...createCreativeVariant("AI advertentie 1", "ai-adset-1-variant-1"),
      name: String(payload.headline || payload.adName || "AI advertentie 1"),
      adName: String(payload.adName || payload.headline || "AI advertentie 1"),
      primaryText: String(payload.primaryText || ""),
      headline: String(payload.headline || ""),
      description: String(payload.description || ""),
      linkUrl: String(payload.linkUrl || ""),
      displayUrl: String(payload.displayUrl || ""),
      ctaType: String(payload.ctaType || "LEARN_MORE"),
      ctaLabel: String(payload.ctaLabel || ctaLabelFromType(String(payload.ctaType || "LEARN_MORE"))),
      urlTags,
    };
    const aiAdsets = Array.isArray(targeting.adsets) && targeting.adsets.length
      ? targeting.adsets.map((item: any, index: number) => ({
          ...targetingToAdset(asRecord(item), String(asRecord(item).name || `AI doelgroep ${index + 1}`), `ai-adset-${index + 1}`),
          variants: [{ ...firstAiAd, id: `ai-adset-${index + 1}-variant-1` }],
        }))
      : [{ ...targetingToAdset(targeting, "AI doelgroep 1", "ai-adset-1"), variants: [firstAiAd] }];
    setAdsets(aiAdsets);
    setActiveCreativeRef(aiAdsets[0]?.variants[0] ? { adsetId: aiAdsets[0].id, variantId: aiAdsets[0].variants[0].id } : null);
    if (payload.linkUrl) {
      const host = String(payload.linkUrl).replace(/^https?:\/\//, "").split("/")[0] || "";
      if (host && !displayUrl.trim()) setDisplayUrl(host);
    }
    setActiveStep(aiAdsets.length ? "adsets" : "campaign");
    const aiUsed = payload.provider !== "fallback" && payload.model !== "none";
    showToast({
      title: aiUsed ? "AI campagnevoorstel gegenereerd" : "Basisvoorstel geladen",
      description: payload.imageBrief
        ? `Visual tip: ${String(payload.imageBrief).slice(0, 120)}`
        : aiUsed
          ? "Controleer campagne, advertentiesets en vul daarna beelden in bij Advertenties."
          : "AI was niet beschikbaar — controleer en vul velden handmatig aan.",
      variant: aiUsed ? "success" : "error",
    });
  }

  function handleMetaAiSuggestion(brief?: MetaAiBriefingInput) {
    const trimmedProduct = brief?.product.trim() || getMetaAiProductInput();
    if (!trimmedProduct) return;
    if (brief) {
      setProduct(brief.product);
      setAudience(brief.audience);
      setAiTone(brief.tone);
    }
    const gen = beginGeneration();
    generateSuggestion.mutate(
      {
        product: trimmedProduct,
        audience: (brief?.audience ?? audience).trim() || undefined,
        tone: brief?.tone ?? aiTone,
        leadId: leadId || undefined,
      },
      {
        onSuccess: (payload) => {
          if (!isCurrentGeneration(gen)) return;
          applyMetaSuggestionSuccess(payload);
        },
      },
    );
  }

  const pushPaused = trpc.metaAds.pushPausedToMeta.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Push mislukt", description: explainMetaError(e.message)?.message || e.message, variant: "error" }) });
  const retryFailed = trpc.metaAds.retryFailed.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Retry mislukt", description: e.message, variant: "error" }) });
  const reconcilePush = trpc.metaAds.reconcilePush.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Controle mislukt", description: e.message, variant: "error" }) });
  const rejectDraft = trpc.metaAds.rejectDraft.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Afkeuren mislukt", description: e.message, variant: "error" }) });
  const cancelDraft = trpc.metaAds.cancelDraft.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Annuleren mislukt", description: e.message, variant: "error" }) });
  const duplicateDraft = trpc.metaAds.duplicateDraft.useMutation({ onSuccess: async (row: any) => { setSelectedPlanId(row.id); setLoadedPlanId(null); await invalidate(); showToast({ title: "Draft gedupliceerd" }); }, onError: (e) => showToast({ title: "Dupliceren mislukt", description: e.message, variant: "error" }) });
  const archiveDraft = trpc.metaAds.archiveDraft.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Archiveren mislukt", description: e.message, variant: "error" }) });
  const syncCampaigns = trpc.metaAds.syncMetaCampaigns.useMutation({ onSuccess: async () => { await invalidate(); showToast({ title: "Meta campagnes gesynchroniseerd" }); }, onError: (e) => showToast({ title: "Sync mislukt", description: e.message, variant: "error" }) });
  const pauseCampaign = trpc.metaAds.pauseInMeta.useMutation({ onSuccess: async () => { await invalidate(); showToast({ title: "Pauzevoorstel aangemaakt", description: "Open Goedkeuring om dit naar Meta door te zetten." }); }, onError: (e) => showToast({ title: "Pauzevoorstel mislukt", description: e.message, variant: "error" }) });
  const resumeCampaign = trpc.metaAds.resumeInMeta.useMutation({ onSuccess: async () => { await invalidate(); showToast({ title: "Voorstel om te hervatten aangemaakt", description: "Open Goedkeuring om dit naar Meta door te zetten." }); }, onError: (e) => showToast({ title: "Hervatvoorstel mislukt", description: e.message, variant: "error" }) });
  const selectAdAccount = trpc.metaAds.selectAdAccount.useMutation({
    onSuccess: async () => {
      await invalidate();
      showToast({ title: "Ad Account geselecteerd" });
    },
    onError: (error) => showToast({ title: "Selecteren mislukt", description: error.message, variant: "error" }),
  });
  const setAutoadsEnabled = trpc.metaAds.setAutoadsEnabled.useMutation({
    onSuccess: async () => {
      await invalidate();
      showToast({ title: "Meta Ads module bijgewerkt" });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  function updateAdset(id: string, patch: Partial<AdsetDraft>) {
    setAdsets((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function updateVariant(adsetId: string, variantId: string, patch: Partial<CreativeVariantDraft>) {
    setAdsets((current) =>
      current.map((item) =>
        item.id === adsetId
          ? {
              ...item,
              variants: item.variants.map((variant) => (variant.id === variantId ? { ...variant, ...patch } : variant)),
            }
          : item,
      ),
    );
  }

  function togglePlacement(adsetId: string, key: PlacementKey) {
    setAdsets((current) =>
      current.map((item) =>
        item.id === adsetId
          ? {
              ...item,
              placements: item.placements.includes(key) ? item.placements.filter((placement) => placement !== key) : [...item.placements, key],
            }
          : item,
      ),
    );
  }

  function addAdset() {
    setAdsets((current) => [...current, createAdset(`Doelgroep ${current.length + 1}`)]);
  }

  function removeAdset(id: string) {
    setAdsets((current) => current.filter((item) => item.id !== id));
    setActiveCreativeRef(null);
  }

  function addVariant(adsetId: string) {
    const variant = {
      ...createCreativeVariant(`Variant ${Date.now()}`),
      name: `Variant ${Math.max(2, (adsets.find((item) => item.id === adsetId)?.variants.length || 0) + 1)}`,
      adName: `Variant ${Math.max(2, (adsets.find((item) => item.id === adsetId)?.variants.length || 0) + 1)}`,
    };
    setAdsets((current) =>
      current.map((item) =>
        item.id === adsetId
          ? {
              ...item,
              variants: [...item.variants, variant],
            }
          : item,
      ),
    );
    setActiveCreativeRef({ adsetId, variantId: variant.id });
  }

  function removeVariant(adsetId: string, variantId: string) {
    setAdsets((current) =>
      current.map((item) =>
        item.id === adsetId && item.variants.length > 1
          ? { ...item, variants: item.variants.filter((variant) => variant.id !== variantId) }
          : item,
      ),
    );
    setActiveCreativeRef(null);
  }

  async function aiSuggestVariant(adsetId: string, variantId: string, adsetName: string, angle: string) {
    const trimmedProduct = getMetaAiProductInput();
    if (!trimmedProduct) return;
    const gen = beginGeneration();
    try {
      const rawPayload = await generateVariantSuggestion.mutateAsync({
        product: trimmedProduct,
        audience: audience.trim() || undefined,
        tone: aiTone,
        angle: angle.trim() || `${adsetName} doelgroep met duidelijke hook`,
        landingUrl: linkUrl.trim() || undefined,
        adsetName,
        leadId: leadId || undefined,
      });
      if (!isCurrentGeneration(gen)) return;
      const payload = asRecord(rawPayload);
      updateVariant(adsetId, variantId, {
        name: String(payload.adName || payload.headline || "AI variant"),
        adName: String(payload.adName || payload.headline || "AI variant"),
        primaryText: String(payload.primaryText || ""),
        headline: String(payload.headline || ""),
        description: String(payload.description || ""),
        linkUrl: String(payload.linkUrl || linkUrl),
        ctaType: String(payload.ctaType || "LEARN_MORE"),
        ctaLabel: String(payload.ctaLabel || ctaLabelFromType(String(payload.ctaType || "LEARN_MORE"))),
        publishAsset: (payload.publishAsset || "feed") as AssetSlot,
        angle: String(payload.angle || angle || ""),
      });
      showToast({ title: "AI advertentie-variant gegenereerd" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Onbekende fout";
      showToast({ title: "Variant suggestie mislukt", description: trpcErrorDescription(message), variant: "error" });
    }
  }

  async function uploadVariantAsset(adsetId: string, variantId: string, slot: AssetSlot, file: File) {
    const token = `${adsetId}:${variantId}:${slot}`;
    setUploadingVariantAsset(token);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Upload mislukt");
      }
      if (slot === "feed") updateVariant(adsetId, variantId, { feedImageUrl: payload.url });
      if (slot === "square") updateVariant(adsetId, variantId, { squareImageUrl: payload.url });
      if (slot === "story") updateVariant(adsetId, variantId, { storyImageUrl: payload.url });
      showToast({ title: "Variant-afbeelding geüpload" });
    } catch (error) {
      showToast({
        title: "Upload mislukt",
        description: error instanceof Error ? error.message : "Onbekende fout",
        variant: "error",
      });
    } finally {
      setUploadingVariantAsset(null);
    }
  }

  function buildPayload(strict = true) {
    if (!strict && name.trim().length < 2) {
      throw new Error("Vul minstens een campagnenaam in (min. 2 tekens).");
    }
    if (strict && !campaignComplete) throw new Error("Vul eerst Campaign volledig in.");
    if (strict && !adsetsComplete) throw new Error("Vul eerst Ad set volledig in.");
    if (strict && !adsComplete) throw new Error("Vul eerst Ads volledig in.");
    const advancedCreative = parseJson(advancedCreativeJson, "Advanced creative");
    const advancedTargeting = parseJson(advancedTargetingJson, "Advanced targeting");
    const campaignSettings = {
      buyingType,
      bidStrategy,
      bidAmount: numberValue(bidAmount) || null,
      campaignSpendCap: numberValue(campaignSpendCap) || null,
      specialAdCategories: csvToList(specialAdCategories),
      optimizationGoal: optimizationGoal === "AUTO" ? null : optimizationGoal,
      destinationType: destinationType === "AUTO" ? null : destinationType,
      billingEvent,
      pixelId: pixelId.trim() || null,
      customEventType: customEventType.trim() || null,
      advertiserName: advertiserName.trim() || null,
      advertiserPayerDifferent,
    };
    const adsetPayloads = adsets.map((adset) => ({
      ...buildTargetingFromAdset(adset),
      id: adset.id,
      placements: adset.placements,
    }));
    const baseTargeting = adsetPayloads[0];
    const creativeGroups = adsets.map((adset) => ({
      adsetId: adset.id,
      name: adset.name,
      variants: adset.variants.map((variant) =>
        buildMergedVariantPayload(
          {
            adName,
            primaryText,
            headline,
            description,
            linkUrl,
            displayUrl,
            feedImageUrl,
            squareImageUrl,
            storyImageUrl,
            publishAsset,
            ctaType,
            ctaLabel,
            urlTags,
          },
          variant,
        ),
      ),
    }));
    const firstCreative = asRecord(creativeGroups[0]?.variants[0]);

    return {
      name: name.trim(),
      objective: objective as any,
      dailyBudgetCents: budgetCentsOrNull(dailyBudget),
      lifetimeBudgetCents: budgetCentsOrNull(lifetimeBudget),
      currency,
      startTime: startTime ? new Date(startTime) : null,
      endTime: endTime ? new Date(endTime) : null,
      targeting: {
        ...baseTargeting,
        adsets: adsetPayloads,
        campaignSettings,
        ...advancedTargeting,
      },
      creatives: {
        brandKitId: searchParams.get("brandKitId") || undefined,
        adName: String(firstCreative.adName || adName).trim(),
        pageName: facebookPublisherName,
        linkUrl: String(firstCreative.linkUrl || linkUrl).trim(),
        displayUrl: String(firstCreative.displayUrl || displayUrl).trim(),
        message: String(firstCreative.message || firstCreative.primaryText || primaryText).trim(),
        headline: String(firstCreative.headline || headline).trim(),
        description: String(firstCreative.description || description).trim(),
        imageUrl: String(firstCreative.imageUrl || primaryPublishImage).trim(),
        feedImageUrl: String(firstCreative.feedImageUrl || feedImageUrl).trim(),
        squareImageUrl: String(firstCreative.squareImageUrl || squareImageUrl).trim(),
        storyImageUrl: String(firstCreative.storyImageUrl || storyImageUrl).trim(),
        publishAsset: (firstCreative.publishAsset as AssetSlot) || publishAsset,
        ctaType: String(firstCreative.ctaType || ctaType),
        cta: String(firstCreative.cta || firstCreative.ctaLabel || ctaLabel).trim(),
        ctaLabel: String(firstCreative.ctaLabel || ctaLabel).trim(),
        urlTags: String(firstCreative.urlTags || urlTags).trim(),
        aiTone,
        aiBrief: {
          product: product.trim(),
          audience: audience.trim(),
          tone: aiTone,
        },
        adsets: creativeGroups,
        ...advancedCreative,
      },
    };
  }

  function saveDraft() {
    try {
      const payload = buildPayload(false);
      if (campaignNameConflict) {
        showToast({ title: "Naam bestaat al", description: campaignNameConflict, variant: "error" });
        return;
      }
      if (selectedPlan && ["DRAFT", "FAILED", "CANCELLED"].includes(selectedPlan.status)) updateDraft.mutate({ id: selectedPlan.id, ...payload });
      else createDraft.mutate(payload);
    } catch (error) {
      showToast({ title: "Controleer je velden", description: error instanceof Error ? error.message : "Ongeldige input", variant: "error" });
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-[2rem] border border-[#1877F2]/15 bg-gradient-to-br from-[#1877F2]/[0.07] via-white to-[#E1306C]/[0.05] p-6 shadow-sm dark:border-[#1877F2]/25 dark:from-[#1877F2]/15 dark:via-slate-950 dark:to-[#833AB4]/10">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#1877F2]/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/4 h-44 w-44 rounded-full bg-[#E1306C]/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className="border-0 bg-[#1877F2]/10 font-medium text-[#1877F2] hover:bg-[#1877F2]/10 dark:bg-[#1877F2]/20 dark:text-[#6ba3ff]">
                  Meta Ads
                </Badge>
                <Badge variant="secondary" className="font-normal">
                  Campagnes starten als PAUSED
                </Badge>
              </div>
              <div className="flex items-start gap-4">
                <MetaAdsBrandMark />
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Meta Ads Studio</h1>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Campaign → Ad set → Ads, zoals in Ads Manager. Met AI-voorstellen, formaatchecks en veilige paused push naar
                    Facebook &amp; Instagram.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-black/5 dark:bg-slate-900/80 dark:text-slate-200 dark:ring-white/10">
                      <span className="h-2 w-2 rounded-full bg-[#1877F2]" />
                      Facebook
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-black/5 dark:bg-slate-900/80 dark:text-slate-200 dark:ring-white/10">
                      <span className="h-2 w-2 rounded-full bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]" />
                      Instagram
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col xl:flex-row">
              <Button className="bg-[#1877F2] text-white shadow-md shadow-[#1877F2]/20 hover:bg-[#166fe5]" asChild>
                <Link href="/settings/integrations">Meta koppeling beheren</Link>
              </Button>
              <Button variant="outline" className="border-slate-200 bg-white/80 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60" onClick={startNewCampaign}>
                <Plus className="mr-2 h-4 w-4" />
                Nieuwe campagne
              </Button>
              <Button
                variant="outline"
                className="border-slate-200 bg-white/80 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60"
                onClick={() => setAdsTab("campaigns")}
              >
                Live campagnes
              </Button>
              <Button
                variant="outline"
                className="border-[#1877F2]/25 bg-white/80 hover:bg-[#1877F2]/5 dark:border-[#1877F2]/30 dark:bg-slate-900/60"
                disabled={!canOpenStep("review")}
                onClick={() => {
                  setAdsTab("builder");
                  setActiveStep("review");
                }}
              >
                Naar review
              </Button>
            </div>
          </div>
        </div>

        <AdsCopilotPanel provider="META" campaignIds={selectedCampaignId ? [selectedCampaignId] : []} />

        {!connection.data?.autoadsEnabled ? (
          <AdsModuleSetupNotice
            tone="meta"
            icon={PauseCircle}
            title="Meta Ads module staat uit"
            badge="Alleen lokaal"
            summary="Drafts, review en goedkeuring werken lokaal — push naar Meta na inschakelen."
            headerAction={
              <Button
                size="sm"
                type="button"
                className={cn("h-8 text-white", adsModuleSetupToneStyles("meta").cta)}
                onClick={() => setAdsTab("settings")}
              >
                <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                Inschakelen
              </Button>
            }
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <div
                className={cn(
                  "rounded-xl border px-3 py-2.5",
                  adsModuleSetupToneStyles("meta").accentCard,
                )}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#1877F2]/90 dark:text-[#6BA3FF]">
                  Nu beschikbaar
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Campagnes opbouwen in de studio, reviewen, goedkeuren en als draft bewaren — zonder live te gaan.
                </p>
              </div>
              <div className={cn("rounded-xl border px-3 py-2.5", adsModuleSetupToneStyles("meta").mutedCard)}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Na inschakelen
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Goedgekeurde campagnes pushen als{" "}
                  <span className="font-medium text-foreground">paused</span> — live zetten doe je in Meta Ads Manager.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className={cn("text-white", adsModuleSetupToneStyles("meta").cta)}
                onClick={() => setAdsTab("settings")}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Module inschakelen
              </Button>
              <Button
                variant="outline"
                className={adsModuleSetupToneStyles("meta").outlineBtn}
                asChild
              >
                <Link href="/settings/integrations">Meta-koppeling</Link>
              </Button>
            </div>
          </AdsModuleSetupNotice>
        ) : null}

        {connection.data?.missingConfiguredScopes?.length ? (
          <MetaOAuthScopesAlert scopes={connection.data.missingConfiguredScopes} />
        ) : null}

        <AdsStudioStatsStrip
          studio="meta"
          items={[
            {
              id: "connection",
              label: "Koppeling",
              icon: adsStudioStatIcons.connection,
              primary: "Meta OAuth",
              secondary:
                connection.data?.selectedAdAccountName ||
                connection.data?.selectedAdAccountId ||
                "Geen account geselecteerd",
              connected: Boolean(connection.data?.connected),
            },
            {
              id: "performance",
              label: "CTR (30d)",
              icon: adsStudioStatIcons.performance,
              primary:
                insightCoach.impressions > 0 ? `${insightCoach.ctr.toFixed(2)}%` : "—",
              secondary:
                insightCoach.clicks > 0
                  ? `CPC ${new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(insightCoach.cpc)}`
                  : insightCoach.impressions > 0
                    ? `${insightCoach.impressions.toLocaleString("nl-BE")} impressies`
                    : "Geen data in periode",
            },
            {
              id: "insights",
              label: "30 dagen",
              icon: adsStudioStatIcons.insights,
              primary: new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(totalSpend),
              secondary: `${totalClicks} klik${totalClicks === 1 ? "" : "s"}`,
            },
          ]}
        />

        <Tabs value={adsTab} onValueChange={setAdsTab} className="space-y-4">
          <AdsStudioTabsNav
            value={adsTab}
            onValueChange={setAdsTab}
            tabs={META_ADS_NAV_TABS}
            studio="meta"
            mobileNavLabel="Meta Ads Studio navigatie"
            getBadgeCount={(tabValue) =>
              tabValue === "approval" ? pendingApprovalCount : tabValue === "drafts" ? rows.length : 0
            }
          />

          <TabsContent value="workflow"><AdsWorkflowPanel provider="META" /></TabsContent>
          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <MetaAdsDashboardOverview
                drafts={rows as Array<Record<string, unknown>>}
                liveCampaigns={(campaigns.data || []) as Array<Record<string, unknown>>}
                insightsRows={(insights.data || []) as Array<Record<string, unknown>>}
                insightsLoading={insights.isLoading}
                insightCoach={insightCoach}
                pendingApprovalCount={pendingApprovalCount}
                operationalRequirements={operationalRequirements}
                connected={Boolean(connection.data?.connected)}
                accountSelected={Boolean(connection.data?.selectedAdAccountId)}
                topScoreEntry={campaignScoreEntries[0]}
                onNavigate={setAdsTab}
                onOpenDraft={(planId) => openDraftForEditing(planId, "campaign")}
                onOpenCampaign={openLiveCampaign}
                onOpenTopScore={() => {
                  const entry = campaignScoreEntries[0];
                  if (!entry) return;
                  if (entry.planId) openScoredPlan(entry.planId);
                  else if (entry.campaignId) openLiveCampaign(entry.campaignId);
                }}
              />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5" /> AI campagne scores</CardTitle>
                  <CardDescription>
                    Per voltooide draft en per actieve Meta-campagne. Gebaseerd op opgeslagen copy, adsets, visuals en tracking — niet op de open editor.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {campaignScoreEntries.length ? (
                    campaignScoreEntries.map((entry) => (
                      <div key={entry.id} className="space-y-2">
                        <CampaignScorePanel entry={entry} compact />
                        <div className="flex justify-end">
                          {entry.planId ? (
                            <Button size="sm" variant="outline" onClick={() => openScoredPlan(entry.planId!)}>
                              Open in studio
                            </Button>
                          ) : entry.campaignId ? (
                            <Button size="sm" variant="outline" onClick={() => openLiveCampaign(entry.campaignId!)}>
                              Bekijk in Meta
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Nog geen campagnes om te scoren</p>
                      <p className="mt-2 text-xs leading-5">
                        Sla een voltooide draft op in Studio, of activeer een campagne in Meta. Minimaal nodig: Campaign, Ad set en Ads met copy, link en visual.
                      </p>
                      <Button size="sm" className="mt-4" variant="outline" onClick={() => setAdsTab("builder")}>
                        Naar studio
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="builder" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className="order-2 min-w-0 overflow-hidden xl:order-1">
                <CardHeader className="gap-0 space-y-0 border-b p-0">
                  <div className="flex items-start gap-3 px-5 py-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white shadow-sm dark:bg-white dark:text-slate-950">
                      {activeStepIndex + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{activeStepMeta.label}</CardTitle>
                        <Badge variant="secondary" className="h-5 px-2 text-[10px] font-normal">
                          Stap {activeStepIndex + 1} van {BUILDER_STEP_ORDER.length}
                        </Badge>
                      </div>
                      <CardDescription className="mt-1 text-xs leading-relaxed">{activeStepMeta.description}</CardDescription>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-lg font-semibold tabular-nums leading-none">{builderCompletionPercent}%</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">checklist</p>
                    </div>
                  </div>
                  <div className="h-1 bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${builderCompletionPercent}%` }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 p-5">
                  <BuilderStepper
                    activeStep={activeStep}
                    onStepClick={setActiveStep}
                    stepComplete={isStepComplete}
                    canOpenStep={canOpenStep}
                    compact
                  />

                  <MetaBuilderChecklist
                    campaignComplete={campaignComplete}
                    adsetsComplete={adsetsComplete}
                    adsComplete={adsComplete}
                    readyToSave={readyToSave}
                    adsetCount={adsets.length}
                    variantCount={totalVariants}
                    onStepClick={setActiveStep}
                  />

                  {activeStep === "campaign" ? (
                    <div className="space-y-4">
                      <BuilderSection
                        icon={FileText}
                        title="Campagnedetails"
                        description="Naam, buying type en doelstelling van de campagne."
                        collapsible
                        defaultOpen
                        preview={[
                          name.trim() || "Nog geen campagnenaam",
                          META_OBJECTIVE_LABELS[objective] || objective,
                          META_BUYING_TYPE_OPTIONS.find((item) => item.value === buyingType)?.label || buyingType,
                        ].join(" · ")}
                      >
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            <div className="space-y-2 sm:col-span-2 xl:col-span-1">
                              <HelpLabel label="Campagnenaam" help="Interne naam voor de draft en de Meta-campagne. Houd dit leesbaar voor je team." />
                              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. Q2 leadgen — website" />
                              {campaignNameConflict ? (
                                <p className="text-xs text-amber-700 dark:text-amber-300">{campaignNameConflict}</p>
                              ) : null}
                            </div>
                            <div className="space-y-2">
                              <HelpLabel label="Buying type" help="Voor de meeste campagnes blijft Auction correct." />
                              <Select value={buyingType} onValueChange={setBuyingType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {META_BUYING_TYPE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <HelpLabel label="Objective" help="Dit bepaalt waar Meta op optimaliseert. Verkeerde objective zorgt vaak voor zwakke delivery." />
                              <Select value={objective} onValueChange={setObjective}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="OUTCOME_TRAFFIC">Traffic</SelectItem>
                                  <SelectItem value="OUTCOME_LEADS">Leads</SelectItem>
                                  <SelectItem value="OUTCOME_SALES">Sales</SelectItem>
                                  <SelectItem value="OUTCOME_ENGAGEMENT">Engagement</SelectItem>
                                  <SelectItem value="OUTCOME_AWARENESS">Awareness</SelectItem>
                                  <SelectItem value="LINK_CLICKS">Link clicks</SelectItem>
                                  <SelectItem value="LEAD_GENERATION">Lead generation</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <HelpLabel label="Valuta" help="Best gelijk houden aan je geselecteerde Ad Account." />
                              <Select value={currency} onValueChange={setCurrency}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {META_CURRENCY_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.symbol} {option.label} ({option.value})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <HelpLabel label="Special ad categories" help="Alleen bij gereguleerde sectoren (housing, employment, credit)." />
                              <Select
                                value={
                                  specialAdCategories.trim()
                                    ? META_SPECIAL_AD_CATEGORY_OPTIONS.find((item) => item.value === specialAdCategories.split(",")[0]?.trim().toUpperCase())?.value ||
                                      "NONE"
                                    : "NONE"
                                }
                                onValueChange={(value) => setSpecialAdCategories(value === "NONE" ? "" : value)}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {META_SPECIAL_AD_CATEGORY_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                      </BuilderSection>

                      <BuilderSection
                        icon={CalendarDays}
                        title="Budget & planning"
                        description="Dagbudget in centen (100 = €1,00). Vul dag- of lifetimebudget in — minimaal €1,00."
                        collapsible
                        defaultOpen={false}
                        preview={
                          dailyBudget.trim()
                            ? `≈ ${dailyBudgetEur} per dag`
                            : lifetimeBudget.trim()
                              ? `≈ ${lifetimeBudgetEur} totaal`
                              : "Budget nog niet ingesteld"
                        }
                      >
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            <div className="space-y-2">
                              <HelpLabel label="Dagbudget in cent" help="Voorbeeld: 2500 = €25,00. De workspace budget guard blokkeert te hoge bedragen." />
                              <Input type="number" min="100" value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} placeholder="Bijv. 2500" />
                              {dailyBudget.trim() ? <p className="text-[11px] text-muted-foreground">≈ {dailyBudgetEur} per dag</p> : null}
                            </div>
                            <div className="space-y-2">
                              <HelpLabel label="Lifetime budget in cent" help="Gebruik dit alleen als je geen dagbudget wil. Laat leeg als dagbudget volstaat." />
                              <Input type="number" min="100" value={lifetimeBudget} onChange={(e) => setLifetimeBudget(e.target.value)} placeholder="Optioneel" />
                              {lifetimeBudgetEur ? <p className="text-[11px] text-muted-foreground">≈ {lifetimeBudgetEur} totaal</p> : null}
                            </div>
                            <div className="space-y-2">
                              <HelpLabel label="Campaign spend cap" help="Bovenlimiet voor totale spend van de campagne. Alleen invullen als je dat echt wil forceren." />
                              <Input type="number" value={campaignSpendCap} onChange={(e) => setCampaignSpendCap(e.target.value)} placeholder="Optioneel" />
                            </div>
                            <div className="space-y-2">
                              <HelpLabel label="Start" help="Laat leeg voor meteen na push. V1 pusht altijd als PAUSED, maar bewaart wel deze planning." />
                              <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <HelpLabel label="Einde" help="Optioneel eindmoment van de campagne." />
                              <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                            </div>
                          </div>
                      </BuilderSection>

                      <BuilderSection
                        icon={Globe2}
                        title="EU transparency"
                        description="Optioneel, maar handig voor Europese advertentievereisten."
                        collapsible
                        defaultOpen={false}
                        preview={
                          advertiserName.trim()
                            ? `${advertiserName.trim()}${advertiserPayerDifferent ? " · payer verschilt" : ""}`
                            : "Optioneel — EU advertiser/payer"
                        }
                      >
                          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                            <div className="space-y-2">
                              <HelpLabel label="Advertiser" help="Naam die intern wordt bewaard voor EU advertiser/payer context." />
                              <Input value={advertiserName} onChange={(e) => setAdvertiserName(e.target.value)} placeholder="Naam adverteerder (EU)" />
                            </div>
                            <div className="flex items-end">
                              <div className="flex min-h-10 items-center gap-3 rounded-xl border px-3">
                                <Switch checked={advertiserPayerDifferent} onCheckedChange={setAdvertiserPayerDifferent} />
                                <span className="text-sm">Advertiser en payer verschillen</span>
                              </div>
                            </div>
                          </div>
                      </BuilderSection>
                    </div>
                  ) : null}

                  {activeStep === "adsets" ? (
                    <div className="space-y-4">
                      <BuilderSection
                        icon={ShieldCheck}
                        title="Ad set delivery"
                        description="Performance goal, destination en biedstrategie voor de ad sets."
                        collapsible
                        defaultOpen={false}
                        preview={metaDeliveryPreview({ optimizationGoal, destinationType, bidStrategy, billingEvent })}
                      >
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <div className="space-y-2">
                            <HelpLabel label="Performance goal" help="Laat meestal op Auto staan; we mappen dit veilig naar de objective." />
                            <Select value={optimizationGoal} onValueChange={(value) => setOptimizationGoal(value as OptimizationGoal)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AUTO">Auto per objective</SelectItem>
                                <SelectItem value="LINK_CLICKS">Link clicks</SelectItem>
                                <SelectItem value="LANDING_PAGE_VIEWS">Landing page views</SelectItem>
                                <SelectItem value="LEAD_GENERATION">Lead generation</SelectItem>
                                <SelectItem value="OFFSITE_CONVERSIONS">Offsite conversions</SelectItem>
                                <SelectItem value="REACH">Reach</SelectItem>
                                <SelectItem value="IMPRESSIONS">Impressions</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Destination" help="Niet elke objective laat elke destination toe. Auto is het veiligst." />
                            <Select value={destinationType} onValueChange={(value) => setDestinationType(value as DestinationType)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AUTO">Auto</SelectItem>
                                <SelectItem value="WEBSITE">Website</SelectItem>
                                <SelectItem value="MESSENGER">Messenger</SelectItem>
                                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                                <SelectItem value="PHONE_CALL">Phone call</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Bid strategy" help="Gebruik meestal lowest cost. Caps zijn pas zinvol als je al historische data hebt." />
                            <Select value={bidStrategy} onValueChange={(value) => setBidStrategy(value as BidStrategy)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="LOWEST_COST_WITHOUT_CAP">Lowest cost without cap</SelectItem>
                                <SelectItem value="LOWEST_COST_WITH_BID_CAP">Lowest cost with bid cap</SelectItem>
                                <SelectItem value="COST_CAP">Cost cap</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Bid/cost cap amount" help="Alleen gebruiken als je met cap-strategieën werkt." />
                            <Input type="number" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} placeholder="Alleen bij cap strategies" />
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Billing event" help="Voor de meeste gevallen blijft Impressions (CPM) prima." />
                            <Select value={billingEvent} onValueChange={setBillingEvent}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {META_BILLING_EVENT_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Pixel ID" help="Optioneel. Nodig voor offsite conversions." />
                            <Input value={pixelId} onChange={(e) => setPixelId(e.target.value)} placeholder="Meta pixel ID" />
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Custom event" help="Alleen relevant bij conversion-objectives met pixel." />
                            <Select value={customEventType} onValueChange={setCustomEventType}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {META_CUSTOM_EVENT_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </BuilderSection>

                      <BuilderSection
                        icon={Target}
                        title="Advertentiesets"
                        description="Splits doelgroepen op per hook, regio, funnel of remarketingdoel."
                        accent="ai"
                        collapsible
                        defaultOpen={false}
                        preview={adsetsSectionPreview(adsets)}
                        headerAction={
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              addAdset();
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Toevoegen
                          </Button>
                        }
                      >
                        {!adsets.length ? (
                          <EmptyState
                            icon={<Target className="h-8 w-8" />}
                            title="Nog geen advertentieset"
                            description="Voeg minstens één advertentieset toe met land, leeftijd en placements voordat je advertenties maakt."
                            action={
                              <Button onClick={addAdset}>
                                <Plus className="mr-2 h-4 w-4" />
                                Eerste advertentieset
                              </Button>
                            }
                          />
                        ) : null}
                        <div className="space-y-3">
                          {adsets.map((adset, index) => (
                            <AdsetAccordionCard
                              key={adset.id}
                              adset={adset}
                              index={index}
                              defaultOpen={false}
                              onRemove={() => removeAdset(adset.id)}
                            >
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="space-y-2 sm:col-span-2">
                                  <HelpLabel label="Advertentieset naam" help="Gebruik een naam die doelgroep of testhoek meteen duidelijk maakt." />
                                  <Input value={adset.name} onChange={(e) => updateAdset(adset.id, { name: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                  <HelpLabel label="Gender" help="Laat dit meestal open, tenzij je aanbod echt gender-specifiek is." />
                                  <Select value={adset.genders} onValueChange={(value) => updateAdset(adset.id, { genders: value })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="ALL">Alle genders</SelectItem>
                                      <SelectItem value="1">Mannen</SelectItem>
                                      <SelectItem value="2">Vrouwen</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <HelpLabel label="Leeftijd" help="Min. 13 · max ≥ min" />
                                  <div className="flex gap-2">
                                    <Input type="number" min={13} value={adset.ageMin} onChange={(e) => updateAdset(adset.id, { ageMin: e.target.value })} placeholder={META_DEFAULT_AGE_MIN} />
                                    <Input type="number" min={13} value={adset.ageMax} onChange={(e) => updateAdset(adset.id, { ageMax: e.target.value })} placeholder={META_DEFAULT_AGE_MAX} />
                                  </div>
                                </div>
                              </div>

                              <MetaLocationEditor
                                adset={adset}
                                metaSearchEnabled={Boolean(connection.data?.connected)}
                                onChange={(patch) => updateAdset(adset.id, patch)}
                              />

                              <AdsetAudienceOptionalSection adset={adset} onUpdate={(patch) => updateAdset(adset.id, patch)} />
                              <div className="mt-3 flex items-center justify-between rounded-xl border p-3">
                                <div>
                                  <p className="text-sm font-medium">Advantage+ audience</p>
                                  <p className="text-xs text-muted-foreground">Aan = Meta zoekt ruimer buiten je signalen. Uit = strakker, maar soms minder delivery.</p>
                                </div>
                                <Switch checked={adset.advantageAudience} onCheckedChange={(value) => updateAdset(adset.id, { advantageAudience: value })} />
                              </div>
                              <div className="mt-4">
                                <HelpLabel label="Plaatsingen" help="Kies per adset waar de advertentie mag verschijnen. Stories/Reels vragen best om een aparte 9:16 visual." />
                                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                  {PLACEMENTS.map((placement) => (
                                    <TogglePill
                                      key={`${adset.id}-${placement.key}`}
                                      active={adset.placements.includes(placement.key)}
                                      label={placement.label}
                                      hint={placement.hint}
                                      onClick={() => togglePlacement(adset.id, placement.key)}
                                    />
                                  ))}
                                </div>
                              </div>
                            </AdsetAccordionCard>
                          ))}
                        </div>
                      </BuilderSection>
                    </div>
                  ) : null}

                  {activeStep === "ads" ? (
                    <div className="space-y-4">
                      <BuilderSection
                        icon={ImageIcon}
                        title="Advertenties"
                        description="Meta-niveau 3: pagina-identiteit, AI-briefing en creatieve invoer per variant."
                        collapsible
                        defaultOpen={false}
                        preview={metaAdvertentiesPreview({
                          facebookPublisherName,
                          instagramPublisherName,
                          product,
                          audience,
                          aiTone,
                        })}
                      >
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <CompactHelpLabel
                              label="Facebook"
                              help="Naam uit je geselecteerde Meta advertentieaccount (en gekoppelde pagina)."
                            />
                            <div className="flex h-8 items-center rounded-md border bg-muted/25 px-3 text-sm">
                              <span className="truncate font-medium">{facebookPublisherName}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <CompactHelpLabel
                              label="Instagram"
                              help={
                                metaHasInstagram
                                  ? "Zelfde advertentieaccount; bij gekoppeld Instagram-profiel ook de @-naam."
                                  : "Geen Instagram gekoppeld — preview gebruikt de Facebook-naam."
                              }
                            />
                            <div className="flex h-8 items-center rounded-md border bg-muted/25 px-3 text-sm">
                              <span className="truncate font-medium">{instagramPublisherName}</span>
                            </div>
                          </div>
                          <MetaCampaignUrlTagsField value={urlTags} onChange={setUrlTags} campaignName={name} />
                        </div>
                      </BuilderSection>

                      <BuilderSection
                        icon={Layers3}
                        title="Ads per ad set"
                        description="Elke ad set krijgt één of meerdere advertenties voor copy-, hook- en visualtests."
                        collapsible
                        defaultOpen={false}
                        preview={adsPerAdsetSectionPreview(adsets)}
                      >
                        <div className="space-y-2">
                          {adsets.map((adset, adsetIndex) => (
                            <AdsetCreativeAccordionCard
                              key={`creative-${adset.id}`}
                              adset={adset}
                              index={adsetIndex}
                              defaultOpen={false}
                              onAddVariant={() => addVariant(adset.id)}
                            >
                              <div className="space-y-2">
                                {adset.variants.map((variant, variantIndex) => {
                                  const merged = mergeVariantWithBase(
                                    {
                                      adName,
                                      primaryText,
                                      headline,
                                      description,
                                      linkUrl,
                                      displayUrl,
                                      feedImageUrl,
                                      squareImageUrl,
                                      storyImageUrl,
                                      publishAsset,
                                      ctaType,
                                      ctaLabel,
                                      urlTags,
                                    },
                                    variant,
                                    { inheritAssets: false, inheritCopy: false },
                                  );
                                  return (
                                    <VariantAccordionCard
                                      key={variant.id}
                                      campaignName={name.trim() || "Campagne"}
                                      adsetName={adset.name}
                                      variantIndex={variantIndex}
                                      variant={variant}
                                      defaultOpen={false}
                                      active={activeCreativeRef?.variantId === variant.id}
                                      onSelect={() => setActiveCreativeRef({ adsetId: adset.id, variantId: variant.id })}
                                      onAiSuggest={() => aiSuggestVariant(adset.id, variant.id, adset.name, variant.angle)}
                                      onRemove={() => removeVariant(adset.id, variant.id)}
                                      canRemove={adset.variants.length > 1}
                                      aiBriefingReady={product.trim().length >= 2}
                                    >
                                      <VariantCreativeForm
                                        adsetId={adset.id}
                                        variant={variant}
                                        merged={merged}
                                        campaignUrlTags={urlTags}
                                        uploadingVariantAsset={uploadingVariantAsset}
                                        storyPlacementWarning={
                                          adset.placements.some((placement) =>
                                            ["facebook_story", "facebook_reels", "instagram_story", "instagram_reels"].includes(placement),
                                          ) && !merged.storyImageUrl.trim()
                                        }
                                        onUpdate={(patch) => updateVariant(adset.id, variant.id, patch)}
                                        onUploadAsset={(slot, file) => uploadVariantAsset(adset.id, variant.id, slot, file)}
                                      />
                                    </VariantAccordionCard>
                                  );
                                })}
                              </div>
                            </AdsetCreativeAccordionCard>
                          ))}
                        </div>
                      </BuilderSection>
                    </div>
                  ) : null}

                  {activeStep === "review" ? (
                    <div className="space-y-4">
                      <Card className="border-amber-500/30 bg-amber-500/10">
                        <CardContent className="flex gap-3 p-4 text-sm">
                          <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-700" />
                          <div>
                            <p className="font-medium text-amber-950 dark:text-amber-100">Nieuwe campagnes worden altijd PAUSED aangemaakt.</p>
                            <p className="text-amber-900/80 dark:text-amber-100/80">Approval en push zijn gescheiden. Live zetten gebeurt bewust in Meta Ads Manager.</p>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="grid gap-3 md:grid-cols-2">
                        <CheckRow ok={campaignComplete} label="Campagne compleet" hint="Naam, buying type, objective en budget zijn ingevuld." />
                        <CheckRow ok={adsetsComplete} label="Advertentieset compleet" hint="Elke set heeft landen, leeftijd en minstens één placement." />
                        <CheckRow
                          ok={adsComplete}
                          label="Advertenties compleet"
                          hint="Meta advertentieaccount gekoppeld + per variant copy, https-link en beeld."
                        />
                        <CheckRow ok={Boolean(connection.data?.selectedAdAccountId)} label="Ad Account geselecteerd" hint="Kies exact 1 Meta Ad Account per workspace." />
                      </div>

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2"><Wand2 className="h-4 w-4" /> AI campaign score</CardTitle>
                          <CardDescription>Snelle kwaliteitsinschatting met concrete verbeterpunten.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/30 p-4">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Score</p>
                              <p className="text-4xl font-semibold">{score.score}</p>
                            </div>
                            <Badge variant={score.score >= 70 ? "success" : "warning"}>{score.label}</Badge>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            {score.checks.map((item) => <CheckRow key={item.label} ok={item.ok} label={item.label} hint={item.hint} />)}
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Hoe je dit nog sterker maakt</p>
                            {score.tips.length ? score.tips.map((tip) => <p key={tip} className="rounded-xl border bg-card px-3 py-2 text-sm">{tip}</p>) : <p className="text-sm text-muted-foreground">Deze campagne staat er al stevig voor.</p>}
                          </div>
                        </CardContent>
                      </Card>

                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="space-y-2">
                          <HelpLabel label="Advanced creative JSON" help="Voor gevorderde overrides. Alles hier wordt bovenop de builder opgeslagen." />
                          <Textarea className="min-h-36 font-mono text-xs" value={advancedCreativeJson} onChange={(e) => setAdvancedCreativeJson(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <HelpLabel label="Advanced targeting JSON" help="Voor Meta-specifieke targeting die nog niet in de wizard zit. Gebruik dit voorzichtig." />
                          <Textarea className="min-h-36 font-mono text-xs" value={advancedTargetingJson} onChange={(e) => setAdvancedTargetingJson(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="-mx-5 -mb-5 mt-6 flex flex-col gap-3 border-t bg-muted/25 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={activeStepIndex === 0}
                        onClick={() => setActiveStep(BUILDER_STEP_ORDER[activeStepIndex - 1]!)}
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Vorige
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          activeStepIndex >= BUILDER_STEP_ORDER.length - 1 ||
                          !canOpenStep(BUILDER_STEP_ORDER[activeStepIndex + 1]!)
                        }
                        onClick={() => setActiveStep(BUILDER_STEP_ORDER[activeStepIndex + 1]!)}
                      >
                        Volgende
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={openAiCampaignDialog}
                        disabled={generateSuggestion.isPending}
                      >
                        {generateSuggestion.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        AI campagnevoorstel
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={startNewCampaign}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nieuwe campagne
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={saveDraft}
                        disabled={createDraft.isPending || updateDraft.isPending || !canSaveDraft}
                      >
                        {createDraft.isPending || updateDraft.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Draft opslaan
                      </Button>
                      {readyToSave ? <Badge variant="success">Klaar voor approval</Badge> : null}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="order-1 min-w-0 space-y-4 xl:order-2">
                {activeStep === "ads" || activeStep === "review" ? (
                  <MetaPreview
                    primaryText={previewCreative.primaryText}
                    headline={previewCreative.headline}
                    description={previewCreative.description}
                    linkUrl={previewCreative.linkUrl}
                    feedImageUrl={previewCreative.feedImageUrl}
                    squareImageUrl={previewCreative.squareImageUrl}
                    storyImageUrl={previewCreative.storyImageUrl}
                    ctaLabel={previewCreative.ctaLabel.trim() || ctaLabelFromType(previewCreative.ctaType)}
                    facebookPublisherName={facebookPublisherName}
                    instagramPublisherName={instagramPublisherName}
                    pageAvatarUrl={pageAvatarUrl}
                    placements={selectedPlacements}
                    publishAsset={previewCreative.publishAsset}
                  />
                ) : null}
                <CollapsibleCard
                  title="Studio samenvatting"
                  description="Voortgang, score en blokkades terwijl je bouwt."
                  defaultOpen={operationalRequirements.length > 0 || !readyToSave}
                  preview={
                    readyToSave
                      ? `Klaar · ${score.score}/100 · ${adsets.length} set(s) · ${totalVariants} ad(s)`
                      : `${builderCompletionPercent}% · ${score.score}/100 · ${operationalRequirements.length} blokkade${operationalRequirements.length === 1 ? "" : "s"}`
                  }
                >
                  <MetaAdsStudioSummary
                    adsetCount={adsets.length}
                    variantCount={totalVariants}
                    placementCount={selectedPlacements.length}
                    score={score}
                    builderCompletionPercent={builderCompletionPercent}
                    readyToSave={readyToSave}
                    campaignComplete={campaignComplete}
                    adsetsComplete={adsetsComplete}
                    adsComplete={adsComplete}
                    stepTodos={studioStepTodos}
                    operationalRequirements={operationalRequirements}
                    onStepClick={setActiveStep}
                    onOpenSettings={() => setAdsTab("settings")}
                  />
                </CollapsibleCard>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="approval">
            <Card>
              <CardHeader>
                <CardTitle>Approval queue</CardTitle>
                <CardDescription>OWNER/ADMIN keurt goed en pusht daarna als gepauzeerd naar Meta.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {(["ALL", "DRAFT", "PENDING_APPROVAL", "APPROVED", "FAILED", "PUSHED_PAUSED"] as const).map((status) => (
                    <Button key={status} size="sm" variant={approvalFilter === status ? "default" : "outline"} onClick={() => setApprovalFilter(status)}>
                      {status === "ALL" ? "Alles" : status}
                    </Button>
                  ))}
                </div>
                <ApprovalQueue
                  rows={filteredRows}
                  selectedPlanId={selectedPlan?.id || null}
                  loading={drafts.isLoading}
                  onSelect={(id) => {
                    setSelectedPlanId(id);
                    setLoadedPlanId(null);
                  }}
                  onEdit={(id) => openDraftForEditing(id, "campaign")}
                  onSubmit={(id) => submitForApproval.mutate({ id })}
                  onApprove={(id) => approveDraft.mutate({ id })}
                  onPush={(id) => pushPaused.mutate({ id })}
                  onRetry={(id) => retryFailed.mutate({ id })}
                  onReconcile={(id) => reconcilePush.mutate({ id })}
                  onReject={(id) => rejectDraft.mutate({ id, reason: "Aanpassing gevraagd" })}
                  onCancel={(id) => cancelDraft.mutate({ id })}
                  autoadsEnabled={Boolean(connection.data?.autoadsEnabled)}
                  pushing={pushPaused.isPending}
                  approvalActionPending={approvalActionPending}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="campaigns">
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle>Meta campagnes</CardTitle>
                      <CardDescription>Campagnes rechtstreeks uit het geselecteerde Meta Ad Account.</CardDescription>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => syncCampaigns.mutate()} disabled={syncCampaigns.isPending}>
                      {syncCampaigns.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                      Sync
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {campaigns.isLoading ? <Skeleton className="h-32 w-full" /> : (campaigns.data || []).length ? (campaigns.data || []).map((campaign: any) => (
                    <button key={campaign.id} type="button" onClick={() => setSelectedCampaignId(String(campaign.id))} className={`w-full rounded-xl border p-3 text-left ${selectedCampaignId === campaign.id ? "border-primary bg-primary/5" : "bg-card"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{campaign.name}</p>
                        <Badge variant={campaign.effective_status === "ACTIVE" || campaign.status === "ACTIVE" ? "success" : "secondary"}>{campaign.effective_status || campaign.status || "-"}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{campaign.objective} · updated {prettyDate(campaign.updated_time)}</p>
                    </button>
                  )) : <EmptyState title="Geen campagnes geladen" description="Kies eerst een Ad Account of controleer de Meta rechten." icon={<Megaphone className="h-8 w-8" />} action={
                    <Button className="bg-[#1877F2] text-white shadow-md shadow-[#1877F2]/20 hover:bg-[#166fe5]" onClick={startNewCampaign}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nieuwe campagne
                    </Button>
                  } />}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Campaign details</CardTitle>
                  <CardDescription>Adsets, ads en actuele status uit Meta.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {campaignDetails.isLoading ? <Skeleton className="h-48 w-full" /> : campaignDetails.data ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/30 p-4">
                        <div>
                          <p className="font-medium">{String((campaignDetails.data as any).campaign?.name || "Campaign")}</p>
                          <p className="text-xs text-muted-foreground">{String((campaignDetails.data as any).campaign?.objective || "-")} · {String((campaignDetails.data as any).campaign?.effective_status || (campaignDetails.data as any).campaign?.status || "-")}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={openLiveCampaignAsDraft}>
                            <PencilLine className="mr-2 h-3.5 w-3.5" />
                            Bewerk als draft
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => pauseCampaign.mutate({ campaignId: selectedCampaignId || "" })}>Pause</Button>
                          <Button size="sm" onClick={() => resumeCampaign.mutate({ campaignId: selectedCampaignId || "" })}>Resume</Button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {((campaignDetails.data as any).adsets || []).map((adset: any) => (
                          <div key={adset.id} className="rounded-xl border p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-medium">{adset.name}</p>
                              <Badge variant={adset.effective_status === "ACTIVE" || adset.status === "ACTIVE" ? "success" : "secondary"}>{adset.effective_status || adset.status || "-"}</Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">Optimization: {adset.optimization_goal || "-"} · Ads: {(adset.ads || []).length}</p>
                            <div className="mt-3 grid gap-2">
                              {(adset.ads || []).map((ad: any) => (
                                <div key={ad.id} className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span>{ad.name}</span>
                                    <Badge variant={ad.effective_status === "ACTIVE" || ad.status === "ACTIVE" ? "success" : "secondary"}>{ad.effective_status || ad.status || "-"}</Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : <EmptyState title="Geen campaign details" description="Selecteer een campagne om de adsets en ads te bekijken." icon={<Layers3 className="h-8 w-8" />} />}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="drafts">
            <MetaAdsDraftsPanel
              rows={rows as Array<{
                id: string;
                name: string;
                status: string;
                objective?: string | null;
                dailyBudgetCents?: number | null;
                currency?: string | null;
                createdAt?: string | Date | null;
                lastError?: string | null;
              }>}
              formatBudget={(row) => eur(row.dailyBudgetCents, row.currency || "EUR")}
              formatDate={(row) => prettyDate(row.createdAt)}
              renderErrorHint={(raw) => <ErrorHint raw={raw} />}
              onEdit={(id) => openDraftForEditing(id, "campaign")}
              onDuplicate={(id) => duplicateDraft.mutate({ id })}
              onArchive={(id) => archiveDraft.mutate({ id })}
              onStartNew={startNewCampaign}
              duplicatePending={duplicateDraft.isPending}
              archivePending={archiveDraft.isPending}
            />
          </TabsContent>

          <TabsContent value="insights">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Insights</CardTitle>
                <CardDescription>Performance van de laatste 30 dagen op campaign-, adset- of ad-niveau.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {(["campaign", "adset", "ad"] as const).map((level) => (
                    <Button key={level} size="sm" variant={insightLevel === level ? "default" : "outline"} onClick={() => setInsightLevel(level)}>
                      {level}
                    </Button>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl border bg-muted/30 p-3 text-sm"><p className="text-xs uppercase text-muted-foreground">Rijen</p><p className="text-2xl font-semibold">{(insights.data || []).length}</p></div>
                  <div className="rounded-xl border bg-muted/30 p-3 text-sm"><p className="text-xs uppercase text-muted-foreground">Spend</p><p className="text-2xl font-semibold">€{(insights.data || []).reduce((sum: number, row: any) => sum + Number(row.spend || 0), 0).toFixed(2)}</p></div>
                  <div className="rounded-xl border bg-muted/30 p-3 text-sm"><p className="text-xs uppercase text-muted-foreground">Clicks</p><p className="text-2xl font-semibold">{(insights.data || []).reduce((sum: number, row: any) => sum + Number(row.clicks || 0), 0)}</p></div>
                  <div className="rounded-xl border bg-muted/30 p-3 text-sm"><p className="text-xs uppercase text-muted-foreground">Impressies</p><p className="text-2xl font-semibold">{(insights.data || []).reduce((sum: number, row: any) => sum + Number(row.impressions || 0), 0)}</p></div>
                </div>
                <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                  <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" /> AI coach</CardTitle>
                      <CardDescription>Snelle interpretatie van de huidige Meta inzichten.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border bg-card p-3">
                          <p className="text-xs uppercase text-muted-foreground">CTR</p>
                          <p className="text-2xl font-semibold">{insightCoach.ctr.toFixed(2)}%</p>
                        </div>
                        <div className="rounded-xl border bg-card p-3">
                          <p className="text-xs uppercase text-muted-foreground">Gem. CPC</p>
                          <p className="text-2xl font-semibold">€{insightCoach.cpc.toFixed(2)}</p>
                        </div>
                        <div className="rounded-xl border bg-card p-3">
                          <p className="text-xs uppercase text-muted-foreground">Conversions</p>
                          <p className="text-2xl font-semibold">{insightCoach.conversions}</p>
                        </div>
                        <div className="rounded-xl border bg-card p-3">
                          <p className="text-xs uppercase text-muted-foreground">Spend</p>
                          <p className="text-2xl font-semibold">€{insightCoach.spend.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {insightCoach.tips.map((tip) => (
                          <p key={tip} className="rounded-xl border bg-card px-3 py-2">{tip}</p>
                        ))}
                        {!insightCoach.tips.length ? <p className="rounded-xl border bg-card px-3 py-2">De huidige data ziet er stabiel uit. Test vooral nieuwe creatives tegen je best presterende hook.</p> : null}
                      </div>
                    </CardContent>
                  </Card>
                  <div className="space-y-3">
                    {(insights.data || []).map((row: any) => (
                      <div key={row.ad_id || row.adset_id || row.campaign_id || row.campaign_name} className="grid gap-2 rounded-xl border p-3 text-sm md:grid-cols-7">
                        <div className="font-medium">{row.ad_name || row.adset_name || row.campaign_name || row.campaign_id}</div>
                        <div>Reach: {row.reach || 0}</div>
                        <div>Impressies: {row.impressions || 0}</div>
                        <div>Clicks: {row.clicks || 0}</div>
                        <div>CTR: {row.ctr || 0}</div>
                        <div>CPC: €{row.cpc || 0}</div>
                        <div>Spend: €{row.spend || 0}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {!(insights.data || []).length ? <EmptyState title="Geen inzichten" description="Meta geeft nog geen data terug voor dit account of deze periode." icon={<BarChart3 className="h-8 w-8" />} /> : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Meta Ads instellingen</CardTitle>
                <CardDescription>Selecteer exact één Ad Account per workspace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Card className="border-amber-500/30 bg-amber-500/10">
                  <CardContent className="flex gap-3 p-4 text-sm">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-700" />
                    <div>
                      <p className="font-medium text-amber-950 dark:text-amber-100">Nieuwe campagnes worden gepauzeerd aangemaakt in Meta.</p>
                      <p className="text-amber-900/80 dark:text-amber-100/80">Live zetten doe je bewust in Meta Ads Manager.</p>
                    </div>
                  </CardContent>
                </Card>
                <div className="rounded-xl border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">Meta Ads module</p>
                      <p className="text-xs text-muted-foreground">Vereist om Push paused naar Meta te gebruiken.</p>
                    </div>
                    <Switch checked={Boolean(connection.data?.autoadsEnabled)} disabled={setAutoadsEnabled.isPending} onCheckedChange={(enabled) => setAutoadsEnabled.mutate({ enabled })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>AI-training voor Meta Ads</Label>
                  <Textarea
                    className="min-h-32"
                    value={aiTrainingNotes}
                    onChange={(event) => setAiTrainingNotes(event.target.value)}
                    placeholder="Beschrijf je merk, tone of voice, verboden claims, voorkeurs-CTA's, doelgroepen en voorbeeldcopy. De AI gebruikt dit bij campagne- en advertentievoorstellen."
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      disabled={updateAiTrainingNotes.isPending}
                      onClick={() => updateAiTrainingNotes.mutate({ notes: aiTrainingNotes })}
                    >
                      {updateAiTrainingNotes.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      AI-training opslaan
                    </Button>
                    <p className="text-xs text-muted-foreground">Workspace-breed. Geldt voor alle Meta Ads AI-voorstellen in deze studio.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Beschikbare Meta Ad Accounts</Label>
                  {adAccounts.isLoading ? <Skeleton className="h-20 w-full" /> : (adAccounts.data || []).map((account: any) => (
                    <div key={account.id} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{account.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{account.id} · {account.currency} · {account.businessName || "Geen businessnaam"}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={connection.data?.selectedAdAccountId === account.id ? "secondary" : "default"}
                        onClick={() => selectAdAccount.mutate({ adAccountId: account.id, name: account.name, currency: account.currency, timezoneName: account.timezoneName, businessId: account.businessId })}
                      >
                        {connection.data?.selectedAdAccountId === account.id ? "Geselecteerd" : "Selecteren"}
                      </Button>
                    </div>
                  ))}
                  {!(adAccounts.data || []).length ? <EmptyState title="Geen Ad Accounts gevonden" description="Controleer ads_read/ads_management en koppel Meta opnieuw." icon={<Megaphone className="h-8 w-8" />} /> : null}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <MetaAiCampaignBriefingDialog
        open={aiCampaignDialogOpen}
        onOpenChange={setAiCampaignDialogOpen}
        onConfirm={handleMetaAiSuggestion}
        pending={generateSuggestion.isPending}
      />
    </TooltipProvider>
  );
}
