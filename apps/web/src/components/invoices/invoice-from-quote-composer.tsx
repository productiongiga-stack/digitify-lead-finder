"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import {
  Badge,
  Button,
  Input,
  Label,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@digitify/ui";
import { ExternalLink, Plus, Receipt, Save, Trash2 } from "lucide-react";
import { useToast } from "@/components/feedback/toast-provider";
import { cn } from "@/lib/utils";

type DraftItem = {
  id?: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

type DraftForm = {
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  clientAddress: string;
  clientVat: string;
  vatRate: number;
  notes: string;
  items: DraftItem[];
};

const QUOTE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Concept",
  SENT: "Verstuurd",
  VIEWED: "Bekeken",
  ACCEPTED: "Geaccepteerd",
  REJECTED: "Afgewezen",
  EXPIRED: "Verlopen",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(value || 0);
}

function defaultDueDateValue() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().slice(0, 10);
}

function quoteToDraft(quote: {
  clientName: string;
  clientEmail: string | null;
  clientCompany: string | null;
  clientAddress: string | null;
  clientVat: string | null;
  vatRate: number;
  notes: string | null;
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    quantity: number;
    unitPrice: number;
  }>;
}): DraftForm {
  return {
    clientName: quote.clientName,
    clientEmail: quote.clientEmail || "",
    clientCompany: quote.clientCompany || "",
    clientAddress: quote.clientAddress || "",
    clientVat: quote.clientVat || "",
    vatRate: quote.vatRate,
    notes: quote.notes || "",
    items: quote.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || "",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  };
}

function calcTotals(items: DraftItem[], vatRate: number) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const vatAmount = Math.round(subtotal * (vatRate / 100) * 100) / 100;
  return { subtotal, vatAmount, total: subtotal + vatAmount };
}

type Props = {
  quoteId: string;
  alreadyInvoiced?: boolean;
  onCancel: () => void;
  onCreated: () => void;
};

