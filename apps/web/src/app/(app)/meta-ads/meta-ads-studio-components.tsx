"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { FacebookPageAvatar } from "@/components/social/social-platform-avatars";
import { eur, numberValue, asRecord } from "./meta-ads-format-utils";
import { Badge, Button, Card, CardContent, CardDescription, CardTitle, EmptyState, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Textarea, Tooltip, TooltipContent, TooltipTrigger, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@digitify/ui";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, BarChart3, CheckCircle2, ChevronDown, Eye, HelpCircle, Image as ImageIcon, FileText, Layers3, Loader2, Lock, Megaphone, PauseCircle, PencilLine, Plus, RefreshCcw, Search, Send, Settings2, MapPin, ShieldCheck, Sparkles, Target, Trash2, Upload, Wand2, X, XCircle } from "lucide-react";
import { type CampaignScoreEntry } from "@/lib/meta-ads-campaign-score";

export const AdsWorkflowPanel = dynamic(() => import("@/components/ads/ads-workflow-panel"));

export type PlanStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "PUSHING" | "PUSHED_PAUSED" | "FAILED" | "CANCELLED";

export type PlacementKey =
  | "facebook_feed"
  | "facebook_story"
  | "facebook_reels"
  | "instagram_feed"
  | "instagram_story"
  | "instagram_reels"
  | "instagram_explore"
  | "audience_network";

export type BuilderStep = "campaign" | "adsets" | "ads" | "review";

export type BidStrategy = "LOWEST_COST_WITHOUT_CAP" | "LOWEST_COST_WITH_BID_CAP" | "COST_CAP";

export type OptimizationGoal = "AUTO" | "LINK_CLICKS" | "LANDING_PAGE_VIEWS" | "LEAD_GENERATION" | "OFFSITE_CONVERSIONS" | "REACH" | "IMPRESSIONS";

export type DestinationType = "AUTO" | "WEBSITE" | "MESSENGER" | "WHATSAPP" | "PHONE_CALL";

export type AssetSlot = "feed" | "square" | "story";

export type AiTone = "professioneel" | "speels" | "direct" | "luxueus" | "vriendelijk";

export type ErrorExplanation = {
  label: string;
  code?: string;
  message: string;
  actions: string[];
};

export type MetaGeoKind = "country" | "region" | "city";

export type MetaGeoEntry = {
  key: string;
  label: string;
  kind: MetaGeoKind;
  countryCode?: string;
};

export type AdsetDraft = {
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

export type CreativeVariantDraft = {
  id: string;
  name: string;
  adName: string;
  primaryText: string;
  headline: string;
  description: string;
  linkUrl: string;
  displayUrl: string;
  videoUrl?: string;
  feedImageUrl: string;
  squareImageUrl: string;
  storyImageUrl: string;
  publishAsset: AssetSlot;
  ctaType: string;
  ctaLabel: string;
  urlTags: string;
  angle: string;
};

export type OperationalRequirement = {
  code: string;
  title: string;
  description: string;
  nextStep: string;
};

export type ImageProbeState = {
  status: "idle" | "loading" | "ready" | "error";
  width: number;
  height: number;
};

export const META_ADS_NAV_TABS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: "workflow", label: "Editor & AI", icon: Sparkles },
  { value: "campaigns", label: "Campagnes", icon: Megaphone },
  { value: "dashboard", label: "Overzicht", icon: Eye },
  { value: "builder", label: "Campagne-wizard", icon: Wand2 },
  { value: "approval", label: "Goedkeuring", icon: ShieldCheck },
  { value: "drafts", label: "Drafts", icon: FileText },
  { value: "insights", label: "Prestaties", icon: BarChart3 },
  { value: "settings", label: "Instellingen", icon: Settings2 },
];

export const BUILDER_STEP_ORDER: BuilderStep[] = ["campaign", "adsets", "ads", "review"];

