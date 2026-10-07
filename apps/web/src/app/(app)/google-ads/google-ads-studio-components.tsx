"use client";

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea, Tooltip, TooltipContent, TooltipTrigger, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@digitify/ui";
import { AlertTriangle, BarChart3, CheckCircle2, ChevronDown, ChevronRight, Eye, FileText, HelpCircle, Megaphone, Image as ImageIcon, Loader2, Lock, MapPin, PauseCircle, Plus, Search, Settings2, ShieldCheck, Smartphone, Sparkles, Upload, Wand2, XCircle, Monitor, Play } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const AdsWorkflowPanel = dynamic(() => import("@/components/ads/ads-workflow-panel"));

export type PlanStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "PUSHING" | "PUSHED_PAUSED" | "FAILED" | "CANCELLED";

export type CampaignType = "SEARCH" | "PERFORMANCE_MAX";

export type BuilderStep = "setup" | "creative" | "targeting" | "review";

export type MatchType = "BROAD" | "PHRASE" | "EXACT";

export type BiddingStrategy = "MAXIMIZE_CONVERSIONS" | "MAXIMIZE_CONVERSION_VALUE" | "MANUAL_CPC";

export const GOOGLE_ADS_NAV_TABS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: "workflow", label: "Editor & AI", icon: Sparkles },
  { value: "campaigns", label: "Campagnes", icon: Megaphone },
  { value: "dashboard", label: "Campagne-wizard", icon: Wand2 },
  { value: "queue", label: "Goedkeuring", icon: ShieldCheck },
  { value: "drafts", label: "Drafts", icon: FileText },
  { value: "insights", label: "Prestaties", icon: BarChart3 },
  { value: "settings", label: "Instellingen", icon: Settings2 },
];

export const CURRENCY_OPTIONS = [
  { value: "EUR", label: "Euro", symbol: "€" },
  { value: "USD", label: "US dollar", symbol: "$" },
  { value: "GBP", label: "Britse pond", symbol: "£" },
  { value: "CHF", label: "Zwitserse frank", symbol: "CHF" },
] as const;

export type ErrorExplanation = {
  label: string;
  code?: string;
  message: string;
  actions: string[];
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

export type PmaxImageKind = "landscape" | "square" | "portrait" | "logo" | "landscapeLogo";

export type GooglePmaxImageSpec = {
  kind: PmaxImageKind;
  title: string;
  shortTitle: string;
  help: string;
  googleAssetField: string;
  aspectLabel: string;
  aspectTarget: number;
  aspectTolerance: number;
  recommended: { width: number; height: number };
  minimum: { width: number; height: number };
  required: boolean;
  maxPerAssetGroup: number;
  pushedOnSubmit: boolean;
};

export const PMAX_REQUIRED_IMAGE_KINDS: PmaxImageKind[] = ["landscape", "square", "logo"];

export const PMAX_OPTIONAL_IMAGE_KINDS: PmaxImageKind[] = ["portrait", "landscapeLogo"];

export const GOOGLE_PMAX_IMAGE_SPECS: Record<PmaxImageKind, GooglePmaxImageSpec> = {
  landscape: {
    kind: "landscape",
    title: "Landscape (1.91:1)",
    shortTitle: "Landscape",
    help: "MARKETING_IMAGE — verplicht hoofdbeeld voor brede placements (Display, Discover, Search image extensions).",
    googleAssetField: "MARKETING_IMAGE",
    aspectLabel: "1.91:1 (landscape)",
    aspectTarget: 1.91,
    aspectTolerance: 0.14,
    recommended: { width: 1200, height: 628 },
    minimum: { width: 600, height: 314 },
    required: true,
    maxPerAssetGroup: 20,
    pushedOnSubmit: true,
  },
  square: {
    kind: "square",
    title: "Square (1:1)",
    shortTitle: "Square",
    help: "SQUARE_MARKETING_IMAGE — verplicht vierkant marketingbeeld voor vrijwel alle PMax-placements.",
    googleAssetField: "SQUARE_MARKETING_IMAGE",
    aspectLabel: "1:1 (vierkant)",
    aspectTarget: 1,
    aspectTolerance: 0.08,
    recommended: { width: 1200, height: 1200 },
    minimum: { width: 300, height: 300 },
    required: true,
    maxPerAssetGroup: 20,
    pushedOnSubmit: true,
  },
  portrait: {
    kind: "portrait",
    title: "Portrait (4:5)",
    shortTitle: "Portrait",
    help: "PORTRAIT_MARKETING_IMAGE — optioneel; Google raadt 2+ portrait-beelden aan voor mobiel/Discover.",
    googleAssetField: "PORTRAIT_MARKETING_IMAGE",
    aspectLabel: "4:5 (portrait)",
    aspectTarget: 4 / 5,
    aspectTolerance: 0.08,
    recommended: { width: 960, height: 1200 },
    minimum: { width: 480, height: 600 },
    required: false,
    maxPerAssetGroup: 20,
    pushedOnSubmit: true,
  },
  logo: {
    kind: "logo",
    title: "Logo (1:1)",
    shortTitle: "Logo vierkant",
    help: "LOGO — verplicht vierkant merklogo (max. 5 per asset group). Vermijd wit logo op transparant.",
    googleAssetField: "LOGO",
    aspectLabel: "1:1 (logo)",
    aspectTarget: 1,
    aspectTolerance: 0.08,
    recommended: { width: 1200, height: 1200 },
    minimum: { width: 128, height: 128 },
    required: true,
    maxPerAssetGroup: 5,
    pushedOnSubmit: true,
  },
  landscapeLogo: {
    kind: "landscapeLogo",
    title: "Landscape logo (4:1)",
    shortTitle: "Logo breed",
    help: "LANDSCAPE_LOGO — optioneel breed merklogo; nuttig naast het vierkante logo op brede placements.",
    googleAssetField: "LANDSCAPE_LOGO",
    aspectLabel: "4:1 (landscape logo)",
    aspectTarget: 4,
    aspectTolerance: 0.12,
    recommended: { width: 1200, height: 300 },
    minimum: { width: 512, height: 128 },
    required: false,
    maxPerAssetGroup: 5,
    pushedOnSubmit: true,
  },
};

export const GOOGLE_PMAX_IMAGE_FILE_RULES =
  "JPG, PNG of GIF · max. 5 MB (5120 KB) · belangrijkste inhoud in het middelste 80% van het beeld";

export const GOOGLE_PMAX_TEXT_REQUIREMENTS = [
  { id: "headlines", label: "Headlines", rule: "min. 3, max. 15 · max. 30 tekens", min: 3 },
  { id: "longHeadlines", label: "Long headlines", rule: "min. 1, max. 5 · max. 90 tekens", min: 1 },
  { id: "descriptions", label: "Descriptions", rule: "min. 2, max. 5 · max. 90 tekens", min: 2 },
  { id: "businessName", label: "Bedrijfsnaam", rule: "verplicht · max. 25 tekens", min: 1 },
] as const;

export function formatPx(size: { width: number; height: number }) {
  return `${size.width} × ${size.height} px`;
}

export const BUILDER_STEP_ORDER: BuilderStep[] = ["setup", "creative", "targeting", "review"];

export const STEPS: Array<{ id: BuilderStep; label: string; description: string; googleHint: string }> = [
  { id: "setup", label: "Campagne", description: "Budget, planning en bieden", googleHint: "Campagne-instellingen" },
  { id: "creative", label: "Advertenties", description: "RSA of asset group", googleHint: "Advertenties & assets" },
  { id: "targeting", label: "Doelgroep", description: "Locatie, taal en keywords", googleHint: "Doelgroep & netwerken" },
  { id: "review", label: "Controleren", description: "Samenvatting en approval", googleHint: "Controleren & publiceren" },
];

export const BIDDING_OPTIONS: Array<{ value: BiddingStrategy; label: string; hint: string }> = [
  { value: "MAXIMIZE_CONVERSIONS", label: "Conversies maximaliseren", hint: "Standaard voor leadgeneratie. Optioneel target-CPA." },
  { value: "MAXIMIZE_CONVERSION_VALUE", label: "Conversiewaarde maximaliseren", hint: "Voor ecommerce of value-based bidding met target-ROAS." },
  { value: "MANUAL_CPC", label: "Handmatige CPC", hint: "Alleen Search. Jij bepaalt max. CPC per keyword." },
];

export const CTA_OPTIONS = [
  "Meer informatie",
  "Offerte aanvragen",
  "Demo boeken",
  "Aanmelden",
  "Contacteer ons",
  "Ontdek meer",
] as const;

export const AI_TONES = [
  { value: "professioneel", label: "Professioneel" },
  { value: "resultaatgericht", label: "Resultaatgericht" },
  { value: "vriendelijk", label: "Vriendelijk" },
  { value: "premium", label: "Premium" },
] as const;

export const LOCATION_PRESETS = [
  { value: "BE", label: "België", description: "Heel België · Nederlands", geo: "geoTargetConstants/2056", languages: "languageConstants/1010" },
  { value: "NL", label: "Nederland", description: "Heel Nederland · Nederlands", geo: "geoTargetConstants/2528", languages: "languageConstants/1010" },
  { value: "BE_NL", label: "België + Nederland", description: "Beide landen · Nederlands", geo: "geoTargetConstants/2056\ngeoTargetConstants/2528", languages: "languageConstants/1010" },
] as const;

export const GEO_TARGET_OPTIONS = [
  { id: "geoTargetConstants/2056", label: "België", group: "Landen" },
  { id: "geoTargetConstants/2528", label: "Nederland", group: "Landen" },
  { id: "geoTargetConstants/2242", label: "Luxemburg", group: "Landen" },
  { id: "geoTargetConstants/1009886", label: "Brussel", group: "Steden & regio's" },
] as const;

export const GEO_COUNTRY_LABELS: Record<string, string> = {
  BE: "België",
  NL: "Nederland",
  LU: "Luxemburg",
};

export const MATCH_TYPE_OPTIONS: Array<{ value: MatchType; label: string; hint: string }> = [
  { value: "PHRASE", label: "Phrase match", hint: "Zoekterm + gerelateerde woorden" },
  { value: "EXACT", label: "Exact match", hint: "Alleen deze precieze zoekopdracht" },
  { value: "BROAD", label: "Broad match", hint: "Ruim bereik — gebruik voorzichtig" },
];

export const NEGATIVE_KEYWORD_PRESETS = [
  "gratis",
  "vacature",
  "werkstudent",
  "opleiding",
  "fraude",
  "adres",
  "telefoonnummer",
  "jobs",
] as const;

export const LANGUAGE_OPTIONS = [
  { id: "languageConstants/1010", label: "Nederlands", hint: "Standaard voor België en Nederland" },
  { id: "languageConstants/1002", label: "Frans", hint: "België (Wallonië & Brussel)" },
  { id: "languageConstants/1000", label: "Engels", hint: "Internationaal publiek" },
  { id: "languageConstants/1001", label: "Duits", hint: "Duitstalige doelgroep" },
] as const;

export function normalizeGeoId(geoId: string) {
  const trimmed = geoId.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("geoTargetConstants/") ? trimmed : `geoTargetConstants/${trimmed.replace(/^\/+/, "")}`;
}

export function resolveGeoLabel(geoId: string) {
  const normalized = normalizeGeoId(geoId);
  return GEO_TARGET_OPTIONS.find((item) => item.id === normalized)?.label ?? normalized.replace("geoTargetConstants/", "Geo ");
}

export function resolveLanguageLabel(languageId: string) {
  const normalized = languageId.startsWith("languageConstants/") ? languageId : `languageConstants/${languageId}`;
  if (normalized === "languageConstants/1013") return "Nederlands";
  return LANGUAGE_OPTIONS.find((item) => item.id === normalized)?.label ?? languageId.replace("languageConstants/", "Taal ");
}

export function detectLocationPreset(geoText: string, languageText: string) {
  const match = LOCATION_PRESETS.find((item) => item.geo === geoText && item.languages === languageText);
  return match?.value ?? "CUSTOM";
}

export function googleCampaignTypeFromChannel(channelType: unknown): CampaignType {
  const normalized = String(channelType || "").toUpperCase();
  return normalized.includes("PERFORMANCE_MAX") ? "PERFORMANCE_MAX" : "SEARCH";
}

export function eur(cents?: number | null, currency = "EUR") {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency }).format(Number(cents || 0) / 100);
}

