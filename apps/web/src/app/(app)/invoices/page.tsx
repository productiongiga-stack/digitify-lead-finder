"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { AlertTriangle, Banknote, Clock, Download, Mail, Pencil, Receipt, RefreshCw, Send, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { InvoiceFromQuoteComposer } from "@/components/invoices/invoice-from-quote-composer";
import { InvoiceEditor } from "@/components/invoices/invoice-editor";
import { useToast } from "@/components/feedback/toast-provider";

type InvoiceStatus = "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";
type ManualInvoiceStatus = "DRAFT" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";

const MANUAL_STATUS_OPTIONS: ManualInvoiceStatus[] = ["DRAFT", "PARTIALLY_PAID", "PAID", "CANCELLED"];

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

function formatDueDate(value: string | Date) {
  return new Date(value).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

export default function InvoicesPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "ALL">("ALL");
  const [quoteId, setQuoteId] = useState("");
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const list = trpc.invoice.list.useQuery(statusFilter === "ALL" ? {} : { status: statusFilter });
  const billableQuotesQuery = trpc.invoice.listBillableQuotes.useQuery();

  const updateStatus = trpc.invoice.updateStatus.useMutation({
    onSuccess: () => utils.invoice.list.invalidate(),
  });
  const sendReminder = trpc.invoice.sendReminder.useMutation({
    onSuccess: () => utils.invoice.list.invalidate(),
  });
  const removeInvoice = trpc.invoice.remove.useMutation({
    onSuccess: () => utils.invoice.list.invalidate(),
  });
  const createOutboundDraft = trpc.invoice.createOutboundDraft.useMutation({
    onSuccess: (data) => {
      utils.invoice.list.invalidate();
      showToast({
        title: "Outbound-concept aangemaakt",
        description: "Keur de e-mail goed en verstuur via Outbound.",
      });
      router.push(`/contacts/drafts/${data.draftId}`);
    },
    onError: (error) => {
      showToast({ title: "Outbound mislukt", description: error.message, variant: "error" });
    },
  });

  const items = list.data?.items || [];
  const summary = list.data?.summary;
  const openInvoices = useMemo(
    () => items.filter((item) => !["PAID", "CANCELLED"].includes(item.status)),
    [items],
  );

  const invoicedQuoteIds = useMemo(
    () => new Set(list.data?.invoicedQuoteIds ?? []),
    [list.data?.invoicedQuoteIds],
  );

  const billableQuotes = billableQuotesQuery.data ?? [];

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
          <CardTitle className="text-sm">Nieuwe factuur uit geaccepteerde offerte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-end">
            <div className="min-w-0 space-y-2">
              <Select value={quoteId} onValueChange={setQuoteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer geaccepteerde offerte" />
                </SelectTrigger>
                <SelectContent>
                  {billableQuotesQuery.isLoading ? (
                    <SelectItem value="__loading" disabled>
                      Offertes laden...
                    </SelectItem>
                  ) : billableQuotes.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      Geen geaccepteerde offertes om te factureren
                    </SelectItem>
                  ) : (
                    billableQuotes.map((quote) => (
                      <SelectItem key={quote.id} value={quote.id}>
                        {quote.quoteNumber} • {quote.clientCompany || quote.clientName} •{" "}
                        {formatCurrency(quote.total)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {!quoteId ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Alleen <span className="font-medium text-foreground">geaccepteerde</span> offertes zonder
                  bestaande factuur verschijnen hier. Controleer de regels en maak de factuur aan.
                </p>
              ) : null}
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
              <SelectTrigger className="w-full">
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

          {quoteId ? (
            <InvoiceFromQuoteComposer
              quoteId={quoteId}
              alreadyInvoiced={invoicedQuoteIds.has(quoteId)}
              onCancel={() => setQuoteId("")}
              onCreated={() => {
                setQuoteId("");
                utils.invoice.list.invalidate();
                utils.invoice.listBillableQuotes.invalidate();
              }}
            />
          ) : null}
        </CardContent>
      </Card>

      {list.isLoading ? (
        <Card><CardContent className="p-5 text-sm text-muted-foreground">Facturen laden...</CardContent></Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title="Geen facturen"
          description="Markeer een offerte als geaccepteerd op de offertepagina, of selecteer hierboven een geaccepteerde offerte om je eerste factuur aan te maken."
        />
      ) : (
        <div className="grid gap-3">
          {items.map((invoice) => {
            const status = invoice.status as InvoiceStatus;
            const isOverdue = status === "OVERDUE";
            const isDraft = status === "DRAFT";
            const canEdit = !["PAID", "CANCELLED"].includes(status);
            const canRemind = Boolean(invoice.clientEmail) && !["PAID", "CANCELLED", "DRAFT"].includes(status);
            const canSendOutbound = isDraft && Boolean(invoice.clientEmail) && Boolean(invoice.leadId);
            const statusOptions: Array<{ value: InvoiceStatus; disabled?: boolean }> =
              status === "SENT" || status === "OVERDUE"
                ? [{ value: status, disabled: true }, ...MANUAL_STATUS_OPTIONS.map((value) => ({ value }))]
                : MANUAL_STATUS_OPTIONS.map((value) => ({ value }));

            return (
              <Card key={invoice.id} className="invoice-row">
                <CardContent className="p-0">
                  <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="invoice-row-icon">
                        <Receipt className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold tracking-tight">{invoice.invoiceNumber}</p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {invoice.clientCompany || invoice.clientName}
                        </p>
                        {invoice.clientEmail ? (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground/80">{invoice.clientEmail}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant={STATUS_BADGE[status]} className="shrink-0">
                        {STATUS_LABEL[status]}
                      </Badge>
                      {isDraft ? (
                        <p className="max-w-[220px] text-right text-[11px] text-muted-foreground">
                          Versturen via Outbound na goedkeuring
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="invoice-metrics-row">
                    <div className="invoice-metric">
                      <p className="invoice-metric-label">Totaal</p>
                      <p className="invoice-metric-value">{formatCurrency(invoice.total, invoice.currency)}</p>
                    </div>
                    <div className="invoice-metric">
                      <p className="invoice-metric-label">Vervaldatum</p>
                      <p className={cn("invoice-metric-value", isOverdue && "text-destructive")}>
                        {formatDueDate(invoice.dueDate)}
                      </p>
                    </div>
                    <div className="invoice-metric">
                      <p className="invoice-metric-label">BTW</p>
                      <p className="invoice-metric-value">{invoice.vatRate}%</p>
                    </div>
                    <div className="invoice-metric">
                      <p className="invoice-metric-label">Herinneringen</p>
                      <p className="invoice-metric-value">{invoice.reminderCount || 0}</p>
                    </div>
                  </div>

                  <div className="invoice-actions-bar">
                    <Select
                      value={invoice.status}
                      onValueChange={(value) => {
                        if (!MANUAL_STATUS_OPTIONS.includes(value as ManualInvoiceStatus)) return;
                        updateStatus.mutate({ id: invoice.id, status: value as ManualInvoiceStatus });
                      }}
                    >
                      <SelectTrigger className="h-9 w-full min-w-[170px] max-w-[220px] rounded-xl bg-background/80">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((item) => (
                          <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
                            {STATUS_LABEL[item.value]}
                            {item.disabled ? " (via Outbound)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-xl"
                        disabled={!canEdit}
                        onClick={() =>
                          setEditingInvoiceId((current) => (current === invoice.id ? null : invoice.id))
                        }
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        {editingInvoiceId === invoice.id ? "Sluiten" : "Bewerken"}
                      </Button>
                      {canSendOutbound ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 rounded-xl"
                          disabled={createOutboundDraft.isPending}
                          onClick={() => createOutboundDraft.mutate({ invoiceId: invoice.id })}
                        >
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                          Via Outbound
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-xl"
                        onClick={() => window.open(`/api/invoices/${invoice.id}/pdf`, "_blank")}
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-xl"
                        disabled={sendReminder.isPending || !canRemind}
                        onClick={() => sendReminder.mutate({ id: invoice.id })}
                      >
                        {sendReminder.isPending ? (
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Mail className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Reminder
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={removeInvoice.isPending}
                        onClick={() => removeInvoice.mutate({ id: invoice.id })}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Verwijder
                      </Button>
                    </div>
                  </div>

                  {editingInvoiceId === invoice.id ? (
                    <InvoiceEditor
                      invoiceId={invoice.id}
                      onClose={() => setEditingInvoiceId(null)}
                      onSaved={() => setEditingInvoiceId(null)}
                    />
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
