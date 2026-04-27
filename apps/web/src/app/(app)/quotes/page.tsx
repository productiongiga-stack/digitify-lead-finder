"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import {
  Button,
  Badge,
  Card,
  CardContent,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  DataTable,
  type DataTableColumn,
  EmptyState,
  StatsCards,
  type StatItem,
} from "@digitify/ui";
import {
  Plus,
  FileText,
  Euro,
  TrendingUp,
  CheckCircle,
  Send,
  Clock,
  XCircle,
} from "lucide-react";

type QuoteStatus = "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "REJECTED" | "EXPIRED";

const STATUS_MAP: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";
  }
> = {
  DRAFT: { label: "Concept", variant: "secondary" },
  SENT: { label: "Verzonden", variant: "info" },
  VIEWED: { label: "Bekeken", variant: "warning" },
  ACCEPTED: { label: "Goedgekeurd", variant: "success" },
  REJECTED: { label: "Afgewezen", variant: "destructive" },
  EXPIRED: { label: "Verlopen", variant: "outline" },
};

const FILTER_TABS: { key: QuoteStatus | undefined; label: string; icon: typeof FileText }[] = [
  { key: undefined, label: "Alle", icon: FileText },
  { key: "DRAFT", label: "Concept", icon: Clock },
  { key: "SENT", label: "Verzonden", icon: Send },
  { key: "ACCEPTED", label: "Goedgekeurd", icon: CheckCircle },
  { key: "REJECTED", label: "Afgewezen", icon: XCircle },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDateShort(d: Date | string) {
  return new Date(d).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type Quote = {
  id: string;
  quoteNumber: string;
  clientName: string;
  clientCompany: string | null;
  total: number;
  status: string;
  createdAt: Date | string;
};

export default function QuotesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadIdFilter = searchParams.get("leadId") || undefined;
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | undefined>(undefined);
  const pageSize = 20;

  const { data, isLoading } = trpc.quote.list.useQuery({
    page,
    perPage: pageSize,
    leadId: leadIdFilter,
    status: statusFilter,
  });
  const { data: stats } = trpc.quote.getStats.useQuery();

  const quotes = (data?.quotes ?? []) as Quote[];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const nextQuote = quotes[0];
  const pendingPipeline = (stats?.draft ?? 0) + (stats?.sent ?? 0);
  const displayedTotal = quotes.reduce((sum, q) => sum + q.total, 0);
  const acceptanceRate =
    stats && stats.accepted + stats.rejected > 0
      ? Math.round((stats.accepted / (stats.accepted + stats.rejected)) * 100)
      : 0;

  const statItems: StatItem[] = [
    {
      label: "Totaal Offertes",
      value: total,
      icon: <FileText />,
      hint: stats ? `${stats.draft} concept · ${stats.sent} verzonden` : undefined,
    },
    {
      label: "Pipeline Waarde",
      value: formatCurrency(stats?.pipelineValue ?? 0),
      icon: <Euro />,
      hint: "Openstaande offertes",
    },
    {
      label: "Goedgekeurd Waarde",
      value: formatCurrency(stats?.totalValue ?? 0),
      icon: <CheckCircle />,
      hint: stats ? `${stats.accepted} goedgekeurd` : undefined,
      tone: "positive",
    },
    {
      label: "Acceptatieratio",
      value: `${acceptanceRate}%`,
      icon: <TrendingUp />,
      hint: stats ? `${stats.accepted} ✓ / ${stats.rejected} ✗` : undefined,
      tone: acceptanceRate >= 60 ? "positive" : acceptanceRate >= 30 ? "warning" : "neutral",
    },
  ];

  const columns = useMemo<DataTableColumn<Quote>[]>(
    () => [
      {
        id: "number",
        header: "Nummer",
        cell: (q) => <span className="font-mono text-xs">{q.quoteNumber}</span>,
      },
      {
        id: "client",
        header: "Klant",
        cell: (q) => (
          <div className="min-w-0">
            {q.clientCompany ? (
              <>
                <p className="truncate font-medium">{q.clientCompany}</p>
                <p className="truncate text-xs text-muted-foreground">{q.clientName}</p>
              </>
            ) : (
              <p className="truncate font-medium">{q.clientName}</p>
            )}
          </div>
        ),
      },
      {
        id: "total",
        header: "Bedrag",
        align: "right",
        cell: (q) => <span className="font-medium tabular-nums">{formatCurrency(q.total)}</span>,
      },
      {
        id: "status",
        header: "Status",
        cell: (q) => {
          const info = STATUS_MAP[q.status] ?? STATUS_MAP.DRAFT;
          return <Badge variant={info.variant}>{info.label}</Badge>;
        },
      },
      {
        id: "createdAt",
        header: "Datum",
        hideBelow: "md",
        cell: (q) => (
          <span className="text-sm text-muted-foreground">{formatDateShort(q.createdAt)}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        stopPropagation: true,
        cell: (q) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => router.push(`/quotes/${q.id}`)}
          >
            Bekijken
          </Button>
        ),
      },
    ],
    [router],
  );

  const renderMobileCard = (q: Quote) => {
    const info = STATUS_MAP[q.status] ?? STATUS_MAP.DRAFT;
    return (
      <button
        type="button"
        onClick={() => router.push(`/quotes/${q.id}`)}
        className="rounded-xl border p-3 text-left transition-colors hover:bg-muted/40"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{q.clientCompany || q.clientName}</p>
            {q.clientCompany ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{q.clientName}</p>
            ) : null}
            <p className="mt-0.5 text-[11px] font-mono text-muted-foreground">{q.quoteNumber}</p>
          </div>
          <Badge variant={info.variant}>{info.label}</Badge>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">{formatCurrency(q.total)}</p>
          <p className="text-xs text-muted-foreground">{formatDateShort(q.createdAt)}</p>
        </div>
      </button>
    );
  };

  const emptyEl = (
    <EmptyState
      icon={<FileText />}
      title="Geen offertes gevonden"
      description={
        statusFilter
          ? `Er zijn geen offertes met de status "${STATUS_MAP[statusFilter]?.label ?? statusFilter}".`
          : "Maak een nieuwe offerte aan om te beginnen."
      }
      action={
        statusFilter ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatusFilter(undefined);
              setPage(1);
            }}
          >
            Alle offertes tonen
          </Button>
        ) : (
          <Link href="/quotes/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nieuwe Offerte
            </Button>
          </Link>
        )
      }
    />
  );

  return (
    <div className="app-page">
      <div className="app-page-header">
        <div className="app-page-heading">
          <h1 className="app-page-title">Offertes</h1>
          <p className="app-page-subtitle">Beheer en verstuur offertes naar je klanten</p>
        </div>
        <div className="app-page-actions">
          <Link href="/quotes/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nieuwe Offerte
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-3">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3">
          {/* Filter Tabs */}
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-max flex-wrap items-center gap-1.5">
              {FILTER_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = statusFilter === tab.key;
                return (
                  <Button
                    key={tab.label}
                    variant={active ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setStatusFilter(tab.key);
                      setPage(1);
                    }}
                  >
                    <Icon className="mr-1.5 h-3.5 w-3.5" />
                    {tab.label}
                  </Button>
                );
              })}
              {leadIdFilter ? (
                <Badge variant="outline" className="h-7 px-2">
                  Lead filter actief
                </Badge>
              ) : null}
              {leadIdFilter ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/leads/${leadIdFilter}`}>Open lead</Link>
                </Button>
              ) : null}
            </div>
          </div>

          {/* Stats */}
          <StatsCards items={statItems} columns={4} loading={!stats} />

          {/* Summary bar */}
          {quotes.length > 0 ? (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                {quotes.length} offerte{quotes.length !== 1 ? "s" : ""} getoond
              </span>
              <span className="font-medium text-foreground">
                Totaal: {formatCurrency(displayedTotal)}
              </span>
            </div>
          ) : null}

          {/* Table */}
          <DataTable<Quote>
            data={quotes}
            columns={columns}
            getRowId={(q) => q.id}
            loading={isLoading}
            onRowClick={(q) => router.push(`/quotes/${q.id}`)}
            renderMobileCard={renderMobileCard}
            empty={emptyEl}
            pagination={{
              page,
              pageSize,
              total,
              totalPages,
              onPageChange: setPage,
            }}
          />
        </TabsContent>

        <TabsContent value="info" className="space-y-3">
          <div className="grid gap-3 xl:grid-cols-3">
            <Card className="border-emerald-200 bg-emerald-50/80 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Volgende focus
                </p>
                <p className="mt-1.5 text-sm font-medium">
                  {pendingPipeline > 0
                    ? `${pendingPipeline} offerte${pendingPipeline !== 1 ? "s" : ""} zitten nog in de pipeline en vragen opvolging.`
                    : "Geen open pipeline-items. Tijd voor nieuwe opportuniteiten."}
                </p>
                <Button asChild size="sm" variant="outline" className="mt-2.5">
                  <Link href={nextQuote ? `/quotes/${nextQuote.id}` : "/quotes/new"}>
                    {nextQuote ? "Open bovenste offerte" : "Nieuwe offerte"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/80 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Pipeline signalen
                </p>
                <p className="mt-1.5 text-sm font-medium">
                  {stats?.sent ?? 0} verzonden · {stats?.accepted ?? 0} goedgekeurd ·{" "}
                  {stats?.rejected ?? 0} afgewezen
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Gebruik bekeken offertes als natuurlijke follow-up lijst voor sales.
                </p>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50/80 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Gerelateerd
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button asChild size="sm" variant="outline">
                    <Link href="/settings/quotes">Quote instellingen</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/leads">Open leads</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
