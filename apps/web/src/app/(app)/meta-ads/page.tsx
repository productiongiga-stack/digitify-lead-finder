"use client";

import { useEffect, useMemo, useState } from "react";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@digitify/ui";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Eye,
  HelpCircle,
  Image as ImageIcon,
  Layers3,
  Loader2,
  Lock,
  Megaphone,
  PauseCircle,
  Plus,
  RefreshCcw,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Wand2,
  XCircle,
} from "lucide-react";
import { useToast } from "@/components/feedback/toast-provider";
import {
  buildCampaignScore,
  buildCampaignScoreEntries,
  type CampaignScoreEntry,
} from "@/lib/meta-ads-campaign-score";

type PlanStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "PUSHING" | "PUSHED_PAUSED" | "FAILED" | "CANCELLED";
type PlacementKey =
  | "facebook_feed"
  | "facebook_story"
  | "facebook_reels"
  | "instagram_feed"
  | "instagram_story"
  | "instagram_reels"
  | "instagram_explore"
  | "audience_network";
type BuilderStep = "setup" | "campaign" | "adsets" | "creatives" | "review";
type BidStrategy = "LOWEST_COST_WITHOUT_CAP" | "LOWEST_COST_WITH_BID_CAP" | "COST_CAP";
type OptimizationGoal = "AUTO" | "LINK_CLICKS" | "LANDING_PAGE_VIEWS" | "LEAD_GENERATION" | "OFFSITE_CONVERSIONS" | "REACH" | "IMPRESSIONS";
type DestinationType = "AUTO" | "WEBSITE" | "MESSENGER" | "WHATSAPP" | "PHONE_CALL";
type AssetSlot = "feed" | "square" | "story";
type AiTone = "professioneel" | "speels" | "direct" | "luxueus" | "vriendelijk";

type ErrorExplanation = {
  label: string;
  code?: string;
  message: string;
  actions: string[];
};

type AdsetDraft = {
  id: string;
  name: string;
  countries: string;
  regions: string;
  cities: string;
  ageMin: string;
  ageMax: string;
  genders: string;
  placements: PlacementKey[];
  customAudiencesText: string;
  excludedCustomAudiencesText: string;
  interestSignalsText: string;
  advantageAudience: boolean;
  notes: string;
  variants: CreativeVariantDraft[];
};

type CreativeVariantDraft = {
  id: string;
  name: string;
  adName: string;
  primaryText: string;
  headline: string;
  description: string;
  linkUrl: string;
  displayUrl: string;
  feedImageUrl: string;
  squareImageUrl: string;
  storyImageUrl: string;
  publishAsset: AssetSlot;
  ctaType: string;
  ctaLabel: string;
  urlTags: string;
  angle: string;
};

type OperationalRequirement = {
  code: string;
  title: string;
  description: string;
  nextStep: string;
};

type ImageProbeState = {
  status: "idle" | "loading" | "ready" | "error";
  width: number;
  height: number;
};

const STEPS: Array<{ id: BuilderStep; label: string; description: string }> = [
  { id: "setup", label: "1. Setup", description: "Objective, budget en AI-briefing" },
  { id: "campaign", label: "2. Campaign", description: "Bidding, tracking en defaults" },
  { id: "adsets", label: "3. Adsets", description: "Meerdere doelgroepen en delivery" },
  { id: "creatives", label: "4. Creatives", description: "Varianten per adset" },
  { id: "review", label: "5. Review", description: "Score, checks, advanced JSON en save" },
];

const PLACEMENTS: Array<{ key: PlacementKey; label: string; hint: string }> = [
  { key: "facebook_feed", label: "Facebook feed", hint: "1:1 of 1.91:1" },
  { key: "facebook_story", label: "Facebook story", hint: "9:16" },
  { key: "facebook_reels", label: "Facebook reels", hint: "9:16" },
  { key: "instagram_feed", label: "Instagram feed", hint: "1:1 of 4:5" },
  { key: "instagram_story", label: "Instagram story", hint: "9:16" },
  { key: "instagram_reels", label: "Instagram reels", hint: "9:16" },
  { key: "instagram_explore", label: "Instagram explore", hint: "extra bereik" },
  { key: "audience_network", label: "Audience Network", hint: "let op leadkwaliteit" },
];

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

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function csvToList(value: string, upper = true) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (upper ? item.toUpperCase() : item));
}

function linesToList(value: string, max = 50) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

function listToLines(value: unknown, fallback: string[]) {
  return (Array.isArray(value) && value.length ? value : fallback)
    .map((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const row = item as Record<string, unknown>;
        return String(row.id || row.key || "");
      }
      return String(item);
    })
    .filter(Boolean)
    .join("\n");
}

