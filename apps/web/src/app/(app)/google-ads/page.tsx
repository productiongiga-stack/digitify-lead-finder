"use client";

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
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
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  HelpCircle,
  Layers,
  Megaphone,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Lock,
  PauseCircle,
  RefreshCcw,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  XCircle,
} from "lucide-react";
import { useToast } from "@/components/feedback/toast-provider";

type PlanStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "PUSHING" | "PUSHED_PAUSED" | "FAILED" | "CANCELLED";
type CampaignType = "SEARCH" | "PERFORMANCE_MAX";
type BuilderStep = "setup" | "creative" | "targeting" | "review";
type MatchType = "BROAD" | "PHRASE" | "EXACT";
type BiddingStrategy = "MAXIMIZE_CONVERSIONS" | "MAXIMIZE_CONVERSION_VALUE" | "MANUAL_CPC";

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
  { value: "BE", label: "Belgie", geo: "geoTargetConstants/2056", languages: "languageConstants/1010" },
  { value: "NL", label: "Nederland", geo: "geoTargetConstants/2528", languages: "languageConstants/1013" },
  { value: "BE_NL", label: "Belgie + Nederland", geo: "geoTargetConstants/2056\ngeoTargetConstants/2528", languages: "languageConstants/1010\nlanguageConstants/1013" },
] as const;

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