export const STEPS: Array<{ id: BuilderStep; label: string; description: string; metaLevel: "campaign" | "adset" | "ad" | "review" }> = [
  { id: "campaign", label: "Campagne", description: "Naam, objective, budget en planning", metaLevel: "campaign" },
  { id: "adsets", label: "Advertentieset", description: "Delivery, doelgroep en plaatsingen", metaLevel: "adset" },
  { id: "ads", label: "Advertenties", description: "Pagina, copy, links en beelden per ad", metaLevel: "ad" },
  { id: "review", label: "Controleren", description: "Score, checklist en opslaan", metaLevel: "review" },
];

export const META_CURRENCY_OPTIONS = [
  { value: "EUR", label: "Euro", symbol: "€" },
  { value: "USD", label: "US dollar", symbol: "$" },
  { value: "GBP", label: "Britse pond", symbol: "£" },
] as const;

export const META_BUYING_TYPE_OPTIONS = [
  { value: "AUCTION", label: "Auction", hint: "Standaard voor vrijwel alle campagnes." },
  { value: "RESERVED", label: "Reserved", hint: "Vaste media-aankoop — zeldzaam in leadgen." },
] as const;

export const META_BILLING_EVENT_OPTIONS = [
  { value: "IMPRESSIONS", label: "Impressions (CPM)" },
  { value: "LINK_CLICKS", label: "Link clicks (CPC)" },
  { value: "APP_INSTALLS", label: "App installs" },
  { value: "THRUPLAY", label: "ThruPlay (video)" },
] as const;

export const META_CUSTOM_EVENT_OPTIONS = [
  { value: "LEAD", label: "Lead" },
  { value: "PURCHASE", label: "Purchase" },
  { value: "COMPLETE_REGISTRATION", label: "Complete registration" },
  { value: "ADD_TO_CART", label: "Add to cart" },
] as const;

export const META_SPECIAL_AD_CATEGORY_OPTIONS = [
  { value: "NONE", label: "Geen special category" },
  { value: "HOUSING", label: "Housing" },
  { value: "EMPLOYMENT", label: "Employment" },
  { value: "CREDIT", label: "Credit" },
] as const;

export const META_AI_TONES: Array<{ value: AiTone; label: string }> = [
  { value: "professioneel", label: "Professioneel" },
  { value: "vriendelijk", label: "Vriendelijk" },
  { value: "direct", label: "Direct" },
  { value: "speels", label: "Speels" },
  { value: "luxueus", label: "Luxueus" },
];

export const PLACEMENTS: Array<{ key: PlacementKey; label: string; hint: string }> = [
  { key: "facebook_feed", label: "Facebook feed", hint: "1:1 of 1.91:1" },
  { key: "facebook_story", label: "Facebook story", hint: "9:16" },
  { key: "facebook_reels", label: "Facebook reels", hint: "9:16" },
  { key: "instagram_feed", label: "Instagram feed", hint: "1:1 of 4:5" },
  { key: "instagram_story", label: "Instagram story", hint: "9:16" },
  { key: "instagram_reels", label: "Instagram reels", hint: "9:16" },
  { key: "instagram_explore", label: "Instagram explore", hint: "extra bereik" },
  { key: "audience_network", label: "Audience Network", hint: "let op leadkwaliteit" },
];

export const META_LOCATION_PRESETS = [
  { value: "BE", label: "Belgie", countries: "BE", description: "Alle Meta-delivery in Belgie." },
  { value: "NL", label: "Nederland", countries: "NL", description: "Alle Meta-delivery in Nederland." },
  { value: "BE_NL", label: "Belgie + Nederland", countries: "BE, NL", description: "Breed Benelux-startpunt voor Nederlandstalige campagnes." },
  { value: "CUSTOM", label: "Aangepast", countries: "", description: "Gebruik eigen landcodes, regio keys of city keys." },
] as const;

export const META_COUNTRY_LABELS: Record<string, string> = {
  BE: "België",
  NL: "Nederland",
  FR: "Frankrijk",
  DE: "Duitsland",
  LU: "Luxemburg",
};

export const META_COUNTRY_PICKS = [
  { code: "BE", label: "België" },
  { code: "NL", label: "Nederland" },
  { code: "LU", label: "Luxemburg" },
  { code: "FR", label: "Frankrijk" },
  { code: "DE", label: "Duitsland" },
] as const;

export const META_GEO_MAX_LOCATIONS = 25;