export function InvoiceFromQuoteComposer({ quoteId, alreadyInvoiced, onCancel, onCreated }: Props) {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<DraftForm | null>(null);
  const [dueDate, setDueDate] = useState(defaultDueDateValue);

  const quoteQuery = trpc.quote.getById.useQuery({ id: quoteId });

  const updateQuote = trpc.quote.update.useMutation({
    onSuccess: () => {
      utils.quote.getById.invalidate({ id: quoteId });
      showToast({ title: "Offerte opgeslagen", description: "Wijzigingen zijn bewaard op de offerte." });
    },
    onError: (error) => {
      showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" });
    },
  });

  const createFromQuote = trpc.invoice.createFromQuote.useMutation({
    onSuccess: () => {
      utils.invoice.list.invalidate();
      utils.invoice.listBillableQuotes.invalidate();
      showToast({ title: "Factuur aangemaakt", description: "De factuur staat klaar als concept." });
      onCreated();
    },
    onError: (error) => {
      showToast({ title: "Factuur aanmaken mislukt", description: error.message, variant: "error" });
    },
  });

  useEffect(() => {
    if (quoteQuery.data) {
      setDraft(quoteToDraft(quoteQuery.data));
      setDueDate(defaultDueDateValue());
    }
  }, [quoteQuery.data]);

  const canEditQuote = quoteQuery.data?.status !== "ACCEPTED";
  const totals = useMemo(
    () => (draft ? calcTotals(draft.items, draft.vatRate) : { subtotal: 0, vatAmount: 0, total: 0 }),
    [draft],
  );

  function updateItem(index: number, patch: Partial<DraftItem>) {
    if (!draft) return;
    setDraft({
      ...draft,
      items: draft.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    });
  }

  function addItem() {
    if (!draft) return;
    setDraft({
      ...draft,
      items: [...draft.items, { name: "", description: "", quantity: 1, unitPrice: 0 }],
    });
  }

  function removeItem(index: number) {
    if (!draft || draft.items.length <= 1) return;
    setDraft({ ...draft, items: draft.items.filter((_, i) => i !== index) });
  }

  async function saveQuoteDraft(): Promise<boolean> {
    if (!draft || !canEditQuote) return true;
    if (draft.items.some((item) => !item.name.trim())) {
      showToast({
        title: "Regels incompleet",
        description: "Elke regel moet een omschrijving hebben.",
        variant: "error",
      });
      return false;
    }
    await updateQuote.mutateAsync({
      id: quoteId,
      clientName: draft.clientName,
      clientEmail: draft.clientEmail || undefined,
      clientCompany: draft.clientCompany || undefined,
      clientAddress: draft.clientAddress || undefined,
      clientVat: draft.clientVat || undefined,
      vatRate: draft.vatRate,
      notes: draft.notes || undefined,
      items: draft.items.map((item) => ({
        id: item.id,
        name: item.name.trim(),
        description: item.description || undefined,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    });
    return true;
  }

  async function handleCreateInvoice() {
    if (alreadyInvoiced) {
      showToast({
        title: "Al gefactureerd",
        description: "Voor deze offerte bestaat al een factuur.",
        variant: "error",
      });
      return;
    }
    if (!draft) return;
    if (draft.items.length === 0) {
      showToast({
        title: "Geen regels",
        description: "Voeg minstens één regel toe aan de offerte.",
        variant: "error",
      });
      return;
    }
    if (draft.items.some((item) => !item.name.trim())) {
      showToast({
        title: "Regels incompleet",
        description: "Elke regel moet een omschrijving hebben.",
        variant: "error",
      });
      return;
    }

    if (canEditQuote) {
      const saved = await saveQuoteDraft();
      if (!saved) return;
    }

    const due = new Date(`${dueDate}T12:00:00`);
    createFromQuote.mutate({
      quoteId,
      dueDate: due.toISOString(),
    });
  }

  if (quoteQuery.isLoading || !draft) {
    return (
      <div className="mt-4 space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const quote = quoteQuery.data!;
  const isPending = updateQuote.isPending || createFromQuote.isPending;

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-primary/15 bg-gradient-to-br from-muted/30 via-background to-muted/20 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Offerte voor facturatie</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold tracking-tight">{quote.quoteNumber}</p>
            <Badge variant="secondary">{QUOTE_STATUS_LABEL[quote.status] ?? quote.status}</Badge>
            {alreadyInvoiced ? <Badge variant="outline">Al gefactureerd</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Controleer en pas de offerte aan voordat je de factuur aanmaakt.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="rounded-xl">
          <Link href={`/quotes/${quoteId}`}>
            Volledige offerte
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {!canEditQuote ? (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          Deze offerte is geaccepteerd en kan niet meer worden bewerkt. Je kunt wel direct een factuur aanmaken.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="invoice-client-name">Klantnaam</Label>
            <Input
              id="invoice-client-name"
              value={draft.clientName}
              disabled={!canEditQuote || isPending}
              onChange={(e) => setDraft({ ...draft, clientName: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invoice-client-company">Bedrijf</Label>
            <Input
              id="invoice-client-company"
              value={draft.clientCompany}
              disabled={!canEditQuote || isPending}
              onChange={(e) => setDraft({ ...draft, clientCompany: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invoice-client-email">E-mail</Label>
            <Input
              id="invoice-client-email"
              type="email"
              value={draft.clientEmail}
              disabled={!canEditQuote || isPending}
              onChange={(e) => setDraft({ ...draft, clientEmail: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="invoice-due-date">Vervaldatum factuur</Label>
            <Input
              id="invoice-due-date"
              type="date"
              value={dueDate}
              disabled={isPending}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invoice-vat-rate">BTW (%)</Label>
            <Input
              id="invoice-vat-rate"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={draft.vatRate}
              disabled={!canEditQuote || isPending}
              onChange={(e) => setDraft({ ...draft, vatRate: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invoice-notes">Notities</Label>
            <Textarea
              id="invoice-notes"
              rows={3}
              value={draft.notes}
              disabled={!canEditQuote || isPending}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Optionele notities op de factuur"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Omschrijving</TableHead>
              <TableHead className="w-[90px]">Aantal</TableHead>
              <TableHead className="w-[120px]">Prijs</TableHead>
              <TableHead className="w-[120px] text-right">Totaal</TableHead>
              {canEditQuote ? <TableHead className="w-[52px]" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {draft.items.map((item, index) => (
              <TableRow key={item.id ?? `new-${index}`}>
                <TableCell>
                  <Input
                    value={item.name}
                    disabled={!canEditQuote || isPending}
                    placeholder="Omschrijving"
                    onChange={(e) => updateItem(index, { name: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    disabled={!canEditQuote || isPending}
                    onChange={(e) => updateItem(index, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.unitPrice}
                    disabled={!canEditQuote || isPending}
                    onChange={(e) => updateItem(index, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrency(item.quantity * item.unitPrice)}
                </TableCell>
                {canEditQuote ? (
                  <TableCell>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      disabled={isPending || draft.items.length <= 1}
                      onClick={() => removeItem(index)}
                      aria-label="Regel verwijderen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {canEditQuote ? (
        <Button type="button" size="sm" variant="outline" className="rounded-xl" disabled={isPending} onClick={addItem}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Regel toevoegen
        </Button>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border/60 pt-4">
        <div className="space-y-1 text-sm">
          <div className="flex gap-6 tabular-nums">
            <span className="text-muted-foreground">Subtotaal</span>
            <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex gap-6 tabular-nums">
            <span className="text-muted-foreground">BTW ({draft.vatRate}%)</span>
            <span className="font-medium">{formatCurrency(totals.vatAmount)}</span>
          </div>
          <div className={cn("flex gap-6 tabular-nums text-base")}>
            <span className="font-medium">Totaal</span>
            <span className="font-semibold">{formatCurrency(totals.total)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-xl" disabled={isPending} onClick={onCancel}>
            Annuleren
          </Button>
          {canEditQuote ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={isPending}
              onClick={() => void saveQuoteDraft()}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Offerte opslaan
            </Button>
          ) : null}
          <Button
            type="button"
            className="rounded-xl"
            disabled={isPending || alreadyInvoiced}
            onClick={() => void handleCreateInvoice()}
          >
            <Receipt className="mr-1.5 h-3.5 w-3.5" />
            {createFromQuote.isPending ? "Bezig..." : "Factuur aanmaken"}
          </Button>
        </div>
      </div>
    </div>
  );
}
