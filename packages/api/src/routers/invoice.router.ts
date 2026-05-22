import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { readWorkspaceJsonSetting, writeWorkspaceJsonSetting } from "../lib/user-json-setting";
import { sendBrandedEmail } from "../lib/email-sender";
import { workspaceScopeFromUser, type WorkspaceScope } from "../lib/workspace-settings";

const INVOICES_KEY = "invoices.items_json";

const invoiceItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().default(null),
  quantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
});

const invoiceSchema = z.object({
  id: z.string(),
  invoiceNumber: z.string(),
  quoteId: z.string().nullable().default(null),
  leadId: z.string().nullable().default(null),
  clientName: z.string(),
  clientEmail: z.string().nullable().default(null),
  clientCompany: z.string().nullable().default(null),
  clientAddress: z.string().nullable().default(null),
  clientVat: z.string().nullable().default(null),
  status: z.enum(["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"]).default("DRAFT"),
  issueDate: z.string(),
  dueDate: z.string(),
  subtotal: z.number(),
  vatRate: z.number(),
  vatAmount: z.number(),
  total: z.number(),
  currency: z.string().default("EUR"),
  paymentReference: z.string(),
  notes: z.string().nullable().default(null),
  reminderCount: z.number().default(0),
  lastReminderAt: z.string().nullable().default(null),
  paidAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
  items: z.array(invoiceItemSchema),
});

type InvoiceItem = z.infer<typeof invoiceSchema>;

async function loadInvoices(db: any, scope: WorkspaceScope): Promise<InvoiceItem[]> {
  const raw = await readWorkspaceJsonSetting<unknown[]>(db, scope, INVOICES_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => invoiceSchema.safeParse(item))
    .filter((item) => item.success)
    .map((item) => item.data);
}

