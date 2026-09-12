"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@digitify/ui";
import { BarChart3, FileText, Receipt, RefreshCw, Target, TrendingUp, Users } from "lucide-react";

type Period = "month" | "quarter" | "year";

function periodDates(period: Period) {
  const to = new Date();
  const from = new Date(to);
  if (period === "month") from.setDate(1);
  if (period === "quarter") from.setMonth(to.getMonth() - 2, 1);
  if (period === "year") from.setMonth(0, 1);
  return { from, to };
}

function euro(value: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function MetricCard({ label, value, detail, icon: Icon, href }: { label: string; value: string; detail: string; icon: typeof Users; href: string }) {
  return (
    <Link href={href} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <Card className="app-surface h-full transition-colors hover:border-primary/40">
        <CardContent className="flex items-start justify-between gap-3 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </div>
          <span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></span>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ReportingOverviewPage() {
  const [period, setPeriod] = useState<Period>("month");
  const dates = useMemo(() => periodDates(period), [period]);
  const overview = trpc.report.overview.useQuery(dates, { staleTime: 30_000 });

  return (
    <div className="app-page space-y-5">
      <div className="app-page-header flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="app-page-heading">
          <div className="mb-2 flex items-center gap-2 text-primary"><BarChart3 className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wide">Analyse</span></div>
          <h1 className="app-page-title">Rapportage</h1>
          <p className="app-page-subtitle">Een compact overzicht van je commerciële voortgang.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
            <SelectTrigger className="w-[150px]" aria-label="Rapportageperiode"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Deze maand</SelectItem>
              <SelectItem value="quarter">Dit kwartaal</SelectItem>
              <SelectItem value="year">Dit jaar</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => overview.refetch()} disabled={overview.isFetching} title="Verversen" aria-label="Rapportage verversen">
            <RefreshCw className={overview.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </div>
      </div>

      {overview.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-xl" />)}</div>
      ) : overview.error ? (
        <QueryErrorState message={overview.error.message} onRetry={() => overview.refetch()} />
      ) : !overview.data ? (
        <Card className="app-surface"><CardContent className="p-0"><EmptyState icon={<BarChart3 />} title="Geen rapportage beschikbaar" description="Er is nog geen data voor deze periode." /></CardContent></Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Leads" value={String(overview.data.leads.total)} detail={`${overview.data.leads.won} gewonnen`} icon={Users} href="/leads" />
            <MetricCard label="Conversie" value={`${overview.data.leads.conversionRate}%`} detail="Leads naar gewonnen" icon={TrendingUp} href="/crm" />
            <MetricCard label="Offertewaarde" value={euro(overview.data.quotes.value)} detail={`${overview.data.quotes.total} offertes`} icon={FileText} href="/quotes" />
            <MetricCard label="Omzet gefactureerd" value={euro(overview.data.invoices.value)} detail={`${overview.data.invoices.total} facturen`} icon={Receipt} href="/invoices" />
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="app-surface">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3"><CardTitle className="text-base">Commerciële signalen</CardTitle><Badge variant="outline">Live uit je workspace</Badge></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Gemiddelde leadscore</p><p className="mt-1 text-xl font-semibold">{overview.data.leads.averageScore}</p><p className="text-xs text-muted-foreground">op 100</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Actieve campagnes</p><p className="mt-1 text-xl font-semibold">{overview.data.campaigns.active}</p><p className="text-xs text-muted-foreground">van {overview.data.campaigns.total} totaal</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Gefactureerd</p><p className="mt-1 text-xl font-semibold">{euro(overview.data.invoices.value)}</p><p className="text-xs text-muted-foreground">in gekozen periode</p></div>
              </CardContent>
            </Card>
            <Card className="app-surface">
              <CardHeader className="pb-3"><CardTitle className="text-base">Verder werken</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                <Link className="flex items-center justify-between rounded-lg border p-3 text-sm hover:border-primary/40" href="/leads"><span className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" />Leads kwalificeren</span><span aria-hidden>→</span></Link>
                <Link className="flex items-center justify-between rounded-lg border p-3 text-sm hover:border-primary/40" href="/quotes"><span className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />Offertes opvolgen</span><span aria-hidden>→</span></Link>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
