"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useMutationGeneration } from "@/lib/use-mutation-generation";
import { useBranding } from "@/lib/branding";
import { AdsStudioStatsStrip, adsStudioStatIcons } from "@/components/ads/ads-studio-stats-strip";
import { AdsStudioTabsNav } from "@/components/ads/ads-studio-tabs-nav";
import { MetaAdsDashboardOverview } from "@/components/ads/meta-ads-dashboard-overview";
import { MetaAdsDraftsPanel } from "@/components/ads/meta-ads-drafts-panel";
import { MetaAdsStudioSummary } from "@/components/ads/meta-ads-studio-summary";
import { AdsModuleSetupNotice, adsModuleSetupToneStyles } from "@/components/ads/ads-module-setup-notice";
import { FacebookPageAvatar, MetaAdsBrandMark } from "@/components/social/social-platform-avatars";
import { eur, numberValue, budgetCentsOrNull, normalizeCampaignNameKey, asRecord } from "./meta-ads-format-utils";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@digitify/ui";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  HelpCircle,
  Image as ImageIcon,
  FileText,
  Globe2,
  Layers3,
  Loader2,
  Lock,
  Megaphone,
  PauseCircle,
  PencilLine,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Send,
  Settings2,
  MapPin,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Wand2,
  X,
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
type BuilderStep = "campaign" | "adsets" | "ads" | "review";
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

type MetaGeoKind = "country" | "region" | "city";

type MetaGeoEntry = {
  key: string;
  label: string;
  kind: MetaGeoKind;
  countryCode?: string;
};

type AdsetDraft = {
  id: string;
  name: string;
  countries: string;
  regions: string;
  cities: string;
  geoLabels: string;
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

const META_ADS_NAV_TABS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: "campaigns", label: "Campagnes", icon: Megaphone },
  { value: "dashboard", label: "Overzicht", icon: Eye },
  { value: "builder", label: "Campagne-wizard", icon: Wand2 },
  { value: "approval", label: "Goedkeuring", icon: ShieldCheck },
  { value: "drafts", label: "Drafts", icon: FileText },
  { value: "insights", label: "Prestaties", icon: BarChart3 },
  { value: "settings", label: "Instellingen", icon: Settings2 },
];

const BUILDER_STEP_ORDER: BuilderStep[] = ["campaign", "adsets", "ads", "review"];

const STEPS: Array<{ id: BuilderStep; label: string; description: string; metaLevel: "campaign" | "adset" | "ad" | "review" }> = [
  { id: "campaign", label: "Campagne", description: "Naam, objective, budget en planning", metaLevel: "campaign" },
  { id: "adsets", label: "Advertentieset", description: "Delivery, doelgroep en plaatsingen", metaLevel: "adset" },
  { id: "ads", label: "Advertenties", description: "Pagina, copy, links en beelden per ad", metaLevel: "ad" },
  { id: "review", label: "Controleren", description: "Score, checklist en opslaan", metaLevel: "review" },
];

const META_CURRENCY_OPTIONS = [
  { value: "EUR", label: "Euro", symbol: "€" },
  { value: "USD", label: "US dollar", symbol: "$" },
  { value: "GBP", label: "Britse pond", symbol: "£" },
] as const;

const META_BUYING_TYPE_OPTIONS = [
  { value: "AUCTION", label: "Auction", hint: "Standaard voor vrijwel alle campagnes." },
  { value: "RESERVED", label: "Reserved", hint: "Vaste media-aankoop — zeldzaam in leadgen." },
] as const;

const META_BILLING_EVENT_OPTIONS = [
  { value: "IMPRESSIONS", label: "Impressions (CPM)" },
  { value: "LINK_CLICKS", label: "Link clicks (CPC)" },
  { value: "APP_INSTALLS", label: "App installs" },
  { value: "THRUPLAY", label: "ThruPlay (video)" },
] as const;

const META_CUSTOM_EVENT_OPTIONS = [
  { value: "LEAD", label: "Lead" },
  { value: "PURCHASE", label: "Purchase" },
  { value: "COMPLETE_REGISTRATION", label: "Complete registration" },
  { value: "ADD_TO_CART", label: "Add to cart" },
] as const;

const META_SPECIAL_AD_CATEGORY_OPTIONS = [
  { value: "NONE", label: "Geen special category" },
  { value: "HOUSING", label: "Housing" },
  { value: "EMPLOYMENT", label: "Employment" },
  { value: "CREDIT", label: "Credit" },
] as const;

