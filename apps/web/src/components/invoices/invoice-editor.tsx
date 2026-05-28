"use client";

import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
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
import { Plus, Save, Trash2, X } from "lucide-react";
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
  dueDate: string;
  items: DraftItem[];
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(value || 0);
}

function calcTotals(items: DraftItem[], vatRate: number) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const vatAmount = Math.round(subtotal * (vatRate / 100) * 100) / 100;
  return { subtotal, vatAmount, total: subtotal + vatAmount };
}

type Props = {
  invoiceId: string;
  onClose: () => void;
  onSaved: () => void;
};

export function InvoiceEditor({ invoiceId, onClose, onSaved }: Props) {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<DraftForm | null>(null);

  const invoiceQuery = trpc.invoice.getById.useQuery({ id: invoiceId });

  const updateInvoice = trpc.invoice.update.useMutation({
    onSuccess: () => {
      utils.invoice.list.invalidate();
      utils.invoice.getById.invalidate({ id: invoiceId });
      showToast({ title: "Factuur opgeslagen", description: "Wijzigingen zijn bewaard." });
      onSaved();
    },
    onError: (error) => {
      showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" });
    },
  });

  useEffect(() => {
    if (invoiceQuery.data) {
      const invoice = invoiceQuery.data;
      setDraft({
        clientName: invoice.clientName,
        clientEmail: invoice.clientEmail || "",
        clientCompany: invoice.clientCompany || "",
        clientAddress: invoice.clientAddress || "",
        clientVat: invoice.clientVat || "",
        vatRate: invoice.vatRate,
        notes: invoice.notes || "",
        dueDate: invoice.dueDate.slice(0, 10),
        items: invoice.items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description || "",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });
    }
  }, [invoiceQuery.data]);

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

  async function handleSave() {
    if (!draft) return;
    if (draft.items.some((item) => !item.name.trim())) {
      showToast({
        title: "Regels incompleet",
        description: "Elke regel moet een omschrijving hebben.",
        variant: "error",
      });
      return;
    }

    const due = new Date(`${draft.dueDate}T12:00:00`);
    await updateInvoice.mutateAsync({
      id: invoiceId,
      clientName: draft.clientName.trim(),
      clientEmail: draft.clientEmail.trim() || "",
      clientCompany: draft.clientCompany.trim() || undefined,
      clientAddress: draft.clientAddress.trim() || undefined,
      clientVat: draft.clientVat.trim() || undefined,
      dueDate: due.toISOString(),
      vatRate: draft.vatRate,
      notes: draft.notes.trim() || undefined,
      items: draft.items.map((item) => ({
        name: item.name.trim(),
        description: item.description.trim() || undefined,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    });
  }

  if (invoiceQuery.isLoading || !draft) {
    return (
      <div className="border-t border-border/60 p-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-3 h-32 w-full" />
      </div>
    );
  }

  const isPending = updateInvoice.isPending;
  const isLocked = ["PAID", "CANCELLED"].includes(invoiceQuery.data!.status);

  return (
    <div className="border-t border-border/60 bg-muted/15 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Factuur bewerken</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pas klantgegevens, regels en vervaldatum aan.
          </p>
        </div>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {isLocked ? (
        <p className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          Deze factuur is {invoiceQuery.data!.status === "PAID" ? "betaald" : "geannuleerd"} en kan niet meer worden
          bewerkt.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`edit-client-name-${invoiceId}`}>Klantnaam</Label>
            <Input
              id={`edit-client-name-${invoiceId}`}
              value={draft.clientName}
              disabled={isLocked || isPending}
              onChange={(e) => setDraft({ ...draft, clientName: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`edit-client-company-${invoiceId}`}>Bedrijf</Label>
            <Input
              id={`edit-client-company-${invoiceId}`}
              value={draft.clientCompany}
              disabled={isLocked || isPending}
              onChange={(e) => setDraft({ ...draft, clientCompany: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`edit-client-email-${invoiceId}`}>E-mail</Label>
            <Input
              id={`edit-client-email-${invoiceId}`}
              type="email"
              value={draft.clientEmail}
              disabled={isLocked || isPending}
              onChange={(e) => setDraft({ ...draft, clientEmail: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`edit-due-date-${invoiceId}`}>Vervaldatum</Label>
            <Input
              id={`edit-due-date-${invoiceId}`}
              type="date"
              value={draft.dueDate}
              disabled={isLocked || isPending}
              onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`edit-vat-rate-${invoiceId}`}>BTW (%)</Label>
            <Input
              id={`edit-vat-rate-${invoiceId}`}
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={draft.vatRate}
              disabled={isLocked || isPending}
              onChange={(e) => setDraft({ ...draft, vatRate: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`edit-notes-${invoiceId}`}>Notities</Label>
            <Textarea
              id={`edit-notes-${invoiceId}`}
              rows={3}
              value={draft.notes}
              disabled={isLocked || isPending}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Omschrijving</TableHead>
              <TableHead className="w-[90px]">Aantal</TableHead>
              <TableHead className="w-[120px]">Prijs</TableHead>
              <TableHead className="w-[120px] text-right">Totaal</TableHead>
              {!isLocked ? <TableHead className="w-[52px]" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {draft.items.map((item, index) => (
              <TableRow key={item.id ?? `new-${index}`}>
                <TableCell>
                  <Input
                    value={item.name}
                    disabled={isLocked || isPending}
                    placeholder="Omschrijving"
                    onChange={(e) => updateItem(index, { name: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    disabled={isLocked || isPending}
                    onChange={(e) => updateItem(index, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.unitPrice}
                    disabled={isLocked || isPending}
                    onChange={(e) => updateItem(index, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrency(item.quantity * item.unitPrice)}
                </TableCell>
                {!isLocked ? (
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

      {!isLocked ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3 rounded-xl"
          disabled={isPending}
          onClick={addItem}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Regel toevoegen
        </Button>
      ) : null}

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-border/60 pt-4">
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
          <Button type="button" variant="outline" className="rounded-xl" disabled={isPending} onClick={onClose}>
            Sluiten
          </Button>
          {!isLocked ? (
            <Button type="button" className="rounded-xl" disabled={isPending} onClick={() => void handleSave()}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {updateInvoice.isPending ? "Bezig..." : "Opslaan"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}