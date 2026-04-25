"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { getAppUrl } from "@/lib/config";
import {
  Card, CardContent, CardHeader, CardTitle, Badge, Button, Skeleton,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
  Input, Label, Textarea,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@digitify/ui";
import {
  Globe2, Plus, Shield, ShieldAlert, ShieldOff, ShieldQuestion,
  ExternalLink, Search, Calendar, Building2, Loader2, Trash2,
  CheckCircle2, XCircle, Smartphone, FileText, Hash, Share2,
  Cpu, AlertTriangle, Clock, Pencil, Copy, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/feedback/toast-provider";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ACTIVE: { label: "Actief", variant: "default" },
  EXPIRING: { label: "Verloopt binnenkort", variant: "secondary" },
  EXPIRED: { label: "Verlopen", variant: "destructive" },
  TRANSFERRED: { label: "Overgedragen", variant: "outline" },
};

const SSL_MAP: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  VALID: { label: "Geldig", icon: Shield, color: "text-emerald-600 dark:text-emerald-400" },
  EXPIRED: { label: "Verlopen", icon: ShieldAlert, color: "text-red-600 dark:text-red-400" },
  NONE: { label: "Geen", icon: ShieldOff, color: "text-muted-foreground" },
  UNKNOWN: { label: "Onbekend", icon: ShieldQuestion, color: "text-muted-foreground" },
};

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysRemaining(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const now = new Date();
  const exp = new Date(d);
  const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)} dagen verlopen`;
  return `${diff} dagen resterend`;
}

type AnalysisResult = {
  url: string;
  statusCode: number;
  hasSSL: boolean;
  isMobileFriendly: boolean;
  loadTimeMs: number;
  hasMetaTitle: boolean;
  metaTitle: string | null;
  hasMetaDescription: boolean;
  metaDescription: string | null;
  hasH1: boolean;
  h1Text: string | null;
  hasStructuredData: boolean;
  hasFavicon: boolean;
  hasAnalytics: boolean;
  hasCTA: boolean;
  contentLength: number;
  lastModified: string | null;
  technologies: string[];
  socialLinks: Record<string, string | null>;
  contactInfo: { emails: string[]; phones: string[] };
  errors: string[];
};

type TrackerData = {
  summary: {
    pageviews: number;
    uniqueVisitors: number;
    lastSeen: string | null;
  };
  devices: Array<{
    type: string;
    count: number;
  }>;
  browsers: Array<{
    name: string;
    count: number;
  }>;
  campaigns: Array<{
    source: string;
    medium: string;
    campaign: string;
    count: number;
  }>;
  pages: Array<{
    url: string;
    title: string;
    count: number;
    lastSeen: string;
  }>;
  referrers: Array<{
    source: string;
    count: number;
  }>;
  visitors: Array<{
    id: string;
    count: number;
    lastSeen: string;
    pageUrl: string;
    language: string;
    timezone: string;
    deviceType: string;
    browser: string;
  }>;
};

function AnalysisCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
      )}
      <span>{label}</span>
    </div>
  );
}

export default function DomainsPage() {
  const [open, setOpen] = useState(false);
  const [editDomain, setEditDomain] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<Record<string, AnalysisResult>>({});
  const { showToast } = useToast();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.domain.list.useQuery(
    statusFilter ? { status: statusFilter } : undefined,
    { refetchInterval: 60_000 }
  );
  const { data: leadsData } = trpc.lead.list.useQuery({ pageSize: 100 });

  const createMutation = trpc.domain.create.useMutation({
    onSuccess: () => {
      utils.domain.list.invalidate();
      setOpen(false);
      showToast({ title: "Domein opgeslagen", description: "Het nieuwe domein is toegevoegd." });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });
  const updateMutation = trpc.domain.update.useMutation({
    onSuccess: () => {
      utils.domain.list.invalidate();
      setEditDomain(null);
      showToast({ title: "Domein bijgewerkt", description: "De wijzigingen zijn opgeslagen." });
    },
    onError: (error) => showToast({ title: "Bijwerken mislukt", description: error.message, variant: "error" }),
  });
  const deleteMutation = trpc.domain.delete.useMutation({
    onSuccess: () => {
      utils.domain.list.invalidate();
      setDeleteId(null);
      showToast({ title: "Domein verwijderd", description: "Het domein is verwijderd." });
    },
    onError: (error) => showToast({ title: "Verwijderen mislukt", description: error.message, variant: "error" }),
  });
  const analyzeMutation = trpc.domain.analyzeDomain.useMutation();

  const domains = data?.domains ?? [];

  // Stats
  const totalDomains = domains.length;
  const activeDomains = domains.filter((domain: NonNullable<typeof domains>[number]) => domain.status === "ACTIVE").length;
  const expiringDomains = domains.filter((domain: NonNullable<typeof domains>[number]) => domain.status === "EXPIRING").length;
  const sslValid = domains.filter((domain: NonNullable<typeof domains>[number]) => domain.sslStatus === "VALID").length;
  const sslExpired = domains.filter(
    (domain: NonNullable<typeof domains>[number]) => domain.sslStatus === "EXPIRED" || domain.sslStatus === "NONE",
  ).length;

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    createMutation.mutate({
      domainName: form.get("domainName") as string,
      registrar: (form.get("registrar") as string) || undefined,
      registeredAt: (form.get("registeredAt") as string) || undefined,
      expiresAt: (form.get("expiresAt") as string) || undefined,
      notes: (form.get("notes") as string) || undefined,
      leadId: (form.get("leadId") as string) || undefined,
    });
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: editDomain.id,
      domainName: form.get("domainName") as string,
      registrar: (form.get("registrar") as string) || undefined,
      registeredAt: (form.get("registeredAt") as string) || undefined,
      expiresAt: (form.get("expiresAt") as string) || undefined,
      status: (form.get("status") as any) || undefined,
      sslStatus: (form.get("sslStatus") as any) || undefined,
      notes: (form.get("notes") as string) || undefined,
      leadId: (form.get("leadId") as string) || undefined,
    });
  }

  async function handleAnalyze(domainName: string) {
    setExpandedAnalysis(domainName);
    try {
      const result = await analyzeMutation.mutateAsync({ domainName });
      setAnalysisResults((prev) => ({ ...prev, [domainName]: result as AnalysisResult }));
      utils.domain.list.invalidate();
      showToast({ title: "Analyse voltooid", description: `${domainName} is opnieuw gecontroleerd.` });
    } catch {
      showToast({ title: "Analyse mislukt", description: "De website kon niet geanalyseerd worden.", variant: "error" });
    }
  }

  async function copyTrackerCode(domainId: string) {
    const embedCode = `<script async src="${getAppUrl()}/tracker.js?domain=${domainId}"></script>`;
    await navigator.clipboard.writeText(embedCode);
    showToast({
      title: "Tracker code gekopieerd",
      description: "De website tracker embed staat nu op je klembord.",
    });
  }

  const domainToDelete = domains.find((domain: NonNullable<typeof domains>[number]) => domain.id === deleteId);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Domeinen</h1>
          <p className="text-sm text-muted-foreground">
            Beheer domeinnamen, SSL-certificaten en website-analyse
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuw Domein
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Globe2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? "-" : totalDomains}</p>
                <p className="text-xs text-muted-foreground">Totaal Domeinen</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? "-" : activeDomains}</p>
                <p className="text-xs text-muted-foreground">Actief</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? "-" : expiringDomains}</p>
                <p className="text-xs text-muted-foreground">Verlopend</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? "-" : sslValid}</p>
                <p className="text-xs text-muted-foreground">SSL Geldig</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-500/10 p-2">
                <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? "-" : sslExpired}</p>
                <p className="text-xs text-muted-foreground">SSL Verlopen</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={!statusFilter ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter(undefined)}
        >
          Alles
        </Button>
        {Object.entries(STATUS_MAP).map(([key, { label }]) => (
          <Button
            key={key}
            variant={statusFilter === key ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Domain Cards */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !domains.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Globe2 className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium">Geen domeinen gevonden</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Voeg een domein toe om te beginnen.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {domains.map((domain: NonNullable<typeof domains>[number]) => {
            const statusInfo = STATUS_MAP[domain.status] ?? STATUS_MAP.ACTIVE;
            const sslInfo = SSL_MAP[domain.sslStatus ?? "UNKNOWN"] ?? SSL_MAP.UNKNOWN;
            const SslIcon = sslInfo.icon;
            const days = daysRemaining(domain.expiresAt);
            const analysis = analysisResults[domain.domainName];
            const storedAnalysis = domain.lead?.enrichmentData?.find(
              (item: NonNullable<typeof domain.lead>["enrichmentData"][number]) => item.source === "domain_analysis"
            )?.data as AnalysisResult | undefined;
            const trackerData = domain.lead?.enrichmentData?.find(
              (item: NonNullable<typeof domain.lead>["enrichmentData"][number]) => item.source === `website_tracker:${domain.id}`
            )?.data as TrackerData | undefined;
            const effectiveAnalysis = analysis || storedAnalysis;
            const isExpanded = expandedAnalysis === domain.domainName;
            const isAnalyzing = analyzeMutation.isPending && expandedAnalysis === domain.domainName && !analysis;
            const websiteIsOnline =
              effectiveAnalysis?.statusCode !== undefined &&
              effectiveAnalysis.statusCode >= 200 &&
              effectiveAnalysis.statusCode < 400;

            return (
              <Card key={domain.id} className="flex flex-col">
                <CardContent className="p-5 flex-1 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <a
                        href={`https://${domain.domainName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lg font-semibold hover:text-primary flex items-center gap-1.5 truncate"
                      >
                        {domain.domainName}
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </a>
                    </div>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </div>

                  {/* SSL Status */}
                  <div className="flex items-center gap-1.5">
                    <SslIcon className={`h-4 w-4 ${sslInfo.color}`} />
                    <span className="text-sm">{sslInfo.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        effectiveAnalysis
                          ? websiteIsOnline
                            ? "bg-emerald-500"
                            : "bg-red-500"
                          : "bg-slate-300"
                      }`}
                    />
                    <span className="text-sm text-muted-foreground">
                      Website {effectiveAnalysis ? (websiteIsOnline ? "online" : "offline") : "onbekend"}
                    </span>
                    {effectiveAnalysis?.statusCode ? (
                      <span className="text-xs text-muted-foreground">HTTP {effectiveAnalysis.statusCode}</span>
                    ) : null}
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    {domain.registrar && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span>{domain.registrar}</span>
                      </div>
                    )}
                    {domain.expiresAt && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>{formatDate(domain.expiresAt)}</span>
                        {days && (
                          <span className={`text-xs ${days.includes("verlopen") ? "text-red-600" : "text-muted-foreground"}`}>
                            ({days})
                          </span>
                        )}
                      </div>
                    )}
                    {domain.lead && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <Link
                          href={`/leads/${domain.lead.id}`}
                          className="text-primary hover:underline"
                        >
                          {domain.lead.companyName}
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 border-t pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      disabled={isAnalyzing}
                      onClick={() => handleAnalyze(domain.domainName)}
                    >
                      {isAnalyzing ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : (
                        <Search className="mr-1.5 h-3 w-3" />
                      )}
                      Analyseer
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setEditDomain(domain)}
                    >
                      <Pencil className="mr-1.5 h-3 w-3" />
                      Bewerk
                    </Button>
                    <Link
                      href={`/domains/${domain.id}`}
                      className="inline-flex h-9 items-center rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      Details
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(domain.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Analysis Results */}
                  {isExpanded && effectiveAnalysis && (
                    <div className="space-y-3 pt-3 border-t">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Analyse Resultaten
                      </p>
                      <div className="grid gap-2">
                        <AnalysisCheck
                          ok={effectiveAnalysis.hasSSL}
                          label={`SSL: ${effectiveAnalysis.hasSSL ? "Geldig" : "Niet gevonden"}`}
                        />
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span>Laadtijd: {effectiveAnalysis.loadTimeMs}ms</span>
                        </div>
                        <AnalysisCheck
                          ok={effectiveAnalysis.isMobileFriendly}
                          label={`Mobiel vriendelijk: ${effectiveAnalysis.isMobileFriendly ? "Ja" : "Nee"}`}
                        />
                        <AnalysisCheck
                          ok={effectiveAnalysis.hasMetaTitle}
                          label={`Meta titel: ${effectiveAnalysis.hasMetaTitle ? "Aanwezig" : "Ontbreekt"}`}
                        />
                        {effectiveAnalysis.metaTitle ? (
                          <div className="flex items-start gap-2 text-sm">
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="line-clamp-2">Titel: {effectiveAnalysis.metaTitle}</span>
                          </div>
                        ) : null}
                        <AnalysisCheck
                          ok={effectiveAnalysis.hasMetaDescription}
                          label={`Meta beschrijving: ${effectiveAnalysis.hasMetaDescription ? "Aanwezig" : "Ontbreekt"}`}
                        />
                        <AnalysisCheck
                          ok={effectiveAnalysis.hasH1}
                          label={`H1 tag: ${effectiveAnalysis.hasH1 ? "Aanwezig" : "Ontbreekt"}`}
                        />
                        {effectiveAnalysis.h1Text ? (
                          <div className="flex items-start gap-2 text-sm">
                            <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="line-clamp-2">H1: {effectiveAnalysis.h1Text}</span>
                          </div>
                        ) : null}
                        <AnalysisCheck
                          ok={effectiveAnalysis.hasCTA}
                          label={`Contactformulier/CTA: ${effectiveAnalysis.hasCTA ? "Gevonden" : "Niet gevonden"}`}
                        />
                        <div className="flex items-center gap-2 text-sm">
                          <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span>Content lengte: {effectiveAnalysis.contentLength} tekens</span>
                        </div>
                        {effectiveAnalysis.lastModified ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span>Laatst gewijzigd: {formatDate(effectiveAnalysis.lastModified)}</span>
                          </div>
                        ) : null}
                        {effectiveAnalysis.contactInfo.emails.length > 0 && (
                          <div className="flex items-start gap-2 text-sm">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span>E-mails: {effectiveAnalysis.contactInfo.emails.join(", ")}</span>
                          </div>
                        )}
                        {effectiveAnalysis.contactInfo.phones.length > 0 && (
                          <div className="flex items-start gap-2 text-sm">
                            <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span>Telefoons: {effectiveAnalysis.contactInfo.phones.join(", ")}</span>
                          </div>
                        )}
                        {Object.entries(effectiveAnalysis.socialLinks).some(([, v]) => v) && (
                          <div className="flex items-center gap-2 text-sm">
                            <Share2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span>
                              Socials:{" "}
                              {Object.entries(effectiveAnalysis.socialLinks)
                                .filter(([, v]) => v)
                                .map(([k]) => k)
                                .join(", ")}
                            </span>
                          </div>
                        )}
                        {effectiveAnalysis.technologies.length > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <Cpu className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span>Tech: {effectiveAnalysis.technologies.join(", ")}</span>
                          </div>
                        )}
                        {effectiveAnalysis.errors.length > 0 && (
                          <div className="flex items-start gap-2 text-sm text-red-600">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>{effectiveAnalysis.errors.join("; ")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {isExpanded && (
                    <div className="space-y-3 pt-3 border-t">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Website Tracker
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Plaats deze embed op de website om bezoekers en paginaweergaven te registreren.
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => void copyTrackerCode(domain.id)}>
                          <Copy className="mr-2 h-3.5 w-3.5" />
                          Kopieer code
                        </Button>
                      </div>

                      <div className="rounded-lg border bg-muted/40 p-3 text-xs font-mono break-all">
                        {`<script async src="${getAppUrl()}/tracker.js?domain=${domain.id}"></script>`}
                      </div>

                      {!domain.lead ? (
                        <p className="text-sm text-muted-foreground">
                          Koppel dit domein eerst aan een lead. De tracker slaat bezoekersdata per gekoppelde website op.
                        </p>
                      ) : trackerData ? (
                        <div className="grid gap-3">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-lg border p-3">
                              <p className="text-xs text-muted-foreground">Pageviews</p>
                              <p className="text-lg font-semibold">{trackerData.summary.pageviews}</p>
                            </div>
                            <div className="rounded-lg border p-3">
                              <p className="text-xs text-muted-foreground">Bezoekers</p>
                              <p className="text-lg font-semibold">{trackerData.summary.uniqueVisitors}</p>
                            </div>
                            <div className="rounded-lg border p-3">
                              <p className="text-xs text-muted-foreground">Laatste hit</p>
                              <p className="text-sm font-medium">
                                {trackerData.summary.lastSeen ? formatDate(trackerData.summary.lastSeen) : "-"}
                              </p>
                            </div>
                          </div>

                          {trackerData.pages.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Populaire pagina's</p>
                              {trackerData.pages.slice(0, 3).map((page) => (
                                <div key={page.url} className="rounded-lg border p-3 text-sm">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="truncate font-medium">{page.title || page.url}</span>
                                    <span className="text-muted-foreground">{page.count} views</span>
                                  </div>
                                  <p className="mt-1 truncate text-xs text-muted-foreground">{page.url}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {trackerData.referrers.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Referrers</p>
                              <div className="flex flex-wrap gap-2">
                                {trackerData.referrers.slice(0, 4).map((referrer) => (
                                  <Badge key={referrer.source} variant="outline">
                                    {referrer.source}: {referrer.count}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {trackerData.devices?.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Devices</p>
                              <div className="flex flex-wrap gap-2">
                                {trackerData.devices.map((device) => (
                                  <Badge key={device.type} variant="outline">
                                    {device.type}: {device.count}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {trackerData.browsers?.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Browsers</p>
                              <div className="flex flex-wrap gap-2">
                                {trackerData.browsers.map((browser) => (
                                  <Badge key={browser.name} variant="outline">
                                    {browser.name}: {browser.count}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {trackerData.campaigns?.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Campagnes</p>
                              {trackerData.campaigns.slice(0, 4).map((campaign) => (
                                <div key={`${campaign.source}-${campaign.medium}-${campaign.campaign}`} className="rounded-lg border p-3 text-sm">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="font-medium">
                                      {campaign.source} / {campaign.medium}
                                    </span>
                                    <span className="text-muted-foreground">{campaign.count} hits</span>
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">{campaign.campaign}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {trackerData.visitors?.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recente bezoekers</p>
                              {trackerData.visitors.slice(0, 4).map((visitor) => (
                                <div key={visitor.id} className="rounded-lg border p-3 text-sm">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="font-medium">{visitor.deviceType} / {visitor.browser}</span>
                                    <span className="text-muted-foreground">{visitor.count} views</span>
                                  </div>
                                  <p className="mt-1 truncate text-xs text-muted-foreground">{visitor.pageUrl}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {visitor.language || "onbekende taal"} · {visitor.timezone || "onbekende timezone"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Nog geen bezoekersdata ontvangen. Na het plaatsen van de embedcode blijven deze statistieken bewaard, ook wanneer je de website opnieuw analyseert.
                        </p>
                      )}
                    </div>
                  )}
                  {isExpanded && isAnalyzing && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">Website analyseren...</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuw Domein</DialogTitle>
            <DialogDescription>Voeg een nieuw domein toe aan je portfolio.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domainName">Domeinnaam *</Label>
              <Input id="domainName" name="domainName" required placeholder="voorbeeld.be" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registrar">Registrar</Label>
              <Input id="registrar" name="registrar" placeholder="bv. Combell, Namecheap" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="registeredAt">Registratiedatum</Label>
                <Input id="registeredAt" name="registeredAt" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Vervaldatum</Label>
                <Input id="expiresAt" name="expiresAt" type="date" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="leadId">Gekoppelde Lead</Label>
              <select
                id="leadId"
                name="leadId"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Geen</option>
                {leadsData?.items.map((lead: NonNullable<typeof leadsData>["items"][number]) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notities</Label>
              <Textarea id="notes" name="notes" placeholder="Optionele notities..." rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Bezig..." : "Domein Toevoegen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editDomain} onOpenChange={(o) => !o && setEditDomain(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Domein Bewerken</DialogTitle>
            <DialogDescription>Pas de gegevens van dit domein aan.</DialogDescription>
          </DialogHeader>
          {editDomain && (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-domainName">Domeinnaam *</Label>
                <Input
                  id="edit-domainName"
                  name="domainName"
                  required
                  defaultValue={editDomain.domainName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-registrar">Registrar</Label>
                <Input
                  id="edit-registrar"
                  name="registrar"
                  defaultValue={editDomain.registrar ?? ""}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-registeredAt">Registratiedatum</Label>
                  <Input
                    id="edit-registeredAt"
                    name="registeredAt"
                    type="date"
                    defaultValue={editDomain.registeredAt ? new Date(editDomain.registeredAt).toISOString().split("T")[0] : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-expiresAt">Vervaldatum</Label>
                  <Input
                    id="edit-expiresAt"
                    name="expiresAt"
                    type="date"
                    defaultValue={editDomain.expiresAt ? new Date(editDomain.expiresAt).toISOString().split("T")[0] : ""}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <select
                    id="edit-status"
                    name="status"
                    defaultValue={editDomain.status}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-sslStatus">SSL Status</Label>
                  <select
                    id="edit-sslStatus"
                    name="sslStatus"
                    defaultValue={editDomain.sslStatus ?? "UNKNOWN"}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {Object.entries(SSL_MAP).map(([key, { label }]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-leadId">Gekoppelde Lead</Label>
                <select
                  id="edit-leadId"
                  name="leadId"
                  defaultValue={editDomain.leadId ?? ""}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Geen</option>
                  {leadsData?.items.map((lead: NonNullable<typeof leadsData>["items"][number]) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.companyName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notities</Label>
                <Textarea
                  id="edit-notes"
                  name="notes"
                  defaultValue={editDomain.notes ?? ""}
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDomain(null)}>
                  Annuleren
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Bezig..." : "Opslaan"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Domein verwijderen</DialogTitle>
            <DialogDescription>
              Deze actie kan niet ongedaan worden gemaakt.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4">
            Weet je zeker dat je het domein &quot;{domainToDelete?.domainName}&quot; wilt verwijderen?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Annuleren
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verwijderen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
