"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Copy,
  ExternalLink,
  Gauge,
  Globe2,
  Lightbulb,
  ListChecks,
  Mail,
  MousePointerClick,
  Phone,
  RefreshCcw,
  Shield,
  ShieldOff,
  TimerReset,
  TrendingUp,
  Users,
} from "lucide-react";
import { DomainStatsCards, type DomainStatItem } from "@/components/domains/domain-stats-cards";
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@digitify/ui";
import { trpc } from "@/lib/trpc/client";
import { getAppUrl } from "@/lib/config";
import { useToast } from "@/components/feedback/toast-provider";

type AnalysisResult = {
  statusCode?: number;
  loadTimeMs?: number;
  hasSSL?: boolean;
  isMobileFriendly?: boolean;
  hasMetaTitle?: boolean;
  metaTitle?: string | null;
  hasMetaDescription?: boolean;
  metaDescription?: string | null;
  hasH1?: boolean;
  h1Text?: string | null;
  hasStructuredData?: boolean;
  hasFavicon?: boolean;
  hasAnalytics?: boolean;
  hasCTA?: boolean;
  contentLength?: number;
  lastModified?: string | null;
  socialLinks?: Record<string, string | null>;
  technologies?: string[];
  contactInfo?: { emails: string[]; phones: string[] };
  errors?: string[];
};

