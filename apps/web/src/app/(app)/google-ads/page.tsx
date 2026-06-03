"use client";

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  HelpCircle,
  Layers,
  Megaphone,
  Languages,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Lock,
  MapPin,
  PauseCircle,
  PencilLine,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Upload,
  Wand2,
  XCircle,
  Monitor,
  Play,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdsStudioStatsStrip, adsStudioStatIcons } from "@/components/ads/ads-studio-stats-strip";
import { AdsStudioTabsNav } from "@/components/ads/ads-studio-tabs-nav";
import { useToast } from "@/components/feedback/toast-provider";

type PlanStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "PUSHING" | "PUSHED_PAUSED" | "FAILED" | "CANCELLED";
type CampaignType = "SEARCH" | "PERFORMANCE_MAX";
type BuilderStep = "setup" | "creative" | "targeting" | "review";
type MatchType = "BROAD" | "PHRASE" | "EXACT";
type BiddingStrategy = "MAXIMIZE_CONVERSIONS" | "MAXIMIZE_CONVERSION_VALUE" | "MANUAL_CPC";

const GOOGLE_ADS_NAV_TABS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: "campaigns", label: "Campagnes", icon: Megaphone },
  { value: "dashboard", label: "Campagne-wizard", icon: Wand2 },
  { value: "queue", label: "Goedkeuring", icon: ShieldCheck },
  { value: "drafts", label: "Drafts", icon: FileText },
  { value: "insights", label: "Prestaties", icon: BarChart3 },
  { value: "settings", label: "Instellingen", icon: Settings2 },
];

const CURRENCY_OPTIONS = [
  { value: "EUR", label: "Euro", symbol: "€" },
  { value: "USD", label: "US dollar", symbol: "$" },
  { value: "GBP", label: "Britse pond", symbol: "£" },
  { value: "CHF", label: "Zwitserse frank", symbol: "CHF" },
] as const;

