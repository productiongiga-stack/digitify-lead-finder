"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@digitify/ui";
import Link from "next/link";
import { Plus, FileText, Euro, TrendingUp, CheckCircle, Send, Clock, XCircle } from "lucide-react";

const STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" }
> = {
  DRAFT: { label: "Concept", variant: "secondary" },
  SENT: { label: "Verzonden", variant: "info" },
  VIEWED: { label: "Bekeken", variant: "warning" },
  ACCEPTED: { label: "Goedgekeurd", variant: "success" },
  REJECTED: { label: "Afgewezen", variant: "destructive" },
  EXPIRED: { label: "Verlopen", variant: "outline" },
};

const FILTER_TABS = [
  { key: undefined as string | undefined, label: "Alle", icon: FileText },
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

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(d: Date | string) {
  return new Date(d).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function QuotesPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const { data, isLoading } = trpc.quote.list.useQuery({
    page,
    perPage: 20,
    status: statusFilter as "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "REJECTED" | "EXPIRED" | undefined,
  });
  const { data: stats } = trpc.quote.getStats.useQuery();

  const quotes = data?.quotes ?? [];
  const activeFilterCount = statusFilter ? 1 : 0;
  const nextQuote = quotes[0];
  const pendingPipeline = (stats?.draft ?? 0) + (stats?.sent ?? 0);

  // Calculate total value of currently displayed quotes
  const displayedTotal = quotes.reduce(
    (sum: number, q: NonNullable<typeof quotes>[number]) => sum + q.total,
    0
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Offertes</h1>
          <p className="text-sm text-muted-foreground">
            Beheer en verstuur offertes naar je klanten
          </p>
        </div>
        <Link href="/embed/quotes">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nieuwe Offerte
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totaal Offertes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.total ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats ? `${stats.draft} concept, ${stats.sent} verzonden` : ""}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Waarde</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.pipelineValue ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Openstaande offertes</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Goedgekeurd Waarde</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.totalValue ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.accepted ?? 0} goedgekeurde offertes
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acceptatieratio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? `${stats.accepted + stats.rejected > 0 ? Math.round((stats.accepted / (stats.accepted + stats.rejected)) * 100) : 0}%` : "0%"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats ? `${stats.accepted} goedgekeurd / ${stats.rejected} afgewezen` : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.label}
              variant={statusFilter === tab.key ? "default" : "outline"}
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
        {statusFilter ? (
          <Badge variant="outline" className="h-9 px-3">
            Filter: {STATUS_MAP[statusFilter]?.label ?? statusFilter}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50/80 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Volgende focus</p>
            <p className="mt-2 text-sm font-medium">
              {pendingPipeline > 0
                ? `${pendingPipeline} offerte${pendingPipeline !== 1 ? "s" : ""} zitten nog in de pipeline en vragen opvolging.`
                : "Geen open pipeline-items. Tijd voor nieuwe opportuniteiten."}
            </p>
            <Button asChild size="sm" variant="outline" className="mt-3">
              <Link href={nextQuote ? `/quotes/${nextQuote.id}` : "/embed/quotes"}>
                {nextQuote ? "Open bovenste offerte" : "Nieuwe offerte"}
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/80 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pipeline signalen</p>
            <p className="mt-2 text-sm font-medium">
              {stats?.sent ?? 0} verzonden · {stats?.accepted ?? 0} goedgekeurd · {stats?.rejected ?? 0} afgewezen
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Gebruik bekeken offertes als natuurlijke follow-up lijst voor sales.
            </p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/80 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gerelateerd</p>
            <div className="mt-3 flex flex-wrap gap-2">
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

      {/* Summary bar */}
      {quotes.length > 0 && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{quotes.length} offerte{quotes.length !== 1 ? "s" : ""} getoond</span>
          <span className="text-foreground font-medium">
            Totaal: {formatCurrency(displayedTotal)}
          </span>
          {activeFilterCount > 0 ? <span>Gefilterd resultaat</span> : null}
        </div>
      )}

      {/* Table */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !quotes.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium">Geen offertes gevonden</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {statusFilter
                  ? `Er zijn geen offertes met de status "${STATUS_MAP[statusFilter]?.label ?? statusFilter}".`
                  : "Maak een nieuwe offerte aan om te beginnen."}
              </p>
              {!statusFilter && (
                <Link href="/embed/quotes" className="mt-4">
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Nieuwe Offerte
                  </Button>
                </Link>
              )}
              {statusFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setStatusFilter(undefined);
                    setPage(1);
                  }}
                >
                  Alle offertes tonen
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nummer</TableHead>
                  <TableHead>Klant</TableHead>
                  <TableHead>Bedrag</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="w-[100px]">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((quote: NonNullable<typeof quotes>[number]) => {
                  const statusInfo = STATUS_MAP[quote.status] ?? STATUS_MAP.DRAFT;
                  return (
                    <TableRow
                      key={quote.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/quotes/${quote.id}`)}
                    >
                      <TableCell className="font-medium font-mono text-xs">
                        {quote.quoteNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          {quote.clientCompany ? (
                            <>
                              <p className="font-medium">{quote.clientCompany}</p>
                              <p className="text-xs text-muted-foreground">
                                {quote.clientName}
                              </p>
                            </>
                          ) : (
                            <p className="font-medium">{quote.clientName}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(quote.total)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant}>
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateShort(quote.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/quotes/${quote.id}`);
                          }}
                        >
                          Bekijken
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Vorige
          </Button>
          <span className="text-sm text-muted-foreground">
            Pagina {page} van {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Volgende
          </Button>
        </div>
      )}
    </div>
  );
}