type TrackerResult = {
  summary?: {
    pageviews?: number;
    uniqueVisitors?: number;
    lastSeen?: string | null;
  };
  pages?: Array<{ url: string; title: string; count: number; lastSeen: string }>;
  referrers?: Array<{ source: string; count: number }>;
  devices?: Array<{ type: string; count: number }>;
  browsers?: Array<{ name: string; count: number }>;
  visitors?: Array<{ id: string; count: number; lastSeen: string; pageUrl: string; browser: string; deviceType: string }>;
};

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("nl-BE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default function DomainDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.domain.getById.useQuery({ id }, { refetchInterval: 60_000 });
  const analyzeMutation = trpc.domain.analyzeDomain.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.domain.getById.invalidate({ id }),
        utils.domain.list.invalidate(),
        utils.dashboard.getDomainMonitor.invalidate(),
      ]);
      showToast({ title: "Analyse vernieuwd", description: "De domeininfo is opnieuw opgehaald." });
    },
    onError: (error) =>
      showToast({ title: "Analyse mislukt", description: error.message, variant: "error" }),
  });

  const analysis = data?.lead?.enrichmentData.find((item) => item.source === "domain_analysis")?.data as AnalysisResult | undefined;
  const tracker = data?.lead?.enrichmentData.find((item) => item.source === `website_tracker:${data?.id}`)?.data as TrackerResult | undefined;
  const trackerCode = data ? `<script async src="${getAppUrl()}/tracker.js?domain=${data.id}"></script>` : "";
  const websiteStatus =
    analysis?.statusCode === undefined
      ? "Onbekend"
      : analysis.statusCode >= 200 && analysis.statusCode < 400
        ? analysis.loadTimeMs && analysis.loadTimeMs > 3000
          ? "Traag"
          : "Online"
        : "Offline";
  const healthScore = (() => {
    if (!analysis) return 0;
    let score = 100;
    if ((analysis.statusCode || 0) >= 400 || (analysis.statusCode || 0) < 200) score -= 35;
    if ((analysis.loadTimeMs || 0) > 3500) score -= 18;
    else if ((analysis.loadTimeMs || 0) > 2200) score -= 10;
    if (!analysis.hasSSL) score -= 14;
    if (!analysis.isMobileFriendly) score -= 10;
    if (!analysis.hasMetaTitle) score -= 6;
    if (!analysis.hasMetaDescription) score -= 6;
    if (!analysis.hasH1) score -= 5;
    if (!analysis.hasStructuredData) score -= 4;
    if (!analysis.hasCTA) score -= 5;
    return clampScore(score);
  })();
  const opportunities = [
    !analysis?.hasMetaTitle ? "Meta title ontbreekt of is zwak. Optimaliseer title per pagina." : null,
    !analysis?.hasMetaDescription ? "Meta beschrijving ontbreekt. Voeg converterende snippet toe." : null,
    !analysis?.hasH1 ? "Geen H1 gevonden. Voorzie duidelijke primaire heading." : null,
    !analysis?.isMobileFriendly ? "Mobielvriendelijkheid verbeteren voor hogere conversie op smartphone." : null,
    !analysis?.hasCTA ? "Voeg een duidelijke CTA toe op de homepage." : null,
    (analysis?.loadTimeMs || 0) > 2500 ? "Laadtijd is hoog. Optimaliseer afbeeldingen en scripts." : null,
    !analysis?.hasStructuredData ? "Structured data ontbreekt. Voeg schema.org markup toe." : null,
    !analysis?.hasAnalytics ? "Analytics detectie ontbreekt. Meet verkeer en conversies." : null,
  ].filter((item): item is string => Boolean(item));

  const domainStatItems = useMemo<DomainStatItem[]>(() => {
    const loadMs = analysis?.loadTimeMs;
    const loadLabel =
      loadMs === undefined
        ? "—"
        : loadMs >= 1000
          ? `${(loadMs / 1000).toFixed(1)}s`
          : `${Math.round(loadMs)}ms`;

    const websiteTone: DomainStatItem["tone"] =
      websiteStatus === "Online"
        ? "positive"
        : websiteStatus === "Traag"
          ? "warning"
          : websiteStatus === "Offline"
            ? "negative"
            : "neutral";

    const loadTone: DomainStatItem["tone"] =
      loadMs === undefined ? "neutral" : loadMs > 3500 ? "negative" : loadMs > 2200 ? "warning" : "positive";

    const healthTone: DomainStatItem["tone"] =
      healthScore >= 80 ? "positive" : healthScore >= 60 ? "warning" : healthScore > 0 ? "negative" : "neutral";

    const visitors = tracker?.summary?.uniqueVisitors ?? 0;
    const pageviews = tracker?.summary?.pageviews ?? 0;
    const lastSeen = tracker?.summary?.lastSeen;

    const hasAnalysis =
      analysis != null &&
      (analysis.statusCode !== undefined ||
        analysis.loadTimeMs !== undefined ||
        analysis.hasSSL !== undefined);

    return [
      {
        label: "Website",
        value: websiteStatus,
        icon: <Globe2 />,
        accent: "sky",
        tone: websiteTone,
        valueVariant: "text",
        empty: !hasAnalysis,
        hint: hasAnalysis ? `HTTP ${analysis?.statusCode}` : "Analyseer opnieuw",
      },
      {
        label: "Laadtijd",
        value: loadLabel,
        icon: <Gauge />,
        accent: "amber",
        tone: loadTone,
        empty: loadMs === undefined,
        hint:
          loadMs === undefined
            ? "Live refresh elke minuut"
            : loadMs > 2500
              ? "Boven 2,5s"
              : "Snel genoeg",
      },
      {
        label: "Health score",
        value: hasAnalysis ? `${healthScore}/100` : "—",
        icon: <Activity />,
        accent: "violet",
        tone: healthTone,
        progress: hasAnalysis ? healthScore : undefined,
        empty: !hasAnalysis,
        hint: hasAnalysis
          ? healthScore >= 80
            ? "Sterke basis"
            : healthScore >= 60
              ? "Verbeterbaar"
              : "Acties nodig"
          : "Na eerste analyse",
      },
      {
        label: "Bezoekers",
        value: visitors,
        icon: <Users />,
        accent: "indigo",
        tone: visitors > 0 ? "info" : "neutral",
        empty: false,
        hint: `${pageviews} pageview${pageviews !== 1 ? "s" : ""}`,
      },
      {
        label: "Laatste hit",
        value: lastSeen ? formatDate(lastSeen) : "—",
        icon: <MousePointerClick />,
        accent: "teal",
        tone: lastSeen ? "info" : "neutral",
        valueVariant: "date",
        empty: !lastSeen,
        hint: data?.lead?.companyName ? data.lead.companyName : "Geen gekoppelde lead",
      },
    ];
  }, [
    analysis,
    data?.lead?.companyName,
    healthScore,
    tracker?.summary?.lastSeen,
    tracker?.summary?.pageviews,
    tracker?.summary?.uniqueVisitors,
    websiteStatus,
  ]);

  const trafficStatItems = useMemo<DomainStatItem[]>(() => {
    const visitors = tracker?.summary?.uniqueVisitors ?? 0;
    const pageviews = tracker?.summary?.pageviews ?? 0;
    const lastSeen = tracker?.summary?.lastSeen;
    const hasAnalysis =
      analysis != null &&
      (analysis.statusCode !== undefined ||
        analysis.loadTimeMs !== undefined ||
        analysis.hasSSL !== undefined);
    const healthTone: DomainStatItem["tone"] =
      healthScore >= 80 ? "positive" : healthScore >= 60 ? "warning" : healthScore > 0 ? "negative" : "neutral";

    return [
      {
        label: "Unieke bezoekers",
        value: visitors,
        icon: <Users />,
        accent: "indigo",
        tone: visitors > 0 ? "info" : "neutral",
        hint: `${pageviews} pageview${pageviews !== 1 ? "s" : ""} totaal`,
      },
      {
        label: "Laatste bezoek",
        value: lastSeen ? formatDate(lastSeen) : "—",
        icon: <MousePointerClick />,
        accent: "teal",
        tone: lastSeen ? "info" : "neutral",
        valueVariant: "date",
        empty: !lastSeen,
        hint: lastSeen ? "Laatste tracker-hit" : "Realtime na plaatsen tracker",
      },
      {
        label: "Gezondheid",
        value: hasAnalysis ? `${healthScore}/100` : "—",
        icon: <Activity />,
        accent: "violet",
        tone: healthTone,
        progress: hasAnalysis ? healthScore : undefined,
        empty: !hasAnalysis,
        hint: hasAnalysis
          ? "Uptime, SEO, snelheid & basics"
          : "Eerst domein analyseren",
      },
    ];
  }, [analysis, healthScore, tracker?.summary?.lastSeen, tracker?.summary?.pageviews, tracker?.summary?.uniqueVisitors]);

  async function copyTrackerCode() {
    if (!trackerCode) return;
    await navigator.clipboard.writeText(trackerCode);
    showToast({ title: "Tracker gekopieerd", description: "De embed-code staat op je klembord." });
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-56" />
        <div className="domain-stats-grid">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[5.75rem] rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Link href="/domains" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Terug naar domeinen
        </Link>
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Dit domein bestaat niet of is niet meer beschikbaar.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/domains" className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Terug naar domeinen
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">{data.domainName}</h1>
            <Badge variant={data.sslStatus === "VALID" ? "success" : "secondary"}>
              {data.sslStatus === "VALID" ? "SSL geldig" : "SSL nakijken"}
            </Badge>
            <Badge variant={websiteStatus === "Online" ? "success" : websiteStatus === "Traag" ? "warning" : "secondary"}>
              {websiteStatus}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Detailanalyse, trackerdata en live status voor dit domein.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copyTrackerCode}>
            <Copy className="mr-2 h-4 w-4" />
            Kopieer tracker
          </Button>
          <Button variant="outline" onClick={() => analyzeMutation.mutate({ domainName: data.domainName })} disabled={analyzeMutation.isPending}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${analyzeMutation.isPending ? "animate-spin" : ""}`} />
            Analyseer opnieuw
          </Button>
          <a
            href={`https://${data.domainName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open website
          </a>
        </div>
      </div>

      <DomainStatsCards items={domainStatItems} />

      <Tabs defaultValue="analysis" className="space-y-4">
        <TabsList className="settings-domain-tabs settings-domain-tabs-cols-3 w-full max-w-2xl">
          <TabsTrigger value="analysis" className="settings-domain-tab">
            <BarChart3 className="settings-domain-tab-icon" aria-hidden />
            <span>Analyse</span>
          </TabsTrigger>
          <TabsTrigger value="traffic" className="settings-domain-tab">
            <TrendingUp className="settings-domain-tab-icon" aria-hidden />
            <span>Verkeer</span>
          </TabsTrigger>
          <TabsTrigger value="actions" className="settings-domain-tab">
            <ListChecks className="settings-domain-tab-icon" aria-hidden />
            <span>Acties</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe2 className="h-4 w-4" />
              Website analyse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Meta titel</p>
                <p className="mt-2 text-sm">{analysis?.metaTitle || "Niet gevonden"}</p>
              </div>
              <div className="rounded-2xl border p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">H1</p>
                <p className="mt-2 text-sm">{analysis?.h1Text || "Niet gevonden"}</p>
              </div>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Meta beschrijving</p>
              <p className="mt-2 text-sm text-muted-foreground">{analysis?.metaDescription || "Niet gevonden"}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {analysis?.hasSSL ? <Shield className="h-4 w-4 text-emerald-600" /> : <ShieldOff className="h-4 w-4 text-red-600" />}
                  SSL
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{analysis?.hasSSL ? "Beveiligde verbinding gevonden" : "Geen SSL gevonden"}</p>
              </div>
              <div className="rounded-2xl border p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <TimerReset className="h-4 w-4 text-primary" />
                  Mobiel
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {analysis?.isMobileFriendly ? "Mobielvriendelijke layout gedetecteerd" : "Mobiele ervaring vraagt aandacht"}
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Gauge className="h-4 w-4 text-primary" />
                  Technische checks
                </p>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <p>{analysis?.hasStructuredData ? "Structured data gevonden" : "Structured data ontbreekt"}</p>
                  <p>{analysis?.hasAnalytics ? "Analytics script gevonden" : "Geen analytics detectie"}</p>
                  <p>{analysis?.hasFavicon ? "Favicon aanwezig" : "Favicon ontbreekt"}</p>
                  <p>{analysis?.hasCTA ? "CTA element gevonden" : "Geen duidelijke CTA gedetecteerd"}</p>
                </div>
              </div>
              <div className="rounded-2xl border p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Activity className="h-4 w-4 text-primary" />
                  Content signalen
                </p>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <p>Inhoudslengte: {analysis?.contentLength ? `${analysis.contentLength} karakters` : "-"}</p>
                  <p>Laatst gewijzigd: {formatDate(analysis?.lastModified)}</p>
                  <p>HTTP status: {analysis?.statusCode ? `HTTP ${analysis.statusCode}` : "-"}</p>
                </div>
              </div>
            </div>
            {analysis?.contactInfo?.emails?.length || analysis?.contactInfo?.phones?.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border p-4">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Mail className="h-4 w-4 text-primary" />
                    Gevonden e-mails
                  </p>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {(analysis.contactInfo?.emails || []).slice(0, 4).map((email) => (
                      <p key={email} className="truncate">{email}</p>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Phone className="h-4 w-4 text-primary" />
                    Gevonden telefoons
                  </p>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {(analysis.contactInfo?.phones || []).slice(0, 4).map((phone) => (
                      <p key={phone}>{phone}</p>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            {analysis?.technologies?.length ? (
              <div className="rounded-2xl border p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Technologieën</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {analysis.technologies.map((tech) => (
                    <Badge key={tech} variant="outline">{tech}</Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {analysis?.errors?.length ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {analysis.errors.join(" · ")}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="h-4 w-4" />
                Opportuniteiten
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {opportunities.length ? (
                opportunities.slice(0, 6).map((item) => (
                  <div key={item} className="rounded-xl border px-3 py-2 text-sm text-muted-foreground">
                    {item}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Geen kritieke opportuniteiten gedetecteerd in de laatste scan.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tracker</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border bg-muted/30 p-4 text-xs font-mono break-all">
                {trackerCode}
              </div>
              {tracker?.pages?.length ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Top pagina's</p>
                  {tracker.pages.slice(0, 4).map((page) => (
                    <div key={page.url} className="rounded-xl border p-3">
                      <p className="truncate text-sm font-medium">{page.title || page.url}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{page.count} views · {formatDate(page.lastSeen)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nog geen trackerhits ontvangen voor dit domein.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Verkeersbronnen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tracker?.referrers?.length ? (
                tracker.referrers.slice(0, 5).map((referrer) => (
                  <div key={referrer.source} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
                    <span>{referrer.source}</span>
                    <span className="text-muted-foreground">{referrer.count}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nog geen referrers gemeten.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
        </TabsContent>

        <TabsContent value="traffic" className="space-y-4">
          <DomainStatsCards items={trafficStatItems} columns={3} />

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Populaire pagina's</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tracker?.pages?.length ? (
                  tracker.pages.slice(0, 8).map((page) => (
                    <div key={page.url} className="rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium">{page.title || page.url}</p>
                        <Badge variant="outline">{page.count} views</Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{page.url}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nog geen paginaweergaven gemeten.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recente bezoekers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tracker?.visitors?.length ? (
                  tracker.visitors.slice(0, 8).map((visitor) => (
                    <div key={visitor.id} className="rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{visitor.deviceType || "device"} / {visitor.browser || "browser"}</p>
                        <span className="text-xs text-muted-foreground">{visitor.count} views</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{visitor.pageUrl}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nog geen bezoekers gemeten.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tracker installeren</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Plaats deze code vlak voor de sluitende head-tag of via de tag manager van de website. Daarna verschijnen bezoekers op de hoofdpagina.
                </p>
                <div className="rounded-2xl border bg-muted/30 p-4 text-xs font-mono break-all">
                  {trackerCode}
                </div>
                <Button onClick={copyTrackerCode}>
                  <Copy className="mr-2 h-4 w-4" />
                  Kopieer tracker
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Aanbevolen volgende stappen</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button variant="outline" className="justify-between" onClick={() => analyzeMutation.mutate({ domainName: data.domainName })} disabled={analyzeMutation.isPending}>
                  Website opnieuw analyseren
                  <RefreshCcw className={`h-4 w-4 ${analyzeMutation.isPending ? "animate-spin" : ""}`} />
                </Button>
                <Button asChild variant="outline" className="justify-between">
                  <a href={`https://${data.domainName}`} target="_blank" rel="noopener noreferrer">
                    Website openen
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                {data.lead ? (
                  <Button asChild variant="outline" className="justify-between">
                    <Link href={`/leads/${data.lead.id}`}>
                      Gekoppelde lead openen
                      <ArrowLeft className="h-4 w-4 rotate-180" />
                    </Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
