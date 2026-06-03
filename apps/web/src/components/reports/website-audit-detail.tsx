"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Badge,
  Button,
  Progress,
} from "@digitify/ui";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Globe,
  Layers3,
  Lightbulb,
  Mail,
  MessageSquare,
  MousePointerClick,
  Phone,
  ScanSearch,
  Share2,
  Shield,
  Sparkles,
  Star,
  Target,
  Zap,
} from "lucide-react";
import { cn, safeExternalUrl } from "@/lib/utils";

export type WebsiteAuditPayload = {
  url?: string;
  checkedAt?: string;
  metrics?: {
    overall?: number;
    speedScore?: number;
    seoScore?: number;
    socialScore?: number;
    reviewScore?: number;
    contactScore?: number;
    uxScore?: number;
  };
  checks?: {
    statusCode?: number;
    ssl?: boolean;
    mobileFriendly?: boolean;
    loadTimeMs?: number;
    hasCTA?: boolean;
    hasFavicon?: boolean;
    hasAnalytics?: boolean;
    metaTitle?: string | null;
    metaDescription?: string | null;
    h1Text?: string | null;
    seo?: {
      hasMetaTitle?: boolean;
      hasMetaDescription?: boolean;
      hasH1?: boolean;
      hasStructuredData?: boolean;
    };
    ux?: {
      linkCount?: number;
      buttonCount?: number;
      formCount?: number;
      imagesTotal?: number;
      imagesMissingAlt?: number;
      pagesChecked?: number;
      pagesBroken?: number;
      pageProbes?: { url: string; statusCode: number; ok: boolean; error?: string }[];
    };
    reviews?: { rating: number | null; reviewCount: number | null; source?: string };
    contact?: { emails?: string[]; phones?: string[] };
    social?: Record<string, string | null>;
  };
  technologies?: string[];
  suggestions?: string[];
  errors?: string[];
};

const SCORE_WEIGHTS = [
  { key: "speedScore", label: "Snelheid", weight: 20, icon: Zap },
  { key: "seoScore", label: "SEO", weight: 20, icon: Globe },
  { key: "socialScore", label: "Social", weight: 10, icon: Share2 },
  { key: "reviewScore", label: "Reviews", weight: 15, icon: Star },
  { key: "contactScore", label: "Contact", weight: 15, icon: Phone },
  { key: "uxScore", label: "Gebruik (UX)", weight: 20, icon: MousePointerClick },
] as const;

type MetricTone = "positive" | "warning" | "negative" | "neutral";

function metricTone(score: number | undefined): MetricTone {
  if (score == null || Number.isNaN(score)) return "neutral";
  if (score >= 75) return "positive";
  if (score >= 50) return "warning";
  return "negative";
}

function hostnameFromAudit(url?: string, title?: string) {
  const raw = url?.trim() || title?.replace(/^Website audit:\s*/i, "").trim() || "";
  if (!raw) return "Website";
  try {
    const normalized = raw.startsWith("http") ? raw : `https://${raw}`;
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return raw.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] || "Website";
  }
}