export function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function budgetCentsOrNull(value: string) {
  const cents = numberValue(value);
  return cents >= 100 ? cents : null;
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

export function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

export function linesToList(value: string, max = 15) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

export function csvToList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function listToLines(value: unknown, fallback: string[]) {
  return (Array.isArray(value) && value.length ? value : fallback).map((item) => String(item)).join("\n");
}

export function parseJson(value: string, label: string) {
  if (!value.trim()) return {};
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} bevat geen geldige JSON.`);
  }
}

export function explainGoogleError(raw?: string | null): ErrorExplanation | null {
  if (!raw) return null;
  const message = raw.replace(/\s+/g, " ").trim();
  const lower = message.toLowerCase();
  const code = message.match(/([A-Z_]+_ERROR:\s*[A-Z_]+)/)?.[1] || message.match(/error_code[^A-Z]+([A-Z_]+)/i)?.[1];

  if (lower.includes("developer_token") || lower.includes("developer token")) {
    return {
      label: "Google Ads API-toegang controleren",
      code,
      message,
      actions: ["Open Google Cloud Console → Google Ads API → API access.", "Controleer of het Cloud-project achter je OAuth-client toegang heeft tot productieaccounts."],
    };
  }
  if (lower.includes("refresh_token") || lower.includes("invalid_grant") || lower.includes("oauth") || lower.includes("permission") || lower.includes("authorization")) {
    return {
      label: "Google OAuth toegang ontbreekt",
      code,
      message,
      actions: ["Koppel Google Ads opnieuw via Integraties met de adwords scope.", "Controleer of de Google gebruiker toegang heeft tot het geselecteerde customer account.", "Als er een manager account nodig is: zet login customer ID correct in de instellingen/env."],
    };
  }
  if (lower.includes("asset_group") || lower.includes("asset group") || lower.includes("marketing_image") || lower.includes("square_marketing_image")) {
    return {
      label: "Performance Max assets zijn niet compleet",
      code,
      message,
      actions: ["Voor PMax heb je minstens 3 headlines, 1 long headline, 2 beschrijvingen, 1 landscape image en 1 square image nodig.", "Gebruik publieke JPG/PNG/GIF URLs en controleer aspect ratio's.", "Als brand guidelines actief zijn, moeten business name en logo als campaign assets gekoppeld worden."],
    };
  }
  if (lower.includes("field_error") || lower.includes("required") || lower.includes("missing") || lower.includes("field:") || lower.includes("veld:")) {
    return {
      label: "Advertentie mist verplichte velden",
      code,
      message,
      actions: ["Gebruik minstens 3 headlines en 2 beschrijvingen voor Search.", "Vul een geldige final URL in die met https:// begint.", "Controleer het veldpad in de foutmelding voor de exacte locatie."],
    };
  }
  if (lower.includes("policy") || lower.includes("disapproved")) {
    return {
      label: "Google Ads policy blokkade",
      code,
      message,
      actions: ["Pas claims, hoofdletters, verboden woorden of landingspagina-inhoud aan.", "Open Google Ads Policy Manager voor de volledige policy finding."],
    };
  }
  if (lower.includes("budget guard") || lower.includes("budget")) {
    return {
      label: "Budget wordt geblokkeerd",
      code,
      message,
      actions: ["Verlaag het dagbudget of verhoog de workspace budgetlimiet in Integraties.", "Minimum is 100 cent."],
    };
  }
  if (lower.includes("customer") || lower.includes("resource_not_found") || lower.includes("not found")) {
    return {
      label: "Google Ads customer is niet bereikbaar",
      code,
      message,
      actions: ["Selecteer opnieuw een customer in Google Ads instellingen.", "Controleer of het account niet verwijderd of ontoegankelijk is."],
    };
  }
  return {
    label: "Google Ads API fout",
    code,
    message,
    actions: ["Controleer customer, OAuth, developer token en billing status.", "Als de fout een veldpad bevat, pas dat veld in de builder of advanced JSON aan."],
  };
}

export function ErrorHint({ raw }: { raw?: string | null }) {
  const explanation = explainGoogleError(raw);
  if (!explanation) return null;
  return (
    <div className="mt-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive">
      <div className="flex flex-wrap items-center gap-2 font-semibold">
        <AlertTriangle className="h-3.5 w-3.5" />
        {explanation.label}
        {explanation.code ? <span className="rounded-full bg-background px-2 py-0.5 font-mono">{explanation.code}</span> : null}
      </div>
      <p className="mt-1 text-destructive/90">{explanation.message}</p>
      <div className="mt-2 space-y-1 text-destructive/80">{explanation.actions.map((action) => <p key={action}>- {action}</p>)}</div>
    </div>
  );
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

export function evaluatePmaxImage(probe: ImageProbeState, spec: GooglePmaxImageSpec) {
  if (probe.status !== "ready" || !probe.width || !probe.height) {
    return { ratioOk: false, meetsMinimum: false, meetsRecommended: false, message: null as string | null };
  }
  const ratioOk = roughlyMatches(aspectRatio(probe), spec.aspectTarget, spec.aspectTolerance);
  const meetsMinimum = probe.width >= spec.minimum.width && probe.height >= spec.minimum.height;
  const meetsRecommended = probe.width >= spec.recommended.width && probe.height >= spec.recommended.height;
  let message: string | null = null;
  if (!ratioOk && !meetsMinimum) {
    message = `Verwacht ${spec.aspectLabel} en minimaal ${formatPx(spec.minimum)}.`;
  } else if (!ratioOk) {
    message = `Verhouding wijkt af van ${spec.aspectLabel} — Google kan dit afkeuren.`;
  } else if (!meetsMinimum) {
    message = `Onder Google-minimum (${formatPx(spec.minimum)}). Upload een groter bestand.`;
  } else if (!meetsRecommended) {
    message = `Voldoet aan minimum; aanbevolen is ${formatPx(spec.recommended)} voor scherpe weergave.`;
  }
  return { ratioOk, meetsMinimum, meetsRecommended, message };
}

export function googleCampaignStatusLabel(status: unknown) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "ENABLED" || normalized === "2") return "Actief";
  if (normalized === "PAUSED" || normalized === "3") return "Gepauzeerd";
  if (normalized === "REMOVED" || normalized === "4") return "Verwijderd";
  return String(status || "Onbekend");
}

export function googleCampaignIsEnabled(status: unknown) {
  const normalized = String(status || "").toUpperCase();
  return normalized === "ENABLED" || normalized === "2";
}

export function googleCampaignIsPaused(status: unknown) {
  const normalized = String(status || "").toUpperCase();
  return normalized === "PAUSED" || normalized === "3";
}

export function describeOperationalRequirement(code: string): OperationalRequirement {
  if (code === "GOOGLE_DEV_TOKEN_MISSING") {
    return {
      code,
      title: "Google Ads API-toegang controleren",
      description: "Nieuwe Google Ads API-projecten beheren hun toegang via het gekoppelde Google Cloud-project.",
      nextStep: "Open Google Cloud Console → Google Ads API → API access en controleer de toegang van het OAuth-project.",
    };
  }
  if (code === "GOOGLE_OAUTH_MISSING") {
    return {
      code,
      title: "Google OAuth ontbreekt",
      description: "Deze workspace heeft nog geen geldige Google Ads OAuth-token.",
      nextStep: "Koppel Google Ads opnieuw via Integraties met de adwords scope.",
    };
  }
  if (code === "GOOGLE_CUSTOMER_NOT_SELECTED") {
    return {
      code,
      title: "Geen customer geselecteerd",
      description: "De studio weet nog niet naar welk Google Ads account de draft moet gaan.",
      nextStep: "Ga naar Instellingen en selecteer exact één Google Ads customer voor deze workspace.",
    };
  }
  if (code === "GOOGLE_AUTOMATION_DISABLED") {
    return {
      code,
      title: "Automatische push staat uit",
      description: "De module is nog niet ingeschakeld, waardoor approved drafts niet gepusht kunnen worden.",
      nextStep: "Zet de Google Ads module aan in de instellingen van deze pagina.",
    };
  }
  return {
    code,
    title: "Operationele blokkade",
    description: "Er ontbreekt nog een vereiste configuratie voor deze workspace.",
    nextStep: "Werk de ontbrekende koppeling of instelling af en probeer opnieuw.",
  };
}

export function HelpLabel({ label, help, helpClassName }: { label: string; help: string; helpClassName?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label>{label}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="rounded-full text-muted-foreground transition hover:text-foreground" aria-label={`Uitleg voor ${label}`} onPointerDown={(event) => event.stopPropagation()}>
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className={cn("max-w-xs whitespace-pre-line text-xs leading-5", helpClassName)}>
          {help}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function WizardSection({
  title,
  description,
  icon: Icon,
  badge,
  preview,
  children,
  defaultOpen = false,
  collapsible = true,
}: {
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  badge?: ReactNode;
  preview?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const header = (
    <>
      {Icon ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-border/60">
          <Icon className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
        </div>
      ) : null}
      <div className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {badge}
        </div>
        {open && description ? <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p> : null}
        {!open && preview ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{preview}</p> : null}
        {!open && !preview && description ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p> : null}
      </div>
    </>
  );

  if (!collapsible) {
    return (
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/50">
        <div className="flex items-start gap-3 border-b border-border/50 bg-muted/30 px-4 py-3">{header}</div>
        <div className="space-y-4 p-4">{children}</div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/50">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full items-start gap-3 bg-muted/30 px-4 py-3 text-left transition hover:bg-muted/40",
          open && "border-b border-border/50",
        )}
      >
        {header}
        <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
      </button>
      {open ? <div className="space-y-4 p-4">{children}</div> : null}
    </section>
  );
}

export function AssetTextHint({ lines, maxChars, label }: { lines: string[]; maxChars: number; label: string }) {
  const tooLong = lines.filter((line) => line.length > maxChars).length;
  return (
    <p className={`text-xs ${tooLong ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
      {lines.length} {label} · max. {maxChars} tekens per regel
      {tooLong ? ` · ${tooLong} regel(s) te lang voor Google` : ""}
    </p>
  );
}