function parseJson(value: string, label: string) {
  if (!value.trim()) return {};
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} bevat geen geldige JSON.`);
  }
}

function createAdset(name = "Nieuwe doelgroep", id = `adset-${Date.now()}`): AdsetDraft {
  return {
    id,
    name,
    countries: "BE",
    regions: "",
    cities: "",
    ageMin: "24",
    ageMax: "60",
    genders: "ALL",
    placements: ["facebook_feed", "instagram_feed", "instagram_story"],
    customAudiencesText: "",
    excludedCustomAudiencesText: "",
    interestSignalsText: "Leadgeneratie\nOnline marketing\nKMO",
    advantageAudience: false,
    notes: "",
    variants: [createCreativeVariant("Variant 1")],
  };
}

function createCreativeVariant(name = "Nieuwe variant", id = `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`): CreativeVariantDraft {
  return {
    id,
    name,
    adName: name,
    primaryText: "",
    headline: "",
    description: "",
    linkUrl: "",
    displayUrl: "",
    feedImageUrl: "",
    squareImageUrl: "",
    storyImageUrl: "",
    publishAsset: "feed",
    ctaType: "LEARN_MORE",
    ctaLabel: "Meer informatie",
    urlTags: "utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}",
    angle: "",
  };
}

function mergeVariantWithBase(base: {
  adName: string;
  primaryText: string;
  headline: string;
  description: string;
  linkUrl: string;
  displayUrl: string;
  feedImageUrl: string;
  squareImageUrl: string;
  storyImageUrl: string;
  publishAsset: AssetSlot;
  ctaType: string;
  ctaLabel: string;
  urlTags: string;
}, variant?: Partial<CreativeVariantDraft> | null) {
  const next = variant || {};
  return {
    adName: next.adName || next.name || base.adName,
    primaryText: next.primaryText || base.primaryText,
    headline: next.headline || base.headline,
    description: next.description || base.description,
    linkUrl: next.linkUrl || base.linkUrl,
    displayUrl: next.displayUrl || base.displayUrl,
    feedImageUrl: next.feedImageUrl || base.feedImageUrl,
    squareImageUrl: next.squareImageUrl || base.squareImageUrl,
    storyImageUrl: next.storyImageUrl || base.storyImageUrl,
    publishAsset: next.publishAsset || base.publishAsset,
    ctaType: next.ctaType || base.ctaType,
    ctaLabel: next.ctaLabel || base.ctaLabel,
    urlTags: next.urlTags || base.urlTags,
  };
}

function placementKeysFromTargeting(targeting: Record<string, any>): PlacementKey[] {
  const next: PlacementKey[] = [];
  const facebookPositions = Array.isArray(targeting.facebook_positions) ? targeting.facebook_positions : [];
  const instagramPositions = Array.isArray(targeting.instagram_positions) ? targeting.instagram_positions : [];
  const publishers = Array.isArray(targeting.publisher_platforms) ? targeting.publisher_platforms : [];
  if (facebookPositions.includes("feed")) next.push("facebook_feed");
  if (facebookPositions.includes("story")) next.push("facebook_story");
  if (facebookPositions.includes("facebook_reels")) next.push("facebook_reels");
  if (instagramPositions.includes("stream")) next.push("instagram_feed");
  if (instagramPositions.includes("story")) next.push("instagram_story");
  if (instagramPositions.includes("reels")) next.push("instagram_reels");
  if (instagramPositions.includes("explore")) next.push("instagram_explore");
  if (publishers.includes("audience_network")) next.push("audience_network");
  return next.length ? next : ["facebook_feed", "instagram_feed"];
}

function targetingToAdset(targeting: Record<string, any>, fallbackName: string, id = `adset-${Date.now()}`): AdsetDraft {
  const geo = asRecord(targeting.geo_locations);
  const automation = asRecord(targeting.targeting_automation);
  return {
    id,
    name: String(targeting.name || fallbackName),
    countries: Array.isArray(geo.countries) ? geo.countries.join(", ") : "BE",
    regions: listToLines(geo.regions, []),
    cities: listToLines(geo.cities, []),
    ageMin: String(targeting.age_min || 24),
    ageMax: String(targeting.age_max || 60),
    genders: Array.isArray(targeting.genders) && targeting.genders.length === 1 ? String(targeting.genders[0]) : "ALL",
    placements: placementKeysFromTargeting(targeting),
    customAudiencesText: listToLines(targeting.custom_audiences, []),
    excludedCustomAudiencesText: listToLines(asRecord(targeting.exclusions).custom_audiences, []),
    interestSignalsText: listToLines(targeting.interestSignals, ["Leadgeneratie", "Online marketing", "KMO"]),
    advantageAudience: automation.advantage_audience === 1 || automation.advantage_audience === "1",
    notes: String(targeting.audienceNotes || ""),
    variants: [createCreativeVariant("Variant 1", `${id}-variant-1`)],
  };
}

function explainMetaError(raw?: string | null): ErrorExplanation | null {
  if (!raw) return null;
  const message = raw.replace(/\s+/g, " ").trim();
  const code = message.match(/code\s+(\d+)/i)?.[1] || message.match(/OAuthException[^\d]*(\d+)/i)?.[1];
  const lower = message.toLowerCase();

  if (lower.includes("permission") || lower.includes("scope") || lower.includes("ads_management") || lower.includes("ads_read")) {
    return {
      label: "Rechten of scopes ontbreken",
      code,
      message,
      actions: [
        "Koppel Meta opnieuw via Integraties zodat ads_read en ads_management mee in de token zitten.",
        "Controleer in Meta App Review dat Marketing API rechten zijn goedgekeurd.",
        "Zorg dat de gebruiker toegang heeft tot het geselecteerde Ad Account en de Page.",
      ],
    };
  }
  if (lower.includes("page") || lower.includes("page_id")) {
    return {
      label: "Facebook Page ontbreekt of is niet toegankelijk",
      code,
      message,
      actions: [
        "Koppel eerst een Facebook Page bij Integraties.",
        "Controleer dat dezelfde Meta gebruiker Page toegang en Ad Account toegang heeft.",
      ],
    };
  }
  if (lower.includes("linkurl") || lower.includes("url") || lower.includes("invalid url")) {
    return {
      label: "Bestemmingslink is ongeldig",
      code,
      message,
      actions: [
        "Gebruik een volledige https URL, bijvoorbeeld https://leads.digitify.be.",
        "Test of de landingspagina publiek bereikbaar is.",
      ],
    };
  }
  if (lower.includes("budget guard") || lower.includes("budget")) {
    return {
      label: "Budget wordt geblokkeerd",
      code,
      message,
      actions: [
        "Verlaag het dagbudget of verhoog de workspace budgetlimiet in Integraties.",
        "Minimum is 100 cent.",
      ],
    };
  }
  if (lower.includes("aspect ratio") || lower.includes("2207009") || lower.includes("36003")) {
    return {
      label: "Afbeeldingsformaat past niet bij je plaatsing",
      code,
      message,
      actions: [
        "Gebruik voor feed bij voorkeur 1:1 of 1.91:1.",
        "Gebruik voor Stories en Reels een aparte 9:16 visual.",
        "Kies in de builder welk beeld effectief naar Meta gepusht wordt.",
      ],
    };
  }
  if (lower.includes("creative") || lower.includes("object_story_spec") || lower.includes("image") || lower.includes("picture") || lower.includes("call_to_action")) {
    return {
      label: "Creative voldoet niet aan Meta regels",
      code,
      message,
      actions: [
        "Controleer headline, tekst, CTA, afbeelding en landingspagina.",
        "Gebruik voor Story/Reels een 9:16 afbeelding en voor feed liefst 1:1 of 4:5.",
        "Gebruik een publieke afbeeldings-URL die Meta kan downloaden.",
      ],
    };
  }
  return {
    label: "Meta API fout",
    code,
    message,
    actions: [
      "Controleer de geselecteerde Ad Account, OAuth koppeling en Meta App mode.",
      "Open Meta Ads Manager om te zien of het account restricties of billing issues heeft.",
    ],
  };
}

function useImageProbe(url: string): ImageProbeState {
  const [state, setState] = useState<ImageProbeState>({ status: "idle", width: 0, height: 0 });

  useEffect(() => {
    if (!url) {
      setState({ status: "idle", width: 0, height: 0 });
      return;
    }

    let cancelled = false;
    setState({ status: "loading", width: 0, height: 0 });

    const image = new window.Image();
    image.onload = () => {
      if (cancelled) return;
      setState({ status: "ready", width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      if (cancelled) return;
      setState({ status: "error", width: 0, height: 0 });
    };
    image.src = url;

    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}

function probeLabel(probe: ImageProbeState) {
  if (probe.status === "loading") return "Controleren...";
  if (probe.status === "error") return "Kon bestand niet uitlezen";
  if (probe.status !== "ready") return "Nog geen bestand";
  return `${probe.width}x${probe.height}`;
}

function aspectRatio(probe: ImageProbeState) {
  if (probe.status !== "ready" || !probe.width || !probe.height) return null;
  return probe.width / probe.height;
}

function roughlyMatches(ratio: number | null, target: number, tolerance = 0.08) {
  if (!ratio) return false;
  return Math.abs(ratio - target) <= tolerance;
}

function resolvePublishImage(slot: AssetSlot, images: { feedImageUrl: string; squareImageUrl: string; storyImageUrl: string }) {
  if (slot === "story") return images.storyImageUrl || images.feedImageUrl || images.squareImageUrl;
  if (slot === "square") return images.squareImageUrl || images.feedImageUrl || images.storyImageUrl;
  return images.feedImageUrl || images.squareImageUrl || images.storyImageUrl;
}

function describeOperationalRequirement(code: string): OperationalRequirement {
  if (code === "META_SCOPE_MISSING") {
    return {
      code,
      title: "Ads-scopes ontbreken",
      description: "De OAuth-token mist minstens een van de vereiste ads-rechten.",
      nextStep: "Koppel Meta opnieuw met ads_read, ads_management en waar nodig business_management.",
    };
  }
  if (code === "META_PAGE_MISSING") {
    return {
      code,
      title: "Geen Facebook Page gekoppeld",
      description: "Meta Ads en social creatives steunen op een geselecteerde pagina-identiteit.",
      nextStep: "Kies in Integraties een Facebook Page voor deze workspace.",
    };
  }
  if (code === "META_ACCOUNT_NOT_SELECTED") {
    return {
      code,
      title: "Geen Ad Account geselecteerd",
      description: "De studio weet nog niet naar welk Meta Ad Account de campagne moet gaan.",
      nextStep: "Ga naar Instellingen in deze module en selecteer exact één Ad Account.",
    };
  }
  if (code === "META_MEDIA_MISSING") {
    return {
      code,
      title: "Ontbrekende media",
      description: "Er ontbreekt minstens één bruikbare visual voor de gekozen creatives of placements.",
      nextStep: "Upload feed-, square- of story-assets en controleer de preview.",
    };
  }
  return {
    code,
    title: "Operationele blokkade",
    description: "Deze workspace mist nog een vereiste instelling om veilig naar Meta te pushen.",
    nextStep: "Open de instellingen en werk de ontbrekende koppeling of configuratie af.",
  };
}

function buildMergedVariantPayload(
  base: {
    adName: string;
    primaryText: string;
    headline: string;
    description: string;
    linkUrl: string;
    displayUrl: string;
    feedImageUrl: string;
    squareImageUrl: string;
    storyImageUrl: string;
    publishAsset: AssetSlot;
    ctaType: string;
    ctaLabel: string;
    urlTags: string;
  },
  variant: CreativeVariantDraft,
) {
  const merged = mergeVariantWithBase(base, variant);
  return {
    id: variant.id,
    name: variant.name.trim() || merged.adName.trim(),
    adName: merged.adName.trim(),
    primaryText: merged.primaryText.trim(),
    message: merged.primaryText.trim(),
    headline: merged.headline.trim(),
    description: merged.description.trim(),
    linkUrl: merged.linkUrl.trim(),
    displayUrl: merged.displayUrl.trim(),
    feedImageUrl: merged.feedImageUrl.trim(),
    squareImageUrl: merged.squareImageUrl.trim(),
    storyImageUrl: merged.storyImageUrl.trim(),
    imageUrl: resolvePublishImage(merged.publishAsset, {
      feedImageUrl: merged.feedImageUrl.trim(),
      squareImageUrl: merged.squareImageUrl.trim(),
      storyImageUrl: merged.storyImageUrl.trim(),
    }),
    publishAsset: merged.publishAsset,
    ctaType: merged.ctaType,
    cta: merged.ctaLabel.trim(),
    ctaLabel: merged.ctaLabel.trim(),
    urlTags: merged.urlTags.trim(),
    angle: variant.angle.trim(),
  };
}

function buildInsightCoachRows(rows: any[], level: "campaign" | "adset" | "ad") {
  const spend = rows.reduce((sum, row) => sum + Number(row.spend || 0), 0);
  const clicks = rows.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
  const impressions = rows.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
  const ctr = impressions ? (clicks / impressions) * 100 : 0;
  const cpc = clicks ? spend / clicks : 0;
  const bestRow = [...rows]
    .filter((row) => Number(row.clicks || 0) > 0)
    .sort((left, right) => Number(right.ctr || 0) - Number(left.ctr || 0))[0];
  const conversions = rows.reduce((sum, row) => {
    const actions = Array.isArray(row.actions) ? row.actions : [];
    return (
      sum +
      actions.reduce((inner: number, action: any) => {
        const type = String(action?.action_type || "");
        if (["lead", "purchase", "omni_lead", "offsite_conversion.lead", "offsite_conversion.purchase"].includes(type)) {
          return inner + Number(action?.value || 0);
        }
        return inner;
      }, 0)
    );
  }, 0);

  const tips: string[] = [];
  if (!rows.length) tips.push("Er zijn nog geen inzichten om AI-advies op te baseren.");
  if (rows.length <= 1) tips.push(`Voeg minstens een tweede ${level === "campaign" ? "campagne" : level === "adset" ? "adset" : "ad"} toe om performance beter te kunnen vergelijken.`);
  if (rows.length && impressions > 0 && ctr < 1) tips.push("CTR ligt laag. Test een scherpere hook in headline en primaire tekst.");
  if (spend > 0 && clicks === 0) tips.push("Er is spend zonder clicks. Controleer targeting, creative fit en de landingspagina-belofte.");
  if (cpc > 2.5) tips.push("CPC is relatief hoog. Splits je doelgroep op of voeg sterkere varianten toe per adset.");
  if (!conversions && spend > 0) tips.push("Er worden nog geen lead- of purchase-acties teruggegeven. Controleer Pixel, event mapping en objective.");
  if (bestRow?.ad_name || bestRow?.adset_name || bestRow?.campaign_name) {
    tips.push(`Beste CTR nu: ${bestRow.ad_name || bestRow.adset_name || bestRow.campaign_name}. Gebruik die hook als inspiratie voor nieuwe varianten.`);
  }

  return {
    spend,
    clicks,
    impressions,
    ctr,
    cpc,
    conversions,
    tips: tips.slice(0, 4),
  };
}

function buildTargetingFromAdset(adset: AdsetDraft) {
  const facebookPositions = [
    adset.placements.includes("facebook_feed") ? "feed" : "",
    adset.placements.includes("facebook_story") ? "story" : "",
    adset.placements.includes("facebook_reels") ? "facebook_reels" : "",
  ].filter(Boolean);
  const instagramPositions = [
    adset.placements.includes("instagram_feed") ? "stream" : "",
    adset.placements.includes("instagram_story") ? "story" : "",
    adset.placements.includes("instagram_reels") ? "reels" : "",
    adset.placements.includes("instagram_explore") ? "explore" : "",
  ].filter(Boolean);
  const publisherPlatforms = [
    facebookPositions.length ? "facebook" : "",
    instagramPositions.length ? "instagram" : "",
    adset.placements.includes("audience_network") ? "audience_network" : "",
  ].filter(Boolean);
  const gendersPayload = adset.genders === "ALL" ? [] : [Number(adset.genders)];

  return {
    name: adset.name.trim(),
    geo_locations: {
      countries: csvToList(adset.countries).length ? csvToList(adset.countries) : ["BE"],
      regions: linesToList(adset.regions),
      cities: linesToList(adset.cities),
    },
    age_min: numberValue(adset.ageMin) || 18,
    age_max: numberValue(adset.ageMax) || 65,
    genders: gendersPayload,
    publisher_platforms: publisherPlatforms.length ? publisherPlatforms : ["facebook", "instagram"],
    facebook_positions: facebookPositions,
    instagram_positions: instagramPositions.length ? instagramPositions : ["stream"],
    custom_audiences: linesToList(adset.customAudiencesText, 25),
    exclusions: { custom_audiences: linesToList(adset.excludedCustomAudiencesText, 25) },
    interestSignals: linesToList(adset.interestSignalsText, 25),
    targeting_automation: { advantage_audience: adset.advantageAudience ? 1 : 0 },
    audienceNotes: adset.notes.trim() || null,
  };
}

function CampaignScorePanel({ entry, compact }: { entry: CampaignScoreEntry; compact?: boolean }) {
  return (
    <div className="rounded-2xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate font-medium">{entry.name}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-[10px]">
              {entry.source === "draft" ? "Draft" : "Live Meta"}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {entry.statusLabel}
            </Badge>
          </div>
        </div>
        <div className="flex items-end gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Score</p>
            <p className={compact ? "text-2xl font-semibold" : "text-3xl font-semibold"}>{entry.score.score}</p>
          </div>
          <Badge variant={entry.score.score >= 70 ? "success" : "warning"}>{entry.score.label}</Badge>
        </div>
      </div>
      {!compact ? (
        <div className="mt-3 space-y-2">
          {entry.score.tips.slice(0, 2).map((tip) => (
            <p key={tip} className="rounded-xl border bg-card px-3 py-2 text-xs leading-5 text-muted-foreground">
              {tip}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function HelpLabel({ label, help }: { label: string; help: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label>{label}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="rounded-full text-muted-foreground transition hover:text-foreground" aria-label={`Uitleg voor ${label}`}>
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-5">
          {help}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function ErrorHint({ raw }: { raw?: string | null }) {
  const explanation = explainMetaError(raw);
  if (!explanation) return null;
  return (
    <div className="mt-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive">
      <div className="flex flex-wrap items-center gap-2 font-semibold">
        <AlertTriangle className="h-3.5 w-3.5" />
        {explanation.label}
        {explanation.code ? <span className="rounded-full bg-background px-2 py-0.5 font-mono">code {explanation.code}</span> : null}
      </div>
      <p className="mt-1 text-destructive/90">{explanation.message}</p>
      <div className="mt-2 space-y-1 text-destructive/80">{explanation.actions.map((action) => <p key={action}>- {action}</p>)}</div>
    </div>
  );
}

function StepButton({
  step,
  activeStep,
  complete,
  locked,
  onClick,
}: {
  step: (typeof STEPS)[number];
  activeStep: BuilderStep;
  complete: boolean;
  locked: boolean;
  onClick: () => void;
}) {
  const active = activeStep === step.id;
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onClick}
      className={`rounded-2xl border p-3 text-left transition ${active ? "border-blue-700 bg-blue-700 text-white shadow-sm" : complete ? "border-blue-500/40 bg-blue-500/10" : locked ? "cursor-not-allowed bg-muted/50 opacity-60" : "bg-card hover:bg-muted"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{step.label}</span>
        {locked ? <Lock className="h-4 w-4" /> : complete ? <CheckCircle2 className={`h-4 w-4 ${active ? "text-white" : "text-blue-600"}`} /> : null}
      </div>
      <p className={`mt-1 text-xs ${active ? "text-white/75" : "text-muted-foreground"}`}>{step.description}</p>
    </button>
  );
}

