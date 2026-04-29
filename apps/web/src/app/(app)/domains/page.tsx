"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { getAppUrl } from "@/lib/config";
import {
  Card, CardContent, CardHeader, CardTitle, Badge, Button, Skeleton,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
  Input, Label, Textarea,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  CreateModal, EmptyState,
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
  const domainSummaries = domains.map((domain: NonNullable<typeof domains>[number]) => {
    const analysis = analysisResults[domain.domainName];
    const storedAnalysis = domain.lead?.enrichmentData?.find(
      (item: NonNullable<typeof domain.lead>["enrichmentData"][number]) => item.source === "domain_analysis"
    )?.data as AnalysisResult | undefined;
    const trackerData = domain.lead?.enrichmentData?.find(
      (item: NonNullable<typeof domain.lead>["enrichmentData"][number]) => item.source === `website_tracker:${domain.id}`
    )?.data as TrackerData | undefined;
    const effectiveAnalysis = analysis || storedAnalysis;
    const online =
      effectiveAnalysis?.statusCode !== undefined &&
      effectiveAnalysis.statusCode >= 200 &&
      effectiveAnalysis.statusCode < 400;
    return {
      domain,
      effectiveAnalysis,
      trackerData,
      visitors: trackerData?.summary.uniqueVisitors ?? 0,
      pageviews: trackerData?.summary.pageviews ?? 0,
      lastSeen: trackerData?.summary.lastSeen ?? null,
      statusCode: effectiveAnalysis?.statusCode ?? null,
      online,
      known: effectiveAnalysis?.statusCode !== undefined,
    };
  });
  const totalVisitors = domainSummaries.reduce((sum, item) => sum + item.visitors, 0);
  const onlineDomains = domainSummaries.filter((item) => item.online).length;
  const offlineDomains = domainSummaries.filter((item) => item.known && !item.online).length;

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
    <div className="app-page">
      <div className="app-page-header">
        <div className="app-page-heading">
          <h1 className="app-page-title">Domeinen</h1>
          <p className="app-page-subtitle">
            Monitor websites op bereikbaarheid en bezoekers. Klik door voor analyse, tracker en acties.
          </p>
        </div>
        <div className="app-page-actions">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuw Domein
        </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max gap-2">
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
      </div>

      <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-xl">
        <CardContent className="p-5">
          <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/50">Website monitor</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Rustige cockpit, diepe analyse op detailniveau.</h2>
              <p className="mt-2 max-w-2xl text-sm text-white/65">
                De hoofdpagina toont alleen wat je meteen wil weten: hoeveel bezoekers er zijn en of de website online is.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Bezoekers</p>
              <p className="mt-2 text-3xl font-semibold">{isLoading ? "-" : totalVisitors}</p>
              <p className="mt-1 text-xs text-white/50">Unieke bezoekers uit geplaatste trackers</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Online</p>
              <p className="mt-2 text-3xl font-semibold">{isLoading ? "-" : onlineDomains}</p>
              <p className="mt-1 text-xs text-white/50">
                {offlineDomains > 0 ? `${offlineDomains} website${offlineDomains !== 1 ? "s" : ""} met issue` : "Geen bekende outages"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
          <CardContent className="p-0">
            <EmptyState
              icon={<Globe2 />}
              title="Geen domeinen gevonden"
              description="Voeg een domein toe om te beginnen."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {domainSummaries.map(({ domain, effectiveAnalysis, trackerData, visitors, pageviews, lastSeen, statusCode, online, known }) => {
            const statusInfo = STATUS_MAP[domain.status] ?? STATUS_MAP.ACTIVE;
            const sslInfo = SSL_MAP[domain.sslStatus ?? "UNKNOWN"] ?? SSL_MAP.UNKNOWN;
            const SslIcon = sslInfo.icon;
            const isAnalyzing = analyzeMutation.isPending && expandedAnalysis === domain.domainName;

            return (
              <Card key={domain.id} className="group overflow-hidden border-border/60 bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/domains/${domain.id}`} className="block truncate text-base font-semibold tracking-tight hover:text-primary">
                        {domain.domainName}
                      </Link>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {domain.lead?.companyName || domain.registrar || "Geen lead gekoppeld"}
                      </p>
                    </div>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border bg-muted/20 p-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${known ? (online ? "bg-emerald-500" : "bg-red-500") : "bg-slate-300"}`} />
                        <p className="text-xs font-medium text-muted-foreground">Website</p>
                      </div>
                      <p className="mt-2 text-lg font-semibold">
                        {known ? (online ? "Online" : "Offline") : "Onbekend"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {statusCode ? `HTTP ${statusCode}` : "Nog niet gecheckt"}
                      </p>
                    </div>
                    <div className="rounded-2xl border bg-muted/20 p-3">
                      <p className="text-xs font-medium text-muted-foreground">Bezoekers</p>
                      <p className="mt-2 text-lg font-semibold">{visitors}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{pageviews} pageviews</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border bg-background/80 p-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Laatste bezoek</p>
                      <p className="truncate text-sm font-medium">{lastSeen ? formatDate(lastSeen) : "Nog geen data"}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <SslIcon className={`h-4 w-4 ${sslInfo.color}`} />
                      <span className="text-xs text-muted-foreground">{sslInfo.label}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={isAnalyzing}
                      onClick={() => handleAnalyze(domain.domainName)}
                    >
                      {isAnalyzing ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : (
                        <Search className="mr-1.5 h-3 w-3" />
                      )}
                      Check live
                    </Button>
                    <Button asChild size="sm" className="h-8 text-xs">
                      <Link href={`/domains/${domain.id}`}>
                      Open details
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setEditDomain(domain)}>
                      <Pencil className="mr-1.5 h-3 w-3" />
                      Bewerk
                    </Button>
                    <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
                      <a href={`https://${domain.domainName}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1.5 h-3 w-3" />
                        Website
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(domain.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
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

      {/* Delete Confirmation */}
      <CreateModal
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Domein verwijderen"
        description="Deze actie kan niet ongedaan worden gemaakt."
        submitLabel="Verwijderen"
        submitVariant="destructive"
        pending={deleteMutation.isPending}
        onSubmit={() => {
          if (deleteId) deleteMutation.mutate({ id: deleteId });
        }}
      >
        <p className="text-sm text-muted-foreground">
          Weet je zeker dat je het domein &quot;{domainToDelete?.domainName}&quot; wilt
          verwijderen?
        </p>
      </CreateModal>
    </div>
  );
}