const META_AI_TONES: Array<{ value: AiTone; label: string }> = [
  { value: "professioneel", label: "Professioneel" },
  { value: "vriendelijk", label: "Vriendelijk" },
  { value: "direct", label: "Direct" },
  { value: "speels", label: "Speels" },
  { value: "luxueus", label: "Luxueus" },
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

const META_LOCATION_PRESETS = [
  { value: "BE", label: "Belgie", countries: "BE", description: "Alle Meta-delivery in Belgie." },
  { value: "NL", label: "Nederland", countries: "NL", description: "Alle Meta-delivery in Nederland." },
  { value: "BE_NL", label: "Belgie + Nederland", countries: "BE, NL", description: "Breed Benelux-startpunt voor Nederlandstalige campagnes." },
  { value: "CUSTOM", label: "Aangepast", countries: "", description: "Gebruik eigen landcodes, regio keys of city keys." },
] as const;

const META_COUNTRY_LABELS: Record<string, string> = {
  BE: "België",
  NL: "Nederland",
  FR: "Frankrijk",
  DE: "Duitsland",
  LU: "Luxemburg",
};

const META_COUNTRY_PICKS = [
  { code: "BE", label: "België" },
  { code: "NL", label: "Nederland" },
  { code: "LU", label: "Luxemburg" },
  { code: "FR", label: "Frankrijk" },
  { code: "DE", label: "Duitsland" },
] as const;

const META_GEO_MAX_LOCATIONS = 25;
const META_DEFAULT_AGE_MIN = "13";
const META_DEFAULT_AGE_MAX = "65";

function metaPlanStatusLabelClient(status: string) {
  if (status === "PUSHED_PAUSED") return "online in Meta";
  if (status === "APPROVED") return "goedgekeurd";
  if (status === "PENDING_APPROVAL") return "wacht op goedkeuring";
  if (status === "PUSHING") return "pushen";
  if (status === "FAILED") return "mislukt";
  return "draft";
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

function metaCountryLabel(code: string) {
  const normalized = code.trim().toUpperCase();
  return META_COUNTRY_LABELS[normalized] ? `${META_COUNTRY_LABELS[normalized]} (${normalized})` : normalized;
}

function resolveMetaLocationPreset(adset: AdsetDraft) {
  if (linesToList(adset.regions).length || linesToList(adset.cities).length) return "CUSTOM";
  const countries = csvToList(adset.countries).map((item) => item.toUpperCase()).join(", ");
  return META_LOCATION_PRESETS.find((preset) => preset.value !== "CUSTOM" && preset.countries === countries)?.value || "CUSTOM";
}

function parseGeoLabels(raw: string) {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function adsetGeoEntries(adset: AdsetDraft): MetaGeoEntry[] {
  const labels = parseGeoLabels(adset.geoLabels);
  const entries: MetaGeoEntry[] = [];
  for (const code of csvToList(adset.countries)) {
    const key = code.toUpperCase();
    entries.push({ key, label: labels[key] || metaCountryLabel(key), kind: "country", countryCode: key });
  }
  for (const key of linesToList(adset.regions, META_GEO_MAX_LOCATIONS)) {
    entries.push({ key, label: labels[key] || `Regio ${key}`, kind: "region" });
  }
  for (const key of linesToList(adset.cities, META_GEO_MAX_LOCATIONS)) {
    entries.push({ key, label: labels[key] || `Stad ${key}`, kind: "city" });
  }
  return entries;
}

function applyGeoEntries(entries: MetaGeoEntry[]): Pick<AdsetDraft, "countries" | "regions" | "cities" | "geoLabels"> {
  const labels: Record<string, string> = {};
  const countryKeys: string[] = [];
  const regionKeys: string[] = [];
  const cityKeys: string[] = [];
  for (const entry of entries) {
    labels[entry.key] = entry.label;
    if (entry.kind === "country") countryKeys.push(entry.key.toUpperCase());
    else if (entry.kind === "region") regionKeys.push(entry.key);
    else cityKeys.push(entry.key);
  }
  return {
    countries: countryKeys.join(", "),
    regions: regionKeys.join("\n"),
    cities: cityKeys.join("\n"),
    geoLabels: JSON.stringify(labels),
  };
}

function adsetHasGeoTargeting(adset: AdsetDraft) {
  return Boolean(csvToList(adset.countries).length || linesToList(adset.regions).length || linesToList(adset.cities).length);
}

function metaLocationSummary(adset: AdsetDraft) {
  const entries = adsetGeoEntries(adset);
  if (!entries.length) return "Nog geen locaties gekozen";
  const countries = entries.filter((item) => item.kind === "country").map((item) => item.label);
  const regions = entries.filter((item) => item.kind === "region");
  const cities = entries.filter((item) => item.kind === "city");
  const parts: string[] = [];
  if (countries.length) parts.push(`Landen: ${countries.join(", ")}`);
  if (regions.length) parts.push(`${regions.length} regio${regions.length === 1 ? "" : "'s"}`);
  if (cities.length) parts.push(`${cities.length} stad${cities.length === 1 ? "" : "en"}`);
  return parts.join(" · ");
}

function adsetsSectionPreview(adsets: AdsetDraft[]) {
  if (!adsets.length) return "Nog geen advertentiesets — voeg er één toe";
  const labels = adsets.map((adset, index) => adset.name.trim() || `Set ${index + 1}`);
  if (adsets.length === 1) {
    return `${labels[0]} · ${adsetAccordionPreview(adsets[0])}`;
  }
  return `${adsets.length} sets · ${labels.slice(0, 3).join(", ")}${labels.length > 3 ? "…" : ""}`;
}

function adsetAccordionPreview(adset: AdsetDraft) {
  const gender =
    adset.genders === "1" ? "Mannen" : adset.genders === "2" ? "Vrouwen" : "Alle genders";
  const ageMin = adset.ageMin.trim() || META_DEFAULT_AGE_MIN;
  const ageMax = adset.ageMax.trim() || META_DEFAULT_AGE_MAX;
  const placements =
    adset.placements.length > 0
      ? `${adset.placements.length} plaatsing${adset.placements.length === 1 ? "" : "en"}`
      : "Geen plaatsingen";
  return [gender, `${ageMin}–${ageMax} jaar`, metaLocationSummary(adset), placements].join(" · ");
}

function adsPerAdsetSectionPreview(adsets: AdsetDraft[]) {
  const totalVariants = adsets.reduce((sum, adset) => sum + adset.variants.length, 0);
  if (!adsets.length) return "Nog geen advertentiesets";
  const names = adsets.map((adset, index) => adset.name.trim() || `Set ${index + 1}`);
  return `${adsets.length} ad set(s) · ${totalVariants} advertentie(s) · ${names.slice(0, 2).join(", ")}${names.length > 2 ? "…" : ""}`;
}

function adsetCreativePreview(adset: AdsetDraft) {
  const first = adset.variants[0];
  const copyHint = first?.headline?.trim() || first?.name?.trim();
  return `${adset.variants.length} advertentie(s) · ${adset.placements.length} placement(s)${copyHint ? ` · ${copyHint}` : ""}`;
}

function variantCreativePreview(variant: CreativeVariantDraft) {
  const parts = [variant.headline?.trim(), variant.linkUrl?.trim()].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Nog geen headline of link";
}

function AdsetCreativeAccordionCard({
  adset,
  index,
  defaultOpen = false,
  onAddVariant,
  children,
}: {
  adset: AdsetDraft;
  index: number;
  defaultOpen?: boolean;
  onAddVariant: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-2xl border bg-muted/20">
      <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-start gap-2.5 rounded-lg py-0.5 text-left transition hover:bg-muted/30"
        >
          <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
          <Layers3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Campagne → Adset</p>
            <p className="font-medium leading-snug">{adset.name.trim() || `Advertentieset ${index + 1}`}</p>
            {!open ? <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{adsetCreativePreview(adset)}</p> : null}
          </div>
        </button>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={(event) => {
            event.stopPropagation();
            onAddVariant();
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Advertentie
        </Button>
      </div>
      {open ? <div className="space-y-2 border-t border-border/40 p-2.5">{children}</div> : null}
    </div>
  );
}

function VariantAccordionCard({
  campaignName,
  adsetName,
  variantIndex,
  variant,
  defaultOpen = false,
  active,
  onSelect,
  onAiSuggest,
  onRemove,
  canRemove,
  aiBriefingReady = true,
  children,
}: {
  campaignName: string;
  adsetName: string;
  variantIndex: number;
  variant: CreativeVariantDraft;
  defaultOpen?: boolean;
  active: boolean;
  onSelect: () => void;
  onAiSuggest: () => void;
  onRemove: () => void;
  canRemove: boolean;
  aiBriefingReady?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const title = variant.name.trim() || `Advertentie ${variantIndex + 1}`;

  return (
    <div className={cn("overflow-hidden rounded-xl border", active ? "border-primary bg-primary/5" : "bg-card")}>
      <div className="flex items-start gap-1.5 px-2.5 py-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen((value) => !value);
            onSelect();
          }}
          className="flex min-w-0 flex-1 items-start gap-2 rounded-lg text-left transition hover:bg-muted/20"
        >
          <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              {campaignName || "Campagne"} → {adsetName} · Ad {variantIndex + 1}
            </p>
            <p className="text-sm font-medium leading-snug">{title}</p>
            {!open ? <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{variantCreativePreview(variant)}</p> : null}
          </div>
        </button>
        <div className="flex shrink-0 flex-wrap gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={!aiBriefingReady}
            title={aiBriefingReady ? undefined : "Vul eerst product of aanbod in (min. 2 tekens)"}
            onClick={(event) => {
              event.stopPropagation();
              onAiSuggest();
            }}
          >
            <Sparkles className="mr-1 h-3 w-3" />
            AI
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 px-0"
            disabled={!canRemove}
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {open ? <div className="space-y-2 border-t border-border/40 px-2.5 pb-2.5 pt-2">{children}</div> : null}
    </div>
  );
}

function AdsetAccordionCard({
  adset,
  index,
  defaultOpen = false,
  onRemove,
  children,
}: {
  adset: AdsetDraft;
  index: number;
  defaultOpen?: boolean;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const title = adset.name.trim() || `Advertentieset ${index + 1}`;

  return (
    <div className="overflow-hidden rounded-2xl border bg-muted/20">
      <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-start gap-2.5 rounded-lg py-0.5 text-left transition hover:bg-muted/30"
        >
          <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
          <Layers3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="font-medium leading-snug">{title}</p>
            {!open ? <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{adsetAccordionPreview(adset)}</p> : null}
            {open && !adset.name.trim() ? (
              <p className="mt-0.5 text-xs text-muted-foreground">Advertentieset {index + 1}</p>
            ) : null}
          </div>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Verwijderen
        </Button>
      </div>
      {open ? <div className="space-y-3 border-t border-border/40 p-4">{children}</div> : null}
    </div>
  );
}

function parseJson(value: string, label: string) {
  if (!value.trim()) return {};
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} bevat geen geldige JSON.`);
  }
}

function createAdset(name = "Nieuwe advertentieset", id = `adset-${Date.now()}`): AdsetDraft {
  return {
    id,
    name,
    countries: "",
    regions: "",
    cities: "",
    ageMin: META_DEFAULT_AGE_MIN,
    ageMax: META_DEFAULT_AGE_MAX,
    genders: "ALL",
    placements: [],
    customAudiencesText: "",
    excludedCustomAudiencesText: "",
    interestSignalsText: "",
    advantageAudience: false,
    notes: "",
    geoLabels: "{}",
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
    ctaLabel: "",
    urlTags: "",
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
}, variant?: Partial<CreativeVariantDraft> | null, options: { inheritAssets?: boolean; inheritCopy?: boolean } = {}) {
  const next = variant || {};
  const inheritCopy = options.inheritCopy !== false;
  const inheritAssets = options.inheritAssets === true;
  return {
    adName: next.adName || next.name || base.adName,
    primaryText: next.primaryText || (inheritCopy ? base.primaryText : ""),
    headline: next.headline || (inheritCopy ? base.headline : ""),
    description: next.description || (inheritCopy ? base.description : ""),
    linkUrl: next.linkUrl || (inheritCopy ? base.linkUrl : ""),
    displayUrl: next.displayUrl || (inheritCopy ? base.displayUrl : ""),
    feedImageUrl: next.feedImageUrl || (inheritAssets ? base.feedImageUrl : ""),
    squareImageUrl: next.squareImageUrl || (inheritAssets ? base.squareImageUrl : ""),
    storyImageUrl: next.storyImageUrl || (inheritAssets ? base.storyImageUrl : ""),
    publishAsset: next.publishAsset || base.publishAsset,
    ctaType: next.ctaType || base.ctaType,
    ctaLabel: next.ctaLabel || (inheritCopy ? base.ctaLabel : ""),
    urlTags: next.urlTags || (inheritCopy ? base.urlTags : ""),
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
  return next;
}

function targetingToAdset(targeting: Record<string, any>, fallbackName: string, id = `adset-${Date.now()}`): AdsetDraft {
  const geo = asRecord(targeting.geo_locations);
  const automation = asRecord(targeting.targeting_automation);
  return {
    id,
    name: String(targeting.name || fallbackName),
    countries: Array.isArray(geo.countries) ? geo.countries.join(", ") : "",
    regions: listToLines(geo.regions, []),
    cities: listToLines(geo.cities, []),
    ageMin: targeting.age_min != null && targeting.age_min !== "" ? String(targeting.age_min) : META_DEFAULT_AGE_MIN,
    ageMax: targeting.age_max != null && targeting.age_max !== "" ? String(targeting.age_max) : META_DEFAULT_AGE_MAX,
    genders: Array.isArray(targeting.genders) && targeting.genders.length === 1 ? String(targeting.genders[0]) : "ALL",
    placements: placementKeysFromTargeting(targeting),
    customAudiencesText: listToLines(targeting.custom_audiences, []),
    excludedCustomAudiencesText: listToLines(asRecord(targeting.exclusions).custom_audiences, []),
    interestSignalsText: listToLines(targeting.interestSignals, []),
    advantageAudience: automation.advantage_audience === 1 || automation.advantage_audience === "1",
    notes: String(targeting.audienceNotes || ""),
    geoLabels:
      typeof targeting.geoLabels === "string"
        ? targeting.geoLabels
        : targeting.geoLabels && typeof targeting.geoLabels === "object"
          ? JSON.stringify(targeting.geoLabels)
          : "{}",
    variants: [createCreativeVariant("Variant 1", `${id}-variant-1`)],
  };
}

/** Meta call_to_action types met Nederlandse knoptekst (zoals in Ads Manager). */
const META_CTA_LABEL_OPTIONS = [
  { type: "LEARN_MORE", label: "Meer informatie", shortLabel: "Meer info" },
  { type: "SHOP_NOW", label: "Shop nu", shortLabel: "Shop nu" },
  { type: "SIGN_UP", label: "Aanmelden", shortLabel: "Aanmelden" },
  { type: "CONTACT_US", label: "Contact opnemen", shortLabel: "Contact" },
  { type: "APPLY_NOW", label: "Solliciteren", shortLabel: "Solliciteren" },
  { type: "GET_QUOTE", label: "Offerte aanvragen", shortLabel: "Offerte" },
  { type: "BOOK_TRAVEL", label: "Boeken", shortLabel: "Boeken" },
  { type: "DOWNLOAD", label: "Downloaden", shortLabel: "Downloaden" },
  { type: "WATCH_MORE", label: "Meer bekijken", shortLabel: "Meer bekijken" },
  { type: "GET_OFFER", label: "Aanbieding bekijken", shortLabel: "Aanbieding" },
  { type: "SUBSCRIBE", label: "Abonneren", shortLabel: "Abonneren" },
  { type: "ORDER_NOW", label: "Nu bestellen", shortLabel: "Bestellen" },
  { type: "GET_SHOWTIMES", label: "Tijden bekijken", shortLabel: "Tijden" },
  { type: "LISTEN_NOW", label: "Nu luisteren", shortLabel: "Luisteren" },
  { type: "REQUEST_TIME", label: "Tijd aanvragen", shortLabel: "Tijd aanvragen" },
  { type: "SEE_MENU", label: "Menu bekijken", shortLabel: "Menu" },
] as const;

function ctaLabelFromType(type: string) {
  const normalized = type.trim().toUpperCase();
  const match = META_CTA_LABEL_OPTIONS.find((option) => option.type === normalized);
  if (match) return match.label;
  if (normalized === "CONTACT_NOW") return "Contact opnemen";
  if (normalized === "BOOK_NOW") return "Boeken";
  return "Meer informatie";
}

function resolveVariantCtaSelectType(variant: Pick<CreativeVariantDraft, "ctaType" | "ctaLabel">) {
  const label = variant.ctaLabel.trim();
  const byLabel = META_CTA_LABEL_OPTIONS.find((option) => option.label === label);
  if (byLabel) return byLabel.type;
  const byType = META_CTA_LABEL_OPTIONS.find((option) => option.type === variant.ctaType);
  if (byType) return byType.type;
  return variant.ctaType || "LEARN_MORE";
}

function resolveMetaPreviewCtaLabel(ctaLabel: string, ctaType?: string) {
  const trimmed = ctaLabel.trim();
  if (trimmed) return trimmed;
  if (ctaType?.trim()) return ctaLabelFromType(ctaType);
  return "Meer informatie";
}

function MetaPreviewFeedCtaButton({ label }: { label: string }) {
  const text = resolveMetaPreviewCtaLabel(label);
  const long = text.length > 16;
  const medium = text.length > 12;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md bg-slate-200 px-2 py-1 text-center font-semibold leading-tight text-slate-800 dark:bg-slate-800 dark:text-slate-100",
        long ? "max-w-[10rem] text-[8px]" : medium ? "max-w-[8.5rem] text-[9px]" : "max-w-[7rem] text-[10px]",
      )}
      title={text}
    >
      <span className="line-clamp-2 break-words hyphens-auto">{text}</span>
    </span>
  );
}

function liveAdToVariant(ad: Record<string, any>, fallbackName: string, id: string): CreativeVariantDraft {
  const creative = asRecord(ad.creative);
  const storySpec = asRecord(creative.object_story_spec);
  const linkData = asRecord(storySpec.link_data);
  const photoData = asRecord(storySpec.photo_data);
  const templateData = asRecord(asRecord(storySpec.template_data).link_data);
  const creativeData = Object.keys(linkData).length ? linkData : Object.keys(templateData).length ? templateData : photoData;
  const callToAction = asRecord(creativeData.call_to_action);
  const ctaType = String(callToAction.type || "LEARN_MORE");
  const ctaValue = asRecord(callToAction.value);
  const imageUrl = String(creativeData.picture || creativeData.image_url || photoData.url || "");
  const linkUrl = String(creativeData.link || ctaValue.link || "");
  const headline = String(creativeData.name || creative.name || ad.name || fallbackName);
  const primaryText = String(creativeData.message || creativeData.text || "");
  const description = String(creativeData.description || creativeData.caption || "");

  return {
    ...createCreativeVariant(fallbackName, id),
    name: String(ad.name || fallbackName),
    adName: String(ad.name || fallbackName),
    primaryText,
    headline,
    description,
    linkUrl,
    displayUrl: linkUrl ? linkUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : "",
    feedImageUrl: imageUrl,
    squareImageUrl: "",
    storyImageUrl: "",
    publishAsset: "feed",
    ctaType,
    ctaLabel: ctaLabelFromType(ctaType),
    urlTags: String(creativeData.url_tags || ""),
    angle: "",
  };
}

function liveAdsetToDraft(adset: Record<string, any>, index: number): AdsetDraft {
  const adsetId = String(adset.id || `live-adset-${index + 1}`);
  const draft = targetingToAdset(asRecord(adset.targeting), String(adset.name || `Adset ${index + 1}`), `live-${adsetId}`);
  const ads = Array.isArray(adset.ads) ? adset.ads : [];
  const variants = ads.length
    ? ads.map((ad: any, adIndex: number) =>
        liveAdToVariant(asRecord(ad), `Ad ${adIndex + 1}`, `live-${adsetId}-ad-${String(ad?.id || adIndex + 1)}`),
      )
    : draft.variants;

  return {
    ...draft,
    name: String(adset.name || draft.name),
    variants,
  };
}

function formatTrpcValidationError(message: string): string | null {
  try {
    const issues = JSON.parse(message) as Array<{ path?: Array<string | number>; message?: string }>;
    if (!Array.isArray(issues) || !issues.length) return null;
    const first = issues[0];
    if (first.path?.includes("product")) {
      return "Vul product of aanbod in op de Campagne-stap (minstens 2 tekens).";
    }
    return first.message || null;
  } catch {
    return null;
  }
}

function trpcErrorDescription(message: string) {
  return formatTrpcValidationError(message) || explainMetaError(message)?.message || message;
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

function previewAssetForSlot(
  slot: AssetSlot,
  images: { feedImageUrl: string; squareImageUrl: string; storyImageUrl: string },
) {
  const trimmed = {
    feed: images.feedImageUrl.trim(),
    square: images.squareImageUrl.trim(),
    story: images.storyImageUrl.trim(),
  };
  if (trimmed[slot]) return { url: trimmed[slot], usesFallback: false };
  const fallback = resolvePublishImage(slot, images).trim();
  return { url: fallback, usesFallback: Boolean(fallback) };
}

function describeOperationalRequirement(code: string): OperationalRequirement {
  if (code === "META_NOT_CONNECTED") {
    return {
      code,
      title: "Meta nog niet gekoppeld",
      description: "Deze workspace heeft nog geen geldige Meta OAuth-token.",
      nextStep: "Koppel Meta via Integraties voordat je ads kunt publiceren.",
    };
  }
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
  const merged = mergeVariantWithBase(base, variant, { inheritAssets: false, inheritCopy: false });
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
    cta: merged.ctaLabel.trim() || ctaLabelFromType(merged.ctaType),
    ctaLabel: merged.ctaLabel.trim() || ctaLabelFromType(merged.ctaType),
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

  const ageMin = numberValue(adset.ageMin);
  const ageMax = numberValue(adset.ageMax);
  return {
    name: adset.name.trim(),
    geo_locations: {
      countries: csvToList(adset.countries),
      regions: linesToList(adset.regions),
      cities: linesToList(adset.cities),
    },
    ...(ageMin >= 13 ? { age_min: ageMin } : {}),
    ...(ageMax >= Math.max(13, ageMin || 13) ? { age_max: ageMax } : {}),
    genders: gendersPayload,
    publisher_platforms: publisherPlatforms,
    facebook_positions: facebookPositions,
    instagram_positions: instagramPositions,
    custom_audiences: linesToList(adset.customAudiencesText, 25),
    exclusions: { custom_audiences: linesToList(adset.excludedCustomAudiencesText, 25) },
    interestSignals: linesToList(adset.interestSignalsText, 25),
    targeting_automation: { advantage_audience: adset.advantageAudience ? 1 : 0 },
    audienceNotes: adset.notes.trim() || null,
    geoLabels: parseGeoLabels(adset.geoLabels),
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

function adsetAudienceSummary(adset: AdsetDraft) {
  const parts: string[] = [];
  const interests = linesToList(adset.interestSignalsText, 25).length;
  const includeCount = linesToList(adset.customAudiencesText, 25).length;
  const excludeCount = linesToList(adset.excludedCustomAudiencesText, 25).length;
  if (interests) parts.push(`${interests} signaal${interests === 1 ? "" : "en"}`);
  if (includeCount) parts.push(`${includeCount} audience${includeCount === 1 ? "" : "s"}`);
  if (excludeCount) parts.push(`${excludeCount} uitgesloten`);
  if (adset.notes.trim()) parts.push("notities");
  return parts.join(" · ");
}

function LinesChipField({
  label,
  help,
  value,
  onChange,
  placeholder,
  maxItems = 25,
  mono = false,
  emptyHint,
}: {
  label: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxItems?: number;
  mono?: boolean;
  emptyHint?: string;
}) {
  const [draft, setDraft] = useState("");
  const items = linesToList(value, maxItems);

  function commitDraft(raw = draft) {
    const parts = raw
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const merged = [...items];
    for (const part of parts) {
      if (merged.length >= maxItems) break;
      const duplicate = merged.some((existing) => existing.toLowerCase() === part.toLowerCase());
      if (!duplicate) merged.push(part);
    }
    onChange(merged.join("\n"));
    setDraft("");
  }

  function removeAt(index: number) {
    onChange(items.filter((_, itemIndex) => itemIndex !== index).join("\n"));
  }

  return (
    <div className="space-y-2">
      <HelpLabel label={label} help={help} />
      <div
        className={cn(
          "rounded-xl border border-border/60 bg-background shadow-sm transition focus-within:ring-2 focus-within:ring-primary/15",
          items.length === 0 && "border-dashed",
        )}
      >
        <div className="flex min-h-9 flex-wrap items-center gap-1.5 p-2">
          {items.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className={cn(
                "inline-flex max-w-full items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground",
                mono && "font-mono text-[10px]",
              )}
            >
              <span className="truncate">{item}</span>
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-background/80 hover:text-foreground"
                aria-label={`Verwijder ${item}`}
                onClick={() => removeAt(index)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {items.length < maxItems ? (
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  commitDraft();
                } else if (event.key === "Backspace" && !draft && items.length) {
                  removeAt(items.length - 1);
                }
              }}
              onBlur={() => {
                if (draft.trim()) commitDraft();
              }}
              placeholder={items.length ? "Nog toevoegen…" : placeholder}
              className={cn(
                "min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground/70",
                mono && "font-mono text-xs",
              )}
            />
          ) : null}
        </div>
        <div className="flex items-center justify-between border-t border-border/40 px-2 py-1 text-[10px] text-muted-foreground">
          <span>{emptyHint || "Enter of komma om toe te voegen"}</span>
          <span className="tabular-nums">
            {items.length}/{maxItems}
          </span>
        </div>
      </div>
    </div>
  );
}

function AdsetAudienceOptionalSection({
  adset,
  onUpdate,
}: {
  adset: AdsetDraft;
  onUpdate: (patch: Partial<AdsetDraft>) => void;
}) {
  const summary = adsetAudienceSummary(adset);

  return (
    <details className="rounded-xl border border-dashed border-border/70 bg-background/50">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Target className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
          Doelgroep &amp; audiences (optioneel)
        </span>
        {summary ? <span className="truncate text-xs text-muted-foreground">{summary}</span> : null}
      </summary>
      <div className="space-y-4 border-t border-border/50 px-3 pb-3 pt-3">
        <p className="rounded-lg border border-violet-200/50 bg-violet-50/40 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground dark:border-violet-900/40 dark:bg-violet-950/20">
          <span className="font-medium text-foreground">Interest signalen</span> helpen AI en interne notities — ze worden niet automatisch als Meta-interests gepusht.
          Custom audience IDs worden wél meegestuurd bij push (vind je in Meta Ads Manager → Doelgroepen).
        </p>

        <LinesChipField
          label="Interest signalen"
          help="Thema’s of interesses voor deze set (AI-briefing). Niet hetzelfde als Meta targeting interests."
          value={adset.interestSignalsText}
          onChange={(next) => onUpdate({ interestSignalsText: next })}
          placeholder="Bijv. Vlaamse ondernemers"
          emptyHint="Typ en druk Enter — één signaal per chip"
        />

        <div className="space-y-3 rounded-xl border border-border/50 bg-muted/15 p-3">
          <p className="text-xs font-semibold text-foreground">Meta custom audiences</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Plak audience-ID’s uit Ads Manager. Insluiten = remarketing/warm traffic · Uitsluiten = bestaande klanten of converters.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <LinesChipField
              label="Insluiten"
              help="Meta custom audience ID, één per chip. Alleen cijfers."
              value={adset.customAudiencesText}
              onChange={(next) => onUpdate({ customAudiencesText: next })}
              placeholder="Audience-ID"
              mono
              maxItems={25}
              emptyHint="ID plakken + Enter"
            />
            <LinesChipField
              label="Uitsluiten"
              help="Audiences die je wilt uitsluiten van deze set."
              value={adset.excludedCustomAudiencesText}
              onChange={(next) => onUpdate({ excludedCustomAudiencesText: next })}
              placeholder="Audience-ID"
              mono
              maxItems={25}
              emptyHint="ID plakken + Enter"
            />
          </div>
        </div>

        <div className="space-y-2">
          <HelpLabel label="Interne notities" help="Waarom bestaat deze advertentieset? Alleen zichtbaar in jullie studio." />
          <Textarea
            className="min-h-[4.5rem] resize-y text-sm"
            rows={2}
            value={adset.notes}
            onChange={(event) => onUpdate({ notes: event.target.value })}
            placeholder="Bijv. warm remarketing, focus op demo-aanvragen"
          />
        </div>
      </div>
    </details>
  );
}

const META_DEFAULT_URL_TAGS = "utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}";

function resolveMetaUrlTagsPreview(tags: string, campaignName: string) {
  const raw = tags.trim() || META_DEFAULT_URL_TAGS;
  const slug = campaignName.trim()
    ? campaignName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    : "mijn-campagne";
  return raw.replace(/\{\{campaign\.name\}\}/gi, slug);
}

function MetaCampaignUrlTagsField({
  value,
  onChange,
  campaignName,
}: {
  value: string;
  onChange: (value: string) => void;
  campaignName: string;
}) {
  const resolvedTags = resolveMetaUrlTagsPreview(value, campaignName);
  const exampleLanding = "https://jouwsite.be/landing";
  const exampleUrl = `${exampleLanding}${exampleLanding.includes("?") ? "&" : "?"}${resolvedTags}`;
  const campaignLabel = campaignName.trim() || "je campagnenaam";
  const summaryPreview = value.trim()
    ? value.trim().length > 52
      ? `${value.trim().slice(0, 52)}…`
      : value.trim()
    : "Niet ingesteld — optioneel";

  return (
    <details className="group rounded-xl border border-dashed border-border/70 bg-background/50 sm:col-span-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-sm font-medium">Standaard URL-parameters (UTM)</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="rounded-full text-muted-foreground transition hover:text-foreground"
                aria-label="Uitleg URL-parameters"
                onClick={(event) => event.preventDefault()}
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs leading-5">
              Tracking die Meta aan je landingspagina plakt bij live ads. Geldt voor alle advertenties, tenzij je per variant iets anders
              invult onder Tracking &amp; publicatie.
            </TooltipContent>
          </Tooltip>
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <span className="hidden max-w-[14rem] truncate font-mono text-[10px] text-muted-foreground sm:inline">{summaryPreview}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
        </span>
      </summary>
      <div className="space-y-2 border-t border-border/50 px-3 pb-3 pt-2">
        <p className="truncate font-mono text-[10px] text-muted-foreground sm:hidden">{summaryPreview}</p>
        <Input
          className="h-8 font-mono text-xs"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={META_DEFAULT_URL_TAGS}
        />
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground dark:border-slate-800 dark:bg-slate-900/40">
          <p>
            <span className="font-medium text-foreground">Wat is dit?</span> Extra tekst achter je bestemmingslink zodat Analytics of je CRM
            kan zien dat bezoekers via deze Meta-campagne binnenkomen.
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5">
            <li>
              <span className="font-medium text-foreground/90">utm_source / utm_medium</span> — welk kanaal (bijv. meta, paid_social)
            </li>
            <li>
              <span className="font-medium text-foreground/90">utm_campaign</span> — campagnenaam in je rapportages
            </li>
            <li>
              <span className="font-medium text-foreground/90">{`{{campaign.name}}`}</span> — wordt bij push vervangen door &quot;{campaignLabel}&quot;
            </li>
          </ul>
          <p className="mt-1.5">
            Alleen invullen als je UTM&apos;s wilt meesturen. Formaat:{" "}
            <span className="font-mono text-[10px]">sleutel=waarde&amp;sleutel2=waarde2</span> (zonder <span className="font-mono">?</span> of{" "}
            <span className="font-mono">&amp;</span> aan het begin).
          </p>
        </div>
        <details className="rounded-lg border border-dashed border-border/60 bg-background/50 px-2.5 py-1.5">
          <summary className="cursor-pointer text-[11px] font-medium text-foreground">Voorbeeld na publicatie</summary>
          <p className="mt-1.5 break-all font-mono text-[10px] leading-snug text-muted-foreground">{exampleUrl}</p>
        </details>
        {!value.trim() ? (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onChange(META_DEFAULT_URL_TAGS)}>
            Standaard UTM invullen
          </Button>
        ) : null}
      </div>
    </details>
  );
}

const META_AD_COPY_LIMITS = {
  primaryText: 125,
  headline: 40,
  description: 30,
} as const;

function metaCopyCounter(length: number, max: number) {
  const over = length > max;
  return (
    <span className={cn("shrink-0 text-[10px] tabular-nums", over ? "font-medium text-destructive" : "text-muted-foreground")}>
      {length}/{max}
    </span>
  );
}

function CompactHelpLabel({ label, help, counter }: { label: string; help: string; counter?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1">
        <Label className="text-[11px] font-medium leading-none text-muted-foreground">{label}</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="rounded-full text-muted-foreground/80 transition hover:text-foreground"
              aria-label={`Uitleg voor ${label}`}
            >
              <HelpCircle className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs leading-5">
            {help}
          </TooltipContent>
        </Tooltip>
      </div>
      {counter}
    </div>
  );
}

function VariantDenseField({
  label,
  help,
  counter,
  className,
  invalid,
  children,
}: {
  label: string;
  help: string;
  counter?: React.ReactNode;
  className?: string;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1 flex items-center justify-between gap-1 leading-none">
        <div className="flex min-w-0 items-center gap-0.5">
          <span className={cn("truncate text-[11px] font-medium", invalid ? "text-destructive" : "text-muted-foreground")}>{label}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="shrink-0 text-muted-foreground/70 hover:text-foreground" aria-label={`Uitleg ${label}`}>
                <HelpCircle className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs leading-5">
              {help}
            </TooltipContent>
          </Tooltip>
        </div>
        {counter}
      </div>
      <div className={cn(invalid && "[&_input]:border-destructive/60 [&_textarea]:border-destructive/60")}>{children}</div>
    </div>
  );
}

function VariantFormAccordionSection({
  title,
  description,
  issues,
  defaultOpen,
  optional,
  children,
}: {
  title: string;
  description?: string;
  issues: string[];
  defaultOpen?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  const hasIssues = issues.length > 0;

  return (
    <details
      className={cn(
        "group overflow-hidden rounded-lg border shadow-sm",
        hasIssues ? "border-destructive/30 bg-destructive/[0.02]" : "border-border/50 bg-background/70",
      )}
      open={defaultOpen || hasIssues || undefined}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-xs font-semibold text-foreground">{title}</p>
            {hasIssues ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {issues.length}
              </span>
            ) : optional ? (
              <span className="text-[10px] font-normal text-muted-foreground">Optioneel</span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                OK
              </span>
            )}
          </div>
          {hasIssues ? (
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-destructive">{issues.join(" · ")}</p>
          ) : description ? (
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="space-y-2.5 border-t border-border/50 px-2.5 pb-2.5 pt-2">{children}</div>
    </details>
  );
}

function variantCopyLengthIssues(variant: CreativeVariantDraft) {
  const issues: Array<{ label: string; over: number; max: number }> = [];
  if (variant.primaryText.length > META_AD_COPY_LIMITS.primaryText) {
    issues.push({
      label: "Primaire tekst",
      over: variant.primaryText.length - META_AD_COPY_LIMITS.primaryText,
      max: META_AD_COPY_LIMITS.primaryText,
    });
  }
  if (variant.headline.length > META_AD_COPY_LIMITS.headline) {
    issues.push({
      label: "Headline",
      over: variant.headline.length - META_AD_COPY_LIMITS.headline,
      max: META_AD_COPY_LIMITS.headline,
    });
  }
  if (variant.description.length > META_AD_COPY_LIMITS.description) {
    issues.push({
      label: "Beschrijving",
      over: variant.description.length - META_AD_COPY_LIMITS.description,
      max: META_AD_COPY_LIMITS.description,
    });
  }
  return issues;
}

function variantBasisIssues(variant: CreativeVariantDraft, merged: ReturnType<typeof mergeVariantWithBase>) {
  const issues: string[] = [];
  if (!variant.name.trim()) issues.push("Advertentienaam ontbreekt");
  const link = merged.linkUrl.trim();
  if (!link) issues.push("Landingspagina (https) ontbreekt");
  else if (!link.startsWith("https://")) issues.push("Link moet met https:// beginnen");
  return issues;
}

function variantCopyIssues(variant: CreativeVariantDraft, merged: ReturnType<typeof mergeVariantWithBase>) {
  const issues: string[] = [];
  if (!merged.primaryText.trim()) issues.push("Primaire tekst ontbreekt");
  if (!merged.headline.trim()) issues.push("Headline ontbreekt");
  for (const issue of variantCopyLengthIssues(variant)) {
    issues.push(`${issue.label}: ${issue.over} tekens te lang (max ${issue.max})`);
  }
  return issues;
}

function variantAssetIssues(
  variant: CreativeVariantDraft,
  merged: ReturnType<typeof mergeVariantWithBase>,
  storyPlacementWarning: boolean,
) {
  const issues: string[] = [];
  const resolvedImage = resolvePublishImage(merged.publishAsset, {
    feedImageUrl: merged.feedImageUrl,
    squareImageUrl: merged.squareImageUrl,
    storyImageUrl: merged.storyImageUrl,
  });
  if (!resolvedImage.trim()) issues.push("Upload minstens één beeld");
  if (storyPlacementWarning && !merged.storyImageUrl.trim()) issues.push("Story/Reels-beeld (9:16) ontbreekt");
  return issues;
}

function VariantCreativeForm({
  adsetId,
  variant,
  merged,
  campaignUrlTags,
  uploadingVariantAsset,
  storyPlacementWarning,
  onUpdate,
  onUploadAsset,
}: {
  adsetId: string;
  variant: CreativeVariantDraft;
  merged: ReturnType<typeof mergeVariantWithBase>;
  campaignUrlTags: string;
  uploadingVariantAsset: string | null;
  storyPlacementWarning: boolean;
  onUpdate: (patch: Partial<CreativeVariantDraft>) => void;
  onUploadAsset: (slot: AssetSlot, file: File) => Promise<void>;
}) {
  const uploadKey = (slot: AssetSlot) => `${adsetId}:${variant.id}:${slot}`;
  const effectiveUrlTags = variant.urlTags.trim() || campaignUrlTags.trim();
  const basisIssues = variantBasisIssues(variant, merged);
  const copyIssues = variantCopyIssues(variant, merged);
  const assetIssues = variantAssetIssues(variant, merged, storyPlacementWarning);
  const assetCount = [variant.feedImageUrl, variant.squareImageUrl, variant.storyImageUrl].filter((url) => url.trim()).length;

  const inputClass = "h-8 min-h-8 py-0 text-xs";

  return (
    <div className="space-y-2">
      <VariantFormAccordionSection
        title="Basis"
        description="Naam, invalshoek, landingspagina en knop."
        issues={basisIssues}
        defaultOpen
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <VariantDenseField label="Advertentienaam" help="Interne naam in Meta Ads Manager.">
            <Input className={inputClass} value={variant.name} onChange={(e) => onUpdate({ name: e.target.value, adName: e.target.value })} />
          </VariantDenseField>
          <VariantDenseField label="Hoek / hook" help="Invalshoek voor A/B-test (alleen intern).">
            <Input className={inputClass} value={variant.angle} onChange={(e) => onUpdate({ angle: e.target.value })} placeholder="Bijv. social proof" />
          </VariantDenseField>
          <VariantDenseField className="sm:col-span-2" label="Landingspagina (URL)" help="https-link, verplicht bij publiceren naar Meta.">
            <Input
              className={inputClass}
              value={variant.linkUrl}
              onChange={(e) => onUpdate({ linkUrl: e.target.value })}
              placeholder="https://jouwsite.be/landing"
            />
          </VariantDenseField>
          <VariantDenseField
            className="sm:col-span-2"
            label="Knop (CTA)"
            help="Eén keuze voor Meta (call_to_action) én de tekst op de knop in de preview — zoals in Ads Manager."
          >
            <Select
              value={resolveVariantCtaSelectType(variant)}
              onValueChange={(value) => onUpdate({ ctaType: value, ctaLabel: ctaLabelFromType(value) })}
            >
              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="Kies een actie" />
              </SelectTrigger>
              <SelectContent>
                {META_CTA_LABEL_OPTIONS.map((option) => (
                  <SelectItem key={option.type} value={option.type}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Preview-knop:{" "}
              <span className="font-medium text-foreground">
                {variant.ctaLabel.trim() || ctaLabelFromType(variant.ctaType)}
              </span>
              <span className="mx-1 text-border">·</span>
              Meta-type: <span className="font-mono text-[10px]">{variant.ctaType}</span>
            </p>
          </VariantDenseField>
        </div>
      </VariantFormAccordionSection>

      <VariantFormAccordionSection
        title="Advertentietekst"
        description="Tekst in feed, story en reels."
        issues={copyIssues}
      >
        <div className="grid gap-2">
          <VariantDenseField
            label="Primaire tekst"
            help={`Hoofdtekst boven het beeld. Max ${META_AD_COPY_LIMITS.primaryText} tekens.`}
            counter={metaCopyCounter(variant.primaryText.length, META_AD_COPY_LIMITS.primaryText)}
            invalid={variant.primaryText.length > META_AD_COPY_LIMITS.primaryText}
          >
            <Textarea
              rows={3}
              className="min-h-[3.25rem] resize-y py-1.5 text-xs leading-relaxed"
              value={variant.primaryText}
              onChange={(e) => onUpdate({ primaryText: e.target.value })}
              placeholder="Beschrijf je aanbod in 1–2 zinnen."
            />
          </VariantDenseField>
          <div className="grid gap-2 sm:grid-cols-2">
            <VariantDenseField
              label="Headline"
              help={`Titel onder het beeld. Max ${META_AD_COPY_LIMITS.headline} tekens — korter werkt vaak beter.`}
              counter={metaCopyCounter(variant.headline.length, META_AD_COPY_LIMITS.headline)}
              invalid={variant.headline.length > META_AD_COPY_LIMITS.headline}
            >
              <Input className={inputClass} value={variant.headline} onChange={(e) => onUpdate({ headline: e.target.value })} />
            </VariantDenseField>
            <VariantDenseField
              label="Beschrijving"
              help={`Korte regel onder de headline. Max ${META_AD_COPY_LIMITS.description} tekens.`}
              counter={metaCopyCounter(variant.description.length, META_AD_COPY_LIMITS.description)}
              invalid={variant.description.length > META_AD_COPY_LIMITS.description}
            >
              <Input className={inputClass} value={variant.description} onChange={(e) => onUpdate({ description: e.target.value })} />
            </VariantDenseField>
          </div>
        </div>
      </VariantFormAccordionSection>

      <VariantFormAccordionSection
        title="Creatieve beelden"
        description={`${assetCount}/3 geüpload · feed · vierkant · story`}
        issues={assetIssues}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <VariantAssetField
            compact
            slot="feed"
            title="Feed"
            help="1200×628 of 1:1."
            ratio="1.91:1"
            recommended="1200×628"
            value={variant.feedImageUrl}
            uploading={uploadingVariantAsset === uploadKey("feed")}
            onUpload={(file) => onUploadAsset("feed", file)}
          />
          <VariantAssetField
            compact
            slot="square"
            title="Vierkant"
            help="1:1 voor Instagram feed."
            ratio="1:1"
            recommended="1200×1200"
            value={variant.squareImageUrl}
            uploading={uploadingVariantAsset === uploadKey("square")}
            onUpload={(file) => onUploadAsset("square", file)}
          />
          <VariantAssetField
            compact
            slot="story"
            title="Story & Reels"
            help="Verticaal 9:16."
            ratio="9:16"
            recommended="1080×1920"
            value={variant.storyImageUrl}
            uploading={uploadingVariantAsset === uploadKey("story")}
            onUpload={(file) => onUploadAsset("story", file)}
          />
        </div>
        {storyPlacementWarning ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-950 dark:text-amber-100">
            Deze ad set heeft story/reels-placements — upload een 9:16-beeld.
          </p>
        ) : null}
      </VariantFormAccordionSection>

      <VariantFormAccordionSection
        title="Tracking & publicatie"
        optional
        description={[
          variant.urlTags.trim() ? "Eigen UTM" : effectiveUrlTags ? "Campagne-UTM" : "Geen UTM",
          variant.publishAsset === "feed" ? "Feed bij push" : variant.publishAsset === "square" ? "Vierkant bij push" : "Story bij push",
        ].join(" · ")}
        issues={[]}
      >
        <p className="rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">UTM</span> = tracking achter je landingslink bij live ads.{" "}
          <span className="font-medium text-foreground">Weergave-URL</span> = alleen wat je in de preview ziet (niet de echte klik-link).{" "}
          <span className="font-medium text-foreground">Primair beeld</span> = welk geüpload formaat we als hoofdvisual meesturen bij push.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <VariantDenseField
            className="sm:col-span-2"
            label="UTM-tracking (url_tags)"
            help="Wordt door Meta aan je landings-URL geplakt. Leeg laten = de standaard UTM van de campagne (Advertenties-stap). Alleen invullen als deze advertentie afwijkt."
          >
            <Input
              className="h-8 font-mono text-[10px]"
              value={variant.urlTags}
              onChange={(e) => onUpdate({ urlTags: e.target.value })}
              placeholder={campaignUrlTags.trim() || META_DEFAULT_URL_TAGS}
            />
            {!variant.urlTags.trim() && effectiveUrlTags ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Bij push: campagne-UTM · <span className="font-mono">{effectiveUrlTags}</span>
              </p>
            ) : null}
          </VariantDenseField>
          <VariantDenseField
            label="Weergave-URL (preview)"
            help="Korte domeinnaam onder de advertentie in onze preview. Bezoekers klikken nog steeds op je echte landingspagina-URL hierboven."
          >
            <Input
              className={inputClass}
              value={variant.displayUrl}
              onChange={(e) => onUpdate({ displayUrl: e.target.value })}
              placeholder={merged.linkUrl ? merged.linkUrl.replace(/^https?:\/\//, "").split("/")[0] : "jouwsite.be"}
            />
          </VariantDenseField>
          <VariantDenseField
            label="Primair beeld bij push"
            help="Welk geüpload beeld (feed / vierkant / story) als hoofdvisual in object_story_spec. Kies het formaat dat past bij je belangrijkste placement."
          >
            <Select value={variant.publishAsset} onValueChange={(value) => onUpdate({ publishAsset: value as AssetSlot })}>
              <SelectTrigger className={inputClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="feed">Feed — landschap 1.91:1</SelectItem>
                <SelectItem value="square">Vierkant — Instagram feed 1:1</SelectItem>
                <SelectItem value="story">Story & Reels — verticaal 9:16</SelectItem>
              </SelectContent>
            </Select>
          </VariantDenseField>
        </div>
      </VariantFormAccordionSection>
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

const META_OPTIMIZATION_GOAL_LABELS: Record<OptimizationGoal, string> = {
  AUTO: "Auto per objective",
  LINK_CLICKS: "Link clicks",
  LANDING_PAGE_VIEWS: "Landing page views",
  LEAD_GENERATION: "Lead generation",
  OFFSITE_CONVERSIONS: "Offsite conversions",
  REACH: "Reach",
  IMPRESSIONS: "Impressions",
};

const META_DESTINATION_LABELS: Record<DestinationType, string> = {
  AUTO: "Auto",
  WEBSITE: "Website",
  MESSENGER: "Messenger",
  WHATSAPP: "WhatsApp",
  PHONE_CALL: "Phone call",
};

const META_BID_STRATEGY_LABELS: Record<BidStrategy, string> = {
  LOWEST_COST_WITHOUT_CAP: "Lowest cost without cap",
  LOWEST_COST_WITH_BID_CAP: "Lowest cost with bid cap",
  COST_CAP: "Cost cap",
};

function metaDeliveryPreview(params: {
  optimizationGoal: OptimizationGoal;
  destinationType: DestinationType;
  bidStrategy: BidStrategy;
  billingEvent: string;
}) {
  const billing =
    META_BILLING_EVENT_OPTIONS.find((option) => option.value === params.billingEvent)?.label || params.billingEvent;
  return [
    META_OPTIMIZATION_GOAL_LABELS[params.optimizationGoal],
    META_DESTINATION_LABELS[params.destinationType],
    META_BID_STRATEGY_LABELS[params.bidStrategy],
    billing,
  ].join(" · ");
}

const META_OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_TRAFFIC: "Traffic",
  OUTCOME_LEADS: "Leads",
  OUTCOME_SALES: "Sales",
  OUTCOME_ENGAGEMENT: "Engagement",
  OUTCOME_AWARENESS: "Awareness",
  LINK_CLICKS: "Link clicks",
  LEAD_GENERATION: "Lead generation",
};

function metaAdvertentiesPreview(params: {
  facebookPublisherName: string;
  instagramPublisherName: string;
  product: string;
  audience: string;
  aiTone: AiTone;
}) {
  const parts: string[] = [];
  if (params.facebookPublisherName.trim()) parts.push(`Facebook: ${params.facebookPublisherName.trim()}`);
  if (params.instagramPublisherName.trim() && params.instagramPublisherName !== params.facebookPublisherName) {
    parts.push(`Instagram: ${params.instagramPublisherName.trim()}`);
  }
  if (params.product.trim()) parts.push(params.product.trim());
  if (params.audience.trim()) parts.push(params.audience.trim());
  const tone = META_AI_TONES.find((item) => item.value === params.aiTone)?.label;
  if (tone) parts.push(tone);
  return parts.length ? parts.join(" · ") : "Meta-identiteit en AI-briefing";
}

function previewPublisherName(slot: AssetSlot, facebookPublisherName: string, instagramPublisherName: string) {
  return slot === "feed" ? facebookPublisherName : instagramPublisherName;
}

const BUILDER_SECTION_ACCENTS = {
  default: {
    shell:
      "border-[#1877F2]/15 bg-gradient-to-br from-[#1877F2]/[0.05] via-card/90 to-sky-500/[0.04] dark:border-[#1877F2]/25 dark:from-[#1877F2]/10 dark:via-slate-950/95 dark:to-sky-950/15",
    iconWrap: "bg-[#1877F2]/10 ring-[#1877F2]/20 dark:bg-[#1877F2]/15 dark:ring-[#1877F2]/30",
    icon: "text-[#1877F2] dark:text-[#8CB4FF]",
    panel: "border-[#1877F2]/10 bg-background/50 dark:border-[#1877F2]/15 dark:bg-background/25",
    summaryHover: "hover:bg-[#1877F2]/[0.04] dark:hover:bg-[#1877F2]/10",
  },
  ai: {
    shell:
      "border-[#1877F2]/25 bg-gradient-to-br from-[#1877F2]/[0.08] via-white to-sky-50/60 dark:border-[#1877F2]/35 dark:from-[#1877F2]/14 dark:via-slate-950 dark:to-sky-950/20",
    iconWrap: "bg-[#1877F2]/15 ring-[#1877F2]/25 shadow-sm shadow-[#1877F2]/10",
    icon: "text-[#166FE5] dark:text-[#8CB4FF]",
    panel: "border-[#1877F2]/15 bg-[#1877F2]/[0.03] dark:border-[#1877F2]/20 dark:bg-[#1877F2]/5",
    summaryHover: "hover:bg-[#1877F2]/[0.06] dark:hover:bg-[#1877F2]/12",
  },
} as const;

function BuilderSection({
  icon: Icon,
  title,
  description,
  children,
  accent = "default",
  collapsible = false,
  defaultOpen,
  preview,
  headerAction,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
  accent?: "default" | "ai";
  collapsible?: boolean;
  defaultOpen?: boolean;
  preview?: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  const [open, setOpen] = useState(() => (collapsible ? Boolean(defaultOpen) : true));
  const styles = BUILDER_SECTION_ACCENTS[accent];

  const headerBody = (
    <>
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 sm:h-10 sm:w-10",
          styles.iconWrap,
        )}
      >
        <Icon className={cn("h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]", styles.icon)} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {collapsible && !open ? (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{preview || description}</p>
        ) : description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </>
  );

  if (collapsible) {
    return (
      <section className={cn("overflow-hidden rounded-2xl border shadow-sm", styles.shell)}>
        <div className="flex items-start gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          <details
            open={open}
            className="group min-w-0 flex-1"
            onToggle={(event) => setOpen(event.currentTarget.open)}
          >
            <summary
              className={cn(
                "flex cursor-pointer list-none items-start gap-3 rounded-xl px-1 py-1 transition-colors marker:content-none [&::-webkit-details-marker]:hidden",
                styles.summaryHover,
              )}
            >
              {headerBody}
              <ChevronDown
                className={cn(
                  "mt-2 h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform duration-200 group-open:rotate-180",
                  open && "rotate-180",
                )}
                aria-hidden
              />
            </summary>
            <div className={cn("mt-3 space-y-4 rounded-xl border px-3 pb-4 pt-3 sm:px-4", styles.panel)}>{children}</div>
          </details>
          {headerAction ? <div className="shrink-0 pt-1">{headerAction}</div> : null}
        </div>
      </section>
    );
  }

  return (
    <section className={cn("overflow-hidden rounded-2xl border shadow-sm", styles.shell)}>
      <div className="flex items-start gap-3 border-b border-border/40 px-4 py-3 sm:px-5">
        {headerBody}
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}

const META_BUILDER_CHECKLIST_STEPS = [
  {
    id: "campaign" as const,
    step: "campaign" as BuilderStep,
    label: "Campagne",
    ok: (p: { campaignComplete: boolean }) => p.campaignComplete,
    hint: "Naam, objective, buying type en budget (min. €1,00).",
  },
  {
    id: "adset" as const,
    step: "adsets" as BuilderStep,
    label: "Adset",
    ok: (p: { adsetsComplete: boolean }) => p.adsetsComplete,
    hint: "Locatie, leeftijd (13+) en minstens één placement.",
  },
  {
    id: "ads" as const,
    step: "ads" as BuilderStep,
    label: "Ads",
    ok: (p: { adsComplete: boolean }) => p.adsComplete,
    hint: "Meta-account, copy, https-link en beeld (9:16 bij stories/reels).",
  },
] as const;

type MetaChecklistFocus = (typeof META_BUILDER_CHECKLIST_STEPS)[number]["id"];

function MetaBuilderChecklist(props: {
  campaignComplete: boolean;
  adsetsComplete: boolean;
  adsComplete: boolean;
  readyToSave: boolean;
  adsetCount: number;
  variantCount: number;
  onStepClick?: (step: BuilderStep) => void;
}) {
  const [focus, setFocus] = useState<MetaChecklistFocus | null>(null);
  const status = {
    campaignComplete: props.campaignComplete,
    adsetsComplete: props.adsetsComplete,
    adsComplete: props.adsComplete,
  };

  const focused = focus ? META_BUILDER_CHECKLIST_STEPS.find((item) => item.id === focus) : null;
  const focusedOk = focused ? focused.ok(status) : false;

  return (
    <div className="rounded-lg border bg-muted/25 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-xs font-semibold">Meta-checklist</p>
        <span className="text-[10px] text-muted-foreground">
          {props.adsetCount} set{props.adsetCount === 1 ? "" : "s"} · {props.variantCount} ad{props.variantCount === 1 ? "" : "s"}
        </span>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Checklist stappen">
          {META_BUILDER_CHECKLIST_STEPS.map((item) => {
            const ok = item.ok(status);
            const active = focus === item.id;

            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  const next = active ? null : item.id;
                  setFocus(next);
                  if (next && props.onStepClick) props.onStepClick(item.step);
                }}
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] leading-none transition",
                  ok
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                    : "border-border/80 bg-background/60 text-muted-foreground hover:border-amber-500/40 hover:bg-amber-500/5",
                  active && (ok ? "ring-1 ring-emerald-500/40" : "ring-1 ring-amber-500/45"),
                )}
              >
                {ok ? (
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
                )}
                {item.label}
              </button>
            );
          })}
        </div>
        <Badge variant={props.readyToSave ? "success" : "warning"} className="ml-auto py-0 text-[10px] font-normal">
          {props.readyToSave ? "Klaar" : "Nog niet compleet"}
        </Badge>
      </div>
      {focused ? (
        <p
          className={cn(
            "mt-1.5 rounded-md px-2 py-1 text-[10px] leading-snug",
            focusedOk
              ? "bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
              : "bg-amber-500/10 text-amber-950 dark:text-amber-100",
          )}
        >
          <span className="font-medium">{focused.label}:</span> {focusedOk ? "Compleet." : focused.hint}
        </p>
      ) : null}
    </div>
  );
}

function MetaAiBriefingFields({
  product,
  setProduct,
  audience,
  setAudience,
  aiTone,
  setAiTone,
  layout = "dialog",
}: {
  product: string;
  setProduct: (value: string) => void;
  audience: string;
  setAudience: (value: string) => void;
  aiTone: AiTone;
  setAiTone: (value: AiTone) => void;
  layout?: "dialog" | "compact";
}) {
  const LabelRow = layout === "dialog" ? CompactHelpLabel : HelpLabel;

  return (
    <div className={cn("grid gap-3", layout === "dialog" ? "gap-4" : "sm:grid-cols-2 xl:grid-cols-3")}>
      <div className={cn("space-y-1.5", layout === "compact" && "sm:col-span-2 xl:col-span-1")}>
        <LabelRow label="Product of aanbod" help="Input voor AI — wordt niet rechtstreeks naar Meta gepusht." />
        <Input
          className={layout === "dialog" ? "h-9" : undefined}
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          placeholder="Bijv. webdesign voor KMO's"
          autoFocus={layout === "dialog"}
        />
      </div>
      <div className="space-y-1.5">
        <LabelRow label="Tone of voice" help="Stijl van AI-gegenereerde campagne- en advertentieteksten." />
        <Select value={aiTone} onValueChange={(value) => setAiTone(value as AiTone)}>
          <SelectTrigger className={layout === "dialog" ? "h-9" : undefined}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {META_AI_TONES.map((tone) => (
              <SelectItem key={tone.value} value={tone.value}>
                {tone.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={cn("space-y-1.5", layout === "compact" ? "sm:col-span-2 xl:col-span-3" : "")}>
        <LabelRow label="Doelgroep" help="Wie wil je bereiken? Gebruikt door AI, niet als harde Meta-targeting." />
        <Input
          className={layout === "dialog" ? "h-9" : undefined}
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="Bijv. zaakvoerders in Vlaanderen"
        />
      </div>
    </div>
  );
}

type MetaAiBriefingInput = {
  product: string;
  audience: string;
  tone: AiTone;
};

function MetaAiCampaignBriefingDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (brief: MetaAiBriefingInput) => void;
  pending: boolean;
}) {
  const [draftProduct, setDraftProduct] = useState("");
  const [draftAudience, setDraftAudience] = useState("");
  const [draftTone, setDraftTone] = useState<AiTone>("professioneel");

  useEffect(() => {
    if (!open) return;
    setDraftProduct("");
    setDraftAudience("");
    setDraftTone("professioneel");
  }, [open]);

  const productReady = draftProduct.trim().length >= 2;

  function handleConfirm() {
    if (!productReady || pending) return;
    onConfirm({
      product: draftProduct.trim(),
      audience: draftAudience.trim(),
      tone: draftTone,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            AI campagnevoorstel
          </DialogTitle>
          <DialogDescription>
            Beantwoord drie korte vragen. Daarna vullen we campagnenaam, objective, advertentieset(s) en eerste advertentie-copy in. Afbeeldingen
            voeg je daarna zelf toe.
          </DialogDescription>
        </DialogHeader>
        <MetaAiBriefingFields
          layout="dialog"
          product={draftProduct}
          setProduct={setDraftProduct}
          audience={draftAudience}
          setAudience={setDraftAudience}
          aiTone={draftTone}
          setAiTone={setDraftTone}
        />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuleren
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={pending || !productReady}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Genereer en ga verder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetaGeoEntryBadge({
  entry,
  onRemove,
}: {
  entry: MetaGeoEntry;
  onRemove: () => void;
}) {
  const kindLabel = entry.kind === "country" ? "Land" : entry.kind === "region" ? "Regio" : "Stad";
  return (
    <Badge variant="secondary" className="gap-1 py-1 pl-2 pr-1 text-xs font-normal">
      <MapPin className="h-3 w-3 shrink-0 opacity-70" />
      <span>
        {kindLabel}: {entry.label}
      </span>
      <button
        type="button"
        className="rounded-full p-0.5 text-muted-foreground transition hover:bg-background hover:text-foreground"
        onClick={onRemove}
        aria-label={`${entry.label} verwijderen`}
      >
        <XCircle className="h-3.5 w-3.5" />
      </button>
    </Badge>
  );
}

function MetaLocationEditor({
  adset,
  onChange,
  metaSearchEnabled,
}: {
  adset: AdsetDraft;
  onChange: (patch: Partial<AdsetDraft>) => void;
  metaSearchEnabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const entries = useMemo(() => adsetGeoEntries(adset), [adset]);
  const [panelOpen, setPanelOpen] = useState(() => entries.length === 0);
  const primaryCountry = csvToList(adset.countries)[0]?.toUpperCase();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 320);
    return () => window.clearTimeout(timer);
  }, [query]);

  const search = trpc.metaAds.searchGeoLocations.useQuery(
    { query: debouncedQuery, countryCode: primaryCountry || undefined },
    { enabled: metaSearchEnabled && debouncedQuery.length >= 2, retry: false },
  );

  function setEntries(next: MetaGeoEntry[]) {
    onChange(applyGeoEntries(next.slice(0, META_GEO_MAX_LOCATIONS)));
  }

  function addEntry(entry: MetaGeoEntry) {
    if (entries.length >= META_GEO_MAX_LOCATIONS) return;
    if (entries.some((item) => item.key === entry.key && item.kind === entry.kind)) return;
    setEntries([...entries, entry]);
  }

  function removeEntry(key: string, kind: MetaGeoKind) {
    setEntries(entries.filter((item) => !(item.key === key && item.kind === kind)));
  }

  const searchResults = (search.data || []).filter(
    (item) => !entries.some((entry) => entry.key === item.key && entry.kind === item.type),
  );

  const locationPicker = (
    <>
      <div className="flex flex-wrap gap-1.5">
        {META_COUNTRY_PICKS.map((country) => {
          const active = entries.some((entry) => entry.kind === "country" && entry.key === country.code);
          return (
            <button
              key={country.code}
              type="button"
              onClick={() =>
                active
                  ? removeEntry(country.code, "country")
                  : addEntry({ key: country.code, label: country.label, kind: "country", countryCode: country.code })
              }
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition",
                active ? "border-primary bg-primary/10 text-primary" : "border-border/70 bg-background hover:bg-muted/40",
              )}
            >
              {country.label}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
          disabled={!metaSearchEnabled}
          placeholder={metaSearchEnabled ? "Zoek stad of regio (zoals Meta Ads)…" : "Koppel Meta om locaties te zoeken"}
          className="bg-background/90 pl-8"
        />
        {search.isFetching ? (
          <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      {metaSearchEnabled && query.length > 0 && query.length < 2 ? (
        <p className="text-[11px] text-muted-foreground">Typ minstens 2 tekens om te zoeken.</p>
      ) : null}
      {searchOpen && metaSearchEnabled && debouncedQuery.length >= 2 ? (
        <div className="max-h-48 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-sm">
          {search.error ? <p className="p-3 text-xs text-amber-800 dark:text-amber-200">{search.error.message}</p> : null}
          {!search.isFetching && !search.error && searchResults.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">Geen locaties gevonden voor &quot;{debouncedQuery}&quot;.</p>
          ) : null}
          {searchResults.map((item) => (
            <button
              key={`${item.type}-${item.key}`}
              type="button"
              className="flex w-full flex-col gap-0.5 border-b border-border/40 px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/60"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                addEntry({
                  key: item.key,
                  label: item.label,
                  kind: item.type === "region" ? "region" : "city",
                  countryCode: item.countryCode,
                });
                setQuery("");
                setSearchOpen(false);
              }}
            >
              <span className="font-medium">{item.label}</span>
              <span className="text-xs text-muted-foreground">
                {item.typeLabel}
                {item.canonicalName ? ` · ${item.canonicalName}` : ""}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/10">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-start gap-2 rounded-lg text-left transition hover:bg-muted/20"
        >
          <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition", panelOpen && "rotate-180")} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Locaties</p>
            {!panelOpen ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{metaLocationSummary(adset)}</p>
            ) : (
              <p className="mt-0.5 text-xs text-muted-foreground">Land, regio of stad — zoals in Meta Ads Manager</p>
            )}
          </div>
        </button>
        <Badge variant={entries.length > 0 ? "success" : "warning"} className="shrink-0 text-[10px] font-normal">
          {entries.length}/{META_GEO_MAX_LOCATIONS}
        </Badge>
      </div>

      {!panelOpen && entries.length ? (
        <div className="flex flex-wrap gap-1.5 border-t border-border/40 px-3 pb-2.5 pt-2">
          {entries.map((entry) => (
            <MetaGeoEntryBadge
              key={`${entry.kind}-${entry.key}`}
              entry={entry}
              onRemove={() => removeEntry(entry.key, entry.kind)}
            />
          ))}
        </div>
      ) : null}

      {panelOpen ? (
        <div className="space-y-3 border-t border-border/40 p-3">
          {locationPicker}
          {entries.length ? (
            <div className="flex flex-wrap gap-1.5">
              {entries.map((entry) => (
                <MetaGeoEntryBadge
                  key={`${entry.kind}-${entry.key}`}
                  entry={entry}
                  onRemove={() => removeEntry(entry.key, entry.kind)}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Kies een preset, een land of zoek een stad/regio via Meta.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CollapsibleCard({
  title,
  description,
  preview,
  children,
  defaultOpen = false,
}: {
  title: string;
  description?: string;
  preview?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-muted/20 sm:px-5",
          open && "border-b border-border/50",
        )}
      >
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {open && description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
          {!open && preview ? <p className="mt-1 truncate text-sm text-muted-foreground">{preview}</p> : null}
          {!open && !preview && description ? <p className="mt-1 truncate text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
      </button>
      {open ? <CardContent className="space-y-3 pt-0 sm:pt-0">{children}</CardContent> : null}
    </Card>
  );
}

function StepButton({
  step,
  stepNumber,
  activeStep,
  complete,
  locked,
  onClick,
}: {
  step: (typeof STEPS)[number];
  stepNumber: number;
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
      className={cn(
        "group flex min-w-[132px] shrink-0 flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition sm:min-w-0",
        active && "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/15",
        !active && complete && "border-primary/30 bg-primary/5 hover:border-primary/40 hover:bg-primary/10",
        !active && !complete && !locked && "border-border/70 bg-background hover:border-primary/25 hover:bg-muted/40",
        locked && "cursor-not-allowed border-border/50 bg-muted/30 opacity-55",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
            active
              ? "bg-primary-foreground/20 text-primary-foreground"
              : complete
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground",
          )}
        >
          {locked ? <Lock className="h-3 w-3" /> : complete && !active ? <CheckCircle2 className="h-3.5 w-3.5" /> : stepNumber}
        </span>
        {complete && !active ? <span className="text-[10px] font-medium text-primary">Klaar</span> : null}
      </div>
      <span className="text-xs font-semibold leading-tight">{step.label}</span>
      <p className={cn("line-clamp-2 text-[10px] leading-snug", active ? "text-primary-foreground/75" : "text-muted-foreground")}>
        {step.description}
      </p>
    </button>
  );
}

function BuilderStepper({
  activeStep,
  onStepClick,
  stepComplete,
  canOpenStep,
  compact = false,
}: {
  activeStep: BuilderStep;
  onStepClick: (step: BuilderStep) => void;
  stepComplete: (step: BuilderStep) => boolean;
  canOpenStep: (step: BuilderStep) => boolean;
  compact?: boolean;
}) {
  const activeIndex = BUILDER_STEP_ORDER.indexOf(activeStep);
  const progress = ((activeIndex + 1) / BUILDER_STEP_ORDER.length) * 100;

  return (
    <div className={cn("space-y-3", compact ? "" : "rounded-2xl border border-border/60 bg-muted/20 p-3 sm:p-4")}>
      {!compact ? (
        <>
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              Stap <span className="font-semibold text-foreground">{activeIndex + 1}</span> van {BUILDER_STEP_ORDER.length}
            </span>
            <span>{Math.round(progress)}% voltooid</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </>
      ) : null}
      <div className="flex gap-2 overflow-x-auto pb-0.5 sm:grid sm:grid-cols-4 sm:overflow-visible">
        {STEPS.map((step, index) => (
          <StepButton
            key={step.id}
            step={step}
            stepNumber={index + 1}
            activeStep={activeStep}
            complete={stepComplete(step.id)}
            locked={!canOpenStep(step.id)}
            onClick={() => onStepClick(step.id)}
          />
        ))}
      </div>
    </div>
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

const VARIANT_ASSET_SLOT_META: Record<
  "feed" | "square" | "story",
  { label: string; ratioHint: string; thumbClass: string }
> = {
  feed: { label: "Feed", ratioHint: "1:1 · 1.91:1", thumbClass: "h-[4.5rem] w-[7.25rem]" },
  square: { label: "Vierkant", ratioHint: "1:1", thumbClass: "h-[4.5rem] w-[4.5rem]" },
  story: { label: "Story / Reels", ratioHint: "9:16", thumbClass: "h-[4.75rem] w-[2.65rem]" },
};

const VARIANT_ASSET_COMPACT_THUMB: Record<"feed" | "square" | "story", string> = {
  feed: "h-11 w-[4.25rem]",
  square: "h-11 w-11",
  story: "h-11 w-[1.85rem]",
};

function VariantAssetField(props: {
  title: string;
  help: string;
  ratio: string;
  recommended: string;
  value: string;
  uploading: boolean;
  slot?: "feed" | "square" | "story";
  compact?: boolean;
  onUpload: (file: File) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const probe = useImageProbe(props.value);
  const hasValue = Boolean(props.value.trim());
  const slot =
    props.slot ??
    (props.title.toLowerCase().includes("story") ? "story" : props.title.toLowerCase().includes("square") ? "square" : "feed");
  const meta = VARIANT_ASSET_SLOT_META[slot];
  const statusLabel = probeLabel(probe);
  const statusVariant =
    probe.status === "ready" ? "success" : probe.status === "error" ? "destructive" : hasValue ? "warning" : "secondary";

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void props.onUpload(file);
    event.currentTarget.value = "";
  }

  const thumbFrame = (
    <div
      className={cn(
        "shrink-0 overflow-hidden rounded-md border bg-background",
        props.compact ? VARIANT_ASSET_COMPACT_THUMB[slot] : meta.thumbClass,
        !hasValue && "border-dashed border-muted-foreground/25 bg-muted/20",
      )}
    >
      {hasValue ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={props.value} alt={meta.label} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageIcon className={cn(props.compact ? "h-3.5 w-3.5" : "h-5 w-5", "opacity-60")} />
        </div>
      )}
    </div>
  );

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/png,image/jpeg,image/webp"
      className="hidden"
      onChange={handleFileChange}
    />
  );

  const uploadButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(props.compact ? "h-7 w-full px-2 text-[10px]" : "w-full")}
      disabled={props.uploading}
      onClick={() => fileInputRef.current?.click()}
    >
      {props.uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
      {hasValue ? "Wijzig" : "Upload"}
    </Button>
  );

  if (props.compact) {
    return (
      <div
        className={cn(
          "flex gap-2 rounded-lg border bg-card/80 p-1.5",
          hasValue ? "border-emerald-500/30" : "border-border/60",
        )}
      >
        {thumbFrame}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0 leading-none">
              <p className="text-[11px] font-semibold">{meta.label}</p>
              <p className="mt-0.5 text-[9px] text-muted-foreground">
                {props.recommended}
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="shrink-0 text-muted-foreground" aria-label={`Uitleg ${meta.label}`}>
                  <HelpCircle className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {props.help}
              </TooltipContent>
            </Tooltip>
          </div>
          <Badge variant={statusVariant} className="h-4 w-fit px-1 text-[9px] font-normal">
            {statusLabel}
          </Badge>
          {fileInput}
          {uploadButton}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-gradient-to-b from-card to-muted/15 shadow-sm transition-shadow hover:shadow-md",
        hasValue ? "border-emerald-500/30 ring-1 ring-emerald-500/10" : "border-border/60",
      )}
    >
      <div className="border-b border-border/40 bg-gradient-to-br from-muted/25 via-background to-muted/10 px-2 py-2">
        <div className="flex h-[5rem] items-center justify-center">{thumbFrame}</div>
      </div>
      <div className="flex flex-col gap-2 p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold leading-tight">{meta.label}</p>
            <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
              {meta.ratioHint} · {props.recommended}
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="shrink-0 rounded-full p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label={`Uitleg voor ${meta.label}`}
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs leading-5">
              {props.help}
            </TooltipContent>
          </Tooltip>
        </div>
        <Badge variant={statusVariant} className="w-fit text-[10px] font-normal">
          {statusLabel}
        </Badge>
        {fileInput}
        {uploadButton}
      </div>
    </div>
  );
}

function StoryReelsPhonePreview(props: {
  imageUrl: string;
  headline: string;
  primaryText: string;
  ctaLabel: string;
  pageName: string;
  pageAvatarUrl?: string;
  displayUrl: string;
}) {
  const hasImage = Boolean(props.imageUrl.trim());
  const headline = props.headline.trim() || "Headline";
  const displayLine = (props.displayUrl || "jouwsite.be").replace(/^https?:\/\//, "").toUpperCase();
  const ctaLabel = resolveMetaPreviewCtaLabel(props.ctaLabel);

  return (
    <div className="mx-auto w-full max-w-[min(300px,88vw)]">
      {/* 9:16 = 1080×1920 */}
      <div
        className="relative rounded-[2.35rem] border-[6px] border-slate-900 bg-slate-900 p-[3px] shadow-[0_28px_64px_-16px_rgba(15,23,42,0.5)] dark:border-slate-700"
        role="img"
        aria-label="Story / Reels preview 1080 bij 1920"
      >
        <div className="pointer-events-none absolute -left-[3px] top-[24%] z-30 h-11 w-[3px] rounded-l-sm bg-slate-800" />
        <div className="pointer-events-none absolute -right-[3px] top-[30%] z-30 h-14 w-[3px] rounded-r-sm bg-slate-800" />

        <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[1.9rem] bg-black">
          <div className="absolute left-1/2 top-2.5 z-30 h-5 w-[88px] -translate-x-1/2 rounded-full bg-black ring-1 ring-white/12" />

          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-slate-800 via-slate-950 to-black text-white/55">
              <ImageIcon className="h-8 w-8" />
              <span className="text-xs font-medium">Story / Reels</span>
              <span className="text-[10px] text-white/45">1080 × 1920</span>
            </div>
          )}

          {/* Boven: story-balken + gesponsord (Meta) */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20">
            <div className="bg-gradient-to-b from-black/80 via-black/45 to-transparent px-3.5 pb-14 pt-10">
              <div className="flex gap-1">
                <div className="h-[2px] flex-1 rounded-full bg-white" />
                <div className="h-[2px] flex-1 rounded-full bg-white/35" />
                <div className="h-[2px] flex-1 rounded-full bg-white/35" />
              </div>
              <div className="mt-3 flex items-center gap-2.5">
                <FacebookPageAvatar size="sm" imageUrl={props.pageAvatarUrl} alt={props.pageName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold leading-tight text-white drop-shadow-sm">{props.pageName}</p>
                  <p className="text-[10px] text-white/80">Gesponsord · Story / Reels</p>
                </div>
              </div>
            </div>
          </div>

          {/* Onder: Meta link-ad overlay (headline, URL, CTA-knop) */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
            <div className="min-h-[42%] bg-gradient-to-t from-black via-black/85 to-transparent px-3.5 pb-4 pt-24">
              <div className="flex min-h-[7.5rem] flex-col justify-end">
                {props.primaryText.trim() ? (
                  <p className="mb-2.5 line-clamp-2 text-[11px] leading-relaxed text-white/92 drop-shadow-md">{props.primaryText}</p>
                ) : null}
                <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-white drop-shadow-sm">{headline}</p>
                <p className="mt-1 truncate text-[10px] font-medium uppercase tracking-wide text-white/65">{displayLine}</p>
                <span
                  className={cn(
                    "mt-3 flex w-full items-center justify-center rounded-xl bg-white px-3 py-2.5 text-center font-semibold leading-tight text-slate-900 shadow-lg shadow-black/25",
                    ctaLabel.length > 18 ? "text-[11px]" : "text-[12px]",
                  )}
                >
                  {ctaLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-1.5 left-1/2 z-30 h-[4px] w-24 -translate-x-1/2 rounded-full bg-white/35" />
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] tabular-nums text-muted-foreground">Mobiel · 9:16 · 1080 × 1920 px</p>
    </div>
  );
}

function MetaPreview(props: {
  primaryText: string;
  headline: string;
  description: string;
  linkUrl: string;
  feedImageUrl: string;
  squareImageUrl: string;
  storyImageUrl: string;
  ctaLabel: string;
  facebookPublisherName: string;
  instagramPublisherName: string;
  pageAvatarUrl?: string;
  placements: PlacementKey[];
  publishAsset?: AssetSlot;
}) {
  const imageBundle = {
    feedImageUrl: props.feedImageUrl,
    squareImageUrl: props.squareImageUrl,
    storyImageUrl: props.storyImageUrl,
  };

  const assets: Record<AssetSlot, string> = {
    feed: props.feedImageUrl.trim(),
    square: props.squareImageUrl.trim(),
    story: props.storyImageUrl.trim(),
  };

  const assetSlots: Array<{ id: AssetSlot; label: string; format: string; hint: string }> = [
    { id: "feed", label: "Feed", format: "1.91:1", hint: "Facebook / IG feed · landschap" },
    { id: "square", label: "Vierkant", format: "1:1", hint: "Instagram feed · vierkant" },
    { id: "story", label: "Story & Reels", format: "9:16", hint: "Story & Reels · verticaal" },
  ];

  const defaultSlot: AssetSlot =
    props.publishAsset && assets[props.publishAsset]
      ? props.publishAsset
      : assets.feed
        ? "feed"
        : assets.square
          ? "square"
          : assets.story
            ? "story"
            : "feed";

  const [activeSlot, setActiveSlot] = useState<AssetSlot>(defaultSlot);
  const [previewOpen, setPreviewOpen] = useState(true);

  useEffect(() => {
    if (props.publishAsset && (assets[props.publishAsset] || resolvePublishImage(props.publishAsset, imageBundle).trim())) {
      setActiveSlot(props.publishAsset);
    }
  }, [props.publishAsset, props.feedImageUrl, props.squareImageUrl, props.storyImageUrl]);

  const displayUrl = props.linkUrl.replace(/^https?:\/\//, "").replace(/\/$/, "") || "jouwsite.be";
  const facebookPublisherName = props.facebookPublisherName.trim() || "Facebook-pagina";
  const instagramPublisherName = props.instagramPublisherName.trim() || facebookPublisherName;
  const previewPageName = previewPublisherName(activeSlot, facebookPublisherName, instagramPublisherName);
  const pageAvatarUrl = props.pageAvatarUrl?.trim() || "";
  const feedPreview = previewAssetForSlot("feed", imageBundle);
  const squarePreview = previewAssetForSlot("square", imageBundle);
  const storyPreview = previewAssetForSlot("story", imageBundle);

  const slotPreviews: Record<AssetSlot, { url: string; usesFallback: boolean }> = {
    feed: feedPreview,
    square: squarePreview,
    story: storyPreview,
  };

  function formatTabThumbFrame(slot: AssetSlot) {
    if (slot === "story") return "aspect-[9/16] h-7 w-[1.05rem]";
    if (slot === "square") return "aspect-square h-7 w-7";
    return "aspect-[1.91/1] h-7 w-[2.65rem]";
  }

  function renderFormatThumb(slot: AssetSlot, emphasized?: boolean) {
    const thumbUrl = slotPreviews[slot].url;
    return (
      <span
        className={cn(
          "relative shrink-0 overflow-hidden rounded border bg-gradient-to-br from-slate-100 to-slate-200/80 dark:from-slate-800 dark:to-slate-900/80",
          formatTabThumbFrame(slot),
          emphasized ? "border-primary/30" : "border-border/60",
        )}
      >
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="h-2.5 w-2.5 opacity-35" />
          </span>
        )}
      </span>
    );
  }

  function renderAspectMedia(url: string, format: "feed" | "square", emptyLabel: string) {
    const frameClass = format === "square" ? "aspect-square w-full" : "aspect-[1.91/1] w-full";
    return (
      <div className={cn("relative w-full overflow-hidden bg-slate-200/70 dark:bg-slate-800/70", frameClass)}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImageIcon className="h-5 w-5 opacity-50" />
            <span className="px-2 text-center text-[10px]">{emptyLabel}</span>
          </div>
        )}
      </div>
    );
  }

  function FeedStylePreview({
    title,
    placementLabel,
    imageUrl,
    format,
    usesFallback,
    emptyLabel,
  }: {
    title: string;
    placementLabel: string;
    imageUrl: string;
    format: "feed" | "square";
    usesFallback: boolean;
    emptyLabel: string;
  }) {
    return (
      <div className="min-w-0 space-y-1.5">
        {title ? (
          <div className="flex items-center justify-between gap-2 px-0.5">
            <p className="text-xs font-semibold">{title}</p>
            <Badge variant="outline" className="text-[10px] font-normal">
              {placementLabel}
            </Badge>
          </div>
        ) : null}
        <div className="mx-auto w-full max-w-[min(500px,100%)] min-w-0 rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-950">
          <div className="flex items-center gap-2">
            <FacebookPageAvatar size="sm" imageUrl={pageAvatarUrl} alt={previewPageName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{previewPageName}</p>
              <p className="truncate text-[10px] text-muted-foreground">Gesponsord · {placementLabel}</p>
            </div>
          </div>
          <p className="mt-2 line-clamp-3 break-words text-xs leading-5 text-foreground/90">
            {props.primaryText || "Je advertentietekst verschijnt hier."}
          </p>
          {usesFallback ? (
            <p className="mt-1.5 text-[10px] text-amber-800 dark:text-amber-200">
              Geen eigen {format === "square" ? "vierkant" : "feed"}-beeld — voorbeeld met ander formaat.
            </p>
          ) : null}
          <div className="mt-2 overflow-hidden rounded-lg border bg-slate-100 dark:bg-slate-900">
            {renderAspectMedia(imageUrl, format, emptyLabel)}
            <div className="bg-slate-50 px-2.5 py-2 dark:bg-slate-900">
              <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{displayUrl}</p>
              <div className="mt-1.5 flex flex-wrap items-end justify-between gap-x-2 gap-y-1.5">
                <div className="min-w-0 flex-1 basis-[8rem]">
                  <p className="line-clamp-2 text-xs font-semibold leading-snug">{props.headline || "Headline"}</p>
                  <p className="line-clamp-1 text-[10px] text-muted-foreground">{props.description || "Beschrijving"}</p>
                </div>
                <MetaPreviewFeedCtaButton label={props.ctaLabel} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeFormatSlot = assetSlots.find((slot) => slot.id === activeSlot) ?? assetSlots[0];
  const collapsedPreview = `${activeFormatSlot.label} · ${activeFormatSlot.format}`;

  return (
    <Card className="min-w-0 overflow-hidden border-slate-200 bg-gradient-to-br from-blue-50 via-white to-fuchsia-50 shadow-sm dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <button
        type="button"
        aria-expanded={previewOpen}
        onClick={() => setPreviewOpen((value) => !value)}
        className={cn(
          "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/40 dark:hover:bg-slate-900/40 sm:px-5 sm:py-4",
          previewOpen && "border-b border-border/40",
        )}
      >
        <div className="min-w-0 flex-1">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Eye className="h-4 w-4 shrink-0" /> Meta preview
          </CardTitle>
          {previewOpen ? (
            <CardDescription className="mt-1 text-xs">
              Indicatief — Meta kan plaatsing en CTA aanpassen.
            </CardDescription>
          ) : (
            <p className="mt-1 truncate text-xs text-muted-foreground">{collapsedPreview}</p>
          )}
        </div>
        <ChevronDown
          className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition", previewOpen && "rotate-180")}
        />
      </button>
      {previewOpen ? (
      <CardContent className="space-y-3 pt-0 sm:pt-0">
        <div
          className="flex gap-0.5 rounded-xl border border-border/50 bg-muted/30 p-0.5 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]"
          role="tablist"
          aria-label="Advertentieformaat"
        >
          {assetSlots.map((slot) => {
            const active = activeSlot === slot.id;
            const hasAsset = Boolean(assets[slot.id]);

            return (
              <button
                key={slot.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveSlot(slot.id)}
                className={cn(
                  "relative flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1.5 py-1 text-left transition sm:gap-2 sm:px-2 sm:py-1.5",
                  active
                    ? "bg-background text-foreground shadow-sm ring-1 ring-primary/25"
                    : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                )}
              >
                {renderFormatThumb(slot.id, active)}
                <span className="min-w-0 flex-1 truncate text-[10px] leading-tight sm:text-[11px]">
                  <span className="font-semibold">{slot.label}</span>
                  <span className="text-muted-foreground"> · {slot.format}</span>
                </span>
                {hasAsset ? (
                  <span
                    className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)] sm:static sm:shrink-0"
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        {activeSlot === "story" ? (
          <div className="min-w-0 space-y-2">
            {storyPreview.usesFallback ? (
              <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-950 dark:text-amber-100">
                Geen story-beeld — voorbeeld met ander formaat. Upload 9:16 voor een realistische preview.
              </p>
            ) : null}
            <div className="flex justify-center rounded-xl border border-border/40 bg-gradient-to-b from-slate-100/80 via-background to-slate-50/50 py-4 dark:from-slate-900/50 dark:via-slate-950 dark:to-slate-900/30">
              <StoryReelsPhonePreview
                imageUrl={storyPreview.url}
                headline={props.headline}
                primaryText={props.primaryText}
                ctaLabel={props.ctaLabel}
                pageName={previewPublisherName("story", facebookPublisherName, instagramPublisherName)}
                pageAvatarUrl={pageAvatarUrl}
                displayUrl={displayUrl}
              />
            </div>
          </div>
        ) : activeSlot === "square" ? (
          <FeedStylePreview
            title=""
            placementLabel="Instagram feed · 1:1"
            imageUrl={squarePreview.url}
            format="square"
            usesFallback={squarePreview.usesFallback}
            emptyLabel="Geen vierkant beeld"
          />
        ) : (
          <FeedStylePreview
            title=""
            placementLabel="Facebook feed · 1.91:1"
            imageUrl={feedPreview.url}
            format="feed"
            usesFallback={feedPreview.usesFallback}
            emptyLabel="Geen feed-beeld"
          />
        )}

        <div className="rounded-2xl border bg-white p-3 dark:bg-slate-950 sm:p-4">
          <p className="text-sm font-semibold">Plaatsingen in deze builder</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {props.placements.length ? (
              props.placements.map((placement) => (
                <Badge key={placement} variant="secondary">
                  {PLACEMENTS.find((item) => item.key === placement)?.label}
                </Badge>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">Nog geen placements geselecteerd in adsets.</p>
            )}
          </div>
        </div>
      </CardContent>
      ) : null}
    </Card>
  );
}

function ApprovalQueue(props: {
  rows: any[];
  selectedPlanId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onSubmit: (id: string) => void;
  onApprove: (id: string) => void;
  onPush: (id: string) => void;
  onRetry: (id: string) => void;
  onReject: (id: string) => void;
  onCancel: (id: string) => void;
  autoadsEnabled: boolean;
  pushing: boolean;
  approvalActionPending?: boolean;
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
            <Button size="sm" variant="outline" onClick={() => props.onEdit(row.id)}>
              <PencilLine className="mr-2 h-3 w-3" />
              Bewerken
            </Button>
            {["DRAFT", "FAILED", "CANCELLED"].includes(row.status) ? (
              <Button size="sm" variant="outline" disabled={props.approvalActionPending} onClick={() => props.onSubmit(row.id)}>
                Indienen
              </Button>
            ) : null}
            {row.status === "PENDING_APPROVAL" ? (
              <Button size="sm" disabled={props.approvalActionPending} onClick={() => props.onApprove(row.id)}>
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

function MetaOAuthScopesAlert({ scopes }: { scopes: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      role="alert"
      className="overflow-hidden rounded-2xl border border-amber-300/70 bg-gradient-to-r from-amber-50/90 via-amber-50/50 to-orange-50/30 shadow-sm dark:border-amber-800/50 dark:from-amber-950/35 dark:via-amber-950/20 dark:to-orange-950/15"
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold tracking-tight text-amber-950 dark:text-amber-50">Meta ads-rechten ontbreken</p>
              <Badge className="border-amber-400/40 bg-amber-500/15 py-0 text-[10px] font-medium text-amber-900 hover:bg-amber-500/15 dark:text-amber-100">
                Waarschuwing
              </Badge>
            </div>
            <p className="text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/80">
              {scopes.length} scope{scopes.length === 1 ? "" : "s"} ontbreken — koppel Meta opnieuw via Integraties om campagnes te
              publiceren.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 border-amber-300/60 bg-amber-50/80 text-xs text-amber-950 hover:bg-amber-100/80 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-50 dark:hover:bg-amber-950/50"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
          >
            {open ? "Verberg" : "Details"}
            <ChevronDown className={cn("ml-1.5 h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          </Button>
          <Button
            className="h-9 bg-[#1877F2] px-4 text-xs font-medium text-white shadow-md shadow-[#1877F2]/25 hover:bg-[#166fe5]"
            size="sm"
            asChild
          >
            <Link href="/settings/integrations">Naar integraties</Link>
          </Button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-amber-200/60 bg-amber-50/40 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/25">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Ontbrekende scopes</p>
          <div className="flex flex-wrap gap-1.5">
            {scopes.map((scope) => (
              <span
                key={scope}
                className="inline-flex rounded-md border border-border/60 bg-background/90 px-2 py-0.5 font-mono text-[10px] text-foreground/90"
              >
                {scope}
              </span>
            ))}
          </div>
          <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
            Beheerder: zet{" "}
            <code className="rounded-md border border-border/50 bg-background px-1.5 py-0.5 font-mono text-[10px]">
              META_OAUTH_INCLUDE_ADS=true
            </code>
            , deploy opnieuw en koppel Meta via Integraties.
          </p>
        </div>
      ) : null}
    </div>
  );
}

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

  const pendingAdJobId = searchParams.get("adJob");
  const [appliedAdJobId, setAppliedAdJobId] = useState<string | null>(null);
  const importCreativeAd = trpc.media.importToBlob.useMutation();
  const creativeAdJob = trpc.media.getJobStatus.useQuery(
    { jobId: pendingAdJobId || "" },
    { enabled: Boolean(pendingAdJobId) && appliedAdJobId !== pendingAdJobId },
  );

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
        if (status.prompt?.trim()) {
          setPrimaryText(status.prompt.trim());
          setProduct(status.prompt.trim().slice(0, 120));
        }
        setStoryImageUrl(mediaUrl);
        setPublishAsset("story");
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

  const rows = drafts.data ?? [];
  const pendingApprovalCount = useMemo(
    () => rows.filter((row: { status: string }) => row.status === "PENDING_APPROVAL").length,
    [rows],
  );
  const filteredRows = approvalFilter === "ALL" ? rows : rows.filter((row: any) => row.status === approvalFilter);
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
              resolvedImage.trim() &&
              (!adsetNeedsStoryImage || merged.storyImageUrl.trim()),
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
          if (!image.trim()) adsTodos.push(`${prefix}: upload een publish-beeld.`);
          if (needsStory && !merged.storyImageUrl.trim()) {
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