function formatAuditDate(iso: string) {
  return new Date(iso).toLocaleString("nl-BE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function metricToneLabel(tone: MetricTone) {
  if (tone === "positive") return "Sterk";
  if (tone === "warning") return "Matig";
  if (tone === "negative") return "Zwak";
  return "—";
}

function loadTimeVerdict(ms: number | undefined) {
  if (ms == null) return { label: "Onbekend", tone: "neutral" as MetricTone };
  if (ms <= 1200) return { label: "Zeer snel", tone: "positive" as MetricTone };
  if (ms <= 2500) return { label: "Acceptabel", tone: "positive" as MetricTone };
  if (ms <= 4000) return { label: "Traag", tone: "warning" as MetricTone };
  return { label: "Te traag", tone: "negative" as MetricTone };
}

function metaLengthHint(text: string | null | undefined, min: number, max: number) {
  const len = text?.trim().length ?? 0;
  if (len === 0) return { len, ok: false, hint: "Ontbreekt" };
  if (len < min) return { len, ok: false, hint: `Te kort (richtlijn ${min}–${max})` };
  if (len > max) return { len, ok: false, hint: `Te lang (richtlijn ${min}–${max})` };
  return { len, ok: true, hint: "Lengte OK" };
}

function AuditScoreRing({ score, size = "md" }: { score: number; size?: "md" | "lg" }) {
  const tone = metricTone(score);
  const radius = size === "lg" ? 26 : 22;
  const viewSize = size === "lg" ? 64 : 56;
  const center = viewSize / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, score));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={cn(
        "audit-metric-ring",
        size === "lg" && "audit-metric-ring-lg",
        `audit-metric-tone-${tone}`,
      )}
      aria-label={`Score ${clamped} van 100`}
    >
      <div className="audit-metric-ring-halo" aria-hidden="true" />
      <svg
        className={cn("audit-metric-ring-svg", size === "lg" && "audit-metric-ring-svg-lg")}
        viewBox={`0 0 ${viewSize} ${viewSize}`}
      >
        <circle
          className="audit-metric-ring-track"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={size === "lg" ? 5 : 4}
        />
        <circle
          className="audit-metric-ring-progress"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={size === "lg" ? 5 : 4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <span className={cn("audit-metric-ring-label", size === "lg" && "audit-metric-ring-label-lg")}>
        {clamped}
      </span>
    </div>
  );
}

type AuditMetricAccent = "violet" | "amber" | "sky" | "indigo";

function AuditMetricCard({
  label,
  value,
  icon: Icon,
  accent,
  featured,
  hint,
}: {
  label: string;
  value: number | undefined;
  icon: LucideIcon;
  accent: AuditMetricAccent;
  featured?: boolean;
  hint?: string;
}) {
  const tone = metricTone(value);
  const displayValue = value ?? null;

  return (
    <article
      className={cn(
        "audit-metric-card",
        `audit-metric-card-accent-${accent}`,
        `audit-metric-tone-${tone}`,
        featured && "audit-metric-card-featured",
      )}
    >
      <div className="audit-metric-card-accent-bar" aria-hidden="true" />
      <div className="audit-metric-card-glow" aria-hidden="true" />
      <div className="audit-metric-card-inner">
        <div className="audit-metric-card-header">
          <div className="audit-metric-card-icon">
            <Icon className="h-4 w-4" />
          </div>
          <div className="audit-metric-card-copy">
            <p className="audit-metric-card-label">{label}</p>
            {displayValue != null ? (
              <span className={cn("audit-metric-tone-badge", `audit-metric-tone-badge-${tone}`)}>
                {hint ?? metricToneLabel(tone)}
              </span>
            ) : (
              <p className="audit-metric-card-hint">Niet gemeten</p>
            )}
          </div>
        </div>
        <div className="audit-metric-ring-wrap">
          {displayValue != null ? (
            <AuditScoreRing score={displayValue} size={featured ? "lg" : "md"} />
          ) : (
            <span className="text-2xl font-medium text-muted-foreground">—</span>
          )}
        </div>
      </div>
    </article>
  );
}

function AuditMetricPill({ label, value }: { label: string; value: number | undefined }) {
  const tone = metricTone(value);
  return (
    <span className={cn("audit-metric-pill", `audit-metric-pill-${tone}`)}>
      <span className="opacity-80">{label}</span>
      <span className="font-semibold">{value ?? "—"}</span>
    </span>
  );
}

