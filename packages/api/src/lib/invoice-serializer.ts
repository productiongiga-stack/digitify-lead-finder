import type { WorkspaceInvoice, WorkspaceInvoiceItem } from "@digitify/db";

export type SerializedInvoice = {
  id: string;
  invoiceNumber: string;
  quoteId: string | null;
  leadId: string | null;
  clientName: string;
  clientEmail: string | null;
  clientCompany: string | null;
  clientAddress: string | null;
  clientVat: string | null;
  status: "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";
  issueDate: string;
  dueDate: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  currency: string;
  paymentReference: string;
  notes: string | null;
  reminderCount: number;
  lastReminderAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
};

export function computeInvoiceStatus(
  status: SerializedInvoice["status"],
  dueDate: Date,
): SerializedInvoice["status"] {
  if (status === "PAID" || status === "CANCELLED") return status;
  if (dueDate.getTime() < Date.now() && status !== "OVERDUE") return "OVERDUE";
  return status;
}

export function serializeInvoice(
  row: WorkspaceInvoice & { items: WorkspaceInvoiceItem[] },
): SerializedInvoice {
  const baseStatus = row.status as SerializedInvoice["status"];
  const status = computeInvoiceStatus(baseStatus, row.dueDate);

  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    quoteId: row.quoteId,
    leadId: row.leadId,
    clientName: row.clientName,
    clientEmail: row.clientEmail,
    clientCompany: row.clientCompany,
    clientAddress: row.clientAddress,
    clientVat: row.clientVat,
    status,
    issueDate: row.issueDate.toISOString(),
    dueDate: row.dueDate.toISOString(),
    subtotal: row.subtotal,
    vatRate: row.vatRate,
    vatAmount: row.vatAmount,
    total: row.total,
    currency: row.currency,
    paymentReference: row.paymentReference,
    notes: row.notes,
    reminderCount: row.reminderCount,
    lastReminderAt: row.lastReminderAt ? row.lastReminderAt.toISOString() : null,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    items: row.items
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((line) => ({
        id: line.id,
        name: line.name,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        total: line.total,
      })),
  };
}

export async function nextInvoiceNumber(db: any, workspaceId: string) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-${workspaceId.slice(-4).toUpperCase()}-`;
  const rows = await db.workspaceInvoice.findMany({
    where: {
      createdById: workspaceId,
      invoiceNumber: { startsWith: prefix },
    },
    select: { invoiceNumber: true },
  });
  const highest = rows.reduce((max: number, row: { invoiceNumber: string }) => {
    const raw = row.invoiceNumber.slice(prefix.length);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return max;
    return Math.max(max, parsed);
  }, 0);
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}