type ErrorExplanation = {
  label: string;
  code?: string;
  message: string;
  actions: string[];
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

/** Google Ads Performance Max image specs (API + support docs, 2025). */
type PmaxImageKind = "landscape" | "square" | "portrait" | "logo" | "landscapeLogo";

type GooglePmaxImageSpec = {
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

const PMAX_REQUIRED_IMAGE_KINDS: PmaxImageKind[] = ["landscape", "square", "logo"];
const PMAX_OPTIONAL_IMAGE_KINDS: PmaxImageKind[] = ["portrait", "landscapeLogo"];

const GOOGLE_PMAX_IMAGE_SPECS: Record<PmaxImageKind, GooglePmaxImageSpec> = {
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

const GOOGLE_PMAX_IMAGE_FILE_RULES =
  "JPG, PNG of GIF · max. 5 MB (5120 KB) · belangrijkste inhoud in het middelste 80% van het beeld";

const GOOGLE_PMAX_TEXT_REQUIREMENTS = [
  { id: "headlines", label: "Headlines", rule: "min. 3, max. 15 · max. 30 tekens", min: 3 },
  { id: "longHeadlines", label: "Long headlines", rule: "min. 1, max. 5 · max. 90 tekens", min: 1 },
  { id: "descriptions", label: "Descriptions", rule: "min. 2, max. 5 · max. 90 tekens", min: 2 },
  { id: "businessName", label: "Bedrijfsnaam", rule: "verplicht · max. 25 tekens", min: 1 },
] as const;

function formatPx(size: { width: number; height: number }) {
  return `${size.width} × ${size.height} px`;
}

const BUILDER_STEP_ORDER: BuilderStep[] = ["setup", "creative", "targeting", "review"];

const STEPS: Array<{ id: BuilderStep; label: string; description: string; googleHint: string }> = [
  { id: "setup", label: "Campagne", description: "Budget, planning en bieden", googleHint: "Campagne-instellingen" },
  { id: "creative", label: "Advertenties", description: "RSA of asset group", googleHint: "Advertenties & assets" },
  { id: "targeting", label: "Doelgroep", description: "Locatie, taal en keywords", googleHint: "Doelgroep & netwerken" },
  { id: "review", label: "Controleren", description: "Samenvatting en approval", googleHint: "Controleren & publiceren" },
];

const BIDDING_OPTIONS: Array<{ value: BiddingStrategy; label: string; hint: string }> = [
  { value: "MAXIMIZE_CONVERSIONS", label: "Conversies maximaliseren", hint: "Standaard voor leadgeneratie. Optioneel target-CPA." },
  { value: "MAXIMIZE_CONVERSION_VALUE", label: "Conversiewaarde maximaliseren", hint: "Voor ecommerce of value-based bidding met target-ROAS." },
  { value: "MANUAL_CPC", label: "Handmatige CPC", hint: "Alleen Search. Jij bepaalt max. CPC per keyword." },
];

const CTA_OPTIONS = [
  "Meer informatie",
  "Offerte aanvragen",
  "Demo boeken",
  "Aanmelden",
  "Contacteer ons",
  "Ontdek meer",
] as const;

const AI_TONES = [
  { value: "professioneel", label: "Professioneel" },
  { value: "resultaatgericht", label: "Resultaatgericht" },
  { value: "vriendelijk", label: "Vriendelijk" },
  { value: "premium", label: "Premium" },
] as const;

const LOCATION_PRESETS = [
  { value: "BE", label: "België", description: "Heel België · Nederlands", geo: "geoTargetConstants/2056", languages: "languageConstants/1010" },
  { value: "NL", label: "Nederland", description: "Heel Nederland · Nederlands", geo: "geoTargetConstants/2528", languages: "languageConstants/1010" },
  { value: "BE_NL", label: "België + Nederland", description: "Beide landen · Nederlands", geo: "geoTargetConstants/2056\ngeoTargetConstants/2528", languages: "languageConstants/1010" },
] as const;

const GEO_TARGET_OPTIONS = [
  { id: "geoTargetConstants/2056", label: "België", group: "Landen" },
  { id: "geoTargetConstants/2528", label: "Nederland", group: "Landen" },
  { id: "geoTargetConstants/2242", label: "Luxemburg", group: "Landen" },
  { id: "geoTargetConstants/1009886", label: "Brussel", group: "Steden & regio's" },
] as const;

const GEO_COUNTRY_LABELS: Record<string, string> = {
  BE: "België",
  NL: "Nederland",
  LU: "Luxemburg",
};

const MATCH_TYPE_OPTIONS: Array<{ value: MatchType; label: string; hint: string }> = [
  { value: "PHRASE", label: "Phrase match", hint: "Zoekterm + gerelateerde woorden" },
  { value: "EXACT", label: "Exact match", hint: "Alleen deze precieze zoekopdracht" },
  { value: "BROAD", label: "Broad match", hint: "Ruim bereik — gebruik voorzichtig" },
];

const NEGATIVE_KEYWORD_PRESETS = [
  "gratis",
  "vacature",
  "werkstudent",
  "opleiding",
  "fraude",
  "adres",
  "telefoonnummer",
  "jobs",
] as const;

const LANGUAGE_OPTIONS = [
  { id: "languageConstants/1010", label: "Nederlands", hint: "Standaard voor België en Nederland" },
  { id: "languageConstants/1002", label: "Frans", hint: "België (Wallonië & Brussel)" },
  { id: "languageConstants/1000", label: "Engels", hint: "Internationaal publiek" },
  { id: "languageConstants/1001", label: "Duits", hint: "Duitstalige doelgroep" },
] as const;

function normalizeGeoId(geoId: string) {
  const trimmed = geoId.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("geoTargetConstants/") ? trimmed : `geoTargetConstants/${trimmed.replace(/^\/+/, "")}`;
}

function resolveGeoLabel(geoId: string) {
  const normalized = normalizeGeoId(geoId);
  return GEO_TARGET_OPTIONS.find((item) => item.id === normalized)?.label ?? normalized.replace("geoTargetConstants/", "Geo ");
}

function resolveLanguageLabel(languageId: string) {
  const normalized = languageId.startsWith("languageConstants/") ? languageId : `languageConstants/${languageId}`;
  if (normalized === "languageConstants/1013") return "Nederlands";
  return LANGUAGE_OPTIONS.find((item) => item.id === normalized)?.label ?? languageId.replace("languageConstants/", "Taal ");
}

function detectLocationPreset(geoText: string, languageText: string) {
  const match = LOCATION_PRESETS.find((item) => item.geo === geoText && item.languages === languageText);
  return match?.value ?? "CUSTOM";
}

function googleCampaignTypeFromChannel(channelType: unknown): CampaignType {
  const normalized = String(channelType || "").toUpperCase();
  return normalized.includes("PERFORMANCE_MAX") ? "PERFORMANCE_MAX" : "SEARCH";
}

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

function linesToList(value: string, max = 15) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

function csvToList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToLines(value: unknown, fallback: string[]) {
  return (Array.isArray(value) && value.length ? value : fallback).map((item) => String(item)).join("\n");
}

function parseJson(value: string, label: string) {
  if (!value.trim()) return {};
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} bevat geen geldige JSON.`);
  }
}

function explainGoogleError(raw?: string | null): ErrorExplanation | null {
  if (!raw) return null;
  const message = raw.replace(/\s+/g, " ").trim();
  const lower = message.toLowerCase();
  const code = message.match(/([A-Z_]+_ERROR:\s*[A-Z_]+)/)?.[1] || message.match(/error_code[^A-Z]+([A-Z_]+)/i)?.[1];

  if (lower.includes("developer_token") || lower.includes("developer token")) {
    return {
      label: "Developer token ontbreekt of is niet actief",
      code,
      message,
      actions: ["Zet GOOGLE_ADS_DEVELOPER_TOKEN in Vercel en lokaal in .env.", "Controleer in Google Ads API Center of de token Basic/Standard access heeft."],
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

function ErrorHint({ raw }: { raw?: string | null }) {
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

function evaluatePmaxImage(probe: ImageProbeState, spec: GooglePmaxImageSpec) {
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

function describeOperationalRequirement(code: string): OperationalRequirement {
  if (code === "GOOGLE_DEV_TOKEN_MISSING") {
    return {
      code,
      title: "Developer token ontbreekt",
      description: "De server heeft nog geen actieve Google Ads developer token om API-calls te mogen doen.",
      nextStep: "Zet GOOGLE_ADS_DEVELOPER_TOKEN lokaal en in Vercel, en controleer API Center toegang.",
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

function HelpLabel({ label, help, helpClassName }: { label: string; help: string; helpClassName?: string }) {
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

function WizardSection({
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

function AssetTextHint({ lines, maxChars, label }: { lines: string[]; maxChars: number; label: string }) {
  const tooLong = lines.filter((line) => line.length > maxChars).length;
  return (
    <p className={`text-xs ${tooLong ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
      {lines.length} {label} · max. {maxChars} tekens per regel
      {tooLong ? ` · ${tooLong} regel(s) te lang voor Google` : ""}
    </p>
  );
}

function CopyAssetListEditor({
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

const AUDIENCE_SIGNAL_PRESETS = [
  "KMO eigenaar",
  "Marketing manager",
  "Zaakvoerder",
  "Leadgeneratie tools",
  "Digitale marketing",
  "Webdesign diensten",
] as const;

function AudienceSignalsEditor({
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
              title={aiDisabled ? "Vul eerst product of aanbod in (Setup → AI-briefing)" : undefined}
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

function SearchKeywordsEditor({
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
              title={aiDisabled ? "Vul eerst product of aanbod in (Setup → AI-briefing)" : undefined}
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

function BeneluxGeoSearch({
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

function GeoLocationEditor({
  geoTargets,
  languages,
  locationPreset,
  onGeoTargetsChange,
  onLanguagesChange,
  onLocationPresetChange,
  googleSearchEnabled = false,
}: {
  geoTargets: string;
  languages: string;
  locationPreset: string;
  onGeoTargetsChange: (value: string) => void;
  onLanguagesChange: (value: string) => void;
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

  function applyPreset(presetValue: string) {
    const preset = LOCATION_PRESETS.find((item) => item.value === presetValue);
    if (!preset) return;
    onLocationPresetChange(preset.value);
    onGeoTargetsChange(preset.geo);
    onLanguagesChange(preset.languages);
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
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Snelle regio&apos;s</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {LOCATION_PRESETS.map((preset) => {
            const active = locationPreset === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => applyPreset(preset.value)}
                className={cn(
                  "rounded-xl border p-3 text-left transition",
                  active
                    ? "border-emerald-600 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-600/25"
                    : "border-border/70 bg-background/80 hover:border-emerald-500/35 hover:bg-muted/20",
                )}
              >
                <p className="text-sm font-semibold">{preset.label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{preset.description}</p>
              </button>
            );
          })}
        </div>
      </div>

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
          <p className="text-xs text-muted-foreground">Kies minstens één locatie via een preset of zoek een stad/regio.</p>
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

function LanguageTargetingEditor({
  geoTargets,
  languages,
  locationPreset,
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

function ReviewRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border bg-background/80 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium leading-snug">{value}</div>
    </div>
  );
}

function StepButton({ step, stepIndex, activeStep, complete, locked, onClick }: { step: (typeof STEPS)[number]; stepIndex: number; activeStep: BuilderStep; complete: boolean; locked: boolean; onClick: () => void }) {
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

function CollapsibleCard({
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

function GoogleAdsSetupNotice({
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

function GoogleAdsHeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function FieldCounter({ label, count, min, max }: { label: string; count: number; min: number; max: number }) {
  const ok = count >= min && count <= max;
  return <Badge variant={ok ? "success" : "warning"}>{label}: {count}/{min}-{max}</Badge>;
}

function pmaxImageAssetOk(value: string, spec: GooglePmaxImageSpec, probe: ImageProbeState) {
  if (!value.trim()) return spec.required ? false : true;
  const check = evaluatePmaxImage(probe, spec);
  return check.ratioOk && check.meetsMinimum;
}

function PmaxAssetChecklist(props: {
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

function PmaxAssetUploadRow(props: {
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

function PmaxVisualAssetsPanel(props: {
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

function SearchPreview(props: { finalUrl: string; headlines: string[]; descriptions: string[]; path1: string; path2: string; keywords: string[]; headlinePin1: string; descriptionPin1: string }) {
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

function PMaxPreviewLogo({ logoUrl, businessName, size = "md" }: { logoUrl: string; businessName: string; size?: "sm" | "md" }) {
  const initials = (businessName || "D").trim().charAt(0).toUpperCase();
  const box = size === "sm" ? "h-6 w-6 rounded-md text-[10px]" : "h-8 w-8 rounded-lg text-xs";
  return logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="Logo" className={cn(box, "object-cover")} />
  ) : (
    <div className={cn(box, "flex items-center justify-center bg-emerald-600 font-bold text-white")}>{initials}</div>
  );
}

/** Renders image in exact Google recommended aspect ratio (wrapper enforces dimensions, not max-height). */
function PMaxPreviewFrame({
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
          // eslint-disable-next-line @next/next/no-img-element
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

type PMaxPlacement = "display" | "youtube" | "discover" | "search";

const PMAX_PLACEMENTS: Array<{ id: PMaxPlacement; label: string; icon: LucideIcon; hint: string }> = [
  { id: "display", label: "Display", icon: Monitor, hint: "Landscape 1.91:1 (1200×628 px) — breed banner boven tekst" },
  { id: "youtube", label: "YouTube", icon: Play, hint: "Square 1:1 (1200×1200 px) — feed/thumbnail op mobiel" },
  { id: "discover", label: "Discover", icon: Smartphone, hint: "Portrait 4:5 (960×1200 px) — verticale feedkaart" },
  { id: "search", label: "Search", icon: Search, hint: "Tekstadvertentie + image extension 1.91:1" },
];

function PerformanceMaxPreview(props: {
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

export default function GoogleAdsPage() {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [loadedPlanId, setLoadedPlanId] = useState<string | null>(null);
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
  const [audienceSignalsText, setAudienceSignalsText] = useState("KMO eigenaar\nMarketing manager\nZaakvoerder\nLeadgeneratie tools");
  const [searchPartners, setSearchPartners] = useState(true);
  const [displayExpansion, setDisplayExpansion] = useState(false);
  const [advancedCreativeJson, setAdvancedCreativeJson] = useState("{}");
  const [advancedTargetingJson, setAdvancedTargetingJson] = useState("{}");
  const [uploadingAsset, setUploadingAsset] = useState<PmaxImageKind | null>(null);

  const connection = trpc.googleAds.connectionStatus.useQuery(undefined, { refetchInterval: 30_000 });
  const customers = trpc.googleAds.listCustomers.useQuery(undefined, { enabled: Boolean(connection.data?.connected) });
  const campaigns = trpc.googleAds.listCampaigns.useQuery(undefined, { enabled: Boolean(connection.data?.selectedCustomerId), refetchInterval: 60_000 });
  const insights = trpc.googleAds.getInsights.useQuery(undefined, { enabled: Boolean(connection.data?.selectedCustomerId), refetchInterval: 60_000 });
  const drafts = trpc.googleAds.listDrafts.useQuery(undefined, { refetchInterval: 20_000 });

  const rows = drafts.data ?? [];
  const heroStats = useMemo(
    () => ({
      pending: rows.filter((row: { status: string }) => row.status === "PENDING_APPROVAL").length,
      approved: rows.filter((row: { status: string }) => row.status === "APPROVED").length,
      failed: rows.filter((row: { status: string }) => row.status === "FAILED").length,
    }),
    [rows],
  );
  const filteredRows = approvalFilter === "ALL" ? rows : rows.filter((row: any) => row.status === approvalFilter);
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
    setAudienceSignalsText("KMO eigenaar\nMarketing manager\nZaakvoerder\nLeadgeneratie tools");
    setSearchPartners(true);
    setDisplayExpansion(false);
    setAdvancedCreativeJson("{}");
    setAdvancedTargetingJson("{}");
  }

  function startNewCampaign() {
    resetBuilderForNewCampaign();
    showToast({ title: "Nieuwe campagne", description: "Vul een nieuwe campagnenaam en instellingen in." });
  }

  function openGoogleCampaignAsDraft(campaign: Record<string, any>) {
    const campaignName = String(campaign.name || "Google campagne");
    setSelectedPlanId(`__google_live_import_${String(campaign.id || Date.now())}`);
    setLoadedPlanId(null);
    setName(`${campaignName} (bewerking)`);
    setCampaignType(googleCampaignTypeFromChannel(campaign.channelType));
    setCurrency(connection.data?.defaultCurrency || currency || "EUR");
    setDailyBudget(String(numberValue(dailyBudget) || 2500));
    setStartTime("");
    setEndTime("");
    setAdvancedCreativeJson("{}");
    setAdvancedTargetingJson("{}");
    setAdsTab("dashboard");
    setActiveStep("setup");
    showToast({
      title: "Live Google campagne als draft geopend",
      description: "Google geeft hier basisgegevens terug; vul creative en targeting verder aan in de Studio.",
    });
  }

  useEffect(() => {
    if (!selectedPlan || selectedPlan.id === loadedPlanId) return;
    const creative = asRecord(selectedPlan.creatives);
    const targeting = asRecord(selectedPlan.targeting);
    const campaignSettings = asRecord(targeting.campaignSettings);
    setName(selectedPlan.name || name);
    setCampaignType((selectedPlan.campaignType || "SEARCH") as CampaignType);
    setCurrency(selectedPlan.currency || "EUR");
    setDailyBudget(selectedPlan.dailyBudgetCents ? String(selectedPlan.dailyBudgetCents) : "");
    setStartTime(selectedPlan.startTime ? new Date(selectedPlan.startTime).toISOString().slice(0, 16) : "");
    setEndTime(selectedPlan.endTime ? new Date(selectedPlan.endTime).toISOString().slice(0, 16) : "");
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
    setAudienceSignalsText(listToLines(targeting.audienceSignals, ["KMO eigenaar", "Marketing manager"]));
    setSearchPartners(targeting.searchPartners !== false);
    setDisplayExpansion(Boolean(targeting.displayExpansion));
    setAdvancedCreativeJson("{}");
    setAdvancedTargetingJson("{}");
    setLoadedPlanId(selectedPlan.id);
  }, [selectedPlan, loadedPlanId]);

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
    onSuccess: async () => {
      await invalidate();
      resetBuilderForNewCampaign();
      showToast({
        title: "Google Ads draft aangemaakt",
        description: "De wizard staat leeg — je kunt meteen een volgende campagne opbouwen.",
      });
    },
    onError: (error) => showToast({ title: "Draft mislukt", description: explainGoogleError(error.message)?.message || error.message, variant: "error" }),
  });
  const updateDraft = trpc.googleAds.updateDraft.useMutation({
    onSuccess: async () => {
      await invalidate();
      resetBuilderForNewCampaign();
      showToast({
        title: "Draft opgeslagen",
        description: "De wizard staat leeg — je kunt meteen een volgende campagne opbouwen.",
      });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: explainGoogleError(error.message)?.message || error.message, variant: "error" }),
  });
  const generateSearchKeywords = trpc.googleAds.generateSearchKeywords.useMutation({
    onSuccess: (payload) => {
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
    },
    onError: (error) => showToast({ title: "AI-keywords mislukt", description: error.message, variant: "error" }),
  });

  const generateAudienceSignals = trpc.googleAds.generateAudienceSignals.useMutation({
    onSuccess: (payload) => {
      const nextSignals = payload.audienceSignals?.length ? payload.audienceSignals : linesToList(audienceSignalsText, 25);
      setAudienceSignalsText(nextSignals.join("\n"));
      showToast({
        title: payload.aiUsed ? "AI-signalen toegevoegd" : "Geen nieuwe signalen",
        description: payload.aiUsed
          ? `${nextSignals.length} signaal${nextSignals.length === 1 ? "" : "en"} in je lijst.`
          : "AI gaf geen bruikbare signalen terug — vul handmatig aan of probeer opnieuw.",
        variant: payload.aiUsed ? "success" : "error",
      });
    },
    onError: (error) => showToast({ title: "AI-signalen mislukt", description: error.message, variant: "error" }),
  });

  const generateSuggestion = trpc.googleAds.generateSuggestion.useMutation({
    onSuccess: (payload: any) => {
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
    },
    onError: (error) => showToast({ title: "AI-voorstel mislukt", description: error.message, variant: "error" }),
  });

  const submitForApproval = trpc.googleAds.submitForApproval.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Indienen mislukt", description: e.message, variant: "error" }) });
  const approveDraft = trpc.googleAds.approveDraft.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Goedkeuren mislukt", description: e.message, variant: "error" }) });
  const pushPaused = trpc.googleAds.pushPausedToGoogle.useMutation({ onSuccess: invalidate, onError: (e) => showToast({ title: "Push mislukt", description: explainGoogleError(e.message)?.message || e.message, variant: "error" }) });
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

  function handleAiSuggestion() {
    const trimmedProduct = product.trim();
    if (trimmedProduct.length < 2) {
      showToast({
        title: "Beschrijf je aanbod eerst",
        description: "Vul product of aanbod in onder AI-briefing op de Setup-stap.",
        variant: "error",
      });
      setActiveStep("setup");
      return;
    }
    generateSuggestion.mutate({
      product: trimmedProduct,
      audience: audience.trim() || undefined,
      campaignType,
      tone: aiTone,
    });
  }

  function handleAiSearchKeywords() {
    const trimmedProduct = product.trim();
    if (trimmedProduct.length < 2) {
      showToast({
        title: "Beschrijf je aanbod eerst",
        description: "Vul product of aanbod in onder AI-briefing op de Setup-stap.",
        variant: "error",
      });
      setActiveStep("setup");
      return;
    }
    generateSearchKeywords.mutate({
      product: trimmedProduct,
      audience: audience.trim() || undefined,
      tone: aiTone,
      existingKeywords: keywords,
      existingNegativeKeywords: negativeKeywords,
    });
  }

  function handleAiAudienceSignals() {
    const trimmedProduct = product.trim();
    if (trimmedProduct.length < 2) {
      showToast({
        title: "Beschrijf je aanbod eerst",
        description: "Vul product of aanbod in onder AI-briefing op de Setup-stap.",
        variant: "error",
      });
      setActiveStep("setup");
      return;
    }
    generateAudienceSignals.mutate({
      product: trimmedProduct,
      audience: audience.trim() || undefined,
      tone: aiTone,
      existingSignals: audienceSignals,
    });
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
    if (strict && !finalUrl.trim().startsWith("https://")) throw new Error("Gebruik een volledige https final URL.");
    if (strict && headlines.length < 3) throw new Error("Google vereist minstens 3 headlines.");
    if (strict && descriptions.length < 2) throw new Error("Google vereist minstens 2 beschrijvingen.");
    if (strict && campaignType === "SEARCH" && !keywords.length) throw new Error("Search vereist minstens 1 keyword.");
    if (strict && campaignType === "PERFORMANCE_MAX") {
      if (!longHeadlines.length) throw new Error("Performance Max vereist minstens 1 long headline.");
      if (!imageUrl.trim() || !squareImageUrl.trim()) throw new Error("Performance Max vereist minstens een landscape en square image URL.");
      if (!businessName.trim() || businessName.trim().length > 25) throw new Error("Performance Max business name is verplicht en maximaal 25 tekens.");
    }
    const advancedCreative = parseJson(advancedCreativeJson, "Advanced creative");
    const advancedTargeting = parseJson(advancedTargetingJson, "Advanced targeting");
    return {
      name,
      campaignType,
      dailyBudgetCents: numberValue(dailyBudget),
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
              {row.status === "DRAFT" || row.status === "FAILED" || row.status === "CANCELLED" ? <Button size="sm" variant="outline" onClick={() => submitForApproval.mutate({ id: row.id })}>Indienen</Button> : null}
              {row.status === "PENDING_APPROVAL" ? <Button size="sm" onClick={() => approveDraft.mutate({ id: row.id })}>Goedkeuren</Button> : null}
              {row.status === "APPROVED" ? <Button size="sm" disabled={!connection.data?.autoadsEnabled || pushPaused.isPending} onClick={() => pushPaused.mutate({ id: row.id })}><Send className="mr-2 h-3 w-3" /> Push paused</Button> : null}
              {row.status === "FAILED" ? <Button size="sm" variant="outline" onClick={() => retryFailed.mutate({ id: row.id })}><RefreshCcw className="mr-2 h-3 w-3" /> Retry</Button> : null}
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

      {(!connection.data?.hasDeveloperToken || !connection.data?.autoadsEnabled) ? (
        <div className="space-y-2">
          {!connection.data?.hasDeveloperToken ? (
            <GoogleAdsSetupNotice
              tone="amber"
              icon={KeyRound}
              title="Developer token ontbreekt"
              badge="API-setup"
              summary="Zonder developer token kan de app niet met de Google Ads API praten."
              headerAction={
                <Button size="sm" className="h-8 bg-amber-600 hover:bg-amber-700" asChild>
                  <Link href="/settings/integrations">
                    <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                    Integraties
                  </Link>
                </Button>
              }
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-amber-100/80 bg-amber-50/30 px-3 py-2.5 dark:border-amber-900/30 dark:bg-amber-950/20">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-800/80 dark:text-amber-200/80">Variabele</p>
                  <p className="mt-1 break-all font-mono text-xs font-medium text-foreground">GOOGLE_ADS_DEVELOPER_TOKEN</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    In <span className="font-mono">.env</span> en Vercel project settings
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/20 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Toegang</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Controleer in het Google Ads API Center of je token <span className="font-medium text-foreground">Basic</span> of{" "}
                    <span className="font-medium text-foreground">Standard</span> access heeft.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="bg-amber-600 hover:bg-amber-700" asChild>
                  <Link href="/settings/integrations">
                    <Settings2 className="mr-2 h-4 w-4" />
                    Naar integraties
                  </Link>
                </Button>
                <Button variant="outline" className="border-amber-200/80 bg-background/80" asChild>
                  <a href="https://ads.google.com/aw/apicenter" target="_blank" rel="noreferrer">
                    Google API Center
                  </a>
                </Button>
              </div>
            </GoogleAdsSetupNotice>
          ) : null}
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
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
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

                    <details className="group rounded-2xl border border-dashed border-border/80 bg-muted/10 open:bg-muted/20">
                      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                        <span className="inline-flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-emerald-600" />
                          AI-briefing (optioneel)
                        </span>
                      </summary>
                      <div className="space-y-4 border-t border-border/50 px-4 pb-4 pt-3">
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="space-y-2 sm:col-span-2">
                            <HelpLabel label="Product of aanbod" help="Input voor de knop 'AI voorstel' — niet rechtstreeks naar Google." />
                            <Input
                              value={product}
                              onChange={(e) => setProduct(e.target.value)}
                              placeholder="Bijv. Leadgeneratie voor lokale KMO's"
                            />
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Tone of voice" help="Stijl van AI-gegenereerde headlines en descriptions." />
                            <Select value={aiTone} onValueChange={setAiTone}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {AI_TONES.map((tone) => (
                                  <SelectItem key={tone.value} value={tone.value}>{tone.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 sm:col-span-3">
                            <HelpLabel label="Doelgroep" help="Wie wil je bereiken? Gebruikt door AI, niet als harde targeting." />
                            <Input
                              value={audience}
                              onChange={(e) => setAudience(e.target.value)}
                              placeholder="Bijv. Belgische KMO-eigenaars en zaakvoerders"
                            />
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
                    <WizardSection title="Locaties" description="Waar je advertenties mogen verschijnen — campagneniveau in Google Ads." icon={Target} defaultOpen>
                      <GeoLocationEditor
                        geoTargets={geoTargets}
                        languages={languages}
                        locationPreset={locationPreset}
                        onGeoTargetsChange={setGeoTargets}
                        onLanguagesChange={setLanguages}
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
                        defaultOpen
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
                          aiDisabled={product.trim().length < 2}
                        />
                      </WizardSection>
                    ) : (
                      <WizardSection title="Doelgroepsignalen (PMax)" description="Richtinggevende signalen — geen harde targeting zoals in Search." icon={Target} defaultOpen>
                        <AudienceSignalsEditor
                          value={audienceSignalsText}
                          onChange={setAudienceSignalsText}
                          onAiSuggest={handleAiAudienceSignals}
                          aiPending={generateAudienceSignals.isPending}
                          aiDisabled={product.trim().length < 2}
                        />
                      </WizardSection>
                    )}
                  </div>
                ) : null}

                {activeStep === "review" ? (
                  <div className="space-y-4">
                    <Card className="border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                      <CardContent className="flex gap-3 p-4 text-sm">
                        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                        <div>
                          <p className="font-medium">Publicatie als PAUSED in Google Ads</p>
                          <p className="mt-1 text-muted-foreground">
                            Na goedkeuring pushen we je campagne gepauzeerd. Activeren doe je bewust in Google Ads — net als bij een echte launch-checklist.
                          </p>
                        </div>
                      </CardContent>
                    </Card>

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
                      disabled={generateSuggestion.isPending || product.trim().length < 2}
                      title={product.trim().length < 2 ? "Vul eerst product of aanbod in (Setup → AI-briefing)" : undefined}
                    >
                      {generateSuggestion.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      AI voorstel
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={startNewCampaign}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nieuwe campagne
                    </Button>
                    <Button onClick={saveDraft} size="sm" disabled={createDraft.isPending || updateDraft.isPending || !canSaveDraft}>
                      {createDraft.isPending || updateDraft.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Draft opslaan
                    </Button>
                    {readyToSave ? <Badge variant="success">Klaar voor approval</Badge> : null}
                  </div>
                </div>
                {!readyToSave ? (
                  <p className="text-xs text-muted-foreground">Je kunt tussentijds opslaan. Voor de goedkeuringswachtrij moeten alle stappen groen zijn.</p>
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
              {campaigns.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (campaigns.data || []).length ? (
                (campaigns.data || []).map((campaign: any) => (
                  <div key={campaign.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground">{campaign.channelType} · {campaign.status}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={campaign.status === "ENABLED" || campaign.status === 2 ? "success" : "secondary"}>{String(campaign.status)}</Badge>
                      <Button size="sm" variant="outline" onClick={() => openGoogleCampaignAsDraft(asRecord(campaign))}>
                        <PencilLine className="mr-2 h-3.5 w-3.5" />
                        Bewerk als draft
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
                      : "Kies eerst een customer of koppel Google Ads opnieuw."
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
        <TabsContent value="settings"><Card><CardHeader><CardTitle>Google Ads instellingen</CardTitle><CardDescription>Selecteer exact één customer ID per workspace.</CardDescription></CardHeader><CardContent className="space-y-4"><Card className="border-amber-500/30 bg-amber-500/10"><CardContent className="flex gap-3 p-4 text-sm"><ShieldCheck className="mt-0.5 h-5 w-5 text-amber-700" /><div><p className="font-medium text-amber-950 dark:text-amber-100">Nieuwe campagnes worden gepauzeerd aangemaakt in Google Ads.</p><p className="text-amber-900/80 dark:text-amber-100/80">Live zetten doe je bewust in Google Ads.</p></div></CardContent></Card><div className="rounded-xl border p-3 text-sm"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">Google Ads module</p><p className="text-xs text-muted-foreground">Vereist om Push paused naar Google te gebruiken.</p></div><Switch checked={Boolean(connection.data?.autoadsEnabled)} disabled={setAutoadsEnabled.isPending} onCheckedChange={(enabled) => setAutoadsEnabled.mutate({ enabled })} /></div></div><div className="space-y-2"><Label>Beschikbare Google Ads customers</Label>{customers.isLoading ? <Skeleton className="h-20 w-full" /> : (customers.data || []).map((account: any) => (<div key={account.customerId} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{account.name}</p><p className="font-mono text-xs text-muted-foreground">{account.customerId} · {account.currency}</p></div><Button size="sm" variant={connection.data?.selectedCustomerId === account.customerId ? "secondary" : "default"} onClick={() => selectCustomer.mutate({ customerId: account.customerId, name: account.name, currency: account.currency, timezoneName: account.timezone })}>{connection.data?.selectedCustomerId === account.customerId ? "Geselecteerd" : "Selecteren"}</Button></div>))}{!(customers.data || []).length ? <EmptyState title="Geen customers gevonden" description="Koppel Google Ads met adwords-scope en controleer API-toegang." icon={<Search className="h-8 w-8" />} /> : null}</div></CardContent></Card></TabsContent>
      </Tabs>
      </div>
    </TooltipProvider>
  );
}
