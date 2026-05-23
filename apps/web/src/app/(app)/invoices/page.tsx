"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc/client";
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
  StatsCards,
  type StatItem,
} from "@digitify/ui";
import { AlertTriangle, Banknote, Clock, Download, Mail, Receipt, RefreshCw } from "lucide-react";

type InvoiceStatus = "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "Concept",
  SENT: "Verzonden",
  PARTIALLY_PAID: "Deels betaald",
  PAID: "Betaald",
  OVERDUE: "Vervallen",
  CANCELLED: "Geannuleerd",
};

const STATUS_BADGE: Record<InvoiceStatus, "secondary" | "warning" | "success" | "destructive" | "outline" | "info"> = {
  DRAFT: "secondary",
  SENT: "info",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "destructive",
  CANCELLED: "outline",
};

function formatCurrency(value: number, currency = "EUR") {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency }).format(value || 0);
}

export default function InvoicesPage() {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "ALL">("ALL");
  const [quoteId, setQuoteId] = useState("");
  const utils = trpc.useUtils();
  const list = trpc.invoice.list.useQuery(statusFilter === "ALL" ? {} : { status: statusFilter });
  const quotes = trpc.quote.list.useQuery({ page: 1, perPage: 100 });

  const createFromQuote = trpc.invoice.createFromQuote.useMutation({
    onSuccess: () => {
      utils.invoice.list.invalidate();
      setQuoteId("");
    },
  });
  const updateStatus = trpc.invoice.updateStatus.useMutation({
    onSuccess: () => utils.invoice.list.invalidate(),
  });
  const sendReminder = trpc.invoice.sendReminder.useMutation({
    onSuccess: () => utils.invoice.list.invalidate(),
  });
  const removeInvoice = trpc.invoice.remove.useMutation({
    onSuccess: () => utils.invoice.list.invalidate(),
  });

  const items = list.data?.items || [];
  const summary = list.data?.summary;
  const openInvoices = useMemo(
    () => items.filter((item) => !["PAID", "CANCELLED"].includes(item.status)),
    [items],
  );

  const statItems = useMemo<StatItem[]>(
    () => [
      {
        label: "Totaal facturen",
        value: summary?.total ?? 0,
        icon: <Receipt />,
        hint: statusFilter !== "ALL" ? `Filter: ${STATUS_LABEL[statusFilter as InvoiceStatus]}` : undefined,
      },
      {
        label: "Openstaand",
        value: openInvoices.length,
        icon: <Clock />,
        hint: "Nog niet betaald of geannuleerd",
        tone: openInvoices.length > 0 ? "warning" : "neutral",
      },
      {
        label: "Vervallen",
        value: summary?.overdue ?? 0,
        icon: <AlertTriangle />,
        hint: "Na vervaldatum",
        tone: (summary?.overdue ?? 0) > 0 ? "negative" : "neutral",
      },
      {
        label: "Open bedrag",
        value: formatCurrency(summary?.totalOpenAmount ?? 0),
        icon: <Banknote />,
        hint: "Totaal uitstaand",
        tone: (summary?.totalOpenAmount ?? 0) > 0 ? "warning" : "neutral",
      },
    ],
    [summary, openInvoices.length, statusFilter],
  );

  return (
    <div className="app-page space-y-4">
      <div className="app-page-header">
        <div className="app-page-heading">
          <h1 className="app-page-title">Facturen</h1>
          <p className="app-page-subtitle">Converteer offertes naar facturen, beheer BTW, status en herinneringen.</p>
        </div>
      </div>

      <StatsCards items={statItems} columns={4} loading={list.isLoading} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Nieuwe factuur uit offerte</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <div className="w-full min-w-[260px] max-w-[480px]">
            <Select value={quoteId} onValueChange={setQuoteId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteer offerte" />
              </SelectTrigger>
              <SelectContent>
                {(quotes.data?.quotes || []).map((quote) => (
                  <SelectItem key={quote.id} value={quote.id}>
                    {quote.quoteNumber} • {quote.clientCompany || quote.clientName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" disabled={!quoteId} onClick={() => createFromQuote.mutate({ quoteId })}>
            <Receipt className="mr-2 h-4 w-4" />
            Factuur aanmaken
          </Button>
          <div className="ml-auto">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Alle statussen</SelectItem>
                {(Object.keys(STATUS_LABEL) as InvoiceStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>{STATUS_LABEL[status]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {list.isLoading ? (
        <Card><CardContent className="p-5 text-sm text-muted-foreground">Facturen laden...</CardContent></Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title="Geen facturen"
          description="Maak een factuur vanuit een bestaande offerte."
        />
      ) : (
        <div className="grid gap-3">
          {items.map((invoice) => (
            <Card key={invoice.id}>
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{invoice.invoiceNumber}</p>
                    <Badge variant={STATUS_BADGE[invoice.status as InvoiceStatus]}>
                      {STATUS_LABEL[invoice.status as InvoiceStatus]}
                    </Badge>
                    <Badge variant="outline">{formatCurrency(invoice.total, invoice.currency)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {invoice.clientCompany || invoice.clientName} · vervalt op {new Date(invoice.dueDate).toLocaleDateString("nl-BE")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    BTW {invoice.vatRate}% · herinneringen {invoice.reminderCount || 0}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={invoice.status}
                    onValueChange={(value) =>
                      updateStatus.mutate({ id: invoice.id, status: value as InvoiceStatus })
                    }
                  >
                    <SelectTrigger className="w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABEL) as InvoiceStatus[]).map((status) => (
                        <SelectItem key={status} value={status}>{STATUS_LABEL[status]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`/api/invoices/${invoice.id}/pdf`, "_blank")}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={sendReminder.isPending}
                    onClick={() => sendReminder.mutate({ id: invoice.id })}
                  >
                    {sendReminder.isPending ? (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Mail className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Reminder
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => removeInvoice.mutate({ id: invoice.id })}>
                    Verwijder
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