function WizardSection({
  title,
  description,
  icon: Icon,
  badge,
  children,
}: {
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/50">
      <div className="flex items-start gap-3 border-b border-border/50 bg-muted/30 px-4 py-3">
        {Icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-border/60">
            <Icon className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
            {badge}
          </div>
          {description ? <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className="space-y-4 p-4">{children}</div>
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

function AssetUploadCard(props: {
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
    <div className="rounded-2xl border p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <HelpLabel label={props.title} help={props.help} />
          <p className="mt-1 text-xs text-muted-foreground">Ratio: {props.ratio} · Aanbevolen: {props.recommended}</p>
          <p className="mt-1 text-xs text-muted-foreground">Gedetecteerd: {probeLabel(probe)}</p>
        </div>
        <label className="inline-flex cursor-pointer items-center">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
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
      {props.title === "Landscape image" ? (
        <p className="mt-2 text-xs text-muted-foreground">{roughlyMatches(aspectRatio(probe), 1.91, 0.14) ? "Ratio ziet er goed uit voor landscape." : probe.status === "ready" ? "Controleer of deze visual echt breed genoeg is voor landscape placements." : ""}</p>
      ) : null}
      {props.title === "Square image" ? (
        <p className="mt-2 text-xs text-muted-foreground">{roughlyMatches(aspectRatio(probe), 1, 0.08) ? "Ratio ziet er goed uit voor square." : probe.status === "ready" ? "Deze asset lijkt niet perfect 1:1." : ""}</p>
      ) : null}
      {props.title === "Portrait image" ? (
        <p className="mt-2 text-xs text-muted-foreground">{roughlyMatches(aspectRatio(probe), 4 / 5, 0.08) ? "Ratio ziet er goed uit voor portrait." : probe.status === "ready" ? "Controleer of deze asset dicht genoeg bij 4:5 zit." : ""}</p>
      ) : null}
      {props.title === "Logo" ? (
        <p className="mt-2 text-xs text-muted-foreground">{roughlyMatches(aspectRatio(probe), 1, 0.08) ? "Logo lijkt mooi vierkant." : probe.status === "ready" ? "Google werkt meestal het best met een vierkant logo." : ""}</p>
      ) : null}
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

function SearchPreview(props: { finalUrl: string; headlines: string[]; descriptions: string[]; path1: string; path2: string; keywords: string[]; headlinePin1: string; descriptionPin1: string }) {
  const domain = props.finalUrl.replace(/^https?:\/\//, "").split("/")[0] || "leads.digitify.be";
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

function PerformanceMaxPreview(props: { finalUrl: string; headlines: string[]; longHeadlines: string[]; descriptions: string[]; imageUrl: string; squareImageUrl: string; portraitImageUrl: string; logoUrl: string; businessName: string; callToAction: string }) {
  return (
    <Card className="overflow-hidden border-slate-200 bg-gradient-to-br from-orange-50 via-white to-lime-50 shadow-sm dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Eye className="h-4 w-4" /> Performance Max preview</CardTitle><CardDescription>Indicatief asset group voorbeeld. Google mixt dit over Search, Display, YouTube, Gmail, Discover en Maps.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-3xl border bg-white shadow-sm dark:bg-slate-950">
          {props.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.imageUrl} alt="Performance Max landscape preview" className="aspect-[1.91/1] w-full object-cover" />
          ) : (
            <div className="flex aspect-[1.91/1] items-center justify-center bg-slate-100 text-muted-foreground dark:bg-slate-900"><ImageIcon className="mr-2 h-5 w-5" /> Landscape marketing image</div>
          )}
          <div className="p-4">
            <div className="flex items-center gap-2">
              {props.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={props.logoUrl} alt="Logo" className="h-8 w-8 rounded-lg object-cover" />
              ) : <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">D</div>}
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{props.businessName || "Digitify"}</p>
            </div>
            <h3 className="mt-3 text-xl font-semibold leading-tight">{props.longHeadlines[0] || props.headlines[0] || "Meer kwalitatieve leads"}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{props.descriptions[0] || "Beschrijving van de campagne."}</p>
            <Button className="mt-4" size="sm">{props.callToAction || "Meer informatie"}</Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border bg-white dark:bg-slate-950">
            {props.squareImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={props.squareImageUrl} alt="Square preview" className="aspect-square w-full object-cover" />
            ) : <div className="flex aspect-square items-center justify-center text-xs text-muted-foreground">Square 1:1 image</div>}
          </div>
          <div className="overflow-hidden rounded-2xl border bg-white dark:bg-slate-950">
            {props.portraitImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={props.portraitImageUrl} alt="Portrait preview" className="aspect-[4/5] w-full object-cover" />
            ) : <div className="flex aspect-[4/5] items-center justify-center text-xs text-muted-foreground">Portrait 4:5 optional</div>}
          </div>
        </div>
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
  const [adsTab, setAdsTab] = useState("dashboard");
  const [approvalFilter, setApprovalFilter] = useState<"ALL" | PlanStatus>("ALL");
  const [name, setName] = useState("Digitify lead campagne");
  const [campaignType, setCampaignType] = useState<CampaignType>("SEARCH");
  const [currency, setCurrency] = useState("EUR");
  const [dailyBudget, setDailyBudget] = useState("2500");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [biddingStrategy, setBiddingStrategy] = useState<BiddingStrategy>("MAXIMIZE_CONVERSIONS");
  const [targetCpaCents, setTargetCpaCents] = useState("");
  const [targetRoas, setTargetRoas] = useState("");
  const [conversionAction, setConversionAction] = useState("");
  const [trackingTemplate, setTrackingTemplate] = useState("");
  const [finalUrlSuffix, setFinalUrlSuffix] = useState("utm_source=google&utm_medium=cpc&utm_campaign={campaignid}");
  const [product, setProduct] = useState("Lead generation voor lokale bedrijven");
  const [audience, setAudience] = useState("Belgische KMO-eigenaars en zaakvoerders");
  const [aiTone, setAiTone] = useState("professioneel");
  const [finalUrl, setFinalUrl] = useState("https://leads.digitify.be");
  const [headlinesText, setHeadlinesText] = useState("Meer kwalitatieve leads\nDigitify lead generation\nVraag vandaag een demo\nMeer leads, minder giswerk\nBoek een gratis audit");
  const [longHeadlinesText, setLongHeadlinesText] = useState("Ontdek hoe Digitify meer kwalitatieve leads vindt voor Belgische KMO's");
  const [descriptionsText, setDescriptionsText] = useState("Automatiseer leadgeneratie voor Belgische KMO's.\nCampagne wordt veilig als gepauzeerd aangemaakt.\nKrijg inzicht in prospects, opvolging en conversies.");
  const [headlinePin1, setHeadlinePin1] = useState("");
  const [descriptionPin1, setDescriptionPin1] = useState("");
  const [businessName, setBusinessName] = useState("Digitify");
  const [path1, setPath1] = useState("leads");
  const [path2, setPath2] = useState("demo");
  const [imageUrl, setImageUrl] = useState("");
  const [squareImageUrl, setSquareImageUrl] = useState("");
  const [portraitImageUrl, setPortraitImageUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [callToAction, setCallToAction] = useState("Meer informatie");
  const [assetGroupName, setAssetGroupName] = useState("Lead generation asset group");
  const [brandGuidelinesEnabled, setBrandGuidelinesEnabled] = useState(false);
  const [finalUrlExpansion, setFinalUrlExpansion] = useState(false);
  const [keywordsText, setKeywordsText] = useState("lead generatie belgie\ndigitify leads\nmeer b2b leads");
  const [negativeKeywordsText, setNegativeKeywordsText] = useState("gratis jobs\nopleiding");
  const [matchType, setMatchType] = useState<MatchType>("PHRASE");
  const [adGroupName, setAdGroupName] = useState("Lead generation zoekwoorden");
  const [geoTargets, setGeoTargets] = useState("geoTargetConstants/2056");
  const [languages, setLanguages] = useState("languageConstants/1010");
  const [locationPreset, setLocationPreset] = useState("BE");
  const [audienceSignalsText, setAudienceSignalsText] = useState("KMO eigenaar\nMarketing manager\nZaakvoerder\nLeadgeneratie tools");
  const [searchPartners, setSearchPartners] = useState(true);
  const [displayExpansion, setDisplayExpansion] = useState(false);
  const [advancedCreativeJson, setAdvancedCreativeJson] = useState("{}");
  const [advancedTargetingJson, setAdvancedTargetingJson] = useState("{}");
  const [uploadingAsset, setUploadingAsset] = useState<string | null>(null);

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
  const selectedPlan = rows.find((row: any) => row.id === selectedPlanId) || (selectedPlanId ? null : rows[0]) || null;
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
  const dailyBudgetEuros = numberValue(dailyBudget) / 100;

  function goToBuilderStep(step: BuilderStep) {
    if (canOpenStep(step)) setActiveStep(step);
  }

  function goToAdjacentBuilderStep(direction: -1 | 1) {
    const next = BUILDER_STEP_ORDER[activeStepIndex + direction];
    if (next && canOpenStep(next)) setActiveStep(next);
  }

  useEffect(() => {
    if (!selectedPlan || selectedPlan.id === loadedPlanId) return;
    const creative = asRecord(selectedPlan.creatives);
    const targeting = asRecord(selectedPlan.targeting);
    const campaignSettings = asRecord(targeting.campaignSettings);
    setName(selectedPlan.name || name);
    setCampaignType((selectedPlan.campaignType || "SEARCH") as CampaignType);
    setCurrency(selectedPlan.currency || "EUR");
    setDailyBudget(String(selectedPlan.dailyBudgetCents || 2500));
    setStartTime(selectedPlan.startTime ? new Date(selectedPlan.startTime).toISOString().slice(0, 16) : "");
    setEndTime(selectedPlan.endTime ? new Date(selectedPlan.endTime).toISOString().slice(0, 16) : "");
    setBiddingStrategy((campaignSettings.biddingStrategy || creative.biddingStrategy || "MAXIMIZE_CONVERSIONS") as BiddingStrategy);
    setTargetCpaCents(String(campaignSettings.targetCpaCents || ""));
    setTargetRoas(String(campaignSettings.targetRoas || ""));
    setConversionAction(String(campaignSettings.conversionAction || ""));
    setTrackingTemplate(String(campaignSettings.trackingTemplate || ""));
    setFinalUrlSuffix(String(campaignSettings.finalUrlSuffix || "utm_source=google&utm_medium=cpc&utm_campaign={campaignid}"));
    setFinalUrl(String(creative.finalUrl || creative.linkUrl || finalUrl));
    setHeadlinesText(listToLines(creative.headlines || creative.headline, ["Meer kwalitatieve leads", "Digitify lead generation", "Vraag vandaag een demo"]));
    setLongHeadlinesText(listToLines(creative.longHeadlines || creative.longHeadline, ["Ontdek hoe Digitify meer kwalitatieve leads vindt voor Belgische KMO's"]));
    setDescriptionsText(listToLines(creative.descriptions || creative.description, ["Automatiseer leadgeneratie voor Belgische KMO's.", "Campagne wordt veilig als gepauzeerd aangemaakt."]));
    setHeadlinePin1(String(creative.headlinePin1 || ""));
    setDescriptionPin1(String(creative.descriptionPin1 || ""));
    setImageUrl(String(creative.imageUrl || creative.marketingImageUrl || ""));
    setSquareImageUrl(String(creative.squareImageUrl || creative.squareMarketingImageUrl || ""));
    setPortraitImageUrl(String(creative.portraitImageUrl || ""));
    setLogoUrl(String(creative.logoUrl || ""));
    setBusinessName(String(creative.businessName || businessName));
    setCallToAction(String(creative.callToAction || "Meer informatie"));
    setAssetGroupName(String(creative.assetGroupName || "Lead generation asset group"));
    setBrandGuidelinesEnabled(Boolean(creative.brandGuidelinesEnabled));
    setFinalUrlExpansion(Boolean(creative.finalUrlExpansion));
    setPath1(String(creative.path1 || path1));
    setPath2(String(creative.path2 || path2));
    setKeywordsText(listToLines(targeting.keywords, ["lead generatie belgie", "digitify leads"]));
    setNegativeKeywordsText(listToLines(targeting.negativeKeywords, ["gratis jobs", "opleiding"]));
    setMatchType((targeting.matchType || "PHRASE") as MatchType);
    setAdGroupName(String(targeting.adGroupName || "Lead generation zoekwoorden"));
    setGeoTargets(listToLines(targeting.geoTargetConstants, ["geoTargetConstants/2056"]));
    setLanguages(listToLines(targeting.languageConstants, ["languageConstants/1010"]));
    const preset = LOCATION_PRESETS.find((item) => item.geo === listToLines(targeting.geoTargetConstants, ["geoTargetConstants/2056"]) && item.languages === listToLines(targeting.languageConstants, ["languageConstants/1010"]));
    setLocationPreset(preset?.value || "CUSTOM");
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
    onSuccess: async (row: any) => {
      setSelectedPlanId(row.id);
      setLoadedPlanId(null);
      await invalidate();
      showToast({ title: "Google Ads draft aangemaakt" });
    },
    onError: (error) => showToast({ title: "Draft mislukt", description: explainGoogleError(error.message)?.message || error.message, variant: "error" }),
  });
  const updateDraft = trpc.googleAds.updateDraft.useMutation({
    onSuccess: async () => {
      await invalidate();
      showToast({ title: "Draft opgeslagen" });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: explainGoogleError(error.message)?.message || error.message, variant: "error" }),
  });
  const generateSuggestion = trpc.googleAds.generateSuggestion.useMutation({
    onSuccess: (payload: any) => {
      const creative = asRecord(payload.creatives);
      const targeting = asRecord(payload.targeting);
      setName(payload.name || name);
      if (payload.campaignType) setCampaignType(payload.campaignType);
      if (creative.finalUrl) setFinalUrl(String(creative.finalUrl));
      if (creative.headlines) setHeadlinesText(listToLines(creative.headlines, headlines));
      if (creative.longHeadlines) setLongHeadlinesText(listToLines(creative.longHeadlines, longHeadlines));
      if (creative.descriptions) setDescriptionsText(listToLines(creative.descriptions, descriptions));
      if (targeting.keywords) setKeywordsText(listToLines(targeting.keywords, keywords));
      if (targeting.geoTargetConstants) setGeoTargets(listToLines(targeting.geoTargetConstants, ["geoTargetConstants/2056"]));
      if (targeting.languageConstants) setLanguages(listToLines(targeting.languageConstants, ["languageConstants/1010"]));
      setActiveStep("creative");
      showToast({ title: "AI draftvoorstel gegenereerd" });
    },
    onError: (error) => showToast({ title: "Suggestie mislukt", description: error.message, variant: "error" }),
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

  async function uploadAsset(slot: "landscape" | "square" | "portrait" | "logo", file: File) {
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
        geoTargetConstants: csvToList(geoTargets).length ? csvToList(geoTargets) : ["geoTargetConstants/2056"],
        languageConstants: csvToList(languages).length ? csvToList(languages) : ["languageConstants/1010"],
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

      {!connection.data?.hasDeveloperToken ? (
        <div className="overflow-hidden rounded-2xl border border-amber-200/70 bg-card/90 shadow-sm backdrop-blur-sm dark:border-amber-900/50">
          <div className="border-b border-amber-200/50 bg-gradient-to-r from-amber-50/90 via-amber-50/40 to-transparent px-5 py-3 dark:border-amber-900/40 dark:from-amber-950/40">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                <KeyRound className="h-4 w-4" />
              </div>
              <p className="font-semibold tracking-tight text-amber-950 dark:text-amber-50">Developer token ontbreekt</p>
              <Badge variant="outline" className="border-amber-300/60 bg-white/60 text-[11px] font-normal text-amber-900 dark:bg-white/5 dark:text-amber-100">
                API-setup
              </Badge>
            </div>
          </div>
          <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-3">
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Zonder developer token kan de app niet met de Google Ads API praten. Voeg de variabele toe lokaal en op Vercel.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-amber-100/80 bg-amber-50/30 px-3 py-2.5 dark:border-amber-900/30 dark:bg-amber-950/20">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-800/80 dark:text-amber-200/80">Variabele</p>
                  <p className="mt-1 break-all font-mono text-xs font-medium text-foreground">GOOGLE_ADS_DEVELOPER_TOKEN</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">In <span className="font-mono">.env</span> en Vercel project settings</p>
                </div>
                <div className="rounded-xl border bg-muted/20 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Toegang</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Controleer in het Google Ads API Center of je token <span className="font-medium text-foreground">Basic</span> of{" "}
                    <span className="font-medium text-foreground">Standard</span> access heeft.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col lg:min-w-[200px]">
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
          </div>
        </div>
      ) : null}
      {!connection.data?.autoadsEnabled ? (
        <div className="overflow-hidden rounded-2xl border border-emerald-200/70 bg-card/90 shadow-sm backdrop-blur-sm dark:border-emerald-900/50">
          <div className="border-b border-emerald-200/50 bg-gradient-to-r from-emerald-50/90 via-emerald-50/40 to-transparent px-5 py-3 dark:border-emerald-900/40 dark:from-emerald-950/40">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <PauseCircle className="h-4 w-4" />
              </div>
              <p className="font-semibold tracking-tight text-emerald-950 dark:text-emerald-50">Google Ads module staat uit</p>
              <Badge variant="outline" className="border-emerald-300/60 bg-white/60 text-[11px] font-normal text-emerald-900 dark:bg-white/5 dark:text-emerald-100">
                Alleen lokaal
              </Badge>
            </div>
          </div>
          <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-3">
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Drafts, wizard en approval blijven beschikbaar. Push naar Google Ads vereist dat je de module inschakelt.
              </p>
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
                    Goedgekeurde campagnes pushen als{" "}
                    <span className="font-medium text-foreground">paused</span> — live zetten doe je in Google Ads.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col lg:min-w-[200px]">
              <Button type="button" className="bg-emerald-700 hover:bg-emerald-800" onClick={() => setAdsTab("settings")}>
                <Settings2 className="mr-2 h-4 w-4" />
                Module inschakelen
              </Button>
              <Button variant="outline" className="border-emerald-200/80 bg-background/80" asChild>
                <Link href="/settings/integrations">Google-koppeling</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Koppeling</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex items-center gap-2">{connection.data?.connected ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />} Google OAuth</div><div className="font-mono text-xs text-muted-foreground">{connection.data?.selectedCustomerName || connection.data?.selectedCustomerId || connection.data?.accountEmail || "Geen customer geselecteerd"}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Budget guard</CardTitle></CardHeader><CardContent className="text-sm">Max per campagne: <span className="font-semibold">{eur(connection.data?.maxDailyBudgetCents, connection.data?.defaultCurrency || "EUR")}</span></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Laatste 30 dagen</CardTitle></CardHeader><CardContent className="text-sm">Spend: <span className="font-semibold">{new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(totalSpend)}</span> · Clicks: <span className="font-semibold">{totalClicks}</span> · Conv: <span className="font-semibold">{totalConversions}</span></CardContent></Card>
      </div>

      <Tabs value={adsTab} onValueChange={setAdsTab} className="space-y-4">
        <TabsList className="flex w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="dashboard">Campagne-wizard</TabsTrigger>
          <TabsTrigger value="queue" className="gap-2">
            Goedkeuring
            {pendingApprovalCount > 0 ? (
              <Badge variant="warning" className="h-5 min-w-5 justify-center px-1.5 text-[10px]">
                {pendingApprovalCount}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="campaigns">Live campagnes</TabsTrigger>
          <TabsTrigger value="drafts" className="gap-2">
            Drafts
            {rows.length > 0 ? (
              <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5 text-[10px]">
                {rows.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="insights">Prestaties</TabsTrigger>
          <TabsTrigger value="settings">Instellingen</TabsTrigger>
        </TabsList>
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
                    <WizardSection title="Campagne" description="Naam en campagnetype — overeenkomstig met de eerste stap in Google Ads." icon={Megaphone}>
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
                          <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
                        </div>
                      </div>
                    </WizardSection>

                    <WizardSection title="Budget en planning" description="Dagbudget en optionele start- of einddatum." icon={CalendarDays}>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <HelpLabel label="Dagbudget" help="Het bedrag dat Google maximaal per dag mag uitgeven. Minimum €1,00 per dag." />
                          <div className="relative">
                            <Input
                              type="number"
                              min="1"
                              step="0.01"
                              value={Number.isFinite(dailyBudgetEuros) ? dailyBudgetEuros : ""}
                              onChange={(e) => setDailyBudget(String(Math.max(100, Math.round(Number(e.target.value) * 100))))}
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

                    <WizardSection title="Bieden" description="Biedstrategie op campagneniveau — zoals in Google Ads onder 'Bieden'." icon={Target}>
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
                          <HelpLabel label="Conversieactie (optioneel)" help="Alleen invullen als je een specifieke Google-conversieactie wil koppelen." />
                          <Input value={conversionAction} onChange={(e) => setConversionAction(e.target.value)} placeholder="customers/.../conversionActions/..." className="font-mono text-xs" />
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
                            <Input value={product} onChange={(e) => setProduct(e.target.value)} />
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
                            <Input value={audience} onChange={(e) => setAudience(e.target.value)} />
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
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="space-y-2">
                            <HelpLabel label="Headlines (1 per regel)" help="Google Ads: min. 3, max. 15 headlines · max. 30 tekens elk." />
                            <Textarea className="min-h-44 font-mono text-sm" value={headlinesText} onChange={(e) => setHeadlinesText(e.target.value)} placeholder={"Meer kwalitatieve leads\nDigitify lead generation\nVraag vandaag een demo"} />
                            <AssetTextHint lines={headlines} maxChars={30} label="headlines" />
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Descriptions (1 per regel)" help="Google Ads: min. 2 descriptions · max. 90 tekens elk." />
                            <Textarea className="min-h-44 font-mono text-sm" value={descriptionsText} onChange={(e) => setDescriptionsText(e.target.value)} />
                            <AssetTextHint lines={descriptions} maxChars={90} label="descriptions" />
                          </div>
                        </div>
                        {campaignType === "PERFORMANCE_MAX" ? (
                          <div className="space-y-2">
                            <HelpLabel label="Long headlines (1 per regel)" help="Verplicht voor PMax · max. 90 tekens." />
                            <Textarea className="min-h-28 font-mono text-sm" value={longHeadlinesText} onChange={(e) => setLongHeadlinesText(e.target.value)} />
                            <AssetTextHint lines={longHeadlines} maxChars={90} label="long headlines" />
                          </div>
                        ) : (
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
                        )}
                      </div>
                    </WizardSection>

                    {campaignType === "PERFORMANCE_MAX" ? (
                      <WizardSection title="Asset group — beelden & merk" description="Afbeeldingen, logo en bedrijfsnaam voor Performance Max." icon={ImageIcon}>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2 sm:col-span-2">
                            <HelpLabel label="Naam asset group" help="Interne structuur in Google — vergelijkbaar met een ad group-naam." />
                            <Input value={assetGroupName} onChange={(e) => setAssetGroupName(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Bedrijfsnaam" help="Max. 25 tekens in Google Ads." />
                            <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={25} />
                            <p className="text-xs text-muted-foreground">{businessName.trim().length}/25 tekens</p>
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Call-to-action" help="Knoptekst in preview; Google kan variëren per placement." />
                            <Select value={callToAction} onValueChange={setCallToAction}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {CTA_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>{option}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <AssetUploadCard title="Landscape (1.91:1)" help="Hoofdbeeld voor brede placements." ratio="1.91:1" recommended="1200×628" value={imageUrl} placeholder="URL of upload" uploading={uploadingAsset === "landscape"} onChange={setImageUrl} onUpload={(file) => uploadAsset("landscape", file)} />
                          <AssetUploadCard title="Square (1:1)" help="Verplicht vierkant marketingbeeld." ratio="1:1" recommended="1200×1200" value={squareImageUrl} placeholder="URL of upload" uploading={uploadingAsset === "square"} onChange={setSquareImageUrl} onUpload={(file) => uploadAsset("square", file)} />
                          <AssetUploadCard title="Portrait (4:5)" help="Optioneel, aanbevolen voor mobiel." ratio="4:5" recommended="960×1200" value={portraitImageUrl} placeholder="URL of upload" uploading={uploadingAsset === "portrait"} onChange={setPortraitImageUrl} onUpload={(file) => uploadAsset("portrait", file)} />
                          <AssetUploadCard title="Logo (1:1)" help="Vierkant logo voor PMax." ratio="1:1" recommended="1200×1200" value={logoUrl} placeholder="URL of upload" uploading={uploadingAsset === "logo"} onChange={setLogoUrl} onUpload={(file) => uploadAsset("logo", file)} />
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="flex items-center justify-between rounded-xl border bg-background/80 p-3">
                            <div>
                              <p className="text-sm font-medium">Brand guidelines</p>
                              <p className="text-xs text-muted-foreground">Uit laten in v1 (minder verplichte assets).</p>
                            </div>
                            <Switch checked={brandGuidelinesEnabled} onCheckedChange={setBrandGuidelinesEnabled} />
                          </div>
                          <div className="flex items-center justify-between rounded-xl border bg-background/80 p-3">
                            <div>
                              <p className="text-sm font-medium">Final URL expansion</p>
                              <p className="text-xs text-muted-foreground">Google mag andere pagina&apos;s op je domein gebruiken.</p>
                            </div>
                            <Switch checked={finalUrlExpansion} onCheckedChange={setFinalUrlExpansion} />
                          </div>
                        </div>
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
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <HelpLabel label="Regio-preset" help="Vult geo- en taalconstants in zoals in de Google Ads-locatietargeting." />
                          <Select
                            value={locationPreset}
                            onValueChange={(value) => {
                              setLocationPreset(value);
                              const preset = LOCATION_PRESETS.find((item) => item.value === value);
                              if (preset) {
                                setGeoTargets(preset.geo);
                                setLanguages(preset.languages);
                              }
                            }}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {LOCATION_PRESETS.map((preset) => (
                                <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
                              ))}
                              <SelectItem value="CUSTOM">Aangepast</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <HelpLabel label="Geo targets" help="Één resource per regel, bijv. geoTargetConstants/2056 (België)." />
                          <Textarea className="min-h-28 font-mono text-xs" value={geoTargets} onChange={(e) => { setGeoTargets(e.target.value); setLocationPreset("CUSTOM"); }} />
                        </div>
                      </div>
                    </WizardSection>

                    <WizardSection title="Talen" description="Taal van gebruikers die je advertentie zien." icon={Layers}>
                      <div className="space-y-2">
                        <HelpLabel label="Taalconstants" help="Bijv. languageConstants/1010 = Nederlands. Één per regel." />
                        <Textarea className="min-h-24 font-mono text-xs" value={languages} onChange={(e) => { setLanguages(e.target.value); setLocationPreset("CUSTOM"); }} />
                      </div>
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
                      <WizardSection title="Advertentiegroep & zoekwoorden" description="Ad group, match type en keywordlijst — kern van Search-campagnes." icon={Search}>
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="space-y-2">
                            <HelpLabel label="Naam advertentiegroep" help="Structuur in Google Ads onder je campagne." />
                            <Input value={adGroupName} onChange={(e) => setAdGroupName(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Matchtype (standaard)" help="Geldt voor alle keywords in deze draft." />
                            <Select value={matchType} onValueChange={(value) => setMatchType(value as MatchType)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PHRASE">Phrase match</SelectItem>
                                <SelectItem value="EXACT">Exact match</SelectItem>
                                <SelectItem value="BROAD">Broad match</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Zoekwoorden (1 per regel)" help="Gebruik koopintentie; vermijd te brede termen." />
                            <Textarea className="min-h-40 font-mono text-sm" value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} placeholder={"lead generatie belgië\ndigitify demo"} />
                            <p className="text-xs text-muted-foreground">{keywords.length} keyword(s)</p>
                          </div>
                          <div className="space-y-2">
                            <HelpLabel label="Uitsluitende zoekwoorden" help="Negatieve keywords op campagne-/ad group-niveau." />
                            <Textarea className="min-h-40 font-mono text-sm" value={negativeKeywordsText} onChange={(e) => setNegativeKeywordsText(e.target.value)} placeholder={"gratis\nvacature"} />
                            <p className="text-xs text-muted-foreground">{negativeKeywords.length} uitgesloten</p>
                          </div>
                        </div>
                      </WizardSection>
                    ) : (
                      <WizardSection title="Doelgroepsignalen (PMax)" description="Richtinggevende signalen — geen harde targeting zoals in Search." icon={Target}>
                        <div className="space-y-2">
                          <HelpLabel label="Signalen / thema's (1 per regel)" help="Functies, interesses of marktsegmenten waar Google op mag sturen." />
                          <Textarea className="min-h-40" value={audienceSignalsText} onChange={(e) => setAudienceSignalsText(e.target.value)} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Opgeslagen in de draft. Volledige audience lists in Google Ads koppel je later in het account.
                        </p>
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

                    <WizardSection title="Samenvatting" description="Controleer of alles klopt vóór opslaan en approval." icon={Eye}>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <ReviewRow label="Campagne" value={name || "—"} />
                        <ReviewRow label="Type" value={campaignType === "SEARCH" ? "Zoekcampagne" : "Performance Max"} />
                        <ReviewRow label="Dagbudget" value={eur(numberValue(dailyBudget), currency)} />
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
                    <Button onClick={() => generateSuggestion.mutate({ product, audience, campaignType, tone: aiTone })} variant="outline" size="sm" disabled={generateSuggestion.isPending}>
                      {generateSuggestion.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      AI voorstel
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
              {campaignType === "PERFORMANCE_MAX" ? <PerformanceMaxPreview finalUrl={finalUrl} headlines={headlines} longHeadlines={longHeadlines} descriptions={descriptions} imageUrl={imageUrl} squareImageUrl={squareImageUrl} portraitImageUrl={portraitImageUrl} logoUrl={logoUrl} businessName={businessName} callToAction={callToAction} /> : <SearchPreview finalUrl={finalUrl} headlines={headlines} descriptions={descriptions} path1={path1} path2={path2} keywords={keywords} headlinePin1={headlinePin1} descriptionPin1={descriptionPin1} />}
              <Card>
                <CardHeader><CardTitle>Google Ads-vereisten</CardTitle><CardDescription>Minimale assets zoals in het echte Google Ads-scherm.</CardDescription></CardHeader>
                <CardContent className="grid gap-3">
                  <CheckRow ok={headlines.length >= 3} label="Headlines" hint="Minstens 3 nodig. Meer variatie geeft Google betere combinaties." />
                  <CheckRow ok={descriptions.length >= 2} label="Descriptions" hint="Minstens 2 nodig. Zorg voor duidelijke value proposition en CTA." />
                  <CheckRow ok={campaignType === "SEARCH" || Boolean(imageUrl && squareImageUrl && logoUrl && businessName.trim() && !brandGuidelinesEnabled)} label="PMax visuals" hint="Voor Performance Max: landscape, square, logo, business name en brand guidelines uit zijn nodig in v1." />
                  <CheckRow ok={finalUrl.startsWith("https://")} label="Landing page" hint="Gebruik een publieke https URL die snel laadt en inhoudelijk past bij je advertentie." />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Operationele checks</CardTitle><CardDescription>Wat nog moet kloppen voor een echte push naar Google.</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  {operationalRequirements.length ? operationalRequirements.map((requirement) => (
                    <div key={requirement.code} className="rounded-xl border bg-card p-3">
                      <p className="font-medium">{requirement.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{requirement.description}</p>
                      <p className="mt-2 text-xs font-medium">{requirement.nextStep}</p>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">Geen blokkades gedetecteerd.</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="queue">{queueContent}</TabsContent>

        <TabsContent value="campaigns"><Card><CardHeader><CardTitle>Google campagnes</CardTitle><CardDescription>Campagnes uit het geselecteerde Google Ads customer account.</CardDescription></CardHeader><CardContent className="space-y-3">{campaigns.isLoading ? <Skeleton className="h-32 w-full" /> : (campaigns.data || []).length ? (campaigns.data || []).map((campaign: any) => (<div key={campaign.id} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{campaign.name}</p><p className="text-xs text-muted-foreground">{campaign.channelType} · {campaign.status}</p></div><Badge variant={campaign.status === "ENABLED" || campaign.status === 2 ? "success" : "secondary"}>{String(campaign.status)}</Badge></div>)) : <EmptyState title="Geen campagnes geladen" description="Kies eerst een customer of koppel Google Ads opnieuw." icon={<Search className="h-8 w-8" />} />}</CardContent></Card></TabsContent>
        <TabsContent value="drafts"><Card><CardHeader><CardTitle>Alle drafts</CardTitle><CardDescription>Interne plannen met approval- en push-status.</CardDescription></CardHeader><CardContent className="space-y-3">{rows.map((row: any) => <div key={row.id} className="rounded-xl border p-4"><div className="flex items-center justify-between"><p className="font-medium">{row.name}</p>{statusBadge(row.status)}</div><p className="mt-1 text-sm text-muted-foreground">{row.campaignType} · {eur(row.dailyBudgetCents, row.currency)} · {prettyDate(row.createdAt)}</p><ErrorHint raw={row.lastError} /></div>)}{!rows.length ? <EmptyState title="Geen drafts" description="Je drafts verschijnen hier zodra je er een opslaat." icon={<Save className="h-8 w-8" />} /> : null}</CardContent></Card></TabsContent>
        <TabsContent value="insights"><Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Insights</CardTitle><CardDescription>Campaign-level performance van de laatste 30 dagen.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 md:grid-cols-4"><div className="rounded-xl border bg-muted/30 p-3 text-sm"><p className="text-xs uppercase text-muted-foreground">Campaigns</p><p className="text-2xl font-semibold">{(insights.data || []).length}</p></div><div className="rounded-xl border bg-muted/30 p-3 text-sm"><p className="text-xs uppercase text-muted-foreground">CTR</p><p className="text-2xl font-semibold">{insightCoach.ctr.toFixed(2)}%</p></div><div className="rounded-xl border bg-muted/30 p-3 text-sm"><p className="text-xs uppercase text-muted-foreground">Gem. CPC</p><p className="text-2xl font-semibold">€{insightCoach.cpc.toFixed(2)}</p></div><div className="rounded-xl border bg-muted/30 p-3 text-sm"><p className="text-xs uppercase text-muted-foreground">Conversies</p><p className="text-2xl font-semibold">{totalConversions}</p></div></div><Card className="border-primary/20 bg-primary/5"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" /> AI coach</CardTitle><CardDescription>Praktische interpretatie van de huidige Google Ads resultaten.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm">{insightCoach.tips.map((tip) => <p key={tip} className="rounded-xl border bg-card px-3 py-2">{tip}</p>)}</CardContent></Card>{(insights.data || []).map((row: any) => <div key={row.campaign_id || row.campaign_name} className="grid gap-2 rounded-xl border p-3 text-sm md:grid-cols-6"><div className="font-medium">{row.campaign_name || row.campaign_id}</div><div>Impressies: {row.impressions || 0}</div><div>Clicks: {row.clicks || 0}</div><div>CTR: {Number(row.ctr || 0).toFixed(2)}%</div><div>CPC: €{Number(row.cpc || 0).toFixed(2)}</div><div>Conv: {row.conversions || 0} · Spend: €{row.spend || 0}</div></div>)}{!(insights.data || []).length ? <EmptyState title="Geen inzichten" description="Google geeft nog geen data terug voor dit account of deze periode." icon={<BarChart3 className="h-8 w-8" />} /> : null}</CardContent></Card></TabsContent>
        <TabsContent value="settings"><Card><CardHeader><CardTitle>Google Ads instellingen</CardTitle><CardDescription>Selecteer exact één customer ID per workspace.</CardDescription></CardHeader><CardContent className="space-y-4"><Card className="border-amber-500/30 bg-amber-500/10"><CardContent className="flex gap-3 p-4 text-sm"><ShieldCheck className="mt-0.5 h-5 w-5 text-amber-700" /><div><p className="font-medium text-amber-950 dark:text-amber-100">Nieuwe campagnes worden gepauzeerd aangemaakt in Google Ads.</p><p className="text-amber-900/80 dark:text-amber-100/80">Live zetten doe je bewust in Google Ads.</p></div></CardContent></Card><div className="rounded-xl border p-3 text-sm"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">Google Ads module</p><p className="text-xs text-muted-foreground">Vereist om Push paused naar Google te gebruiken.</p></div><Switch checked={Boolean(connection.data?.autoadsEnabled)} disabled={setAutoadsEnabled.isPending} onCheckedChange={(enabled) => setAutoadsEnabled.mutate({ enabled })} /></div></div><div className="space-y-2"><Label>Beschikbare Google Ads customers</Label>{customers.isLoading ? <Skeleton className="h-20 w-full" /> : (customers.data || []).map((account: any) => (<div key={account.customerId} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{account.name}</p><p className="font-mono text-xs text-muted-foreground">{account.customerId} · {account.currency}</p></div><Button size="sm" variant={connection.data?.selectedCustomerId === account.customerId ? "secondary" : "default"} onClick={() => selectCustomer.mutate({ customerId: account.customerId, name: account.name, currency: account.currency, timezoneName: account.timezone })}>{connection.data?.selectedCustomerId === account.customerId ? "Geselecteerd" : "Selecteren"}</Button></div>))}{!(customers.data || []).length ? <EmptyState title="Geen customers gevonden" description="Koppel Google Ads met adwords-scope en controleer API-toegang." icon={<Search className="h-8 w-8" />} /> : null}</div></CardContent></Card></TabsContent>
      </Tabs>
      </div>
    </TooltipProvider>
  );
}
