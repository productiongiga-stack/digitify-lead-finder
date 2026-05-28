"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Card, CardContent, Badge, Button, Skeleton,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
  Input, Label, Textarea,
  CreateModal, EmptyState,
} from "@digitify/ui";
import {
  Globe2, Plus, Shield, ShieldAlert, ShieldOff, ShieldQuestion,
  ExternalLink, Search, Loader2, Trash2,
  Pencil, ChevronRight, Users, Clock, Activity,
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

      <div className="crm-stats-grid sm:grid-cols-3">
        {[
          {
            label: "Bezoekers",
            hint: "Uniek via trackers",
            value: totalVisitors,
            icon: Users,
            iconClass: "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-400",
          },
          {
            label: "Online",
            hint: `van ${domains.length} domein${domains.length === 1 ? "" : "en"}`,
            value: onlineDomains,
            icon: Activity,
            iconClass: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400",
          },
          {
            label: "Issues",
            hint: offlineDomains > 0 ? "Offline of foutstatus" : "Geen bekende outages",
            value: offlineDomains,
            icon: ShieldAlert,
            iconClass:
              offlineDomains > 0
                ? "bg-red-500/10 text-red-700 ring-red-500/20 dark:text-red-400"
                : "bg-muted/60 text-muted-foreground ring-border/60",
          },
        ].map((stat) => (
          <div key={stat.label} className="crm-stat-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="crm-stat-card-label">{stat.label}</p>
                <p className="crm-stat-card-value">{isLoading ? "—" : stat.value}</p>
                <p className="crm-stat-card-hint">{stat.hint}</p>
              </div>
              <div className={`crm-stat-card-icon ${stat.iconClass}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
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

            const websiteLabel = known ? (online ? "Online" : "Offline") : "Onbekend";
            const websiteHint = statusCode ? `HTTP ${statusCode}` : "Nog niet gecheckt";

            return (
              <Card key={domain.id} className="domain-card group">
                <CardContent className="p-0">
                  <div className="p-4 pb-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/10">
                        <Globe2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/domains/${domain.id}`}
                            className="truncate text-base font-semibold tracking-tight transition-colors hover:text-primary"
                          >
                            {domain.domainName}
                          </Link>
                          <Badge variant={statusInfo.variant} className="shrink-0">
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {domain.lead?.companyName || domain.registrar || "Geen lead gekoppeld"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="domain-metrics-row">
                    <div className="domain-metric">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        <span
                          className={`h-2 w-2 rounded-full ${known ? (online ? "bg-emerald-500" : "bg-red-500") : "bg-muted-foreground/40"}`}
                        />
                        Website
                      </div>
                      <p className="mt-1.5 text-lg font-semibold tabular-nums leading-none">{websiteLabel}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{websiteHint}</p>
                    </div>
                    <div className="domain-metric">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        Bezoekers
                      </div>
                      <p className="mt-1.5 text-lg font-semibold tabular-nums leading-none">{visitors}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{pageviews} pageviews</p>
                    </div>
                  </div>

                  <div className="domain-status-bar">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {lastSeen ? `Laatste bezoek ${formatDate(lastSeen)}` : "Nog geen bezoekdata"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium">
                      <SslIcon className={`h-3.5 w-3.5 ${sslInfo.color}`} />
                      <span className="text-muted-foreground">SSL {sslInfo.label}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 p-4 pt-3">

                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={isAnalyzing}
                        onClick={() => handleAnalyze(domain.domainName)}
                        aria-label="Live check"
                      >
                        {isAnalyzing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditDomain(domain)}
                        aria-label="Bewerken"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                        <a
                          href={`https://${domain.domainName}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Website openen"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(domain.id)}
                        aria-label="Verwijderen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button asChild size="sm" className="shrink-0">
                      <Link href={`/domains/${domain.id}`}>
                        Details
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
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