export function CopyAssetListEditor({
  label,
  help,
  value,
  onChange,
  minItems,
  maxItems,
  maxChars,
  itemLabel,
  placeholders = [],
  defaultOpen = false,
  collapsible = true,
  toolbarActions,
}: {
  label: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
  minItems: number;
  maxItems: number;
  maxChars: number;
  itemLabel: string;
  placeholders?: string[];
  defaultOpen?: boolean;
  collapsible?: boolean;
  toolbarActions?: ReactNode;
}) {
  const lines = useMemo(() => {
    const parts = value.split("\n");
    const count = Math.min(maxItems, Math.max(minItems, parts.length));
    return Array.from({ length: count }, (_, index) => parts[index] ?? "");
  }, [value, minItems, maxItems]);

  const filledLines = useMemo(() => lines.map((line) => line.trim()).filter(Boolean), [lines]);

  function syncLines(nextLines: string[]) {
    onChange(nextLines.join("\n"));
  }

  function updateLine(index: number, text: string) {
    const next = [...lines];
    next[index] = text;
    syncLines(next);
  }

  function removeLine(index: number) {
    if (lines.length <= minItems) return;
    syncLines(lines.filter((_, itemIndex) => itemIndex !== index));
  }

  function addLine() {
    if (lines.length >= maxItems) return;
    syncLines([...lines, ""]);
  }

  const statusBadge = (
    <Badge
      variant={minItems === 0 || filledLines.length >= minItems ? "success" : "warning"}
      className="text-[10px] font-normal"
    >
      {minItems === 0
        ? `${filledLines.length} ingevuld · max ${maxItems}`
        : `${filledLines.length}/${minItems} min · max ${maxItems}`}
    </Badge>
  );

  const editorFields = (
    <>
      <div className="space-y-1 rounded-lg border border-border/60 bg-background/70 p-2">
        {lines.map((line, index) => {
          const overLimit = line.length > maxChars;
          return (
            <div key={`${itemLabel}-${index}`} className="flex items-center gap-1.5">
              <span className="w-4 shrink-0 text-center text-[10px] font-semibold tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <div className="relative min-w-0 flex-1">
                <Input
                  value={line}
                  onChange={(event) => updateLine(index, event.target.value)}
                  placeholder={placeholders[index] || `${itemLabel} ${index + 1}`}
                  className={cn(
                    "h-7 bg-background/90 pr-11 text-xs",
                    overLimit && "border-amber-500 focus-visible:ring-amber-500/40",
                  )}
                />
                <span
                  className={cn(
                    "pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] tabular-nums",
                    overLimit ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground",
                  )}
                >
                  {line.length}/{maxChars}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                disabled={lines.length <= minItems}
                onClick={() => removeLine(index)}
                aria-label={`${itemLabel} ${index + 1} verwijderen`}
              >
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
        {lines.length < maxItems || toolbarActions ? (
          <div className={cn("mt-0.5 flex flex-col gap-1.5", toolbarActions && "sm:flex-row")}>
            {lines.length < maxItems ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn("h-7 border-dashed bg-background/70 text-xs", toolbarActions ? "sm:flex-1" : "w-full")}
                onClick={addLine}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {itemLabel} toevoegen
              </Button>
            ) : null}
            {toolbarActions}
          </div>
        ) : null}
      </div>
      {filledLines.some((line) => line.length > maxChars) ? (
        <AssetTextHint lines={filledLines} maxChars={maxChars} label={itemLabel.toLowerCase()} />
      ) : null}
    </>
  );

  if (!collapsible) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <HelpLabel label={label} help={help} />
          {statusBadge}
        </div>
        {editorFields}
      </div>
    );
  }

  return (
    <details className="group overflow-hidden rounded-xl border border-border/60 bg-muted/10 open:bg-muted/15" {...(defaultOpen ? { open: true } : {})}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <HelpLabel label={label} help={help} />
            {statusBadge}
          </div>
          <p className="truncate text-[11px] text-muted-foreground group-open:hidden">
            {filledLines[0] || `Minimaal ${minItems} ${itemLabel.toLowerCase()}${minItems === 1 ? "" : "s"} vereist`}
          </p>
        </div>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="space-y-1.5 border-t border-border/50 px-2.5 pb-2 pt-2">{editorFields}</div>
    </details>
  );
}

export const AUDIENCE_SIGNAL_PRESETS = [
  "KMO eigenaar",
  "Marketing manager",
  "Zaakvoerder",
  "Leadgeneratie tools",
  "Digitale marketing",
  "Webdesign diensten",
] as const;

export function AudienceSignalsEditor({
  value,
  onChange,
  onAiSuggest,
  aiPending = false,
  aiDisabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onAiSuggest?: () => void;
  aiPending?: boolean;
  aiDisabled?: boolean;
}) {
  const signals = useMemo(() => linesToList(value, 25), [value]);

  function addPreset(preset: string) {
    const current = linesToList(value, 25);
    if (current.includes(preset) || current.length >= 25) return;
    onChange([...current, preset].join("\n"));
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-3">
        <p className="text-xs font-medium text-muted-foreground">Snel toevoegen</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {AUDIENCE_SIGNAL_PRESETS.map((preset) => {
            const added = signals.includes(preset);
            return (
              <button
                key={preset}
                type="button"
                disabled={added || signals.length >= 25}
                onClick={() => addPreset(preset)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition disabled:cursor-default disabled:opacity-70",
                  added
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-border/70 bg-background hover:border-border hover:bg-muted/40",
                )}
              >
                {added ? "✓ " : "+ "}
                {preset}
              </button>
            );
          })}
        </div>
      </div>
      <CopyAssetListEditor
        label="Signalen / thema's"
        help="Functies, interesses of marktsegmenten waar Google op mag sturen. Minimaal 1 signaal — meer variatie helpt Google je doelgroep te begrijpen."
        value={value}
        onChange={onChange}
        minItems={1}
        maxItems={25}
        maxChars={80}
        itemLabel="Signaal"
        collapsible={false}
        placeholders={[
          "KMO eigenaar",
          "Marketing manager",
          "Zaakvoerder",
          "Leadgeneratie tools",
        ]}
        toolbarActions={
          onAiSuggest ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 border-dashed bg-emerald-50/80 text-xs text-emerald-900 hover:bg-emerald-100/80 dark:bg-emerald-950/30 dark:text-emerald-100 dark:hover:bg-emerald-950/50 sm:min-w-[9.5rem]"
              disabled={aiPending || aiDisabled}
              title={aiDisabled ? undefined : "Open AI-briefing"}
              onClick={onAiSuggest}
            >
              {aiPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
              AI-signalen
            </Button>
          ) : null
        }
      />
      <p className="text-xs leading-5 text-muted-foreground">
        Opgeslagen in de draft. Volledige audience lists in Google Ads koppel je later in het account.
      </p>
    </div>
  );
}

