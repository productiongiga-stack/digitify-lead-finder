import type { PrismaClient } from "@digitify/db";
import { readWorkspaceJsonSetting } from "./user-json-setting";
import type { WorkspaceScope } from "./workspace-settings";

const LEGACY_INVOICES_KEY = "invoices.items_json";

type LegacyInvoiceItem = {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
};

type LegacyInvoice = {
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
  items: LegacyInvoiceItem[];
};

export async function migrateLegacyWorkspaceInvoices(
  db: PrismaClient,
  scope: WorkspaceScope,
): Promise<{ imported: number }> {
  const existing = await db.workspaceInvoice.count({
    where: { createdById: scope.workspaceId },
  });
  if (existing > 0) return { imported: 0 };

  const raw = await readWorkspaceJsonSetting<unknown[]>(db, scope, LEGACY_INVOICES_KEY, []);
  if (!Array.isArray(raw) || raw.length === 0) return { imported: 0 };

  let imported = 0;

  for (const entry of raw.slice(0, 3000)) {
    if (!entry || typeof entry !== "object") continue;
    const inv = entry as LegacyInvoice;
    if (typeof inv.id !== "string" || !inv.invoiceNumber || !inv.clientName) continue;

    const exists = await db.workspaceInvoice.findFirst({
      where: { id: inv.id, createdById: scope.workspaceId },
      select: { id: true },
    });
    if (exists) continue;

    await db.workspaceInvoice.create({
      data: {
        id: inv.id,
        createdById: scope.workspaceId,
        invoiceNumber: inv.invoiceNumber,
        quoteId: inv.quoteId,
        leadId: inv.leadId,
        clientName: inv.clientName,
        clientEmail: inv.clientEmail,
        clientCompany: inv.clientCompany,
        clientAddress: inv.clientAddress,
        clientVat: inv.clientVat,
        status: inv.status,
        issueDate: new Date(inv.issueDate),
        dueDate: new Date(inv.dueDate),
        subtotal: inv.subtotal,
        vatRate: inv.vatRate,
        vatAmount: inv.vatAmount,
        total: inv.total,
        currency: inv.currency || "EUR",
        paymentReference: inv.paymentReference,
        notes: inv.notes,
        reminderCount: inv.reminderCount ?? 0,
        lastReminderAt: inv.lastReminderAt ? new Date(inv.lastReminderAt) : null,
        paidAt: inv.paidAt ? new Date(inv.paidAt) : null,
        createdAt: new Date(inv.createdAt),
        updatedAt: new Date(inv.updatedAt),
        items: {
          create: (Array.isArray(inv.items) ? inv.items : []).map((line, index) => ({
            id: line.id,
            name: line.name,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            total: line.total,
            sortOrder: index,
          })),
        },
      },
    });
    imported += 1;
  }

  return { imported };
}