function CheckRow({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border/50 bg-background/40 px-3 py-2.5">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      )}
      <div className="min-w-0">
        <p className={cn("text-sm font-medium", ok ? "text-foreground" : "text-foreground/90")}>{label}</p>
        {detail ? <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  );
}

function StatBar({ label, value, max, hint }: { label: string; value: number; max: number; hint?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {value}
          {hint ? ` · ${hint}` : ""}
        </span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

function ContentField({
  label,
  value,
  min,
  max,
}: {
  label: string;
  value: string | null | undefined;
  min: number;
  max: number;
}) {
  const meta = metaLengthHint(value, min, max);
  if (!value?.trim()) {
    return (
      <div className="rounded-xl border border-dashed border-amber-300/60 bg-amber-50/30 px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/20">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">Niet gevonden op de homepage</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <Badge variant={meta.ok ? "outline" : "warning"} className="text-[10px] font-normal">
          {meta.len} tekens · {meta.hint}
        </Badge>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground">{value}</p>
    </div>
  );
}

function AuditAccordionSection({
  id,
  title,
  subtitle,
  icon: Icon,
  badge,
  open,
  onOpenChange,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  badge?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <section id={id} className="audit-accordion overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-sm">
      <button
        type="button"
        className="audit-accordion-trigger flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/25 sm:px-5"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700 ring-1 ring-violet-500/15 dark:text-violet-300">
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold tracking-tight text-foreground sm:text-[15px]">{title}</p>
            {badge}
          </div>
          {subtitle && !open ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground sm:text-[13px]">{subtitle}</p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "audit-accordion-chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        className={cn(
          "audit-accordion-panel border-t border-border/50 px-4 pb-4 pt-3 sm:px-5 sm:pb-5",
          !open && "hidden print:block",
        )}
      >
        {children}
      </div>
    </section>
  );
}

function IssueCountBadge({ count }: { count: number }) {
  if (count <= 0) {
    return (
      <Badge variant="outline" className="border-emerald-200/80 bg-emerald-50/50 text-[10px] font-medium text-emerald-800 dark:text-emerald-200">
        Alles OK
      </Badge>
    );
  }
  return (
    <Badge variant="warning" className="text-[10px] font-medium">
      {count} aandachtspunt{count !== 1 ? "en" : ""}
    </Badge>
  );
}

export function WebsiteAuditDetail({
  payload,
  title,
  createdAt,
  leadId,
}: {
  payload: WebsiteAuditPayload;
  title: string;
  createdAt: string;
  leadId?: string | null;
}) {
  const metrics = payload.metrics ?? {};
  const checks = payload.checks ?? {};
  const ux = checks.ux ?? {};
  const suggestions = payload.suggestions ?? [];
  const socialEntries = Object.entries(checks.social ?? {}).filter(([, url]) => Boolean(url?.trim()));
  const auditUrl = safeExternalUrl(payload.url);
  const emails = checks.contact?.emails ?? [];
  const phones = checks.contact?.phones ?? [];

  const hostname = hostnameFromAudit(payload.url, title);
  const overallScore = metrics.overall;
  const overallTone = metricTone(overallScore);
  const loadVerdict = loadTimeVerdict(checks.loadTimeMs);

  const technicalIssues = useMemo(() => {
    let n = 0;
    if (!checks.ssl) n++;
    if (!checks.mobileFriendly) n++;
    if ((checks.loadTimeMs ?? 99999) > 2500) n++;
    if (!checks.seo?.hasMetaTitle) n++;
    if (!checks.seo?.hasMetaDescription) n++;
    if (!checks.seo?.hasH1) n++;
    if (!checks.seo?.hasStructuredData) n++;
    if (!checks.hasFavicon) n++;
    if (!checks.hasAnalytics) n++;
    if (!checks.hasCTA) n++;
    if (checks.statusCode != null && checks.statusCode >= 400) n++;
    return n;
  }, [checks]);

  const sectionIds = useMemo(
    () =>
      [
        "audit-scores",
        "audit-technical",
        "audit-seo",
        "audit-ux",
        "audit-trust",
        ...((payload.technologies ?? []).length > 0 ? ["audit-tech"] : []),
        "audit-actions",
      ] as const,
    [payload.technologies],
  );

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => ({
    "audit-scores": true,
    "audit-technical": false,
    "audit-seo": false,
    "audit-ux": false,
    "audit-trust": false,
    "audit-tech": false,
    "audit-actions": true,
  }));

  const setSectionOpen = (id: string, open: boolean) => {
    setOpenSections((prev) => ({ ...prev, [id]: open }));
  };

  const setAllSections = (open: boolean) => {
    setOpenSections((prev) => {
      const next = { ...prev };
      for (const id of sectionIds) next[id] = open;
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <header className="audit-report-hero">
        <div className="audit-report-hero-glow" aria-hidden="true" />
        <div className="audit-report-hero-body">
          <div className="audit-report-hero-main">
            <div className="audit-report-hero-icon">
              <Globe className="h-6 w-6" />
            </div>
            <div className="audit-report-hero-copy">
              <p className="audit-report-hero-eyebrow">Website audit</p>
              <h1 className="audit-report-hero-title">{hostname}</h1>
              <div className="audit-report-hero-meta">
                <span className="audit-report-hero-chip">
                  <Calendar className="h-3.5 w-3.5" />
                  Rapport {formatAuditDate(createdAt)}
                </span>
                {payload.checkedAt ? (
                  <span className="audit-report-hero-chip">
                    <ScanSearch className="h-3.5 w-3.5" />
                    Scan {formatAuditDate(payload.checkedAt)}
                  </span>
                ) : null}
                {checks.statusCode != null ? (
                  <span
                    className={cn(
                      "audit-report-hero-chip",
                      checks.statusCode >= 200 && checks.statusCode < 400
                        ? "audit-report-hero-chip-ok"
                        : "audit-report-hero-chip-warn",
                    )}
                  >
                    HTTP {checks.statusCode}
                  </span>
                ) : null}
                {overallScore != null ? (
                  <span
                    className={cn(
                      "audit-report-hero-chip",
                      overallTone === "positive" && "audit-report-hero-chip-ok",
                      overallTone === "negative" && "audit-report-hero-chip-warn",
                    )}
                  >
                    Score {overallScore}/100
                  </span>
                ) : null}
              </div>
              {auditUrl ? (
                <a
                  href={auditUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="audit-report-hero-url"
                >
                  <span className="truncate">{payload.url}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
              ) : null}
            </div>
          </div>
          <div className="audit-report-hero-aside">
            {overallScore != null ? (
              <div
                className={cn("audit-report-hero-score", `audit-report-hero-score-${overallTone}`)}
                aria-label={`Totaalscore ${overallScore}`}
              >
                <span className="audit-report-hero-score-value">{overallScore}</span>
                <span className="audit-report-hero-score-label">Totaal</span>
              </div>
            ) : null}
            {leadId ? (
              <Button asChild size="sm" variant="outline" className="audit-report-hero-action">
                <Link href={`/leads/${leadId}`}>Gekoppelde lead</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-xs text-muted-foreground">
          Klik op een sectie om details te tonen. Bij print worden alle secties uitgevouwen.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setAllSections(true)}>
            <ChevronDown className="mr-1.5 h-3.5 w-3.5" />
            Alles open
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setAllSections(false)}>
            <ChevronUp className="mr-1.5 h-3.5 w-3.5" />
            Alles dicht
          </Button>
        </div>
      </div>

      <AuditAccordionSection
        id="audit-scores"
        title="Scores & samenvatting"
        subtitle={
          overallScore != null
            ? `Totaalscore ${overallScore} — gewogen over snelheid, SEO, social, reviews, contact en UX`
            : "Overzicht van alle scores"
        }
        icon={Sparkles}
        open={openSections["audit-scores"] ?? true}
        onOpenChange={(v) => setSectionOpen("audit-scores", v)}
        badge={<IssueCountBadge count={suggestions.length} />}
      >
        <section className="audit-metrics-section" aria-label="Audit scores">
          <div className="audit-metrics-grid">
            <AuditMetricCard
              label="Totaal"
              value={metrics.overall}
              icon={Sparkles}
              accent="violet"
              featured
              hint="Gewogen gemiddelde"
            />
            <AuditMetricCard label="Snelheid" value={metrics.speedScore} icon={Zap} accent="amber" />
            <AuditMetricCard label="SEO" value={metrics.seoScore} icon={Globe} accent="sky" />
            <AuditMetricCard label="Gebruik" value={metrics.uxScore} icon={MousePointerClick} accent="indigo" />
          </div>
          <div className="audit-metrics-secondary">
            <span className="audit-metrics-secondary-label">Ook gemeten</span>
            <AuditMetricPill label="Social" value={metrics.socialScore} />
            <AuditMetricPill label="Reviews" value={metrics.reviewScore} />
            <AuditMetricPill label="Contact" value={metrics.contactScore} />
          </div>
        </section>

        <div className="mt-4 rounded-xl border border-border/60 bg-muted/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hoe de totaalscore wordt berekend</p>
          <ul className="mt-3 space-y-2">
            {SCORE_WEIGHTS.map((row) => {
              const score = metrics[row.key as keyof typeof metrics] as number | undefined;
              const Icon = row.icon;
              return (
                <li key={row.key} className="flex items-center gap-3 text-sm">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-[5.5rem] font-medium">{row.label}</span>
                  <div className="flex-1">
                    <Progress value={score ?? 0} className="h-1.5" />
                  </div>
                  <span className="w-8 text-right tabular-nums text-muted-foreground">{score ?? "—"}</span>
                  <span className="w-10 text-right text-xs text-muted-foreground">{row.weight}%</span>
                </li>
              );
            })}
          </ul>
        </div>

        {suggestions.length > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-200/60 bg-amber-50/25 p-4 dark:border-amber-900/40 dark:bg-amber-950/15">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-950 dark:text-amber-100">
              <Lightbulb className="h-4 w-4" />
              Top prioriteiten
            </p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
              {suggestions.slice(0, 3).map((item, i) => (
                <li key={`prio-${i}`}>{item}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </AuditAccordionSection>

      <AuditAccordionSection
        id="audit-technical"
        title="Techniek & performance"
        subtitle={`Laadtijd ${checks.loadTimeMs ?? "—"} ms · ${loadVerdict.label}`}
        icon={Zap}
        open={openSections["audit-technical"] ?? false}
        onOpenChange={(v) => setSectionOpen("audit-technical", v)}
        badge={<IssueCountBadge count={technicalIssues} />}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <CheckRow ok={!!checks.ssl} label="SSL / HTTPS actief" detail="Beveiligde verbinding voor bezoekers en SEO" />
          <CheckRow
            ok={(checks.loadTimeMs ?? 99999) <= 2500}
            label={`Laadtijd: ${checks.loadTimeMs ?? "—"} ms`}
            detail={`Richtlijn: onder 2,5 s · ${loadVerdict.label}`}
          />
          <CheckRow ok={!!checks.mobileFriendly} label="Mobielvriendelijk (viewport)" detail="Site schaalt correct op smartphones" />
          <CheckRow
            ok={checks.statusCode != null && checks.statusCode >= 200 && checks.statusCode < 400}
            label={`HTTP-status: ${checks.statusCode ?? "—"}`}
            detail="Homepage bereikbaar voor crawlers en bezoekers"
          />
          <CheckRow ok={!!checks.hasFavicon} label="Favicon aanwezig" />
          <CheckRow ok={!!checks.hasAnalytics} label="Analytics geïnstalleerd" detail="Bv. GA4 of vergelijkbaar meetpunt" />
        </div>
      </AuditAccordionSection>

      <AuditAccordionSection
        id="audit-seo"
        title="SEO & content"
        subtitle={[checks.metaTitle, checks.h1Text].filter(Boolean).length ? "Meta en koppen geanalyseerd" : "Content op homepage"
        }
        icon={FileText}
        open={openSections["audit-seo"] ?? false}
        onOpenChange={(v) => setSectionOpen("audit-seo", v)}
        badge={
          <IssueCountBadge
            count={
              [!checks.seo?.hasMetaTitle, !checks.seo?.hasMetaDescription, !checks.seo?.hasH1, !checks.seo?.hasStructuredData].filter(
                Boolean,
              ).length
            }
          />
        }
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <CheckRow ok={!!checks.seo?.hasMetaTitle} label="Meta title aanwezig" />
          <CheckRow ok={!!checks.seo?.hasMetaDescription} label="Meta description aanwezig" />
          <CheckRow ok={!!checks.seo?.hasH1} label="H1 aanwezig" />
          <CheckRow ok={!!checks.seo?.hasStructuredData} label="Structured data (schema.org)" />
        </div>
        <div className="mt-4 space-y-3">
          <ContentField label="Meta title" value={checks.metaTitle} min={30} max={60} />
          <ContentField label="Meta description" value={checks.metaDescription} min={120} max={160} />
          <ContentField label="H1" value={checks.h1Text} min={20} max={70} />
        </div>
      </AuditAccordionSection>

      <AuditAccordionSection
        id="audit-ux"
        title="Pagina's & gebruikservaring"
        subtitle={`${ux.pagesChecked ?? 0} pagina's · ${ux.pagesBroken ?? 0} problemen · ${ux.linkCount ?? 0} links`}
        icon={Shield}
        open={openSections["audit-ux"] ?? false}
        onOpenChange={(v) => setSectionOpen("audit-ux", v)}
        badge={<IssueCountBadge count={(ux.pagesBroken ?? 0) + ((ux.imagesMissingAlt ?? 0) > 0 ? 1 : 0)} />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Interactie</p>
            <StatBar label="Interne links" value={ux.linkCount ?? 0} max={Math.max(ux.linkCount ?? 0, 50)} />
            <StatBar label="Knoppen / CTA's" value={ux.buttonCount ?? 0} max={Math.max(ux.buttonCount ?? 0, 10)} />
            <StatBar label="Formulieren" value={ux.formCount ?? 0} max={Math.max(ux.formCount ?? 0, 5)} />
            <CheckRow ok={!!checks.hasCTA} label="Primaire call-to-action zichtbaar" />
          </div>
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Afbeeldingen</p>
            {ux.imagesTotal != null && ux.imagesTotal > 0 ? (
              <>
                <StatBar
                  label="Met alt-tekst"
                  value={ux.imagesTotal - (ux.imagesMissingAlt ?? 0)}
                  max={ux.imagesTotal}
                  hint={`${ux.imagesMissingAlt ?? 0} zonder alt`}
                />
                {(ux.imagesMissingAlt ?? 0) > 0 ? (
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Vul alt-teksten in voor betere toegankelijkheid en SEO.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Geen afbeeldingen geteld op de homepage.</p>
            )}
          </div>
        </div>
        {(ux.pageProbes ?? []).length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gecontroleerde pagina&apos;s</p>
            <ul className="max-h-56 space-y-1.5 overflow-y-auto">
              {(ux.pageProbes ?? []).map((probe) => (
                <li
                  key={probe.url}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-xs"
                >
                  <span className="truncate font-mono">{probe.url.replace(/^https?:\/\//, "")}</span>
                  <Badge variant={probe.ok ? "outline" : "destructive"}>
                    {probe.statusCode || probe.error || "ERR"}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Geen diepere paginacontrole uitgevoerd.</p>
        )}
      </AuditAccordionSection>

      <AuditAccordionSection
        id="audit-trust"
        title="Contact, social & reviews"
        subtitle={`${emails.length} e-mail · ${phones.length} telefoon · ${socialEntries.length} social`}
        icon={Target}
        open={openSections["audit-trust"] ?? false}
        onOpenChange={(v) => setSectionOpen("audit-trust", v)}
        badge={<IssueCountBadge count={[emails.length === 0, phones.length === 0, socialEntries.length < 2].filter(Boolean).length} />}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              E-mail
            </p>
            {emails.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm">
                {emails.map((e) => (
                  <li key={e}>
                    <a href={`mailto:${e}`} className="text-primary hover:underline">
                      {e}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Geen e-mailadres gevonden op de site.</p>
            )}
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              Telefoon
            </p>
            {phones.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm">
                {phones.map((p) => (
                  <li key={p}>
                    <a href={`tel:${p.replace(/\s/g, "")}`} className="text-primary hover:underline">
                      {p}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Geen telefoonnummer gevonden.</p>
            )}
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Star className="h-3.5 w-3.5" />
              Reviews
            </p>
            {checks.reviews?.rating != null ? (
              <p className="mt-2 text-sm">
                <span className="font-semibold text-foreground">{checks.reviews.rating.toFixed(1)}</span>
                <span className="text-muted-foreground"> / 5</span>
                {checks.reviews.reviewCount != null ? (
                  <span className="text-muted-foreground"> · {checks.reviews.reviewCount} reviews</span>
                ) : null}
                {checks.reviews.source ? (
                  <span className="text-muted-foreground"> ({checks.reviews.source})</span>
                ) : null}
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Geen reviewdata gekoppeld aan deze scan.</p>
            )}
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-border/60 bg-muted/10 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Share2 className="h-3.5 w-3.5" />
            Social profielen
          </p>
          {socialEntries.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {socialEntries.map(([network, url]) => {
                const safeUrl = safeExternalUrl(url);
                return (
                <li key={network} className="flex items-center justify-between gap-2 text-sm">
                  <span className="capitalize text-muted-foreground">{network}</span>
                  {safeUrl ? (
                    <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline">
                      {url}
                    </a>
                  ) : (
                    <span className="truncate text-muted-foreground">{url}</span>
                  )}
                </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Geen actieve social links gedetecteerd.</p>
          )}
        </div>
      </AuditAccordionSection>

      {(payload.technologies ?? []).length > 0 ? (
        <AuditAccordionSection
          id="audit-tech"
          title="Technologie-stack"
          subtitle={(payload.technologies ?? []).slice(0, 4).join(", ")}
          icon={Layers3}
          open={openSections["audit-tech"] ?? false}
          onOpenChange={(v) => setSectionOpen("audit-tech", v)}
          badge={
            <Badge variant="secondary" className="text-[10px] font-normal">
              {(payload.technologies ?? []).length} gedetecteerd
            </Badge>
          }
        >
          <div className="flex flex-wrap gap-2">
            {(payload.technologies ?? []).map((tech) => (
              <Badge key={tech} variant="secondary" className="px-2.5 py-1 text-xs">
                {tech}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Gebaseerd op scripts, headers en HTML-patronen. Handig om integraties en onderhoudsrisico&apos;s in te schatten.
          </p>
        </AuditAccordionSection>
      ) : null}

      <AuditAccordionSection
        id="audit-actions"
        title="Actieplan & aanbevelingen"
        subtitle={
          suggestions.length > 0
            ? `${suggestions.length} concrete verbeterstappen`
            : "Geen kritieke punten — site scoort goed"
        }
        icon={Lightbulb}
        open={openSections["audit-actions"] ?? true}
        onOpenChange={(v) => setSectionOpen("audit-actions", v)}
        badge={<IssueCountBadge count={suggestions.length} />}
      >
        {suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Geen kritieke verbeterpunten gevonden. Blijf scores monitoren na content- of designwijzigingen.
          </p>
        ) : (
          <ol className="space-y-3">
            {suggestions.map((item, i) => (
              <li
                key={`${i}-${item.slice(0, 24)}`}
                className="flex gap-3 rounded-xl border border-amber-200/50 bg-amber-50/20 px-3 py-3 dark:border-amber-900/35 dark:bg-amber-950/15"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-900 dark:text-amber-100">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed text-foreground">{item}</p>
              </li>
            ))}
          </ol>
        )}
        {(payload.errors ?? []).length > 0 ? (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <p className="font-semibold">Scanfouten</p>
            <p className="mt-1">{(payload.errors ?? []).join(" · ")}</p>
          </div>
        ) : null}
      </AuditAccordionSection>
    </div>
  );
}