export function SearchKeywordsEditor({
  adGroupName,
  onAdGroupNameChange,
  matchType,
  onMatchTypeChange,
  keywordsText,
  onKeywordsChange,
  negativeKeywordsText,
  onNegativeKeywordsChange,
  onAiSuggest,
  aiPending = false,
  aiDisabled = false,
}: {
  adGroupName: string;
  onAdGroupNameChange: (value: string) => void;
  matchType: MatchType;
  onMatchTypeChange: (value: MatchType) => void;
  keywordsText: string;
  onKeywordsChange: (value: string) => void;
  negativeKeywordsText: string;
  onNegativeKeywordsChange: (value: string) => void;
  onAiSuggest?: () => void;
  aiPending?: boolean;
  aiDisabled?: boolean;
}) {
  const negatives = useMemo(() => linesToList(negativeKeywordsText, 80), [negativeKeywordsText]);

  function addNegativePreset(term: string) {
    const current = linesToList(negativeKeywordsText, 80);
    if (current.includes(term) || current.length >= 80) return;
    onNegativeKeywordsChange([...current, term].join("\n"));
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <HelpLabel label="Naam advertentiegroep" help="Interne structuur in Google Ads onder je campagne." />
          <Input value={adGroupName} onChange={(event) => onAdGroupNameChange(event.target.value)} placeholder="Bijv. Leadgeneratie KMO België" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <HelpLabel label="Matchtype (standaard)" help="Geldt voor alle zoekwoorden in deze draft." />
          <div className="grid gap-2 sm:grid-cols-3">
            {MATCH_TYPE_OPTIONS.map((option) => {
              const active = matchType === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onMatchTypeChange(option.value)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition",
                    active
                      ? "border-emerald-600 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-600/25"
                      : "border-border/70 bg-background/80 hover:border-emerald-500/35 hover:bg-muted/20",
                  )}
                >
                  <p className="text-sm font-semibold">{option.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{option.hint}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <CopyAssetListEditor
        label="Zoekwoorden"
        help="Koopintentie in het Nederlands (België). Minimaal 1 keyword vereist voor Search."
        value={keywordsText}
        onChange={onKeywordsChange}
        minItems={1}
        maxItems={80}
        maxChars={80}
        itemLabel="Keyword"
        collapsible={false}
        placeholders={["Keyword 1", "Keyword 2", "Keyword 3"]}
        toolbarActions={
          onAiSuggest ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 border-dashed bg-emerald-50/80 text-xs text-emerald-900 hover:bg-emerald-100/80 dark:bg-emerald-950/30 dark:text-emerald-100 dark:hover:bg-emerald-950/50 sm:min-w-[9.5rem]"
              disabled={aiPending || aiDisabled}
              title={aiDisabled ? undefined : "Open AI-briefing"}
              onClick={onAiSuggest}
            >
              {aiPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
              AI-keywords
            </Button>
          ) : null
        }
      />

      <div className="space-y-3 rounded-xl border border-dashed border-border/70 bg-muted/10 p-3">
        <div>
          <p className="text-sm font-medium">Uitsluitende zoekwoorden</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Voorkom ongewenste clicks (gratis, vacatures, …).</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {NEGATIVE_KEYWORD_PRESETS.map((preset) => {
            const added = negatives.includes(preset);
            return (
              <button
                key={preset}
                type="button"
                disabled={added || negatives.length >= 80}
                onClick={() => addNegativePreset(preset)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition disabled:cursor-default disabled:opacity-70",
                  added
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-border/70 bg-background hover:bg-muted/40",
                )}
              >
                {added ? "✓ " : "+ "}
                {preset}
              </button>
            );
          })}
        </div>
        <CopyAssetListEditor
          label="Uitsluitingen"
          help="Optioneel. Één term per regel — Google sluit deze zoekopdrachten uit."
          value={negativeKeywordsText}
          onChange={onNegativeKeywordsChange}
          minItems={0}
          maxItems={80}
          maxChars={80}
          itemLabel="Uitsluiting"
          collapsible={false}
          placeholders={["Uitsluiting 1", "Uitsluiting 2"]}
        />
      </div>
    </div>
  );
}

export function BeneluxGeoSearch({
  enabled,
  selectedGeoIds,
  onSelect,
}: {
  enabled: boolean;
  selectedGeoIds: string[];
  onSelect: (item: { id: string; label: string }) => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 320);
    return () => window.clearTimeout(timer);
  }, [query]);

  const search = trpc.googleAds.searchGeoLocations.useQuery(
    { query: debouncedQuery },
    { enabled: enabled && debouncedQuery.length >= 2, retry: false },
  );

  const results = useMemo(
    () => (search.data || []).filter((item) => !selectedGeoIds.includes(normalizeGeoId(item.id))),
    [search.data, selectedGeoIds],
  );

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          disabled={!enabled}
          placeholder={enabled ? "Zoek stad of regio in Benelux…" : "Koppel Google Ads om te zoeken"}
          className="bg-background/90 pl-8"
        />
        {search.isFetching ? (
          <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      {open && enabled && debouncedQuery.length >= 2 ? (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {search.error ? (
            <p className="p-3 text-xs text-amber-800 dark:text-amber-200">{search.error.message}</p>
          ) : null}
          {!search.isFetching && !search.error && results.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">Geen locaties gevonden voor &quot;{debouncedQuery}&quot;.</p>
          ) : null}
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full flex-col gap-0.5 border-b border-border/40 px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/60"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect({ id: item.id, label: item.canonicalName || item.label });
                setQuery("");
                setOpen(false);
              }}
            >
              <span className="font-medium">{item.label}</span>
              <span className="text-xs text-muted-foreground">
                {item.canonicalName}
                {item.countryCode ? ` · ${GEO_COUNTRY_LABELS[item.countryCode] || item.countryCode}` : ""}
                {item.targetType ? ` · ${item.targetType}` : ""}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {enabled && query.length > 0 && query.length < 2 ? (
        <p className="mt-1 text-xs text-muted-foreground">Typ minstens 2 tekens om te zoeken.</p>
      ) : null}
    </div>
  );
}

