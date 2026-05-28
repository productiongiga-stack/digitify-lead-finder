"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@digitify/ui";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Globe,
  MousePointerClick,
  ScanSearch,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
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

  const hostname = hostnameFromAudit(payload.url, title);
  const overallScore = metrics.overall;
  const overallTone = metricTone(overallScore);

  return (
    <div className="space-y-5">
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
              </div>
              {payload.url ? (
                <a
                  href={payload.url}
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

      <section className="audit-metrics-section" aria-label="Audit scores">
        <div className="audit-metrics-grid">
          <AuditMetricCard
            label="Totaal"
            value={metrics.overall}
            icon={Sparkles}
            accent="violet"
            featured
            hint="Gemiddelde van alle categorieën"
          />
          <AuditMetricCard label="Snelheid" value={metrics.speedScore} icon={Zap} accent="amber" />
          <AuditMetricCard label="SEO" value={metrics.seoScore} icon={Globe} accent="sky" />
          <AuditMetricCard label="Gebruik" value={metrics.uxScore} icon={MousePointerClick} accent="indigo" />
        </div>

        <div className="audit-metrics-secondary">
          <span className="audit-metrics-secondary-label">Ook</span>
          <AuditMetricPill label="Social" value={metrics.socialScore} />
          <AuditMetricPill label="Reviews" value={metrics.reviewScore} />
          <AuditMetricPill label="Contact" value={metrics.contactScore} />
          {checks.statusCode != null ? (
            <span
              className={cn(
                "audit-metric-pill",
                checks.statusCode >= 200 && checks.statusCode < 400
                  ? "audit-metric-pill-positive"
                  : "audit-metric-pill-negative",
              )}
            >
              <span className="opacity-80">HTTP</span>
              <span className="font-semibold">{checks.statusCode}</span>
            </span>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="app-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Technische check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <CheckRow ok={!!checks.ssl} label="SSL / HTTPS actief" />
            <CheckRow ok={!!checks.mobileFriendly} label="Mobielvriendelijk (viewport)" />
            <CheckRow
              ok={(checks.loadTimeMs ?? 99999) <= 2500}
              label={`Laadtijd ${checks.loadTimeMs ?? "—"} ms`}
            />
            <CheckRow ok={!!checks.seo?.hasMetaTitle} label="Meta title aanwezig" />
            <CheckRow ok={!!checks.seo?.hasMetaDescription} label="Meta description aanwezig" />
            <CheckRow ok={!!checks.seo?.hasH1} label="H1 aanwezig" />
            <CheckRow ok={!!checks.seo?.hasStructuredData} label="Structured data" />
            <CheckRow ok={!!checks.hasFavicon} label="Favicon" />
            <CheckRow ok={!!checks.hasAnalytics} label="Analytics geïnstalleerd" />
          </CardContent>
        </Card>

        <Card className="app-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Pagina&apos;s & interactie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {ux.pagesChecked ?? 0} pagina&apos;s gecontroleerd · {ux.pagesBroken ?? 0} met problemen ·{" "}
              {ux.linkCount ?? 0} links · {ux.buttonCount ?? 0} knoppen · {ux.formCount ?? 0} formulieren
            </p>
            {(ux.pageProbes ?? []).length > 0 ? (
              <ul className="max-h-48 space-y-1.5 overflow-y-auto text-xs">
                {(ux.pageProbes ?? []).map((probe) => (
                  <li
                    key={probe.url}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/50 px-2 py-1.5"
                  >
                    <span className="truncate font-mono">{probe.url.replace(/^https?:\/\//, "")}</span>
                    <Badge variant={probe.ok ? "outline" : "destructive"}>
                      {probe.statusCode || probe.error ? (probe.statusCode || "ERR") : "—"}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Geen paginacontrole uitgevoerd.</p>
            )}
            {ux.imagesMissingAlt != null && ux.imagesTotal != null && ux.imagesTotal > 0 ? (
              <p className="text-xs text-muted-foreground">
                Afbeeldingen: {ux.imagesTotal - (ux.imagesMissingAlt ?? 0)}/{ux.imagesTotal} met alt-tekst
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {(checks.metaTitle || checks.h1Text) && (
        <Card className="app-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Content snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {checks.metaTitle ? (
              <p>
                <span className="font-medium">Title:</span> {checks.metaTitle}
              </p>
            ) : null}
            {checks.metaDescription ? (
              <p>
                <span className="font-medium">Description:</span> {checks.metaDescription}
              </p>
            ) : null}
            {checks.h1Text ? (
              <p>
                <span className="font-medium">H1:</span> {checks.h1Text}
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      {(payload.technologies ?? []).length > 0 ? (
        <Card className="app-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Technologie</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {(payload.technologies ?? []).map((tech) => (
                <Badge key={tech} variant="secondary">
                  {tech}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="app-surface border-amber-200/80 dark:border-amber-900/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Aanbevelingen</CardTitle>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen kritieke verbeterpunten gevonden.</p>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {suggestions.map((item, i) => (
                <li key={`${i}-${item.slice(0, 24)}`}>{item}</li>
              ))}
            </ol>
          )}
          {(payload.errors ?? []).length > 0 ? (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {(payload.errors ?? []).join(" · ")}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