function TogglePill({ active, label, hint, onClick }: { active: boolean; label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-3 py-2 text-left text-sm transition ${active ? "border-slate-950 bg-slate-950 text-white shadow-sm dark:border-white dark:bg-white dark:text-slate-950" : "border-border bg-card hover:bg-muted"}`}
    >
      <span className="block font-medium">{label}</span>
      {hint ? <span className={`text-xs ${active ? "text-white/70 dark:text-slate-700" : "text-muted-foreground"}`}>{hint}</span> : null}
    </button>
  );
}

function CheckRow({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border bg-card p-3 text-sm">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />}
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function AssetUploadCard(props: {
  title: string;
  help: string;
  ratio: string;
  recommended: string;
  value: string;
  placeholder: string;
  probe: ImageProbeState;
  uploading: boolean;
  onChange: (value: string) => void;
  onUpload: (file: File) => Promise<void>;
}) {
  return (
    <div className="rounded-2xl border p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <HelpLabel label={props.title} help={props.help} />
          <p className="mt-1 text-xs text-muted-foreground">Ratio: {props.ratio} · Aanbevolen: {props.recommended}</p>
          <p className="mt-1 text-xs text-muted-foreground">Gedetecteerd: {probeLabel(props.probe)}</p>
        </div>
        <label className="inline-flex cursor-pointer items-center">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void props.onUpload(file);
              event.currentTarget.value = "";
            }}
          />
          <span className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted">
            {props.uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload
          </span>
        </label>
      </div>
      <Input value={props.value} onChange={(event) => props.onChange(event.target.value)} placeholder={props.placeholder} />
      <div className="mt-3 overflow-hidden rounded-2xl border bg-muted/30">
        {props.value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.value} alt={props.title} className="aspect-[16/9] w-full object-cover" />
        ) : (
          <div className="flex aspect-[16/9] items-center justify-center text-xs text-muted-foreground">
            <ImageIcon className="mr-2 h-4 w-4" /> Preview verschijnt hier
          </div>
        )}
      </div>
    </div>
  );
}

function VariantAssetField(props: {
  title: string;
  help: string;
  ratio: string;
  recommended: string;
  value: string;
  placeholder: string;
  uploading: boolean;
  onChange: (value: string) => void;
  onUpload: (file: File) => Promise<void>;
}) {
  const probe = useImageProbe(props.value);

  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <HelpLabel label={props.title} help={props.help} />
          <p className="mt-1 text-xs text-muted-foreground">Ratio: {props.ratio} · Aanbevolen: {props.recommended}</p>
          <p className="mt-1 text-xs text-muted-foreground">Gedetecteerd: {probeLabel(probe)}</p>
        </div>
        <label className="inline-flex cursor-pointer items-center">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void props.onUpload(file);
              event.currentTarget.value = "";
            }}
          />
          <span className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted">
            {props.uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload
          </span>
        </label>
      </div>
      <Input value={props.value} onChange={(event) => props.onChange(event.target.value)} placeholder={props.placeholder} />
    </div>
  );
}

function MetaPreview(props: {
  primaryText: string;
  headline: string;
  description: string;
  linkUrl: string;
  feedImageUrl: string;
  storyImageUrl: string;
  ctaLabel: string;
  pageName: string;
  placements: PlacementKey[];
}) {
  const displayUrl = props.linkUrl.replace(/^https?:\/\//, "").replace(/\/$/, "") || "leads.digitify.be";
  return (
    <Card className="overflow-hidden border-slate-200 bg-gradient-to-br from-blue-50 via-white to-fuchsia-50 shadow-sm dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="h-4 w-4" /> Meta preview
        </CardTitle>
        <CardDescription>Indicatief voorbeeld. Meta kan tekst, CTA en plaatsing automatisch aanpassen.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-3xl border bg-white p-4 shadow-sm dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">D</div>
            <div>
              <p className="text-sm font-semibold">{props.pageName || "Digitify"}</p>
              <p className="text-xs text-muted-foreground">Gesponsord · Facebook feed</p>
            </div>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm leading-6">{props.primaryText || "Je advertentietekst verschijnt hier."}</p>
          <div className="mt-3 overflow-hidden rounded-2xl border bg-slate-100 dark:bg-slate-900">
            {props.feedImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={props.feedImageUrl} alt="Advertentie preview" className="aspect-[1.91/1] w-full object-cover" />
            ) : (
              <div className="flex aspect-[1.91/1] items-center justify-center text-muted-foreground">
                <ImageIcon className="mr-2 h-5 w-5" /> Afbeelding preview
              </div>
            )}
            <div className="bg-slate-50 p-3 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{displayUrl}</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold leading-tight">{props.headline || "Headline"}</p>
                  <p className="text-xs text-muted-foreground">{props.description || "Beschrijving"}</p>
                </div>
                <span className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-100">{props.ctaLabel}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[2rem] border bg-gradient-to-b from-fuchsia-50 to-orange-50 p-3 dark:from-slate-950 dark:to-slate-900">
            <div className="mx-auto max-w-[190px] rounded-[1.7rem] border-4 border-slate-900 bg-white p-2 shadow-xl dark:bg-slate-950">
              <div className="overflow-hidden rounded-[1.25rem] border bg-slate-100 dark:bg-slate-900">
                {props.storyImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={props.storyImageUrl} alt="Story preview" className="aspect-[9/16] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[9/16] items-center justify-center px-4 text-center text-xs text-muted-foreground">Story/Reels preview</div>
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-xs font-medium">{props.headline || "Instagram headline"}</p>
            </div>
          </div>
          <div className="rounded-3xl border bg-white p-4 dark:bg-slate-950">
            <p className="text-sm font-semibold">Plaatsingen in deze builder</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {props.placements.map((placement) => (
                <Badge key={placement} variant="secondary">
                  {PLACEMENTS.find((item) => item.key === placement)?.label}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ApprovalQueue(props: {
  rows: any[];
  selectedPlanId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onSubmit: (id: string) => void;
  onApprove: (id: string) => void;
  onPush: (id: string) => void;
  onRetry: (id: string) => void;
  onReject: (id: string) => void;
  onCancel: (id: string) => void;
  autoadsEnabled: boolean;
  pushing: boolean;
}) {
  if (props.loading) return <Skeleton className="h-40 w-full" />;
  if (!props.rows.length) {
    return (
      <EmptyState
        title="Nog geen Meta Ads drafts"
        description="Maak je eerste draft aan via de wizard."
        icon={<PauseCircle className="h-8 w-8" />}
      />
    );
  }

  return (
    <div className="space-y-3">
      {props.rows.map((row) => (
        <div key={row.id} className={`rounded-2xl border p-4 ${props.selectedPlanId === row.id ? "border-primary bg-primary/5" : "bg-card"}`}>
          <button type="button" className="w-full text-left" onClick={() => props.onSelect(row.id)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{row.name}</p>
              {statusBadge(row.status)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {row.objective} · {eur(row.dailyBudgetCents, row.currency)} · bijgewerkt {prettyDate(row.updatedAt)}
            </p>
            <ErrorHint raw={row.lastError} />
          </button>
          <div className="mt-3 flex flex-wrap gap-2">
            {["DRAFT", "FAILED", "CANCELLED"].includes(row.status) ? (
              <Button size="sm" variant="outline" onClick={() => props.onSubmit(row.id)}>
                Indienen
              </Button>
            ) : null}
            {row.status === "PENDING_APPROVAL" ? (
              <Button size="sm" onClick={() => props.onApprove(row.id)}>
                Goedkeuren
              </Button>
            ) : null}
            {row.status === "APPROVED" ? (
              <Button size="sm" disabled={!props.autoadsEnabled || props.pushing} onClick={() => props.onPush(row.id)}>
                <Send className="mr-2 h-3 w-3" />
                Push paused
              </Button>
            ) : null}
            {row.status === "FAILED" ? (
              <Button size="sm" variant="outline" onClick={() => props.onRetry(row.id)}>
                <RefreshCcw className="mr-2 h-3 w-3" />
                Retry
              </Button>
            ) : null}
            {!["PUSHING", "PUSHED_PAUSED", "CANCELLED"].includes(row.status) ? (
              <Button size="sm" variant="outline" onClick={() => props.onReject(row.id)}>
                Afkeuren
              </Button>
            ) : null}
            {!["PUSHING", "PUSHED_PAUSED", "CANCELLED"].includes(row.status) ? (
              <Button size="sm" variant="outline" onClick={() => props.onCancel(row.id)}>
                Annuleren
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MetaAdsPage() {
  const { showToast } = useToast();
  const utils = trpc.useUtils();

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [loadedPlanId, setLoadedPlanId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<BuilderStep>("setup");
  const [adsTab, setAdsTab] = useState("dashboard");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [insightLevel, setInsightLevel] = useState<"campaign" | "adset" | "ad">("campaign");
  const [approvalFilter, setApprovalFilter] = useState<"ALL" | PlanStatus>("ALL");
  const [activeCreativeRef, setActiveCreativeRef] = useState<{ adsetId: string; variantId: string } | null>(null);

  const [name, setName] = useState("Digitify Meta campagne");
  const [objective, setObjective] = useState("OUTCOME_TRAFFIC");
  const [currency, setCurrency] = useState("EUR");
  const [dailyBudget, setDailyBudget] = useState("2500");
  const [lifetimeBudget, setLifetimeBudget] = useState("");
  const [campaignSpendCap, setCampaignSpendCap] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [bidStrategy, setBidStrategy] = useState<BidStrategy>("LOWEST_COST_WITHOUT_CAP");
  const [bidAmount, setBidAmount] = useState("");
  const [buyingType, setBuyingType] = useState("AUCTION");
  const [specialAdCategories, setSpecialAdCategories] = useState("");
  const [product, setProduct] = useState("Lead generation voor lokale bedrijven");
  const [audience, setAudience] = useState("Belgische KMO-eigenaars en zaakvoerders");
  const [aiTone, setAiTone] = useState<AiTone>("professioneel");

  const [pageName, setPageName] = useState("Digitify");
  const [adName, setAdName] = useState("Digitify Meta Ad");
  const [primaryText, setPrimaryText] = useState("Ontdek hoe Digitify meer kwalitatieve leads kan vinden voor je bedrijf.");
  const [headline, setHeadline] = useState("Meer leads, minder giswerk");
  const [description, setDescription] = useState("Campagne wordt veilig als gepauzeerd aangemaakt.");
  const [linkUrl, setLinkUrl] = useState("https://leads.digitify.be");
  const [displayUrl, setDisplayUrl] = useState("leads.digitify.be");
  const [feedImageUrl, setFeedImageUrl] = useState("");
  const [squareImageUrl, setSquareImageUrl] = useState("");
  const [storyImageUrl, setStoryImageUrl] = useState("");
  const [publishAsset, setPublishAsset] = useState<AssetSlot>("feed");
  const [ctaType, setCtaType] = useState("LEARN_MORE");
  const [ctaLabel, setCtaLabel] = useState("Meer informatie");
  const [urlTags, setUrlTags] = useState("utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}");
  const [optimizationGoal, setOptimizationGoal] = useState<OptimizationGoal>("AUTO");
  const [destinationType, setDestinationType] = useState<DestinationType>("AUTO");
  const [billingEvent, setBillingEvent] = useState("IMPRESSIONS");
  const [pixelId, setPixelId] = useState("");
  const [customEventType, setCustomEventType] = useState("LEAD");
  const [adsets, setAdsets] = useState<AdsetDraft[]>([createAdset("Belgie breed", "adset-1")]);
  const [advancedCreativeJson, setAdvancedCreativeJson] = useState("{}");
  const [advancedTargetingJson, setAdvancedTargetingJson] = useState("{}");
  const [uploadingAsset, setUploadingAsset] = useState<AssetSlot | null>(null);
  const [uploadingVariantAsset, setUploadingVariantAsset] = useState<string | null>(null);

  const feedProbe = useImageProbe(feedImageUrl);
  const squareProbe = useImageProbe(squareImageUrl);
  const storyProbe = useImageProbe(storyImageUrl);

  const connection = trpc.metaAds.connectionStatus.useQuery(undefined, { refetchInterval: 30_000 });
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

  const rows = drafts.data ?? [];
  const filteredRows = approvalFilter === "ALL" ? rows : rows.filter((row: any) => row.status === approvalFilter);
  const selectedPlan = rows.find((row: any) => row.id === selectedPlanId) || (selectedPlanId ? null : rows[0]) || null;
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
      ),
    [adName, primaryText, headline, description, linkUrl, displayUrl, feedImageUrl, squareImageUrl, storyImageUrl, publishAsset, ctaType, ctaLabel, urlTags, activeVariant],
  );
  const primaryPublishImage = resolvePublishImage(publishAsset, { feedImageUrl, squareImageUrl, storyImageUrl });
  const requiresStoryImage = adsets.some((adset) => adset.placements.some((placement) => ["facebook_story", "facebook_reels", "instagram_story", "instagram_reels"].includes(placement)));
  const hasAnyImage = Boolean(feedImageUrl.trim() || squareImageUrl.trim() || storyImageUrl.trim());
  const canSaveDraft = Boolean(name.trim().length >= 2);
  const setupComplete = Boolean(name.trim() && objective && (numberValue(dailyBudget) >= 100 || numberValue(lifetimeBudget) >= 100));
  const campaignComplete = Boolean(product.trim() && audience.trim());
  const adsetsComplete = Boolean(
    adsets.length &&
      adsets.every((adset) => csvToList(adset.countries).length && numberValue(adset.ageMin) >= 13 && numberValue(adset.ageMax) >= numberValue(adset.ageMin) && adset.placements.length),
  );
  const creativesComplete = Boolean(
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
          );
          const resolvedImage = resolvePublishImage(merged.publishAsset, {
            feedImageUrl: merged.feedImageUrl,
            squareImageUrl: merged.squareImageUrl,
            storyImageUrl: merged.storyImageUrl,
          });
          return Boolean(merged.primaryText.trim() && merged.headline.trim() && merged.linkUrl.trim().startsWith("https://") && resolvedImage.trim());
        }),
      ),
  );
  const readyToSave = setupComplete && campaignComplete && adsetsComplete && creativesComplete;
  const operationalRequirements = useMemo(
    () => ((connection.data?.missingOperationalRequirements || []) as string[]).map(describeOperationalRequirement),
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
    return {
      name,
      dailyBudget,
      lifetimeBudget,
      primaryText,
      headline,
      description,
      linkUrl,
      feedImageUrl,
      squareImageUrl,
      storyImageUrl,
      publishAsset,
      pixelId,
      objective,
      adsets: adsets.map((adset) => ({
        customAudiencesText: adset.customAudiencesText,
        notes: adset.notes,
        variants: adset.variants.map((variant) => {
          const merged = mergeVariantWithBase(variantBase, variant);
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

  function openLiveCampaign(campaignId: string) {
    setSelectedCampaignId(campaignId);
    setAdsTab("campaigns");
  }

  function canOpenStep(step: BuilderStep) {
    if (step === "setup") return true;
    if (step === "campaign") return setupComplete;
    if (step === "adsets") return setupComplete && campaignComplete;
    if (step === "creatives") return setupComplete && campaignComplete && adsetsComplete;
    if (step === "review") return setupComplete && campaignComplete && adsetsComplete && creativesComplete;
    return false;
  }

  useEffect(() => {
    if (!selectedPlan || selectedPlan.id === loadedPlanId) return;

    const creative = asRecord(selectedPlan.creatives);
    const targeting = asRecord(selectedPlan.targeting);
    const campaignSettings = asRecord(targeting.campaignSettings);

    setName(selectedPlan.name || "Digitify Meta campagne");
    setObjective(selectedPlan.objective || "OUTCOME_TRAFFIC");
    setCurrency(selectedPlan.currency || "EUR");
    setDailyBudget(String(selectedPlan.dailyBudgetCents || 2500));
    setLifetimeBudget(String(selectedPlan.lifetimeBudgetCents || ""));
    setStartTime(selectedPlan.startTime ? new Date(selectedPlan.startTime).toISOString().slice(0, 16) : "");
    setEndTime(selectedPlan.endTime ? new Date(selectedPlan.endTime).toISOString().slice(0, 16) : "");
    setBidStrategy((campaignSettings.bidStrategy || "LOWEST_COST_WITHOUT_CAP") as BidStrategy);
    setBidAmount(String(campaignSettings.bidAmount || ""));
    setBuyingType(String(campaignSettings.buyingType || "AUCTION"));
    setCampaignSpendCap(String(campaignSettings.campaignSpendCap || ""));
    setSpecialAdCategories(Array.isArray(campaignSettings.specialAdCategories) ? campaignSettings.specialAdCategories.join(", ") : "");
    setAiTone((creative.aiTone || "professioneel") as AiTone);

    setPageName(String(creative.pageName || "Digitify"));
    setAdName(String(creative.adName || "Digitify Meta Ad"));
    setPrimaryText(String(creative.message || creative.primaryText || ""));
    setHeadline(String(creative.headline || creative.name || ""));
    setDescription(String(creative.description || ""));
    setLinkUrl(String(creative.linkUrl || creative.url || "https://leads.digitify.be"));
    setDisplayUrl(String(creative.displayUrl || "leads.digitify.be"));
    setFeedImageUrl(String(creative.feedImageUrl || creative.imageUrl || ""));
    setSquareImageUrl(String(creative.squareImageUrl || ""));
    setStoryImageUrl(String(creative.storyImageUrl || ""));
    setPublishAsset((creative.publishAsset || "feed") as AssetSlot);
    setCtaType(String(creative.ctaType || "LEARN_MORE"));
    setCtaLabel(String(creative.cta || creative.ctaLabel || "Meer informatie"));
    setUrlTags(String(creative.urlTags || "utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}"));

    setOptimizationGoal((campaignSettings.optimizationGoal || "AUTO") as OptimizationGoal);
    setDestinationType((campaignSettings.destinationType || "AUTO") as DestinationType);
    setBillingEvent(String(campaignSettings.billingEvent || "IMPRESSIONS"));
    setPixelId(String(campaignSettings.pixelId || ""));
    setCustomEventType(String(campaignSettings.customEventType || "LEAD"));

    const creativeGroups = Array.isArray(creative.adsets) ? creative.adsets : [];
    const adsetRows = (Array.isArray(targeting.adsets) && targeting.adsets.length
      ? targeting.adsets.map((item: any, index: number) => {
          const adsetId = String(asRecord(item).id || `loaded-adset-${index + 1}`);
          const group = creativeGroups.find((entry: any) => String(asRecord(entry).adsetId || "") === adsetId) || creativeGroups[index];
          const variants = Array.isArray(asRecord(group).variants) && asRecord(group).variants.length
            ? asRecord(group).variants.map((variant: any, variantIndex: number) => ({
                ...createCreativeVariant(`Variant ${variantIndex + 1}`, String(asRecord(variant).id || `${adsetId}-variant-${variantIndex + 1}`)),
                name: String(asRecord(variant).name || asRecord(variant).adName || `Variant ${variantIndex + 1}`),
                adName: String(asRecord(variant).adName || asRecord(variant).name || `Variant ${variantIndex + 1}`),
                primaryText: String(asRecord(variant).primaryText || asRecord(variant).message || ""),
                headline: String(asRecord(variant).headline || ""),
                description: String(asRecord(variant).description || ""),
                linkUrl: String(asRecord(variant).linkUrl || ""),
                displayUrl: String(asRecord(variant).displayUrl || ""),
                feedImageUrl: String(asRecord(variant).feedImageUrl || asRecord(variant).imageUrl || ""),
                squareImageUrl: String(asRecord(variant).squareImageUrl || ""),
                storyImageUrl: String(asRecord(variant).storyImageUrl || ""),
                publishAsset: (asRecord(variant).publishAsset || "feed") as AssetSlot,
                ctaType: String(asRecord(variant).ctaType || "LEARN_MORE"),
                ctaLabel: String(asRecord(variant).ctaLabel || asRecord(variant).cta || "Meer informatie"),
                urlTags: String(asRecord(variant).urlTags || urlTags),
                angle: String(asRecord(variant).angle || ""),
              }))
            : [createCreativeVariant("Variant 1", `${adsetId}-variant-1`)];
          return {
            ...targetingToAdset(asRecord(item), String(asRecord(item).name || `Doelgroep ${index + 1}`), adsetId),
            variants,
          };
        })
      : [{ ...targetingToAdset(targeting, String(campaignSettings.adsetName || "Belgie breed"), "loaded-adset-1"), variants: [createCreativeVariant("Variant 1", "loaded-adset-1-variant-1")] }]) as AdsetDraft[];
    setAdsets(adsetRows);
    setActiveCreativeRef(adsetRows[0]?.variants[0] ? { adsetId: adsetRows[0].id, variantId: adsetRows[0].variants[0].id } : null);

    setAdvancedCreativeJson("{}");
    setAdvancedTargetingJson("{}");
    setLoadedPlanId(selectedPlan.id);
  }, [selectedPlan, loadedPlanId]);

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

  const createDraft = trpc.metaAds.createDraft.useMutation({
    onSuccess: async (row: any) => {
      setSelectedPlanId(row.id);
      setLoadedPlanId(null);
      await invalidate();
      showToast({ title: "Meta Ads draft aangemaakt" });
    },
    onError: (error) => showToast({ title: "Draft mislukt", description: explainMetaError(error.message)?.message || error.message, variant: "error" }),
  });
  const updateDraft = trpc.metaAds.updateDraft.useMutation({
    onSuccess: async () => {
      await invalidate();
      showToast({ title: "Draft opgeslagen" });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: explainMetaError(error.message)?.message || error.message, variant: "error" }),
  });
  const generateSuggestion = trpc.metaAds.generateSuggestion.useMutation({
    onSuccess: (payload: any) => {
      setName(payload.name || name);
      setObjective(payload.objective || objective);
      setPrimaryText(payload.primaryText || primaryText);
      setHeadline(payload.headline || headline);
      setDescription(payload.description || description);
      setCtaType(payload.ctaType || "LEARN_MORE");
      setCtaLabel(payload.ctaLabel || "Meer informatie");
      const targeting = asRecord(payload.targeting);
      const aiAdsets = Array.isArray(targeting.adsets) && targeting.adsets.length
        ? targeting.adsets.map((item: any, index: number) => targetingToAdset(asRecord(item), String(asRecord(item).name || `AI doelgroep ${index + 1}`), `ai-adset-${index + 1}`))
        : [targetingToAdset(targeting, "AI doelgroep 1", "ai-adset-1")];
      setAdsets(aiAdsets);
      setActiveStep("campaign");
      showToast({ title: "AI draftvoorstel gegenereerd" });
    },
    onError: (error) => showToast({ title: "Suggestie mislukt", description: error.message, variant: "error" }),
  });
  const generateVariantSuggestion = trpc.metaAds.generateVariantSuggestion.useMutation({
    onError: (error) => showToast({ title: "Variant suggestie mislukt", description: error.message, variant: "error" }),
  });
  const submitForApproval = trpc.metaAds.submitForApproval.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Indienen mislukt", description: e.message, variant: "error" }) });
  const approveDraft = trpc.metaAds.approveDraft.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Goedkeuren mislukt", description: e.message, variant: "error" }) });
  const pushPaused = trpc.metaAds.pushPausedToMeta.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Push mislukt", description: explainMetaError(e.message)?.message || e.message, variant: "error" }) });
  const retryFailed = trpc.metaAds.retryFailed.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Retry mislukt", description: e.message, variant: "error" }) });
  const rejectDraft = trpc.metaAds.rejectDraft.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Afkeuren mislukt", description: e.message, variant: "error" }) });
  const cancelDraft = trpc.metaAds.cancelDraft.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Annuleren mislukt", description: e.message, variant: "error" }) });
  const duplicateDraft = trpc.metaAds.duplicateDraft.useMutation({ onSuccess: async (row: any) => { setSelectedPlanId(row.id); setLoadedPlanId(null); await invalidate(); showToast({ title: "Draft gedupliceerd" }); }, onError: (e) => showToast({ title: "Dupliceren mislukt", description: e.message, variant: "error" }) });
  const archiveDraft = trpc.metaAds.archiveDraft.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Archiveren mislukt", description: e.message, variant: "error" }) });
  const syncCampaigns = trpc.metaAds.syncMetaCampaigns.useMutation({ onSuccess: async () => { await invalidate(); showToast({ title: "Meta campagnes gesynchroniseerd" }); }, onError: (e) => showToast({ title: "Sync mislukt", description: e.message, variant: "error" }) });
  const pauseCampaign = trpc.metaAds.pauseInMeta.useMutation({ onSuccess: async () => { await invalidate(); showToast({ title: "Campagne gepauzeerd in Meta" }); }, onError: (e) => showToast({ title: "Pauzeren mislukt", description: e.message, variant: "error" }) });
  const resumeCampaign = trpc.metaAds.resumeInMeta.useMutation({ onSuccess: async () => { await invalidate(); showToast({ title: "Campagne hervat in Meta" }); }, onError: (e) => showToast({ title: "Hervatten mislukt", description: e.message, variant: "error" }) });
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
    setAdsets((current) => (current.length > 1 ? current.filter((item) => item.id !== id) : current));
  }

  function addVariant(adsetId: string) {
    const template = mergeVariantWithBase(
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
      null,
    );
    const variant = {
      ...createCreativeVariant(`Variant ${Date.now()}`),
      ...template,
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
    const payload = await generateVariantSuggestion.mutateAsync({
      product,
      audience,
      tone: aiTone,
      angle: angle || `${adsetName} doelgroep met duidelijke hook`,
      landingUrl: linkUrl,
    });
    updateVariant(adsetId, variantId, {
      name: String(payload.adName || payload.headline || "AI variant"),
      adName: String(payload.adName || payload.headline || "AI variant"),
      primaryText: String(payload.primaryText || ""),
      headline: String(payload.headline || ""),
      description: String(payload.description || ""),
      linkUrl: String(payload.linkUrl || linkUrl),
      ctaType: String(payload.ctaType || "LEARN_MORE"),
      ctaLabel: String(payload.ctaLabel || "Meer informatie"),
      publishAsset: (payload.publishAsset || "feed") as AssetSlot,
      angle,
    });
    showToast({ title: "AI variantvoorstel gegenereerd" });
  }

  async function uploadAsset(slot: AssetSlot, file: File) {
    setUploadingAsset(slot);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Upload mislukt");
      }
      if (slot === "feed") setFeedImageUrl(payload.url);
      if (slot === "square") setSquareImageUrl(payload.url);
      if (slot === "story") setStoryImageUrl(payload.url);
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
    if (strict && !setupComplete) throw new Error("Vul eerst stap 1 volledig in.");
    if (strict && !campaignComplete) throw new Error("Vul eerst stap 2 volledig in.");
    if (strict && !adsetsComplete) throw new Error("Vul eerst stap 3 volledig in.");
    if (strict && !creativesComplete) throw new Error("Vul eerst stap 4 volledig in.");
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

    return {
      name,
      objective: objective as any,
      dailyBudgetCents: numberValue(dailyBudget) || null,
      lifetimeBudgetCents: numberValue(lifetimeBudget) || null,
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
        adName: adName.trim(),
        pageName: pageName.trim(),
        linkUrl: linkUrl.trim(),
        displayUrl: displayUrl.trim(),
        message: primaryText.trim(),
        headline: headline.trim(),
        description: description.trim(),
        imageUrl: primaryPublishImage.trim(),
        feedImageUrl: feedImageUrl.trim(),
        squareImageUrl: squareImageUrl.trim(),
        storyImageUrl: storyImageUrl.trim(),
        publishAsset,
        ctaType,
        cta: ctaLabel.trim(),
        ctaLabel: ctaLabel.trim(),
        urlTags: urlTags.trim(),
        aiTone,
        adsets: creativeGroups,
        ...advancedCreative,
      },
    };
  }

  function saveDraft() {
    try {
      const payload = buildPayload(false);
      if (selectedPlan && ["DRAFT", "FAILED", "CANCELLED"].includes(selectedPlan.status)) updateDraft.mutate({ id: selectedPlan.id, ...payload });
      else createDraft.mutate(payload);
    } catch (error) {
      showToast({ title: "Controleer je velden", description: error instanceof Error ? error.message : "Ongeldige input", variant: "error" });
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <div className="overflow-hidden rounded-[2rem] border bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_36%),radial-gradient(circle_at_80%_0,#f5d0fe,transparent_30%),linear-gradient(135deg,#fff,#f8fafc_55%,#eef2ff)] p-6 shadow-sm dark:bg-[radial-gradient(circle_at_top_left,#1d4ed8,transparent_32%),linear-gradient(135deg,#020617,#0f172a)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <Badge variant="secondary" className="mb-3">Meta wizard · campagnes blijven standaard PAUSED</Badge>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight">Meta Ads studio</h1>
                  <p className="text-sm text-muted-foreground">
                    Bouw Facebook en Instagram campagnes stap voor stap, met meerdere adsets, AI-voorstellen, format checks en veilige paused push.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href="/settings/integrations">Meta koppeling beheren</Link>
              </Button>
              <Button variant="secondary" disabled={!canOpenStep("review")} onClick={() => setActiveStep("review")}>
                Naar review
              </Button>
            </div>
          </div>
        </div>

        {!connection.data?.autoadsEnabled ? (
          <Card className="overflow-hidden border-fuchsia-200/60 bg-gradient-to-br from-white via-fuchsia-50/40 to-blue-50/60 shadow-sm dark:border-fuchsia-900/40 dark:from-slate-950 dark:via-fuchsia-950/20 dark:to-blue-950/30">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-fuchsia-600 text-white shadow-sm">
                  <PauseCircle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold tracking-tight">Meta Ads module staat uit</p>
                    <Badge variant="secondary" className="font-normal">
                      Alleen lokaal
                    </Badge>
                  </div>
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Je kunt drafts maken, reviewen en goedkeuren. Schakel de module in om goedgekeurde campagnes als{" "}
                    <span className="font-medium text-foreground">paused</span> naar Meta te pushen.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                className="shrink-0 bg-fuchsia-700 hover:bg-fuchsia-800"
                onClick={() => setAdsTab("settings")}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Module inschakelen
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {connection.data?.missingConfiguredScopes?.length ? (
          <Card className="border-amber-500/30 bg-amber-500/10">
            <CardContent className="p-4 text-sm text-amber-950 dark:text-amber-100">
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              OAuth mist ads-scopes: <span className="font-mono">{connection.data.missingConfiguredScopes.join(", ")}</span>. Zet <span className="font-mono">META_OAUTH_INCLUDE_ADS=true</span>, redeploy, en koppel Meta opnieuw.
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Koppeling</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">{connection.data?.connected ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />} Meta OAuth</div>
              <div className="font-mono text-xs text-muted-foreground">{connection.data?.selectedAdAccountName || connection.data?.selectedAdAccountId || "Geen account geselecteerd"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Budget guard</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">Max per campagne: <span className="font-semibold">{eur(connection.data?.maxDailyBudgetCents, connection.data?.defaultCurrency || "EUR")}</span></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Laatste 30 dagen</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">Spend: <span className="font-semibold">{new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(totalSpend)}</span> · Clicks: <span className="font-semibold">{totalClicks}</span></CardContent>
          </Card>
        </div>

        <Tabs value={adsTab} onValueChange={setAdsTab} className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start gap-2 rounded-2xl bg-transparent p-0">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="builder">Studio</TabsTrigger>
            <TabsTrigger value="approval">Approval queue</TabsTrigger>
            <TabsTrigger value="campaigns">Campagnes</TabsTrigger>
            <TabsTrigger value="drafts">Drafts</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="settings">Instellingen</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Wat is nu beter?</CardTitle>
                  <CardDescription>Deze studio is nu strakker gemaakt rond de echte Meta-structuur: campagne → meerdere adsets → creatives → paused push.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <CheckRow ok label="Meerdere adsets" hint="Je kunt nu verschillende doelgroepen apart plannen en pushen binnen één campagne." />
                  <CheckRow ok label="Formaatbewuste visuals" hint="Feed, square en story assets zijn los in te vullen of te uploaden." />
                  <CheckRow ok label="AI voorstel met doelgroepideeën" hint="AI vult nu ook objective en adset-suggesties mee in." />
                  <CheckRow ok label="Approval queue apart" hint="Builder en goedkeuringsflow zijn gescheiden zodat het rustiger werkt." />
                </CardContent>
              </Card>
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
                        Sla een voltooide draft op in Studio, of activeer een campagne in Meta. Minimaal nodig: naam, budget, https-link en creatives per adset.
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
              <Card className="overflow-hidden">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle>Meta Ads studio</CardTitle>
                  <CardDescription>Werk de stappen van links naar rechts af. Teruggaan kan altijd, vooruit alleen als de basis klopt.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 p-5">
                  <div className="grid gap-3 md:grid-cols-5">
                    {STEPS.map((step) => (
                      <StepButton
                        key={step.id}
                        step={step}
                        activeStep={activeStep}
                        complete={
                          step.id === "setup"
                            ? setupComplete
                            : step.id === "campaign"
                              ? campaignComplete
                              : step.id === "adsets"
                                ? adsetsComplete
                                : step.id === "creatives"
                                  ? creativesComplete
                                  : readyToSave
                        }
                        locked={!canOpenStep(step.id)}
                        onClick={() => setActiveStep(step.id)}
                      />
                    ))}
                  </div>

                  {activeStep === "setup" ? (
                    <div className="space-y-5">
                      <div className="rounded-2xl border p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Megaphone className="h-4 w-4" />
                          <p className="font-medium">Campagne setup</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <div className="space-y-2">
                            <HelpLabel label="Campagnenaam" help="Interne naam voor de draft en de Meta-campagne. Houd dit leesbaar voor je team." />
                            <Input value={name} onChange={(e) => setName(e.target.value)} />
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
                            <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Dagbudget in cent" help="Voorbeeld: 2500 = €25,00. De workspace budget guard blokkeert te hoge bedragen." />
                            <Input type="number" min="100" value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Lifetime budget in cent" help="Gebruik dit alleen als je geen dagbudget wil. Laat leeg als dagbudget volstaat." />
                            <Input type="number" min="100" value={lifetimeBudget} onChange={(e) => setLifetimeBudget(e.target.value)} placeholder="Optioneel" />
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
                      </div>

                      <div className="rounded-2xl border p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          <p className="font-medium">AI briefing</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-2">
                            <HelpLabel label="Product of aanbod" help="AI gebruikt dit om copy en doelgroepideeën te schrijven." />
                            <Input value={product} onChange={(e) => setProduct(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Doelgroep voor AI" help="Beschrijf wie je wil bereiken. Dit is briefingtekst, geen echte Meta targeting." />
                            <Input value={audience} onChange={(e) => setAudience(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Tone of voice" help="Stuurt de stijl van headline, copy en CTA." />
                            <Select value={aiTone} onValueChange={(value) => setAiTone(value as AiTone)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="professioneel">Professioneel</SelectItem>
                                <SelectItem value="vriendelijk">Vriendelijk</SelectItem>
                                <SelectItem value="direct">Direct</SelectItem>
                                <SelectItem value="speels">Speels</SelectItem>
                                <SelectItem value="luxueus">Luxueus</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button onClick={() => generateSuggestion.mutate({ product, audience, tone: aiTone })} variant="outline" disabled={generateSuggestion.isPending}>
                            {generateSuggestion.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            AI voorstel
                          </Button>
                          <p className="text-xs text-muted-foreground">AI vult copy en doelgroepsuggesties in, maar laat de campagne nog steeds in review bij jouw team.</p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeStep === "campaign" ? (
                    <div className="space-y-5">
                      <div className="rounded-2xl border p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4" />
                          <p className="font-medium">Bidding, tracking en basisinstellingen</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                            <HelpLabel label="Buying type" help="Voor de meeste campagnes blijft AUCTION correct." />
                            <Input value={buyingType} onChange={(e) => setBuyingType(e.target.value.toUpperCase())} />
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Special ad categories" help="Alleen invullen bij gereguleerde sectoren zoals housing, employment of credit." />
                            <Input value={specialAdCategories} onChange={(e) => setSpecialAdCategories(e.target.value)} placeholder="HOUSING, EMPLOYMENT, CREDIT..." />
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Optimization goal" help="Laat meestal op Auto staan tenzij je precies weet welke delivery-optimalisatie je nodig hebt." />
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
                            <HelpLabel label="Destination type" help="Niet elke objective laat elke destination toe. Auto is het veiligst." />
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
                            <HelpLabel label="Billing event" help="Voor de meeste gevallen blijft IMPRESSIONS prima." />
                            <Input value={billingEvent} onChange={(e) => setBillingEvent(e.target.value.toUpperCase())} />
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Pixel ID" help="Belangrijk voor sales/conversion campagnes. Zonder Pixel stuur je Meta minder goed aan." />
                            <Input value={pixelId} onChange={(e) => setPixelId(e.target.value)} placeholder="Voor Sales/Conversions" />
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Custom event type" help="Bijvoorbeeld LEAD, PURCHASE of COMPLETE_REGISTRATION." />
                            <Input value={customEventType} onChange={(e) => setCustomEventType(e.target.value.toUpperCase())} />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          <p className="font-medium">Campaign creative defaults</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <HelpLabel label="Page/brand naam" help="Alleen voor preview en interne context in de builder." />
                            <Input value={pageName} onChange={(e) => setPageName(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Default ad naam" help="Nieuwe varianten starten van deze basis." />
                            <Input value={adName} onChange={(e) => setAdName(e.target.value)} />
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          <HelpLabel label="Default primaire tekst" help="Nieuwe varianten erven deze tekst tot je ze per variant overschrijft." />
                          <Textarea className="min-h-24" value={primaryText} onChange={(e) => setPrimaryText(e.target.value)} />
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <HelpLabel label="Default headline" help="Wordt gebruikt als basis voor varianten." />
                            <Input value={headline} onChange={(e) => setHeadline(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Default beschrijving" help="Wordt gebruikt als basis voor varianten." />
                            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Default bestemmingslink" help="Volledige https-link. Variants kunnen dit overschrijven." />
                            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." />
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Display URL" help="Cosmetische URL in de preview." />
                            <Input value={displayUrl} onChange={(e) => setDisplayUrl(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Default CTA type" help="Nieuwe varianten nemen dit mee als startpunt." />
                            <Select value={ctaType} onValueChange={setCtaType}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="LEARN_MORE">Learn more</SelectItem>
                                <SelectItem value="SIGN_UP">Sign up</SelectItem>
                                <SelectItem value="CONTACT_US">Contact us</SelectItem>
                                <SelectItem value="BOOK_TRAVEL">Book now</SelectItem>
                                <SelectItem value="SHOP_NOW">Shop now</SelectItem>
                                <SelectItem value="APPLY_NOW">Apply now</SelectItem>
                                <SelectItem value="GET_QUOTE">Get quote</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Default CTA label" help="Voor lokale preview en variantbasis." />
                            <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          <HelpLabel label="Default URL tags" help="UTM-tags of andere tracking parameters. Nieuwe varianten erven dit." />
                          <Input value={urlTags} onChange={(e) => setUrlTags(e.target.value)} />
                        </div>
                      </div>

                      <div className="rounded-2xl border p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          <p className="font-medium">Visuals en formaten</p>
                        </div>
                        <div className="grid gap-4 xl:grid-cols-3">
                          <AssetUploadCard
                            title="Feed image"
                            help="Belangrijkste beeld voor klassieke feed placements. Meta accepteert hier het liefst 1:1 of 1.91:1."
                            ratio="1:1 of 1.91:1"
                            recommended="1200x1200 of 1200x628"
                            value={feedImageUrl}
                            placeholder="https://... of upload bestand"
                            probe={feedProbe}
                            uploading={uploadingAsset === "feed"}
                            onChange={setFeedImageUrl}
                            onUpload={(file) => uploadAsset("feed", file)}
                          />
                          <AssetUploadCard
                            title="Square image"
                            help="Nuttig voor placements waar vierkante visuals beter renderen."
                            ratio="1:1"
                            recommended="1200x1200"
                            value={squareImageUrl}
                            placeholder="https://... of upload bestand"
                            probe={squareProbe}
                            uploading={uploadingAsset === "square"}
                            onChange={setSquareImageUrl}
                            onUpload={(file) => uploadAsset("square", file)}
                          />
                          <AssetUploadCard
                            title="Story/Reels image"
                            help="Gebruik hiervoor echt een 9:16 visual. Dat voorkomt de bekende Meta aspect ratio fout."
                            ratio="9:16"
                            recommended="1080x1920"
                            value={storyImageUrl}
                            placeholder="https://... of upload bestand"
                            probe={storyProbe}
                            uploading={uploadingAsset === "story"}
                            onChange={setStoryImageUrl}
                            onUpload={(file) => uploadAsset("story", file)}
                          />
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <HelpLabel label="Primair publish beeld" help="Dit is de asset die we standaard meegeven aan de Meta push. Kies bewust het formaat dat het best past bij je belangrijkste placements." />
                            <Select value={publishAsset} onValueChange={(value) => setPublishAsset(value as AssetSlot)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="feed">Feed image</SelectItem>
                                <SelectItem value="square">Square image</SelectItem>
                                <SelectItem value="story">Story/Reels image</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="rounded-2xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                            <p className="font-medium text-foreground">Format checks</p>
                            <p className="mt-1">Feed ratio: {probeLabel(feedProbe)} {roughlyMatches(aspectRatio(feedProbe), 1) || roughlyMatches(aspectRatio(feedProbe), 1.91, 0.12) ? "· goed voor feed" : feedProbe.status === "ready" ? "· check ratio" : ""}</p>
                            <p>Square ratio: {probeLabel(squareProbe)} {roughlyMatches(aspectRatio(squareProbe), 1) ? "· goed voor 1:1" : squareProbe.status === "ready" ? "· check ratio" : ""}</p>
                            <p>Story ratio: {probeLabel(storyProbe)} {roughlyMatches(aspectRatio(storyProbe), 9 / 16, 0.08) ? "· goed voor story/reels" : storyProbe.status === "ready" ? "· check ratio" : ""}</p>
                          </div>
                        </div>
                        {requiresStoryImage && !storyImageUrl.trim() ? (
                          <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-100">
                            Stories of Reels zijn geselecteerd in minstens één adset, maar er is nog geen aparte 9:16 visual toegevoegd. Dat verhoogt de kans op Meta aspect ratio fouten.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {activeStep === "adsets" ? (
                    <div className="space-y-5">
                      <div className="rounded-2xl border p-4">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">Adsets</p>
                            <p className="text-xs text-muted-foreground">Splits doelgroepen op per hook, regio, funnel of remarketingdoel. Dat werkt duidelijker dan alles in één adset proppen.</p>
                          </div>
                          <Button variant="outline" onClick={addAdset}>
                            <Plus className="mr-2 h-4 w-4" />
                            Adset toevoegen
                          </Button>
                        </div>
                        <div className="space-y-4">
                          {adsets.map((adset, index) => (
                            <div key={adset.id} className="rounded-2xl border bg-muted/20 p-4">
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Layers3 className="h-4 w-4" />
                                  <p className="font-medium">Adset {index + 1}</p>
                                </div>
                                <Button variant="ghost" size="sm" disabled={adsets.length === 1} onClick={() => removeAdset(adset.id)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Verwijderen
                                </Button>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                <div className="space-y-2">
                                  <HelpLabel label="Adset naam" help="Gebruik een naam die doelgroep of testhoek meteen duidelijk maakt." />
                                  <Input value={adset.name} onChange={(e) => updateAdset(adset.id, { name: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                  <HelpLabel label="Landen" help="Landcodes, bijvoorbeeld BE of NL. Meerdere codes scheiden met komma." />
                                  <Input value={adset.countries} onChange={(e) => updateAdset(adset.id, { countries: e.target.value })} placeholder="BE, NL" />
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
                                  <HelpLabel label="Min leeftijd" help="Meta accepteert geen te lage leeftijden voor alle sectoren. 24-60 is vaak een prima start." />
                                  <Input type="number" value={adset.ageMin} onChange={(e) => updateAdset(adset.id, { ageMin: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                  <HelpLabel label="Max leeftijd" help="Laat breed genoeg om delivery niet onnodig dicht te knijpen." />
                                  <Input type="number" value={adset.ageMax} onChange={(e) => updateAdset(adset.id, { ageMax: e.target.value })} />
                                </div>
                              </div>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                  <HelpLabel label="Regio IDs" help="Geavanceerde Meta regio keys. Alleen invullen als je ze echt nodig hebt." />
                                  <Textarea className="min-h-24 font-mono text-xs" value={adset.regions} onChange={(e) => updateAdset(adset.id, { regions: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                  <HelpLabel label="City IDs" help="Geavanceerde Meta city keys. Laat leeg als landen targeting volstaat." />
                                  <Textarea className="min-h-24 font-mono text-xs" value={adset.cities} onChange={(e) => updateAdset(adset.id, { cities: e.target.value })} />
                                </div>
                              </div>
                              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                <div className="space-y-2">
                                  <HelpLabel label="Interest signalen" help="Dit zijn interne AI/notitie-signalen. Ze worden niet blind als Meta interests gepusht, zodat we geen ongeldige targeting meesturen." />
                                  <Textarea className="min-h-28" value={adset.interestSignalsText} onChange={(e) => updateAdset(adset.id, { interestSignalsText: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                  <HelpLabel label="Custom audience IDs" help="Echte Meta audience IDs. Eén per lijn." />
                                  <Textarea className="min-h-28 font-mono text-xs" value={adset.customAudiencesText} onChange={(e) => updateAdset(adset.id, { customAudiencesText: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                  <HelpLabel label="Exclude custom audience IDs" help="Handig om bestaande klanten of converters uit te sluiten." />
                                  <Textarea className="min-h-28 font-mono text-xs" value={adset.excludedCustomAudiencesText} onChange={(e) => updateAdset(adset.id, { excludedCustomAudiencesText: e.target.value })} />
                                </div>
                              </div>
                              <div className="mt-3 space-y-2">
                                <HelpLabel label="Interne adset-notities" help="Leg vast waarom deze doelgroep bestaat, zodat approval en iteratie sneller gaan." />
                                <Textarea className="min-h-20" value={adset.notes} onChange={(e) => updateAdset(adset.id, { notes: e.target.value })} placeholder="Bijvoorbeeld: warm remarketing publiek, focus op demo aanvraag." />
                              </div>
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
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeStep === "creatives" ? (
                    <div className="space-y-5">
                      <div className="rounded-2xl border p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Layers3 className="h-4 w-4" />
                          <p className="font-medium">Creative varianten per adset</p>
                        </div>
                        <div className="space-y-4">
                          {adsets.map((adset) => (
                            <div key={`creative-${adset.id}`} className="rounded-2xl border bg-muted/20 p-4">
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="font-medium">{adset.name}</p>
                                  <p className="text-xs text-muted-foreground">{adset.variants.length} variant(en) · {adset.placements.length} placement(s)</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => addVariant(adset.id)}>
                                  <Plus className="mr-2 h-4 w-4" />
                                  Variant toevoegen
                                </Button>
                              </div>
                              <div className="space-y-3">
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
                                  );
                                  return (
                                    <div key={variant.id} className={`rounded-2xl border p-4 ${activeCreativeRef?.variantId === variant.id ? "border-primary bg-primary/5" : "bg-card"}`}>
                                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                        <button type="button" className="text-left" onClick={() => setActiveCreativeRef({ adsetId: adset.id, variantId: variant.id })}>
                                          <p className="font-medium">{variant.name || `Variant ${variantIndex + 1}`}</p>
                                          <p className="text-xs text-muted-foreground">{merged.headline || "Nog geen headline"} · {merged.linkUrl || "Nog geen link"}</p>
                                        </button>
                                        <div className="flex flex-wrap gap-2">
                                          <Button variant="outline" size="sm" onClick={() => aiSuggestVariant(adset.id, variant.id, adset.name, variant.angle)}>
                                            <Sparkles className="mr-2 h-3.5 w-3.5" />
                                            AI voorstel
                                          </Button>
                                          <Button variant="ghost" size="sm" disabled={adset.variants.length === 1} onClick={() => removeVariant(adset.id, variant.id)}>
                                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                                            Verwijderen
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                        <div className="space-y-2">
                                          <HelpLabel label="Variant naam" help="Interne naam voor je team en approval flow." />
                                          <Input value={variant.name} onChange={(e) => updateVariant(adset.id, variant.id, { name: e.target.value, adName: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                          <HelpLabel label="Hoek / angle" help="Welke hook test deze variant? Bijvoorbeeld snelheid, prijs, vertrouwen of demo." />
                                          <Input value={variant.angle} onChange={(e) => updateVariant(adset.id, variant.id, { angle: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                          <HelpLabel label="CTA type" help="Kan afwijken van de campaign default." />
                                          <Select value={variant.ctaType} onValueChange={(value) => updateVariant(adset.id, variant.id, { ctaType: value })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="LEARN_MORE">Learn more</SelectItem>
                                              <SelectItem value="SIGN_UP">Sign up</SelectItem>
                                              <SelectItem value="CONTACT_US">Contact us</SelectItem>
                                              <SelectItem value="BOOK_TRAVEL">Book now</SelectItem>
                                              <SelectItem value="SHOP_NOW">Shop now</SelectItem>
                                              <SelectItem value="APPLY_NOW">Apply now</SelectItem>
                                              <SelectItem value="GET_QUOTE">Get quote</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                      <div className="mt-3 space-y-2">
                                        <HelpLabel label="Primaire tekst" help="Laat leeg om de campaign default te gebruiken, of overschrijf deze variant bewust." />
                                        <Textarea className="min-h-24" value={variant.primaryText} onChange={(e) => updateVariant(adset.id, variant.id, { primaryText: e.target.value })} />
                                      </div>
                                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-2">
                                          <HelpLabel label="Headline" help="Laat leeg om de campaign default te gebruiken." />
                                          <Input value={variant.headline} onChange={(e) => updateVariant(adset.id, variant.id, { headline: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                          <HelpLabel label="Beschrijving" help="Laat leeg om de campaign default te gebruiken." />
                                          <Input value={variant.description} onChange={(e) => updateVariant(adset.id, variant.id, { description: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                          <HelpLabel label="Link" help="Kan per variant verschillen." />
                                          <Input value={variant.linkUrl} onChange={(e) => updateVariant(adset.id, variant.id, { linkUrl: e.target.value })} placeholder={linkUrl} />
                                        </div>
                                        <div className="space-y-2">
                                          <HelpLabel label="Display URL" help="Optionele override voor preview/context." />
                                          <Input value={variant.displayUrl} onChange={(e) => updateVariant(adset.id, variant.id, { displayUrl: e.target.value })} placeholder={displayUrl} />
                                        </div>
                                        <div className="space-y-2">
                                          <HelpLabel label="CTA label" help="Laat leeg om de campaign default te gebruiken." />
                                          <Input value={variant.ctaLabel} onChange={(e) => updateVariant(adset.id, variant.id, { ctaLabel: e.target.value })} placeholder={ctaLabel} />
                                        </div>
                                        <div className="space-y-2">
                                          <HelpLabel label="Publish asset" help="Welke asset standaard naar Meta gepusht wordt voor deze variant." />
                                          <Select value={variant.publishAsset} onValueChange={(value) => updateVariant(adset.id, variant.id, { publishAsset: value as AssetSlot })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="feed">Feed image</SelectItem>
                                              <SelectItem value="square">Square image</SelectItem>
                                              <SelectItem value="story">Story/Reels image</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                      <div className="mt-3 grid gap-3 xl:grid-cols-3">
                                        <VariantAssetField
                                          title="Feed image"
                                          help="Gebruik per variant een eigen feed-beeld als je de hook visueel wil testen."
                                          ratio="1:1 of 1.91:1"
                                          recommended="1200x1200 of 1200x628"
                                          value={variant.feedImageUrl}
                                          placeholder={feedImageUrl || "Campaign default"}
                                          uploading={uploadingVariantAsset === `${adset.id}:${variant.id}:feed`}
                                          onChange={(value) => updateVariant(adset.id, variant.id, { feedImageUrl: value })}
                                          onUpload={(file) => uploadVariantAsset(adset.id, variant.id, "feed", file)}
                                        />
                                        <VariantAssetField
                                          title="Square image"
                                          help="Handig wanneer deze variant vooral op Instagram feed moet renderen."
                                          ratio="1:1"
                                          recommended="1200x1200"
                                          value={variant.squareImageUrl}
                                          placeholder={squareImageUrl || "Campaign default"}
                                          uploading={uploadingVariantAsset === `${adset.id}:${variant.id}:square`}
                                          onChange={(value) => updateVariant(adset.id, variant.id, { squareImageUrl: value })}
                                          onUpload={(file) => uploadVariantAsset(adset.id, variant.id, "square", file)}
                                        />
                                        <VariantAssetField
                                          title="Story/Reels image"
                                          help="Gebruik hier echt een 9:16 asset om Meta ratio-fouten te vermijden."
                                          ratio="9:16"
                                          recommended="1080x1920"
                                          value={variant.storyImageUrl}
                                          placeholder={storyImageUrl || "Campaign default"}
                                          uploading={uploadingVariantAsset === `${adset.id}:${variant.id}:story`}
                                          onChange={(value) => updateVariant(adset.id, variant.id, { storyImageUrl: value })}
                                          onUpload={(file) => uploadVariantAsset(adset.id, variant.id, "story", file)}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeStep === "review" ? (
                    <div className="space-y-5">
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
                        <CheckRow ok={setupComplete} label="Setup compleet" hint="Naam, objective en budget zijn ingevuld." />
                        <CheckRow ok={campaignComplete} label="Campaign compleet" hint="Bidding, AI briefing en campaign defaults staan klaar." />
                        <CheckRow ok={adsetsComplete} label="Adsets compleet" hint="Elke adset heeft landen, leeftijd en minstens één plaatsing." />
                        <CheckRow ok={creativesComplete} label="Creatives compleet" hint="Elke adset heeft minstens één variant met geldige link en visual." />
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

                  <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                    <Button onClick={saveDraft} disabled={createDraft.isPending || updateDraft.isPending || !canSaveDraft}>
                      {createDraft.isPending || updateDraft.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Draft opslaan
                    </Button>
                    {readyToSave ? (
                      <Badge variant="success">Klaar voor approval</Badge>
                    ) : (
                      <p className="text-xs text-muted-foreground">Je kunt al tussentijds opslaan. Voor approval en push moeten alle stappen volledig zijn.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <MetaPreview
                  primaryText={previewCreative.primaryText}
                  headline={previewCreative.headline}
                  description={previewCreative.description}
                  linkUrl={previewCreative.linkUrl}
                  feedImageUrl={previewCreative.feedImageUrl || previewCreative.squareImageUrl || previewCreative.storyImageUrl}
                  storyImageUrl={previewCreative.storyImageUrl || previewCreative.feedImageUrl || previewCreative.squareImageUrl}
                  ctaLabel={previewCreative.ctaLabel}
                  pageName={pageName}
                  placements={selectedPlacements}
                />
                <Card>
                  <CardHeader>
                    <CardTitle>Studio samenvatting</CardTitle>
                    <CardDescription>Snelle check terwijl je bouwt.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="rounded-xl border bg-muted/30 p-3">
                      <p className="font-medium">Adsets</p>
                      <p className="mt-1 text-muted-foreground">{adsets.length} doelgroep(en) · {selectedPlacements.length} unieke placements</p>
                    </div>
                    <div className="rounded-xl border bg-muted/30 p-3">
                      <p className="font-medium">Creative varianten</p>
                      <p className="mt-1 text-muted-foreground">{totalVariants} varianten over {adsets.length} adsets</p>
                    </div>
                    <div className="rounded-xl border bg-muted/30 p-3">
                      <p className="font-medium">AI score</p>
                      <p className="mt-1 text-muted-foreground">{score.score}/100 · {score.label}</p>
                    </div>
                    <div className="rounded-xl border bg-muted/30 p-3">
                      <p className="font-medium">Operationele checks</p>
                      {(operationalRequirements || []).length ? (
                        <div className="mt-2 space-y-2">
                          {operationalRequirements.map((requirement) => (
                            <div key={requirement.code} className="rounded-xl border bg-card p-3">
                              <p className="font-medium">{requirement.title}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{requirement.description}</p>
                              <p className="mt-2 text-xs font-medium text-foreground">{requirement.nextStep}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-muted-foreground">Geen blokkades gedetecteerd</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
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
                  onSubmit={(id) => submitForApproval.mutate({ id })}
                  onApprove={(id) => approveDraft.mutate({ id })}
                  onPush={(id) => pushPaused.mutate({ id })}
                  onRetry={(id) => retryFailed.mutate({ id })}
                  onReject={(id) => rejectDraft.mutate({ id, reason: "Aanpassing gevraagd" })}
                  onCancel={(id) => cancelDraft.mutate({ id })}
                  autoadsEnabled={Boolean(connection.data?.autoadsEnabled)}
                  pushing={pushPaused.isPending}
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
                  )) : <EmptyState title="Geen campagnes geladen" description="Kies eerst een Ad Account of controleer de Meta rechten." icon={<Megaphone className="h-8 w-8" />} />}
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
            <Card>
              <CardHeader>
                <CardTitle>Alle drafts</CardTitle>
                <CardDescription>Interne plannen met approval- en push-status.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {rows.map((row: any) => (
                  <div key={row.id} className="rounded-xl border p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{row.name}</p>
                      {statusBadge(row.status)}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{row.objective} · {eur(row.dailyBudgetCents, row.currency)} · {prettyDate(row.createdAt)}</p>
                    <ErrorHint raw={row.lastError} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => duplicateDraft.mutate({ id: row.id })}>Dupliceren</Button>
                      <Button size="sm" variant="outline" onClick={() => archiveDraft.mutate({ id: row.id })}>Archiveren</Button>
                    </div>
                  </div>
                ))}
                {!rows.length ? <EmptyState title="Geen drafts" description="Je drafts verschijnen hier zodra je er een opslaat." icon={<Save className="h-8 w-8" />} /> : null}
              </CardContent>
            </Card>
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
    </TooltipProvider>
  );
}