function nextInvoiceNumber(userId: string, existing: InvoiceItem[]) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-${userId.slice(-4).toUpperCase()}-`;
  const highest = existing.reduce((max, item) => {
    if (!item.invoiceNumber.startsWith(prefix)) return max;
    const raw = item.invoiceNumber.slice(prefix.length);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return max;
    return Math.max(max, parsed);
  }, 0);
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}

function computeInvoiceStatus(item: InvoiceItem) {
  if (item.status === "PAID" || item.status === "CANCELLED") return item.status;
  const now = Date.now();
  const dueAt = new Date(item.dueDate).getTime();
  if (Number.isFinite(dueAt) && dueAt < now && item.status !== "OVERDUE") {
    return "OVERDUE" as const;
  }
  return item.status;
}

export const invoiceRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"]).optional(),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const scope = workspaceScopeFromUser(ctx.user);
      let invoices = await loadInvoices(ctx.db, scope);
      invoices = invoices.map((item) => ({ ...item, status: computeInvoiceStatus(item) }));
      if (input.status) invoices = invoices.filter((item) => item.status === input.status);
      invoices.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
      const summary = {
        total: invoices.length,
        draft: invoices.filter((item) => item.status === "DRAFT").length,
        sent: invoices.filter((item) => item.status === "SENT").length,
        overdue: invoices.filter((item) => item.status === "OVERDUE").length,
        paid: invoices.filter((item) => item.status === "PAID").length,
        totalOpenAmount: invoices
          .filter((item) => !["PAID", "CANCELLED"].includes(item.status))
          .reduce((sum, item) => sum + item.total, 0),
      };
      return { items: invoices, summary };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const scope = workspaceScopeFromUser(ctx.user);
      const invoices = await loadInvoices(ctx.db, scope);
      const item = invoices.find((invoice) => invoice.id === input.id);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Factuur niet gevonden." });
      return { ...item, status: computeInvoiceStatus(item) };
    }),

  createFromQuote: protectedProcedure
    .input(
      z.object({
        quoteId: z.string(),
        dueDate: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const quote = await ctx.db.quote.findFirst({
        where: { id: input.quoteId, createdById: ctx.user.workspaceId! },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
      if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "Offerte niet gevonden." });
      if (quote.items.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Kan geen factuur maken zonder offerte-items.",
        });
      }

      const scope = workspaceScopeFromUser(ctx.user);
      const invoices = await loadInvoices(ctx.db, scope);
      const existing = invoices.find((invoice) => invoice.quoteId === quote.id);
      if (existing) return existing;

      const issueDate = new Date();
      const dueDate = input.dueDate ? new Date(input.dueDate) : new Date(issueDate.getTime() + 14 * 24 * 60 * 60 * 1000);
      const invoice: InvoiceItem = {
        id: randomUUID(),
        invoiceNumber: nextInvoiceNumber(scope.workspaceId, invoices),
        quoteId: quote.id,
        leadId: quote.leadId,
        clientName: quote.clientName,
        clientEmail: quote.clientEmail || null,
        clientCompany: quote.clientCompany || null,
        clientAddress: quote.clientAddress || null,
        clientVat: quote.clientVat || null,
        status: quote.status === "ACCEPTED" ? "SENT" : "DRAFT",
        issueDate: issueDate.toISOString(),
        dueDate: dueDate.toISOString(),
        subtotal: quote.subtotal,
        vatRate: quote.vatRate,
        vatAmount: quote.vatAmount,
        total: quote.total,
        currency: "EUR",
        paymentReference: `+++${Math.floor(Math.random() * 900000000) + 100000000}+++`,
        notes: quote.notes || null,
        reminderCount: 0,
        lastReminderAt: null,
        paidAt: null,
        createdAt: issueDate.toISOString(),
        updatedAt: issueDate.toISOString(),
        items: quote.items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
      };
      invoices.unshift(invoice);
      await writeWorkspaceJsonSetting(ctx.db, scope, INVOICES_KEY, invoices.slice(0, 3000));

      await ctx.db.activity.create({
        data: {
          userId: ctx.user.id,
          leadId: quote.leadId,
          type: "QUOTE_CREATED",
          title: `Factuur ${invoice.invoiceNumber} aangemaakt vanuit offerte ${quote.quoteNumber}`,
          metadata: { invoiceId: invoice.id, quoteId: quote.id, total: invoice.total },
        },
      });

      return invoice;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const scope = workspaceScopeFromUser(ctx.user);
      const invoices = await loadInvoices(ctx.db, scope);
      const index = invoices.findIndex((invoice) => invoice.id === input.id);
      if (index < 0) throw new TRPCError({ code: "NOT_FOUND", message: "Factuur niet gevonden." });
      const current = invoices[index];
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Factuur niet gevonden." });
      const next: InvoiceItem = {
        ...current,
        status: input.status,
        paidAt: input.status === "PAID" ? new Date().toISOString() : current.paidAt,
        updatedAt: new Date().toISOString(),
      };
      invoices[index] = next;
      await writeWorkspaceJsonSetting(ctx.db, scope, INVOICES_KEY, invoices);
      return next;
    }),

  sendReminder: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const scope = workspaceScopeFromUser(ctx.user);
      const invoices = await loadInvoices(ctx.db, scope);
      const index = invoices.findIndex((invoice) => invoice.id === input.id);
      if (index < 0) throw new TRPCError({ code: "NOT_FOUND", message: "Factuur niet gevonden." });
      const current = invoices[index];
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Factuur niet gevonden." });
      if (!current.clientEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Deze factuur heeft geen klant e-mailadres.",
        });
      }
      const result = await sendBrandedEmail(ctx.db, {
        toEmail: current.clientEmail,
        subject: `Betalingsherinnering ${current.invoiceNumber}`,
        body: [
          `Beste ${current.clientName},`,
          ``,
          `Dit is een vriendelijke herinnering voor factuur ${current.invoiceNumber}.`,
          `Vervaldatum: ${new Date(current.dueDate).toLocaleDateString("nl-BE")}`,
          `Openstaand bedrag: ${new Intl.NumberFormat("nl-BE", { style: "currency", currency: current.currency || "EUR" }).format(current.total)}`,
          `Betalingsreferentie: ${current.paymentReference}`,
          ``,
          `Gelieve dit bedrag zo snel mogelijk te voldoen.`,
        ].join("\n"),
        recipientCompany: current.clientCompany || current.clientName,
        userId: ctx.user.id,
      });
      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Herinnering verzenden mislukt.",
        });
      }

      const updated: InvoiceItem = {
        ...current,
        status: current.status === "DRAFT" ? "SENT" : current.status,
        reminderCount: (current.reminderCount || 0) + 1,
        lastReminderAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      invoices[index] = updated;
      await writeWorkspaceJsonSetting(ctx.db, scope, INVOICES_KEY, invoices);
      return updated;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const scope = workspaceScopeFromUser(ctx.user);
      const invoices = await loadInvoices(ctx.db, scope);
      const filtered = invoices.filter((invoice) => invoice.id !== input.id);
      if (filtered.length === invoices.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Factuur niet gevonden." });
      }
      await writeWorkspaceJsonSetting(ctx.db, scope, INVOICES_KEY, filtered);
      return { success: true };
    }),
});
