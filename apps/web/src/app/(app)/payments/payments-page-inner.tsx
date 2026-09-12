"use client";

import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from "@digitify/ui";
import { AlertTriangle, ArrowRight, Banknote, Clock3, RefreshCw, WalletCards } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { QueryErrorState } from "@/components/feedback/query-error-state";

type InvoiceStatus = "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";

const statusLabels: Record<InvoiceStatus, string> = {
  DRAFT: "Concept",
  SENT: "Verzonden",
  PARTIALLY_PAID: "Deels betaald",
  PAID: "Betaald",
  OVERDUE: "Vervallen",
  CANCELLED: "Geannuleerd",
};

function euro(value: number, currency = "EUR") {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency, maximumFractionDigits: 0 }).format(value || 0);
}

function date(value: string | Date) {
  return new Date(value).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" });
}

function statusVariant(status: InvoiceStatus): "secondary" | "warning" | "success" | "destructive" | "outline" | "info" {
  if (status === "PAID") return "success";
  if (status === "OVERDUE") return "destructive";
  if (status === "PARTIALLY_PAID") return "warning";
  if (status === "SENT") return "info";
  if (status === "CANCELLED") return "outline";
  return "secondary";
}

export function PaymentsPageInner() {
  const overview = trpc.payment.overview.useQuery(undefined, { staleTime: 15_000 });
  const data = overview.data;
  const refresh = () => void overview.refetch();

  return (
    <div className="app-page space-y-5">
      <div className="app-page-header flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="app-page-heading">
          <div className="mb-2 flex items-center gap-2 text-primary"><WalletCards className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wide">Verkoop</span></div>
          <h1 className="app-page-title">Betalingen</h1>
          <p className="app-page-subtitle">Volg openstaande bedragen en betaalstatussen vanuit je facturen.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline"><Link href="/invoices">Facturen beheren<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          <Button variant="outline" size="icon" onClick={refresh} disabled={overview.isFetching} title="Betalingen verversen" aria-label="Betalingen verversen"><RefreshCw className={overview.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button>
        </div>
      </div>

      {overview.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}</div>
      ) : overview.error ? (
        <QueryErrorState message={overview.error.message} onRetry={refresh} />
      ) : !data ? (
        <Card className="app-surface"><CardContent className="p-0"><EmptyState icon={<Banknote />} title="Geen betaaloverzicht" description="Er is nog geen factuurdata beschikbaar." /></CardContent></Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="app-surface"><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Openstaand</p><p className="mt-2 text-2xl font-semibold">{euro(data.open.amount)}</p><p className="mt-1 text-xs text-muted-foreground">{data.open.count} facturen</p></CardContent></Card>
            <Card className="app-surface"><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vervalt binnen 14 dagen</p><p className="mt-2 text-2xl font-semibold">{data.dueSoon.length}</p><p className="mt-1 text-xs text-muted-foreground">actie vereist</p></CardContent></Card>
            <Card className="app-surface"><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Betaald</p><p className="mt-2 text-2xl font-semibold">{data.status.PAID?.count ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">facturen geregistreerd</p></CardContent></Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
            <Card className="app-surface">
              <CardHeader className="border-b border-border/60 px-4 py-3 sm:px-5"><CardTitle className="text-base">Betaalopvolging</CardTitle></CardHeader>
              <CardContent className="divide-y divide-border/60 p-0">
                {data.dueSoon.length === 0 ? <EmptyState icon={<Clock3 />} title="Geen dringende betalingen" description="Er zijn geen openstaande facturen met een naderende vervaldatum." /> : data.dueSoon.map((invoice) => <div key={invoice.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><p className="text-sm font-semibold">{invoice.invoiceNumber} · {invoice.clientName}</p><p className="mt-1 text-xs text-muted-foreground">Vervaldatum {date(invoice.dueDate)} · {euro(invoice.total, invoice.currency)}</p></div><div className="flex items-center gap-2"><Badge variant={statusVariant(invoice.status as InvoiceStatus)}>{statusLabels[invoice.status as InvoiceStatus]}</Badge><Button asChild variant="ghost" size="icon" title="Factuur openen" aria-label={`Factuur ${invoice.invoiceNumber} openen`}><Link href="/invoices"><ArrowRight className="h-4 w-4" /></Link></Button></div></div>)}
              </CardContent>
            </Card>
            <Card className="app-surface">
              <CardHeader className="border-b border-border/60 px-4 py-3 sm:px-5"><CardTitle className="text-base">Statusverdeling</CardTitle></CardHeader>
              <CardContent className="space-y-3 p-4 sm:p-5">
                {(Object.keys(statusLabels) as InvoiceStatus[]).map((status) => <div key={status} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary/60" />{statusLabels[status]}</span><span className="font-semibold">{data.status[status]?.count ?? 0}</span></div>)}
              </CardContent>
            </Card>
          </div>

          <Card className="app-surface">
            <CardHeader className="border-b border-border/60 px-4 py-3 sm:px-5"><CardTitle className="text-base">Recent bijgewerkt</CardTitle></CardHeader>
            <CardContent className="divide-y divide-border/60 p-0">
              {data.recent.length === 0 ? <EmptyState icon={<Banknote />} title="Nog geen facturen" description="Maak een factuur vanuit een geaccepteerde offerte." /> : data.recent.map((invoice) => <div key={invoice.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><p className="text-sm font-semibold">{invoice.invoiceNumber} · {invoice.clientName}</p><p className="mt-1 text-xs text-muted-foreground">Bijgewerkt {date(invoice.updatedAt)} · {euro(invoice.total, invoice.currency)}</p></div><Badge variant={statusVariant(invoice.status as InvoiceStatus)}>{statusLabels[invoice.status as InvoiceStatus]}</Badge></div>)}
            </CardContent>
          </Card>
        </>
      )}
      {data?.dueSoon.some((invoice) => invoice.status === "OVERDUE") ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5 text-destructive" />Vervallen facturen vereisen handmatige opvolging via Facturen.</p> : null}
    </div>
  );
}