export const META_DEFAULT_AGE_MIN = "13";

export const META_DEFAULT_AGE_MAX = "65";

export function metaPlanStatusLabelClient(status: string) {
  if (status === "PUSHED_PAUSED") return "online in Meta";
  if (status === "APPROVED") return "goedgekeurd";
  if (status === "PENDING_APPROVAL") return "wacht op goedkeuring";
  if (status === "PUSHING") return "pushen";
  if (status === "FAILED") return "mislukt";
  return "draft";
}

export function prettyDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("nl-BE", { dateStyle: "short", timeStyle: "short" });
}

export function statusBadge(status: PlanStatus) {
  if (status === "PUSHED_PAUSED") return <Badge variant="success">Gepusht als paused</Badge>;
  if (status === "FAILED") return <Badge variant="warning">Mislukt</Badge>;
  if (status === "PUSHING") return <Badge variant="secondary">Pushen...</Badge>;
  if (status === "APPROVED") return <Badge variant="info">Goedgekeurd</Badge>;
  if (status === "PENDING_APPROVAL") return <Badge variant="warning">Wacht op approval</Badge>;
  if (status === "CANCELLED") return <Badge variant="outline">Geannuleerd</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

export function csvToList(value: string, upper = true) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (upper ? item.toUpperCase() : item));
}

export function linesToList(value: string, max = 50) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