export function GeoLocationEditor({
  geoTargets,
  languages,
  onGeoTargetsChange,
  onLocationPresetChange,
  googleSearchEnabled = false,
}: {
  geoTargets: string;
  languages: string;
  onGeoTargetsChange: (value: string) => void;
  onLocationPresetChange: (value: string) => void;
  googleSearchEnabled?: boolean;
}) {
  const [geoLabels, setGeoLabels] = useState<Record<string, string>>({});
  const selectedGeoIds = useMemo(
    () => linesToList(geoTargets, 10).map(normalizeGeoId).filter(Boolean),
    [geoTargets],
  );
  const availableGeoOptions = GEO_TARGET_OPTIONS.filter((option) => !selectedGeoIds.includes(option.id));

  function displayGeoLabel(geoId: string) {
    const normalized = normalizeGeoId(geoId);
    return geoLabels[normalized] || resolveGeoLabel(normalized);
  }

  function markCustom(nextGeo: string) {
    onLocationPresetChange(detectLocationPreset(nextGeo, languages));
  }

  function addGeoTarget(geoId: string, label?: string) {
    const normalized = normalizeGeoId(geoId);
    if (!normalized || selectedGeoIds.includes(normalized) || selectedGeoIds.length >= 10) return;
    const nextGeo = [...selectedGeoIds, normalized].join("\n");
    onGeoTargetsChange(nextGeo);
    markCustom(nextGeo);
    if (label) {
      setGeoLabels((current) => ({ ...current, [normalized]: label }));
    }
  }

  function removeGeoTarget(geoId: string) {
    const normalized = normalizeGeoId(geoId);
    const nextGeo = selectedGeoIds.filter((item) => item !== normalized).join("\n");
    onGeoTargetsChange(nextGeo);
    markCustom(nextGeo);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <HelpLabel label="Geselecteerde locaties" help="Mensen in deze gebieden kunnen je advertentie zien. Max. 10 locaties per campagne." />
          <Badge variant={selectedGeoIds.length > 0 ? "success" : "warning"} className="text-[10px] font-normal">
            {selectedGeoIds.length}/10 locaties
          </Badge>
        </div>
        {selectedGeoIds.length ? (
          <div className="flex flex-wrap gap-2">
            {selectedGeoIds.map((geoId) => (
              <Badge key={geoId} variant="secondary" className="gap-1.5 py-1 pl-2 pr-1 text-xs font-normal">
                <MapPin className="h-3 w-3 shrink-0 opacity-70" />
                {displayGeoLabel(geoId)}
                <button
                  type="button"
                  className="rounded-full p-0.5 text-muted-foreground transition hover:bg-background hover:text-foreground"
                  onClick={() => removeGeoTarget(geoId)}
                  aria-label={`${displayGeoLabel(geoId)} verwijderen`}
                >
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Kies minstens één locatie of zoek een stad/regio.</p>
        )}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Zoek steden en regio&apos;s in België, Nederland en Luxemburg via Google Ads.
          </p>
          <BeneluxGeoSearch
            enabled={googleSearchEnabled}
            selectedGeoIds={selectedGeoIds}
            onSelect={(item) => addGeoTarget(item.id, item.label)}
          />
          {!googleSearchEnabled ? (
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Koppel Google Ads en selecteer een customer om locaties live te zoeken.
            </p>
          ) : null}
        </div>
        {availableGeoOptions.length ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Snel toevoegen</p>
            <div className="flex flex-wrap gap-1.5">
              {availableGeoOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addGeoTarget(item.id, item.label)}
                  className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs transition hover:bg-muted/40"
                >
                  + {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <details className="rounded-xl border border-dashed border-border/70 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Geavanceerd — geo target IDs</summary>
        <div className="mt-3 space-y-2">
          <HelpLabel label="Technische locatie-IDs" help="Één geoTargetConstants/… per regel. Alleen nodig voor niche-locaties buiten de lijst." />
          <Textarea
            className="min-h-24 font-mono text-xs"
            value={geoTargets}
            onChange={(event) => {
              const normalized = event.target.value
                .split("\n")
                .map(normalizeGeoId)
                .filter(Boolean)
                .slice(0, 10)
                .join("\n");
              onGeoTargetsChange(normalized);
              markCustom(normalized);
            }}
          />
        </div>
      </details>
    </div>
  );
}

export function LanguageTargetingEditor({
  geoTargets,
  languages,
  locationPreset: _locationPreset,
  onLanguagesChange,
  onLocationPresetChange,
}: {
  geoTargets: string;
  languages: string;
  locationPreset: string;
  onLanguagesChange: (value: string) => void;
  onLocationPresetChange: (value: string) => void;
}) {
  const selectedLanguageIds = useMemo(() => linesToList(languages, 10), [languages]);
  const selectedLabels = selectedLanguageIds.map((languageId) => resolveLanguageLabel(languageId));

  function markCustom(nextLanguages: string) {
    onLocationPresetChange(detectLocationPreset(geoTargets, nextLanguages));
  }

  function isLanguageActive(languageId: string) {
    return (
      selectedLanguageIds.includes(languageId) ||
      (languageId === "languageConstants/1010" && selectedLanguageIds.includes("languageConstants/1013"))
    );
  }

  function toggleLanguage(languageId: string) {
    if (languageId === "languageConstants/1010") {
      const hasDutch = selectedLanguageIds.some(
        (id) => id === "languageConstants/1010" || id === "languageConstants/1013",
      );
      const nextLanguages = hasDutch
        ? selectedLanguageIds.filter((id) => id !== "languageConstants/1010" && id !== "languageConstants/1013")
        : [...selectedLanguageIds, "languageConstants/1010"];
      const nextLanguageText = nextLanguages.join("\n");
      onLanguagesChange(nextLanguageText);
      markCustom(nextLanguageText);
      return;
    }

    const nextLanguages = selectedLanguageIds.includes(languageId)
      ? selectedLanguageIds.filter((item) => item !== languageId)
      : [...selectedLanguageIds, languageId];
    const nextLanguageText = nextLanguages.join("\n");
    onLanguagesChange(nextLanguageText);
    markCustom(nextLanguageText);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Kies in welke talen je advertentie getoond mag worden. Google koppelt dit aan de taalinstelling van gebruikers in je
        geselecteerde locaties.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {LANGUAGE_OPTIONS.map((language) => {
          const active = isLanguageActive(language.id);
          return (
            <button
              key={language.id}
              type="button"
              onClick={() => toggleLanguage(language.id)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3 text-left transition",
                active
                  ? "border-emerald-600 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-600/25"
                  : "border-border/70 bg-background/80 hover:border-emerald-500/35 hover:bg-muted/20",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold uppercase",
                  active ? "bg-emerald-700 text-white" : "bg-muted text-muted-foreground",
                )}
              >
                {language.label.slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{language.label}</p>
                  {active ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : null}
                </div>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{language.hint}</p>
              </div>
            </button>
          );
        })}
      </div>

      {selectedLanguageIds.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
          <span className="text-xs font-medium text-emerald-900 dark:text-emerald-100">Actieve talen:</span>
          {selectedLabels.map((label) => (
            <Badge key={label} variant="secondary" className="bg-background/80 text-xs font-normal">
              {label}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-xs font-medium text-amber-800 dark:text-amber-200">
          Selecteer minstens één taal om verder te gaan.
        </p>
      )}

      <details className="rounded-xl border border-dashed border-border/70 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Geavanceerd — technische taal-IDs</summary>
        <div className="mt-3 space-y-2">
          <HelpLabel label="Taal-IDs voor Google Ads API" help="Alleen nodig als je een taal buiten de lijst wilt targeten. Één languageConstants/… per regel." />
          <Textarea
            className="min-h-24 font-mono text-xs"
            value={languages}
            onChange={(event) => {
              onLanguagesChange(event.target.value);
              markCustom(event.target.value);
            }}
          />
        </div>
      </details>
    </div>
  );
}

export function ReviewRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border bg-background/80 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium leading-snug">{value}</div>
    </div>
  );
}

export function StepButton({ step, stepIndex, activeStep, complete, locked, onClick }: { step: (typeof STEPS)[number]; stepIndex: number; activeStep: BuilderStep; complete: boolean; locked: boolean; onClick: () => void }) {
  const active = activeStep === step.id;
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onClick}
      className={`rounded-2xl border p-3 text-left transition ${active ? "border-emerald-600 bg-emerald-600 text-white shadow-sm" : complete ? "border-emerald-500/40 bg-emerald-500/10" : locked ? "cursor-not-allowed bg-muted/50 opacity-60" : "bg-card hover:bg-muted"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">
          <span className={active ? "text-white/80" : "text-muted-foreground"}>{stepIndex + 1}. </span>
          {step.label}
        </span>
        {locked ? <Lock className="h-4 w-4" /> : complete ? <CheckCircle2 className={`h-4 w-4 ${active ? "text-white" : "text-emerald-600"}`} /> : null}
      </div>
      <p className={`mt-1 text-xs ${active ? "text-white/75" : "text-muted-foreground"}`}>{step.description}</p>
    </button>
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
  preview?: ReactNode;
  children: ReactNode;
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

export type GoogleAiBriefingInput = {
  product: string;
  audience: string;
  tone: string;
};

export type GoogleAiBriefingAction = "suggestion" | "keywords" | "audience";

export const GOOGLE_AI_BRIEFING_COPY: Record<
  GoogleAiBriefingAction,
  { title: string; description: string; confirm: string }
> = {
  suggestion: {
    title: "AI campagnevoorstel",
    description:
      "Beantwoord drie korte vragen. Daarna vullen we campagnenaam, zoekwoorden of asset-teksten en gaan we door naar de volgende stap.",
    confirm: "Genereer voorstel",
  },
  keywords: {
    title: "AI zoekwoorden",
    description: "Beschrijf je aanbod en doelgroep. AI stelt zoekwoorden en uitsluitingen voor op basis van je Search-campagne.",
    confirm: "Genereer keywords",
  },
  audience: {
    title: "AI doelgroepsignalen",
    description: "Beschrijf je aanbod en doelgroep. AI stelt signalen en thema's voor je Performance Max-assetgroep.",
    confirm: "Genereer signalen",
  },
};

export function GoogleAiBriefingDialog({
  open,
  onOpenChange,
  action,
  initialBrief,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: GoogleAiBriefingAction;
  initialBrief: GoogleAiBriefingInput;
  onConfirm: (brief: GoogleAiBriefingInput) => void;
  pending: boolean;
}) {
  const [draftProduct, setDraftProduct] = useState("");
  const [draftAudience, setDraftAudience] = useState("");
  const [draftTone, setDraftTone] = useState("professioneel");
  const copy = GOOGLE_AI_BRIEFING_COPY[action];
  const productReady = draftProduct.trim().length >= 2;

  useEffect(() => {
    if (!open) return;
    setDraftProduct(initialBrief.product);
    setDraftAudience(initialBrief.audience);
    setDraftTone(initialBrief.tone);
  }, [open, initialBrief.product, initialBrief.audience, initialBrief.tone]);

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
            {copy.title}
          </DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2 sm:col-span-2">
            <HelpLabel label="Product of aanbod" help="Input voor AI — wordt niet rechtstreeks naar Google gepusht." />
            <Input
              value={draftProduct}
              onChange={(e) => setDraftProduct(e.target.value)}
              placeholder="Bijv. Leadgeneratie voor lokale KMO's"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <HelpLabel label="Tone of voice" help="Stijl van AI-gegenereerde headlines en descriptions." />
            <Select value={draftTone} onValueChange={setDraftTone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_TONES.map((tone) => (
                  <SelectItem key={tone.value} value={tone.value}>
                    {tone.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <HelpLabel label="Doelgroep" help="Wie wil je bereiken? Gebruikt door AI, niet als harde targeting." />
            <Input
              value={draftAudience}
              onChange={(e) => setDraftAudience(e.target.value)}
              placeholder="Bijv. beslissers die jouw dienst nodig hebben"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuleren
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={pending || !productReady}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GoogleAdsSetupNotice({
  tone,
  icon: Icon,
  title,
  badge,
  summary,
  headerAction,
  children,
}: {
  tone: "amber" | "emerald";
  icon: ComponentType<{ className?: string }>;
  title: string;
  badge: string;
  summary: string;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toneStyles =
    tone === "amber"
      ? {
          shell: "border-amber-200/70 dark:border-amber-900/50",
          header: "border-amber-200/50 bg-gradient-to-r from-amber-50/90 via-amber-50/40 to-transparent dark:border-amber-900/40 dark:from-amber-950/40",
          icon: "bg-amber-500",
          title: "text-amber-950 dark:text-amber-50",
          badge: "border-amber-300/60 bg-white/60 text-amber-900 dark:bg-white/5 dark:text-amber-100",
          panel: "border-amber-200/50 dark:border-amber-900/40",
        }
      : {
          shell: "border-emerald-200/70 dark:border-emerald-900/50",
          header: "border-emerald-200/50 bg-gradient-to-r from-emerald-50/90 via-emerald-50/40 to-transparent dark:border-emerald-900/40 dark:from-emerald-950/40",
          icon: "bg-emerald-600",
          title: "text-emerald-950 dark:text-emerald-50",
          badge: "border-emerald-300/60 bg-white/60 text-emerald-900 dark:bg-white/5 dark:text-emerald-100",
          panel: "border-emerald-200/50 dark:border-emerald-900/40",
        };

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card/90 shadow-sm backdrop-blur-sm", toneStyles.shell)}>
      <div className={cn("flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5", toneStyles.header)}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left sm:gap-3"
        >
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm", toneStyles.icon)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className={cn("text-sm font-semibold tracking-tight", toneStyles.title)}>{title}</p>
              <Badge variant="outline" className={cn("text-[10px] font-normal", toneStyles.badge)}>
                {badge}
              </Badge>
            </div>
            {!open ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{summary}</p> : null}
          </div>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
          />
        </button>
        {!open && headerAction ? <div className="hidden shrink-0 sm:block">{headerAction}</div> : null}
      </div>
      {open ? (
        <div className={cn("space-y-4 border-t px-4 pb-4 pt-3", toneStyles.panel)}>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{summary}</p>
          {children}
          {headerAction ? <div className="sm:hidden">{headerAction}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

export function GoogleAdsPausedPublishNotice() {
  const steps = [
    { label: "Goedkeuring", icon: ShieldCheck },
    { label: "Push als PAUSED", icon: PauseCircle },
    { label: "Live in Google Ads", icon: Play },
  ] as const;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 via-card/95 to-card shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/35 dark:via-card/95 dark:to-card">
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-400/10 blur-2xl dark:bg-emerald-500/10" />
      <div className="relative flex gap-4 p-4 sm:gap-5 sm:p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm ring-4 ring-emerald-600/10 dark:ring-emerald-500/15">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold tracking-tight text-emerald-950 dark:text-emerald-50 sm:text-[15px]">
              Publicatie als PAUSED in Google Ads
            </p>
            <Badge
              variant="outline"
              className="border-emerald-300/60 bg-white/70 text-[10px] font-medium text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-100"
            >
              Veilig pushpad
            </Badge>
          </div>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Na goedkeuring pushen we je campagne gepauzeerd. Activeren doe je bewust in Google Ads — net als bij een echte
            launch-checklist.
          </p>
          <div className="mt-3.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              return (
                <div key={step.label} className="flex items-center gap-1.5 sm:gap-2">
                  {index > 0 ? <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-emerald-700/40 sm:block dark:text-emerald-300/40" /> : null}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium sm:text-xs",
                      index === 0
                        ? "border-emerald-200/80 bg-emerald-100/70 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-100"
                        : "border-border/60 bg-background/70 text-muted-foreground",
                    )}
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600/15 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                      {index + 1}
                    </span>
                    <StepIcon className="hidden h-3 w-3 sm:block" />
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GoogleAdsHeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export function FieldCounter({ label, count, min, max }: { label: string; count: number; min: number; max: number }) {
  const ok = count >= min && count <= max;
  return <Badge variant={ok ? "success" : "warning"}>{label}: {count}/{min}-{max}</Badge>;
}

export function pmaxImageAssetOk(value: string, spec: GooglePmaxImageSpec, probe: ImageProbeState) {
  if (!value.trim()) return spec.required ? false : true;
  const check = evaluatePmaxImage(probe, spec);
  return check.ratioOk && check.meetsMinimum;
}

export function PmaxAssetChecklist(props: {
  headlines: string[];
  longHeadlines: string[];
  descriptions: string[];
  businessName: string;
  imageUrl: string;
  squareImageUrl: string;
  logoUrl: string;
  portraitImageUrl: string;
  landscapeLogoUrl: string;
  brandGuidelinesEnabled: boolean;
  probes: Record<PmaxImageKind, ImageProbeState>;
}) {
  const textItems = GOOGLE_PMAX_TEXT_REQUIREMENTS.map((item) => {
    const count =
      item.id === "headlines"
        ? props.headlines.length
        : item.id === "longHeadlines"
          ? props.longHeadlines.length
          : item.id === "descriptions"
            ? props.descriptions.length
            : props.businessName.trim().length > 0
              ? 1
              : 0;
    return { ...item, ok: count >= item.min };
  });

  const imageItems = [...PMAX_REQUIRED_IMAGE_KINDS, ...PMAX_OPTIONAL_IMAGE_KINDS].map((kind) => {
    const spec = GOOGLE_PMAX_IMAGE_SPECS[kind];
    const value =
      kind === "landscape"
        ? props.imageUrl
        : kind === "square"
          ? props.squareImageUrl
          : kind === "portrait"
            ? props.portraitImageUrl
            : kind === "logo"
              ? props.logoUrl
              : props.landscapeLogoUrl;
    const ok = pmaxImageAssetOk(value, spec, props.probes[kind]);
    return { kind, spec, ok, filled: Boolean(value.trim()) };
  });

  const requiredImagesOk = PMAX_REQUIRED_IMAGE_KINDS.every((kind) => {
    const spec = GOOGLE_PMAX_IMAGE_SPECS[kind];
    const value =
      kind === "landscape" ? props.imageUrl : kind === "square" ? props.squareImageUrl : props.logoUrl;
    return pmaxImageAssetOk(value, spec, props.probes[kind]);
  });
  const textOk = textItems.every((item) => item.ok);
  const pushReady = !props.brandGuidelinesEnabled && requiredImagesOk && textOk;

  return (
    <div className="rounded-xl border bg-muted/25 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">PMax-checklist</p>
        <Badge variant={pushReady ? "success" : "warning"}>{pushReady ? "Klaar voor push (V1)" : "Nog niet compleet"}</Badge>
      </div>
      {props.brandGuidelinesEnabled ? (
        <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
          Brand guidelines aan → push via deze app is geblokkeerd (V1). Zet uit of maak campagne handmatig in Google Ads.
        </p>
      ) : null}
      <div className="mt-3 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tekst (advertentie-stap)</p>
        <div className="flex flex-wrap gap-1.5">
          {textItems.map((item) => (
            <Badge key={item.id} variant={item.ok ? "success" : "outline"} className="text-[10px] font-normal">
              {item.label}
            </Badge>
          ))}
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Beelden</p>
        <div className="flex flex-wrap gap-1.5">
          {imageItems.map((item) => (
            <Badge
              key={item.kind}
              variant={item.spec.required ? (item.ok ? "success" : "warning") : item.filled ? (item.ok ? "success" : "warning") : "outline"}
              className="text-[10px] font-normal"
            >
              {item.spec.shortTitle}
              {item.spec.required ? "" : item.filled ? "" : " (leeg OK)"}
            </Badge>
          ))}
        </div>
      </div>
      <details className="mt-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground/80">Wat ontbreekt nog voor Google?</summary>
        <ul className="mt-2 list-inside list-disc space-y-1">
          {textItems.filter((item) => !item.ok).map((item) => (
            <li key={item.id}>
              {item.label}: {item.rule}
            </li>
          ))}
          {imageItems
            .filter((item) => item.spec.required && !item.ok)
            .map((item) => (
              <li key={item.kind}>
                {item.spec.title}: {formatPx(item.spec.recommended)} (min. {formatPx(item.spec.minimum)}, {item.spec.aspectLabel})
              </li>
            ))}
          {imageItems
            .filter((item) => !item.spec.required && item.filled && !item.ok)
            .map((item) => (
              <li key={item.kind}>
                {item.spec.title}: afmetingen/verhouding kloppen niet — {formatPx(item.spec.recommended)}
              </li>
            ))}
          {pushReady ? <li>Alle verplichte V1-assets staan klaar.</li> : null}
          <li className="list-none text-[11px]">
            Niet in V1-push: brand guidelines, final URL expansion. Optionele beelden worden alleen gepusht als de URL is ingevuld.
          </li>
        </ul>
      </details>
    </div>
  );
}

export function PmaxAssetUploadRow(props: {
  spec: GooglePmaxImageSpec;
  value: string;
  uploading: boolean;
  onChange: (value: string) => void;
  onUpload: (file: File) => Promise<void>;
}) {
  const { spec } = props;
  const probe = useImageProbe(props.value);
  const check = evaluatePmaxImage(probe, spec);
  const filled = Boolean(props.value.trim());
  const ok = filled && check.ratioOk && check.meetsMinimum;

  return (
    <div className={cn("rounded-xl border p-2.5", ok ? "border-emerald-500/30" : filled ? "border-amber-500/35" : "")}>
      <div className="flex gap-3">
        <div className="w-[88px] shrink-0">
          <PMaxPreviewFrame
            src={props.value}
            alt={spec.title}
            fallback="—"
            recommended={spec.recommended}
            aspectLabel={spec.aspectLabel}
            maxWidthClass="w-[88px]"
            showSizeLabel={false}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <HelpLabel label={spec.shortTitle} help={spec.help} />
            <Badge variant={spec.required ? "default" : "secondary"} className="h-5 text-[10px]">
              {spec.required ? "Verplicht" : "Optioneel"}
            </Badge>
            {filled ? (
              <Badge variant={ok ? "success" : "warning"} className="h-5 text-[10px]">
                {ok ? "Google OK" : "Controleer"}
              </Badge>
            ) : (
              <Badge variant="outline" className="h-5 text-[10px]">
                {spec.required ? "Ontbreekt" : "Leeg"}
              </Badge>
            )}
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            <span className="font-medium text-foreground/90">{formatPx(spec.recommended)}</span> aanbevolen · min.{" "}
            {formatPx(spec.minimum)} · {spec.aspectLabel}
          </p>
          {filled && probe.status === "ready" ? (
            <p className="text-[11px] text-muted-foreground">
              Bestand: {probe.width}×{probe.height}px
              {!check.ratioOk || !check.meetsMinimum ? (
                <span className="text-amber-800 dark:text-amber-200"> — {check.message}</span>
              ) : null}
            </p>
          ) : null}
          <details className="group text-[11px]">
            <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
              Google-specificatie ({spec.googleAssetField})
            </summary>
            <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-muted-foreground">
              <li>Verhouding: {spec.aspectLabel}</li>
              <li>Aanbevolen: {formatPx(spec.recommended)}</li>
              <li>Minimum: {formatPx(spec.minimum)}</li>
              <li>Max. {spec.maxPerAssetGroup} per asset group</li>
              <li>{GOOGLE_PMAX_IMAGE_FILE_RULES}</li>
              <li>{spec.pushedOnSubmit ? "Wordt meegestuurd bij push als URL ingevuld." : "Wordt niet gepusht in V1."}</li>
            </ul>
          </details>
          <div className="flex gap-2">
            <Input
              value={props.value}
              onChange={(event) => props.onChange(event.target.value)}
              placeholder="https://… of upload"
              className="h-8 text-xs"
            />
            <label className="inline-flex shrink-0 cursor-pointer items-center">
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void props.onUpload(file);
                  event.currentTarget.value = "";
                }}
              />
              <span className="inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-medium hover:bg-muted">
                {props.uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PmaxVisualAssetsPanel(props: {
  assetGroupName: string;
  onAssetGroupNameChange: (value: string) => void;
  businessName: string;
  onBusinessNameChange: (value: string) => void;
  callToAction: string;
  onCallToActionChange: (value: string) => void;
  brandGuidelinesEnabled: boolean;
  onBrandGuidelinesChange: (value: boolean) => void;
  finalUrlExpansion: boolean;
  onFinalUrlExpansionChange: (value: boolean) => void;
  headlines: string[];
  longHeadlines: string[];
  descriptions: string[];
  imageUrl: string;
  squareImageUrl: string;
  portraitImageUrl: string;
  logoUrl: string;
  landscapeLogoUrl: string;
  onImageUrlChange: (value: string) => void;
  onSquareImageUrlChange: (value: string) => void;
  onPortraitImageUrlChange: (value: string) => void;
  onLogoUrlChange: (value: string) => void;
  onLandscapeLogoUrlChange: (value: string) => void;
  uploadingAsset: PmaxImageKind | null;
  onUpload: (slot: PmaxImageKind, file: File) => Promise<void>;
}) {
  const probes: Record<PmaxImageKind, ImageProbeState> = {
    landscape: useImageProbe(props.imageUrl),
    square: useImageProbe(props.squareImageUrl),
    portrait: useImageProbe(props.portraitImageUrl),
    logo: useImageProbe(props.logoUrl),
    landscapeLogo: useImageProbe(props.landscapeLogoUrl),
  };

  const values: Record<PmaxImageKind, string> = {
    landscape: props.imageUrl,
    square: props.squareImageUrl,
    portrait: props.portraitImageUrl,
    logo: props.logoUrl,
    landscapeLogo: props.landscapeLogoUrl,
  };

  const setters: Record<PmaxImageKind, (value: string) => void> = {
    landscape: props.onImageUrlChange,
    square: props.onSquareImageUrlChange,
    portrait: props.onPortraitImageUrlChange,
    logo: props.onLogoUrlChange,
    landscapeLogo: props.onLandscapeLogoUrlChange,
  };

  return (
    <div className="space-y-3">
      <PmaxAssetChecklist
        headlines={props.headlines}
        longHeadlines={props.longHeadlines}
        descriptions={props.descriptions}
        businessName={props.businessName}
        imageUrl={props.imageUrl}
        squareImageUrl={props.squareImageUrl}
        logoUrl={props.logoUrl}
        portraitImageUrl={props.portraitImageUrl}
        landscapeLogoUrl={props.landscapeLogoUrl}
        brandGuidelinesEnabled={props.brandGuidelinesEnabled}
        probes={probes}
      />

      <details className="rounded-xl border bg-background/60">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Bestandsregels (alle PMax-beelden)</summary>
        <div className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <p>{GOOGLE_PMAX_IMAGE_FILE_RULES}</p>
          <p className="mt-2">
            Bron:{" "}
            <a
              href="https://developers.google.com/google-ads/api/performance-max/asset-requirements"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline underline-offset-2"
            >
              Google Ads API — Performance Max assets
            </a>
          </p>
        </div>
      </details>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-3">
          <HelpLabel label="Naam asset group" help="Interne structuur in Google Ads." />
          <Input
            className="h-9"
            value={props.assetGroupName}
            onChange={(e) => props.onAssetGroupNameChange(e.target.value)}
            placeholder="Bijv. Lead generation asset group"
          />
        </div>
        <div className="space-y-1.5">
          <HelpLabel label="Bedrijfsnaam" help="BUSINESS_NAME · max. 25 tekens." />
          <Input
            className="h-9"
            value={props.businessName}
            onChange={(e) => props.onBusinessNameChange(e.target.value)}
            maxLength={25}
            placeholder="Bijv. Digitify"
          />
          <p className="text-[11px] text-muted-foreground">{props.businessName.trim().length}/25</p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <HelpLabel label="Call-to-action (preview)" help="Google kan de knoptekst per placement variëren." />
          <Select value={props.callToAction} onValueChange={props.onCallToActionChange}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CTA_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <details className="rounded-xl border" open>
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
          Verplichte beelden ({PMAX_REQUIRED_IMAGE_KINDS.length}) — landscape, square, logo
        </summary>
        <div className="space-y-2 border-t p-2">
          {PMAX_REQUIRED_IMAGE_KINDS.map((kind) => (
            <PmaxAssetUploadRow
              key={kind}
              spec={GOOGLE_PMAX_IMAGE_SPECS[kind]}
              value={values[kind]}
              uploading={props.uploadingAsset === kind}
              onChange={setters[kind]}
              onUpload={(file) => props.onUpload(kind, file)}
            />
          ))}
        </div>
      </details>

      <details className="rounded-xl border">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
          Optionele beelden ({PMAX_OPTIONAL_IMAGE_KINDS.length}) — portrait, breed logo
        </summary>
        <div className="space-y-2 border-t p-2">
          {PMAX_OPTIONAL_IMAGE_KINDS.map((kind) => (
            <PmaxAssetUploadRow
              key={kind}
              spec={GOOGLE_PMAX_IMAGE_SPECS[kind]}
              value={values[kind]}
              uploading={props.uploadingAsset === kind}
              onChange={setters[kind]}
              onUpload={(file) => props.onUpload(kind, file)}
            />
          ))}
        </div>
      </details>

      <details className="rounded-xl border">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Geavanceerd</summary>
        <div className="grid gap-2 border-t p-2 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border bg-background/80 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Brand guidelines</p>
              <p className="text-[11px] text-muted-foreground">Blokkeert V1-push.</p>
            </div>
            <Switch checked={props.brandGuidelinesEnabled} onCheckedChange={props.onBrandGuidelinesChange} />
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-background/80 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Final URL expansion</p>
              <p className="text-[11px] text-muted-foreground">Alleen in draft (V1).</p>
            </div>
            <Switch checked={props.finalUrlExpansion} onCheckedChange={props.onFinalUrlExpansionChange} />
          </div>
        </div>
      </details>
    </div>
  );
}

export function SearchPreview(props: { finalUrl: string; headlines: string[]; descriptions: string[]; path1: string; path2: string; keywords: string[]; headlinePin1: string; descriptionPin1: string }) {
  const domain = props.finalUrl.replace(/^https?:\/\//, "").split("/")[0] || "jouwdomein.be";
  const displayPath = [props.path1, props.path2].filter(Boolean).join("/");
  const shownHeadlines = [props.headlinePin1, ...props.headlines.filter((item) => item !== props.headlinePin1)].filter(Boolean).slice(0, 3);
  const shownDescriptions = [props.descriptionPin1, ...props.descriptions.filter((item) => item !== props.descriptionPin1)].filter(Boolean).slice(0, 2);
  return (
    <Card className="overflow-hidden border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 shadow-sm dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Eye className="h-4 w-4" /> Search preview</CardTitle><CardDescription>Responsive Search Ads roteren assets. Gepinde velden tonen we eerst.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-3xl border bg-white p-4 shadow-sm dark:bg-slate-950">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="secondary">Gesponsord</Badge><span>{domain}{displayPath ? `/${displayPath}` : ""}</span></div>
          <h3 className="text-xl font-medium leading-snug text-blue-700 dark:text-blue-300">{shownHeadlines.join(" | ") || "Headline 1 | Headline 2 | Headline 3"}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{shownDescriptions.join(" ") || "Beschrijving van je advertentie verschijnt hier."}</p>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {props.keywords.slice(0, 4).map((keyword) => <div key={keyword} className="rounded-xl bg-slate-50 p-2 text-xs text-muted-foreground dark:bg-slate-900">Keyword: {keyword}</div>)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PMaxPreviewLogo({ logoUrl, businessName, size = "md" }: { logoUrl: string; businessName: string; size?: "sm" | "md" }) {
  const initials = (businessName || "D").trim().charAt(0).toUpperCase();
  const box = size === "sm" ? "h-6 w-6 rounded-md text-[10px]" : "h-8 w-8 rounded-lg text-xs";
  return logoUrl ? (
    <img src={logoUrl} alt="Logo" className={cn(box, "object-cover")} />
  ) : (
    <div className={cn(box, "flex items-center justify-center bg-emerald-600 font-bold text-white")}>{initials}</div>
  );
}

export function PMaxPreviewFrame({
  src,
  alt,
  fallback,
  recommended,
  aspectLabel,
  maxWidthClass = "max-w-full",
  showSizeLabel = true,
  roundedClass = "",
}: {
  src: string;
  alt: string;
  fallback: string;
  recommended: { width: number; height: number };
  aspectLabel: string;
  maxWidthClass?: string;
  showSizeLabel?: boolean;
  roundedClass?: string;
}) {
  return (
    <div className={cn("w-full", maxWidthClass)}>
      <div
        className={cn("relative w-full overflow-hidden bg-slate-100 dark:bg-slate-900", roundedClass)}
        style={{ aspectRatio: `${recommended.width} / ${recommended.height}` }}
      >
        {src ? (
          <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-muted-foreground">
            <ImageIcon className="mr-1.5 h-4 w-4 shrink-0" />
            {fallback}
          </div>
        )}
      </div>
      {showSizeLabel ? (
        <p className="mt-1 text-center text-[10px] text-muted-foreground">
          {aspectLabel} · {formatPx(recommended)}
        </p>
      ) : null}
    </div>
  );
}

export type PMaxPlacement = "display" | "youtube" | "discover" | "search";

export const PMAX_PLACEMENTS: Array<{ id: PMaxPlacement; label: string; icon: LucideIcon; hint: string }> = [
  { id: "display", label: "Display", icon: Monitor, hint: "Landscape 1.91:1 (1200×628 px) — breed banner boven tekst" },
  { id: "youtube", label: "YouTube", icon: Play, hint: "Square 1:1 (1200×1200 px) — feed/thumbnail op mobiel" },
  { id: "discover", label: "Discover", icon: Smartphone, hint: "Portrait 4:5 (960×1200 px) — verticale feedkaart" },
  { id: "search", label: "Search", icon: Search, hint: "Tekstadvertentie + image extension 1.91:1" },
];

export function PerformanceMaxPreview(props: {
  finalUrl: string;
  headlines: string[];
  longHeadlines: string[];
  descriptions: string[];
  imageUrl: string;
  squareImageUrl: string;
  portraitImageUrl: string;
  logoUrl: string;
  landscapeLogoUrl: string;
  businessName: string;
  callToAction: string;
}) {
  const [placement, setPlacement] = useState<PMaxPlacement>("display");
  const domain = props.finalUrl.replace(/^https?:\/\//, "").split("/")[0] || "jouwsite.be";
  const business = props.businessName.trim() || "Jouw merk";
  const cta = props.callToAction.trim() || "Meer informatie";
  const headline = props.longHeadlines.find(Boolean) || props.headlines.find(Boolean) || "Meer kwalitatieve leads";
  const altHeadline = props.headlines.filter(Boolean)[1] || props.headlines.find(Boolean) || headline;
  const description = props.descriptions.find(Boolean) || "Beschrijving van je campagne verschijnt hier.";
  const headlineCount = props.headlines.filter(Boolean).length;
  const descriptionCount = props.descriptions.filter(Boolean).length;
  const activePlacement = PMAX_PLACEMENTS.find((item) => item.id === placement) ?? PMAX_PLACEMENTS[0];

  return (
    <Card className="overflow-hidden border-slate-200 bg-gradient-to-br from-orange-50 via-white to-lime-50 shadow-sm dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <CardHeader className="space-y-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4" />
            Performance Max preview
          </CardTitle>
          <CardDescription>
            Bekijk hoe Google je assets kan combineren. Performance Max roteert tekst en beeld over Search, Display, YouTube, Gmail, Discover en Maps.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {PMAX_PLACEMENTS.map((item) => {
            const Icon = item.icon;
            const active = placement === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setPlacement(item.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  active
                    ? "border-orange-300 bg-orange-100 text-orange-950 shadow-sm dark:border-orange-500/40 dark:bg-orange-950/40 dark:text-orange-100"
                    : "border-border/70 bg-background/80 text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{activePlacement.hint}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-border/70 bg-white/90 p-4 shadow-sm dark:bg-slate-950/90">
          {placement === "display" ? (
            <div className="mx-auto max-w-md overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
              <PMaxPreviewFrame
                src={props.imageUrl}
                alt="Display banner"
                fallback="Landscape 1.91:1"
                recommended={GOOGLE_PMAX_IMAGE_SPECS.landscape.recommended}
                aspectLabel="Display · 1.91:1"
                maxWidthClass="max-w-full"
                showSizeLabel={false}
              />
              <div className="space-y-2 p-4">
                <div className="flex items-center gap-2">
                  <PMaxPreviewLogo logoUrl={props.logoUrl} businessName={business} size="sm" />
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{business}</p>
                  <Badge variant="secondary" className="ml-auto text-[10px]">Gesponsord</Badge>
                </div>
                <h3 className="line-clamp-2 text-lg font-semibold leading-snug">{headline}</h3>
                <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">{description}</p>
                <Button size="sm" className="mt-1 rounded-full px-4">{cta}</Button>
              </div>
            </div>
          ) : null}

          {placement === "youtube" ? (
            <div className="mx-auto max-w-[280px]">
              <div className="rounded-[1.75rem] border-[3px] border-slate-800 bg-slate-950 p-2 shadow-lg dark:border-slate-600">
                <div className="overflow-hidden rounded-[1.25rem] bg-black">
                  <PMaxPreviewFrame
                    src={props.squareImageUrl || props.imageUrl}
                    alt="YouTube feed creative"
                    fallback="Square 1:1"
                    recommended={GOOGLE_PMAX_IMAGE_SPECS.square.recommended}
                    aspectLabel="YouTube · 1:1"
                    maxWidthClass="max-w-full"
                    showSizeLabel={false}
                    roundedClass="rounded-none"
                  />
                  <div className="space-y-2 p-3 text-white">
                    <div className="flex items-start gap-2">
                      <PMaxPreviewLogo logoUrl={props.logoUrl} businessName={business} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium leading-snug">{altHeadline}</p>
                        <p className="mt-1 truncate text-[11px] text-slate-400">{business} · Gesponsord</p>
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" className="h-8 w-full rounded-full bg-white text-xs text-slate-900 hover:bg-white/90">{cta}</Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {placement === "discover" ? (
            <div className="mx-auto w-full max-w-[240px] overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-950">
              <PMaxPreviewFrame
                src={props.portraitImageUrl || props.squareImageUrl || props.imageUrl}
                alt="Discover card"
                fallback="Portrait 4:5"
                recommended={GOOGLE_PMAX_IMAGE_SPECS.portrait.recommended}
                aspectLabel="Discover · 4:5"
                maxWidthClass="max-w-full"
                showSizeLabel={false}
              />
              <div className="space-y-2 p-4">
                <div className="flex items-center gap-2">
                  <PMaxPreviewLogo logoUrl={props.logoUrl} businessName={business} size="sm" />
                  <p className="truncate text-xs font-medium text-muted-foreground">{business}</p>
                </div>
                <h3 className="line-clamp-3 text-base font-semibold leading-snug">{headline}</h3>
                <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
          ) : null}

          {placement === "search" ? (
            <div className="mx-auto max-w-xl rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-950">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">Gesponsord</Badge>
                <span className="truncate">{domain}</span>
              </div>
              <h3 className="line-clamp-2 text-lg font-medium leading-snug text-blue-700 dark:text-blue-300">{headline}</h3>
              <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-700 dark:text-slate-200">{description}</p>
              {(props.imageUrl || props.squareImageUrl) ? (
                <div className="mt-3 overflow-hidden rounded-xl border">
                  <PMaxPreviewFrame
                    src={props.imageUrl || props.squareImageUrl}
                    alt="Search image extension"
                    fallback="Landscape 1.91:1"
                    recommended={GOOGLE_PMAX_IMAGE_SPECS.landscape.recommended}
                    aspectLabel="Search image · 1.91:1"
                    maxWidthClass="max-w-full"
                    showSizeLabel={false}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Visuele assets in je asset group</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                { label: "Landscape 1.91:1", src: props.imageUrl, spec: GOOGLE_PMAX_IMAGE_SPECS.landscape },
                { label: "Square 1:1", src: props.squareImageUrl, spec: GOOGLE_PMAX_IMAGE_SPECS.square },
                { label: "Portrait 4:5", src: props.portraitImageUrl, spec: GOOGLE_PMAX_IMAGE_SPECS.portrait },
                { label: "Logo 1:1", src: props.logoUrl, spec: GOOGLE_PMAX_IMAGE_SPECS.logo },
                { label: "Logo 4:1", src: props.landscapeLogoUrl, spec: GOOGLE_PMAX_IMAGE_SPECS.landscapeLogo },
              ] as const
            ).map((asset) => (
              <div key={asset.label} className="overflow-hidden rounded-xl border bg-background">
                <PMaxPreviewFrame
                  src={asset.src}
                  alt={asset.label}
                  fallback={asset.label.split(" ")[0] ?? "Asset"}
                  recommended={asset.spec.recommended}
                  aspectLabel={asset.spec.aspectLabel}
                  maxWidthClass="max-w-full"
                />
                <p className="truncate px-2 py-1 text-[10px] text-muted-foreground">{asset.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs leading-5 text-muted-foreground">
          Google kiest zelf welke combinatie verschijnt.
          {headlineCount > 0 || descriptionCount > 0 ? (
            <>
              {" "}Je hebt {headlineCount || "geen"} headline{headlineCount === 1 ? "" : "s"} en {descriptionCount || "geen"} description{descriptionCount === 1 ? "" : "s"} — meer variatie geeft betere resultaten.
            </>
          ) : (
            <> Vul headlines, descriptions en beelden in om een realistischer voorbeeld te zien.</>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
