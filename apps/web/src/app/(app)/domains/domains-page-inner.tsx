"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CreateModal,
  EmptyState,
  Input,
  Skeleton,
} from "@digitify/ui";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Gauge,
  Globe2,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
import { useToast } from "@/components/feedback/toast-provider";
import { DomainFormDialog } from "@/components/domains/domain-form-dialog";
import {
  DOMAIN_SSL_MAP,
  DOMAIN_STATUS_MAP,
  WEBSITE_STATUS_LABEL,
  daysUntilExpiry,
  formatDomainDate,
} from "@/lib/domains/domain-view";
import { cn } from "@/lib/utils";

export function DomainsPageInner() {
  const [open, setOpen] = useState(false);
  const [editDomain, setEditDomain] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState<"updatedAt" | "domainName" | "expiresAt" | "healthScore" | "lastAnalyzedAt">(
    "updatedAt",
  );
  const [page, setPage] = useState(1);
  const { showToast } = useToast();
  const utils = trpc.useUtils();

  const pollWhenVisible = () =>
    typeof document !== "undefined" && document.visibilityState === "visible" ? 120_000 : false;

  const listQuery = trpc.domain.list.useQuery(
    { status: statusFilter, search: search || undefined, sort, page, pageSize: 12 },
    { staleTime: 60_000, refetchInterval: pollWhenVisible },
  );
  const statsQuery = trpc.domain.getPortfolioStats.useQuery(undefined, {
    staleTime: 60_000,
    refetchInterval: pollWhenVisible,
  });
  const monitorQuery = trpc.dashboard.getDomainMonitor.useQuery(undefined, {
    staleTime: 60_000,
    refetchInterval: pollWhenVisible,
  });
  const { data: leadOptions } = trpc.lead.options.useQuery(
    { limit: 100 },
    { enabled: open || Boolean(editDomain) },
  );

  const createMutation = trpc.domain.create.useMutation({
    onSuccess: () => {
      void utils.domain.list.invalidate();
      void utils.domain.getPortfolioStats.invalidate();
      setOpen(false);
      showToast({ title: "Domein opgeslagen" });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });
  const updateMutation = trpc.domain.update.useMutation({
    onSuccess: () => {
      void utils.domain.list.invalidate();
      void utils.domain.getPortfolioStats.invalidate();
      setEditDomain(null);
      showToast({ title: "Domein bijgewerkt" });
    },
    onError: (error) => showToast({ title: "Bijwerken mislukt", description: error.message, variant: "error" }),
  });
  const deleteMutation = trpc.domain.delete.useMutation({
    onSuccess: () => {
      void utils.domain.list.invalidate();
      void utils.domain.getPortfolioStats.invalidate();
      setDeleteId(null);
      showToast({ title: "Domein verwijderd" });
    },
    onError: (error) => showToast({ title: "Verwijderen mislukt", description: error.message, variant: "error" }),
  });
  const analyzeMutation = trpc.domain.analyzeDomain.useMutation({
    onSuccess: () => {
      void utils.domain.list.invalidate();
      void utils.domain.getPortfolioStats.invalidate();
      void utils.dashboard.getDomainMonitor.invalidate();
      showToast({ title: "Analyse voltooid" });
    },
    onError: (error) => showToast({ title: "Analyse mislukt", description: error.message, variant: "error" }),
  });
  const bulkAnalyzeMutation = trpc.domain.bulkAnalyze.useMutation({
    onSuccess: (result) => {
      void utils.domain.list.invalidate();
      void utils.domain.getPortfolioStats.invalidate();
      showToast({
        title: "Bulk-analyse klaar",
        description: `${result.analyzed} geslaagd, ${result.failed} mislukt.`,
      });
    },
    onError: (error) => showToast({ title: "Bulk-analyse mislukt", description: error.message, variant: "error" }),
  });

  const domains = listQuery.data?.domains ?? [];
  const stats = statsQuery.data;
  const domainToDelete = domains.find((domain) => domain.id === deleteId);

  const statCards = useMemo(
    () => [
      { label: "Portfolio", value: stats?.total ?? 0, hint: `${stats?.active ?? 0} actief`, icon: Globe2, tone: "text-primary" },
      { label: "Health", value: stats?.avgHealthScore ?? 0, hint: "Gemiddelde score", icon: Gauge, tone: "text-amber-600" },
      { label: "Bezoekers", value: stats?.totalVisitors ?? 0, hint: `${stats?.totalPageviews ?? 0} pageviews`, icon: Users, tone: "text-sky-600" },
      { label: "Online", value: stats?.online ?? 0, hint: `${stats?.offline ?? 0} offline`, icon: Activity, tone: "text-emerald-600" },
      { label: "Verloopt", value: stats?.expiring ?? 0, hint: `${stats?.expired ?? 0} verlopen`, icon: Clock, tone: "text-orange-600" },
      { label: "Te analyseren", value: stats?.needsAnalysis ?? 0, hint: "Nog geen check", icon: BarChart3, tone: "text-violet-600" },
    ],
    [stats],
  );

  return (
    <div className="app-page space-y-5">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-sky-500/10 via-background to-primary/5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-700 dark:text-sky-300">
              <Globe2 className="h-3.5 w-3.5" />
              Domeinportfolio
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Domeinen</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Beheer klantdomeinen, monitor uptime &amp; SEO, volg bezoekers via de embed-tracker en krijg vroegtijdig
              verval-alerts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={bulkAnalyzeMutation.isPending}
              onClick={() => bulkAnalyzeMutation.mutate({})}
            >
              {bulkAnalyzeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Analyseer alles
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nieuw domein
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {statCards.map((stat) => (
          <div key={stat.label} className="crm-stat-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="crm-stat-card-label">{stat.label}</p>
                <p className="crm-stat-card-value">{statsQuery.isLoading ? "—" : stat.value}</p>
                <p className="crm-stat-card-hint">{stat.hint}</p>
              </div>
              <stat.icon className={cn("h-5 w-5 shrink-0", stat.tone)} />
            </div>
          </div>
        ))}
      </div>

      {stats?.expiringSoon?.length ? (
        <Card className="border-amber-200/60 bg-amber-500/[0.04]">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="font-medium">Binnenkort verlopend:</span>
            {stats.expiringSoon.map((item) => (
              <Link key={item.id} href={`/domains/${item.id}`} className="text-primary hover:underline">
                {item.domainName}
                {item.expiresAt ? ` (${formatDomainDate(item.expiresAt)})` : ""}
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {monitorQuery.data?.length ? (
        <Card>
          <CardContent className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live monitor</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {monitorQuery.data.map((item) => (
                <Link
                  key={item.id}
                  href={`/domains/${item.id}`}
                  className="rounded-xl border bg-muted/15 p-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">{item.domainName}</p>
                    <Badge variant={item.websiteStatus === "online" ? "default" : item.websiteStatus === "slow" ? "secondary" : "outline"}>
                      {WEBSITE_STATUS_LABEL[item.websiteStatus] ?? item.websiteStatus}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Score {item.healthScore ?? 0} · {item.uniqueVisitors} bezoekers
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button variant={!statusFilter ? "default" : "outline"} size="sm" onClick={() => { setStatusFilter(undefined); setPage(1); }}>
            Alles
          </Button>
          {Object.entries(DOMAIN_STATUS_MAP).map(([key, { label }]) => (
            <Button
              key={key}
              variant={statusFilter === key ? "default" : "outline"}
              size="sm"
              onClick={() => { setStatusFilter(key); setPage(1); }}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 lg:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setSearch(searchInput.trim());
                  setPage(1);
                }
              }}
              placeholder="Zoek domein, registrar of lead…"
              className="pl-9"
            />
          </div>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="updatedAt">Laatst bijgewerkt</option>
            <option value="domainName">Naam</option>
            <option value="expiresAt">Vervaldatum</option>
            <option value="healthScore">Health score</option>
            <option value="lastAnalyzedAt">Laatste analyse</option>
          </select>
        </div>
      </div>

      {listQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : !domains.length ? (
        <EmptyState
          icon={<Globe2 />}
          title="Geen domeinen gevonden"
          description={search ? "Pas je zoekopdracht aan of voeg een nieuw domein toe." : "Voeg je eerste domein toe om te starten."}
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nieuw domein
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {domains.map((domain) => {
            const statusInfo = DOMAIN_STATUS_MAP[domain.status] ?? DOMAIN_STATUS_MAP.ACTIVE;
            const sslInfo = DOMAIN_SSL_MAP[domain.sslStatus ?? "UNKNOWN"] ?? DOMAIN_SSL_MAP.UNKNOWN;
            const SslIcon = sslInfo.icon;
            const expiryDays = daysUntilExpiry(domain.expiresAt);
            const isAnalyzing = analyzeMutation.isPending && analyzeMutation.variables?.id === domain.id;

            return (
              <Card key={domain.id} className="domain-card overflow-hidden">
                <CardContent className="p-0">
                  <div className="h-1 bg-gradient-to-r from-sky-500/70 via-primary/50 to-emerald-500/50" />
                  <div className="space-y-4 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Globe2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <Link href={`/domains/${domain.id}`} className="truncate text-base font-semibold hover:text-primary">
                            {domain.domainName}
                          </Link>
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {domain.lead?.companyName || domain.registrar || "Geen lead gekoppeld"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg border bg-muted/20 p-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Health</p>
                        <p className="text-lg font-semibold tabular-nums">{domain.healthScore ?? 0}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</p>
                        <p className="text-sm font-semibold">{WEBSITE_STATUS_LABEL[domain.websiteStatus] ?? "—"}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Bezoekers</p>
                        <p className="text-lg font-semibold tabular-nums">{domain.uniqueVisitors}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <SslIcon className={cn("h-3.5 w-3.5", sslInfo.color)} />
                        SSL {sslInfo.label}
                      </span>
                      {domain.expiresAt ? (
                        <span>
                          Verloopt {formatDomainDate(domain.expiresAt)}
                          {expiryDays != null ? ` (${expiryDays}d)` : ""}
                        </span>
                      ) : null}
                      {domain.lastAnalyzedAt ? (
                        <span>Geanalyseerd {formatDomainDate(domain.lastAnalyzedAt)}</span>
                      ) : (
                        <span className="text-amber-600">Nog niet geanalyseerd</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t pt-3">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={isAnalyzing}
                          onClick={() => analyzeMutation.mutate({ id: domain.id })}
                        >
                          {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={`https://${domain.domainName}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteId(domain.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditDomain(domain)}>
                          Bewerken
                        </Button>
                        <Button size="sm" asChild>
                          <Link href={`/domains/${domain.id}`}>Details</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {listQuery.data && listQuery.data.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Pagina {listQuery.data.page} van {listQuery.data.totalPages} · {listQuery.data.total} domeinen
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= (listQuery.data?.totalPages ?? 1)}
              onClick={() => setPage((value) => value + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <DomainFormDialog
        open={open}
        mode="create"
        leadOptions={leadOptions}
        pending={createMutation.isPending}
        onOpenChange={setOpen}
        onSubmit={(values) => createMutation.mutate(values)}
      />

      <DomainFormDialog
        open={Boolean(editDomain)}
        mode="edit"
        initial={editDomain}
        leadOptions={leadOptions}
        pending={updateMutation.isPending}
        onOpenChange={(value) => !value && setEditDomain(null)}
        onSubmit={(values) => editDomain && updateMutation.mutate({ id: editDomain.id, ...values })}
      />

      <CreateModal
        open={deleteId !== null}
        onOpenChange={(value) => !value && setDeleteId(null)}
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
          Weet je zeker dat je <span className="font-medium text-foreground">{domainToDelete?.domainName}</span> wilt
          verwijderen?
        </p>
      </CreateModal>
    </div>
  );
}