export function listToLines(value: unknown, fallback: string[]) {
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

export function metaCountryLabel(code: string) {
  const normalized = code.trim().toUpperCase();
  return META_COUNTRY_LABELS[normalized] ? `${META_COUNTRY_LABELS[normalized]} (${normalized})` : normalized;
}

export function resolveMetaLocationPreset(adset: AdsetDraft) {
  if (linesToList(adset.regions).length || linesToList(adset.cities).length) return "CUSTOM";
  const countries = csvToList(adset.countries).map((item) => item.toUpperCase()).join(", ");
  return META_LOCATION_PRESETS.find((preset) => preset.value !== "CUSTOM" && preset.countries === countries)?.value || "CUSTOM";
}

export function parseGeoLabels(raw: string) {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function adsetGeoEntries(adset: AdsetDraft): MetaGeoEntry[] {
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

export function applyGeoEntries(entries: MetaGeoEntry[]): Pick<AdsetDraft, "countries" | "regions" | "cities" | "geoLabels"> {
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

export function adsetHasGeoTargeting(adset: AdsetDraft) {
  return Boolean(csvToList(adset.countries).length || linesToList(adset.regions).length || linesToList(adset.cities).length);
}

export function metaLocationSummary(adset: AdsetDraft) {
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

export function adsetsSectionPreview(adsets: AdsetDraft[]) {
  if (!adsets.length) return "Nog geen advertentiesets — voeg er één toe";
  const labels = adsets.map((adset, index) => adset.name.trim() || `Set ${index + 1}`);
  if (adsets.length === 1) {
    return `${labels[0]} · ${adsetAccordionPreview(adsets[0])}`;
  }
  return `${adsets.length} sets · ${labels.slice(0, 3).join(", ")}${labels.length > 3 ? "…" : ""}`;
}

export function adsetAccordionPreview(adset: AdsetDraft) {
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

export function adsPerAdsetSectionPreview(adsets: AdsetDraft[]) {
  const totalVariants = adsets.reduce((sum, adset) => sum + adset.variants.length, 0);
  if (!adsets.length) return "Nog geen advertentiesets";
  const names = adsets.map((adset, index) => adset.name.trim() || `Set ${index + 1}`);
  return `${adsets.length} ad set(s) · ${totalVariants} advertentie(s) · ${names.slice(0, 2).join(", ")}${names.length > 2 ? "…" : ""}`;
}

export function adsetCreativePreview(adset: AdsetDraft) {
  const first = adset.variants[0];
  const copyHint = first?.headline?.trim() || first?.name?.trim();
  return `${adset.variants.length} advertentie(s) · ${adset.placements.length} placement(s)${copyHint ? ` · ${copyHint}` : ""}`;
}

export function variantCreativePreview(variant: CreativeVariantDraft) {
  const parts = [variant.headline?.trim(), variant.linkUrl?.trim()].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Nog geen headline of link";
}

export function AdsetCreativeAccordionCard({
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

export function VariantAccordionCard({
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

export function AdsetAccordionCard({
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

export function parseJson(value: string, label: string) {
  if (!value.trim()) return {};
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} bevat geen geldige JSON.`);
  }
}

export function createAdset(name = "Nieuwe advertentieset", id = `adset-${Date.now()}`): AdsetDraft {
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

export function createCreativeVariant(name = "Nieuwe variant", id = `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`): CreativeVariantDraft {
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

export function mergeVariantWithBase(base: {
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
    videoUrl: next.videoUrl || "",
    publishAsset: next.publishAsset || base.publishAsset,
    ctaType: next.ctaType || base.ctaType,
    ctaLabel: next.ctaLabel || (inheritCopy ? base.ctaLabel : ""),
    urlTags: next.urlTags || (inheritCopy ? base.urlTags : ""),
  };
}

export function placementKeysFromTargeting(targeting: Record<string, any>): PlacementKey[] {
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

export function targetingToAdset(targeting: Record<string, any>, fallbackName: string, id = `adset-${Date.now()}`): AdsetDraft {
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

export const META_CTA_LABEL_OPTIONS = [
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

export function ctaLabelFromType(type: string) {
  const normalized = type.trim().toUpperCase();
  const match = META_CTA_LABEL_OPTIONS.find((option) => option.type === normalized);
  if (match) return match.label;
  if (normalized === "CONTACT_NOW") return "Contact opnemen";
  if (normalized === "BOOK_NOW") return "Boeken";
  return "Meer informatie";
}

export function resolveVariantCtaSelectType(variant: Pick<CreativeVariantDraft, "ctaType" | "ctaLabel">) {
  const label = variant.ctaLabel.trim();
  const byLabel = META_CTA_LABEL_OPTIONS.find((option) => option.label === label);
  if (byLabel) return byLabel.type;
  const byType = META_CTA_LABEL_OPTIONS.find((option) => option.type === variant.ctaType);
  if (byType) return byType.type;
  return variant.ctaType || "LEARN_MORE";
}

export function resolveMetaPreviewCtaLabel(ctaLabel: string, ctaType?: string) {
  const trimmed = ctaLabel.trim();
  if (trimmed) return trimmed;
  if (ctaType?.trim()) return ctaLabelFromType(ctaType);
  return "Meer informatie";
}

export function MetaPreviewFeedCtaButton({ label }: { label: string }) {
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

export function liveAdToVariant(ad: Record<string, any>, fallbackName: string, id: string): CreativeVariantDraft {
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

export function liveAdsetToDraft(adset: Record<string, any>, index: number): AdsetDraft {
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

export function formatTrpcValidationError(message: string): string | null {
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

export function trpcErrorDescription(message: string) {
  return formatTrpcValidationError(message) || explainMetaError(message)?.message || message;
}

export function explainMetaError(raw?: string | null): ErrorExplanation | null {
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
        "Gebruik een volledige https URL, bijvoorbeeld https://jouwdomein.be.",
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

export function useImageProbe(url: string): ImageProbeState {
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

export function probeLabel(probe: ImageProbeState) {
  if (probe.status === "loading") return "Controleren...";
  if (probe.status === "error") return "Kon bestand niet uitlezen";
  if (probe.status !== "ready") return "Nog geen bestand";
  return `${probe.width}x${probe.height}`;
}

export function aspectRatio(probe: ImageProbeState) {
  if (probe.status !== "ready" || !probe.width || !probe.height) return null;
  return probe.width / probe.height;
}

export function roughlyMatches(ratio: number | null, target: number, tolerance = 0.08) {
  if (!ratio) return false;
  return Math.abs(ratio - target) <= tolerance;
}

export function resolvePublishImage(slot: AssetSlot, images: { feedImageUrl: string; squareImageUrl: string; storyImageUrl: string }) {
  if (slot === "story") return images.storyImageUrl || images.feedImageUrl || images.squareImageUrl;
  if (slot === "square") return images.squareImageUrl || images.feedImageUrl || images.storyImageUrl;
  return images.feedImageUrl || images.squareImageUrl || images.storyImageUrl;
}

export function previewAssetForSlot(
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

export function describeOperationalRequirement(code: string): OperationalRequirement {
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

export function buildMergedVariantPayload(
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
    videoUrl: merged.videoUrl.trim(),
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

export function buildInsightCoachRows(rows: any[], level: "campaign" | "adset" | "ad") {
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

export function buildTargetingFromAdset(adset: AdsetDraft) {
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

export function CampaignScorePanel({ entry, compact }: { entry: CampaignScoreEntry; compact?: boolean }) {
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

export function HelpLabel({ label, help }: { label: string; help: string }) {
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

export function adsetAudienceSummary(adset: AdsetDraft) {
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

export function LinesChipField({
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

export function AdsetAudienceOptionalSection({
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

export const META_DEFAULT_URL_TAGS = "utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}";

export function resolveMetaUrlTagsPreview(tags: string, campaignName: string) {
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

export function MetaCampaignUrlTagsField({
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

export const META_AD_COPY_LIMITS = {
  primaryText: 125,
  headline: 40,
  description: 30,
} as const;

export function metaCopyCounter(length: number, max: number) {
  const over = length > max;
  return (
    <span className={cn("shrink-0 text-[10px] tabular-nums", over ? "font-medium text-destructive" : "text-muted-foreground")}>
      {length}/{max}
    </span>
  );
}

export function CompactHelpLabel({ label, help, counter }: { label: string; help: string; counter?: React.ReactNode }) {
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

export function VariantDenseField({
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

export function VariantFormAccordionSection({
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

export function variantCopyLengthIssues(variant: CreativeVariantDraft) {
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

export function variantBasisIssues(variant: CreativeVariantDraft, merged: ReturnType<typeof mergeVariantWithBase>) {
  const issues: string[] = [];
  if (!variant.name.trim()) issues.push("Advertentienaam ontbreekt");
  const link = merged.linkUrl.trim();
  if (!link) issues.push("Landingspagina (https) ontbreekt");
  else if (!link.startsWith("https://")) issues.push("Link moet met https:// beginnen");
  return issues;
}

export function variantCopyIssues(variant: CreativeVariantDraft, merged: ReturnType<typeof mergeVariantWithBase>) {
  const issues: string[] = [];
  if (!merged.primaryText.trim()) issues.push("Primaire tekst ontbreekt");
  if (!merged.headline.trim()) issues.push("Headline ontbreekt");
  for (const issue of variantCopyLengthIssues(variant)) {
    issues.push(`${issue.label}: ${issue.over} tekens te lang (max ${issue.max})`);
  }
  return issues;
}

export function variantAssetIssues(
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
  if (!resolvedImage.trim() && !merged.videoUrl) issues.push("Upload minstens één beeld");
  if (storyPlacementWarning && !merged.storyImageUrl.trim() && !merged.videoUrl) issues.push("Story/Reels-beeld (9:16) ontbreekt");
  return issues;
}

export function VariantCreativeForm({
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
      {variant.videoUrl && <div className="space-y-2 rounded-lg border p-3"><p className="text-sm font-medium">Creative Studio-video</p><video src={variant.videoUrl} controls preload="metadata" className="max-h-64 w-full"/><Button size="sm" variant="outline" onClick={()=>onUpdate({videoUrl:""})}>Video verwijderen</Button><p className="text-xs text-muted-foreground">De afbeeldingen hieronder dienen als poster wanneer deze video wordt gebruikt.</p></div>}
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

export function ErrorHint({ raw }: { raw?: string | null }) {
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

export const META_OPTIMIZATION_GOAL_LABELS: Record<OptimizationGoal, string> = {
  AUTO: "Auto per objective",
  LINK_CLICKS: "Link clicks",
  LANDING_PAGE_VIEWS: "Landing page views",
  LEAD_GENERATION: "Lead generation",
  OFFSITE_CONVERSIONS: "Offsite conversions",
  REACH: "Reach",
  IMPRESSIONS: "Impressions",
};

export const META_DESTINATION_LABELS: Record<DestinationType, string> = {
  AUTO: "Auto",
  WEBSITE: "Website",
  MESSENGER: "Messenger",
  WHATSAPP: "WhatsApp",
  PHONE_CALL: "Phone call",
};

export const META_BID_STRATEGY_LABELS: Record<BidStrategy, string> = {
  LOWEST_COST_WITHOUT_CAP: "Lowest cost without cap",
  LOWEST_COST_WITH_BID_CAP: "Lowest cost with bid cap",
  COST_CAP: "Cost cap",
};

export function metaDeliveryPreview(params: {
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

export const META_OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_TRAFFIC: "Traffic",
  OUTCOME_LEADS: "Leads",
  OUTCOME_SALES: "Sales",
  OUTCOME_ENGAGEMENT: "Engagement",
  OUTCOME_AWARENESS: "Awareness",
  LINK_CLICKS: "Link clicks",
  LEAD_GENERATION: "Lead generation",
};

export function metaAdvertentiesPreview(params: {
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

export function previewPublisherName(slot: AssetSlot, facebookPublisherName: string, instagramPublisherName: string) {
  return slot === "feed" ? facebookPublisherName : instagramPublisherName;
}

export const BUILDER_SECTION_ACCENTS = {
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

export function BuilderSection({
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

export const META_BUILDER_CHECKLIST_STEPS = [
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

export type MetaChecklistFocus = (typeof META_BUILDER_CHECKLIST_STEPS)[number]["id"];

export function MetaBuilderChecklist(props: {
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

export function MetaAiBriefingFields({
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

export type MetaAiBriefingInput = {
  product: string;
  audience: string;
  tone: AiTone;
};

export function MetaAiCampaignBriefingDialog({
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

export function MetaGeoEntryBadge({
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

export function MetaLocationEditor({
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

export function CollapsibleCard({
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

export function StepButton({
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

export function BuilderStepper({
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

export function TogglePill({ active, label, hint, onClick }: { active: boolean; label: string; hint?: string; onClick: () => void }) {
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

export function CheckRow({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
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

export const VARIANT_ASSET_SLOT_META: Record<
  "feed" | "square" | "story",
  { label: string; ratioHint: string; thumbClass: string }
> = {
  feed: { label: "Feed", ratioHint: "1:1 · 1.91:1", thumbClass: "h-[4.5rem] w-[7.25rem]" },
  square: { label: "Vierkant", ratioHint: "1:1", thumbClass: "h-[4.5rem] w-[4.5rem]" },
  story: { label: "Story / Reels", ratioHint: "9:16", thumbClass: "h-[4.75rem] w-[2.65rem]" },
};

export const VARIANT_ASSET_COMPACT_THUMB: Record<"feed" | "square" | "story", string> = {
  feed: "h-11 w-[4.25rem]",
  square: "h-11 w-11",
  story: "h-11 w-[1.85rem]",
};

export function VariantAssetField(props: {
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

export function StoryReelsPhonePreview(props: {
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

export function MetaPreview(props: {
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
    const currentImages = { feedImageUrl: props.feedImageUrl, squareImageUrl: props.squareImageUrl, storyImageUrl: props.storyImageUrl };
    if (props.publishAsset && resolvePublishImage(props.publishAsset, currentImages).trim()) {
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

export function ApprovalQueue(props: {
  rows: any[];
  selectedPlanId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onSubmit: (id: string) => void;
  onApprove: (id: string) => void;
  onPush: (id: string) => void;
  onRetry: (id: string) => void;
  onReconcile?: (id: string) => void;
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
            {row.status === "FAILED" && row.lastError?.startsWith("EXTERNAL_WRITE_UNCERTAIN") && props.onReconcile ? (
              <Button size="sm" variant="outline" onClick={() => props.onReconcile?.(row.id)}>
                <RefreshCcw className="mr-2 h-3 w-3" />
                Controleer Meta
              </Button>
            ) : null}
            {row.status === "FAILED" && !row.lastError?.startsWith("EXTERNAL_WRITE_UNCERTAIN") ? (
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

export function MetaOAuthScopesAlert({ scopes }: { scopes: string[] }) {
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
