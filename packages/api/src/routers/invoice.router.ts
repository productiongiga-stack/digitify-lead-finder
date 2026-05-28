import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { migrateLegacyWorkspaceInvoices } from "../lib/migrate-workspace-invoices";
import { nextInvoiceNumber, serializeInvoice } from "../lib/invoice-serializer";
import { buildInvoiceOutboundBody } from "../lib/invoice-outbound";
import { sendBrandedEmail } from "../lib/email-sender";
import { workspaceScopeFromUser } from "../lib/workspace-settings";

const invoiceInclude = { items: { orderBy: { sortOrder: "asc" as const } } };

const invoiceItemInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
});

const MANUAL_INVOICE_STATUSES = ["DRAFT", "PARTIALLY_PAID", "PAID", "CANCELLED"] as const;

function recalcInvoiceTotals(items: Array<{ quantity: number; unitPrice: number }>, vatRate: number) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const vatAmount = Math.round(subtotal * (vatRate / 100) * 100) / 100;
  return { subtotal, vatAmount, total: subtotal + vatAmount };
}

function assertInvoiceEditable(status: string) {
  if (status === "PAID" || status === "CANCELLED") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Betaalde of geannuleerde facturen kunnen niet meer worden aangepast.",
    });
  }
}

export const invoiceRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: z
            .enum(["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"])
            .optional(),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const scope = workspaceScopeFromUser(ctx.user);
      await migrateLegacyWorkspaceInvoices(ctx.db, scope);

      const rows = await ctx.db.workspaceInvoice.findMany({
        where: { createdById: scope.workspaceId },
        include: invoiceInclude,
        orderBy: { issueDate: "desc" },
      });

      const allItems = rows.map(serializeInvoice);
      const items = input.status
        ? allItems.filter((item) => item.status === input.status)
        : allItems;
      const openItems = allItems.filter((item) => !["PAID", "CANCELLED"].includes(item.status));
      const summary = {
        total: allItems.length,
        open: openItems.length,
        draft: allItems.filter((item) => item.status === "DRAFT").length,
        sent: allItems.filter((item) => item.status === "SENT").length,
        overdue: allItems.filter((item) => item.status === "OVERDUE").length,
        paid: allItems.filter((item) => item.status === "PAID").length,
        totalOpenAmount: openItems.reduce((sum, item) => sum + item.total, 0),
      };
      const invoicedQuoteIds = allItems
        .map((item) => item.quoteId)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      return { items, summary, invoicedQuoteIds };
    }),

  listBillableQuotes: protectedProcedure.query(async ({ ctx }) => {
    const scope = workspaceScopeFromUser(ctx.user);
    await migrateLegacyWorkspaceInvoices(ctx.db, scope);

    const invoicedRows = await ctx.db.workspaceInvoice.findMany({
      where: { createdById: scope.workspaceId, quoteId: { not: null } },
      select: { quoteId: true },
    });
    const invoicedQuoteIds = invoicedRows
      .map((row) => row.quoteId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    return ctx.db.quote.findMany({
      where: {
        createdById: scope.workspaceId,
        status: "ACCEPTED",
        items: { some: {} },
        ...(invoicedQuoteIds.length > 0 ? { id: { notIn: invoicedQuoteIds } } : {}),
      },
      orderBy: [{ acceptedAt: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        quoteNumber: true,
        clientName: true,
        clientCompany: true,
        total: true,
        acceptedAt: true,
        _count: { select: { items: true } },
      },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const scope = workspaceScopeFromUser(ctx.user);
      await migrateLegacyWorkspaceInvoices(ctx.db, scope);

      const row = await ctx.db.workspaceInvoice.findFirst({
        where: { id: input.id, createdById: scope.workspaceId },
        include: invoiceInclude,
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Factuur niet gevonden." });
      return serializeInvoice(row);
    }),

  createFromQuote: protectedProcedure
    .input(
      z.object({
        quoteId: z.string(),
        dueDate: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const scope = workspaceScopeFromUser(ctx.user);
      await migrateLegacyWorkspaceInvoices(ctx.db, scope);

      const quote = await ctx.db.quote.findFirst({
        where: { id: input.quoteId, createdById: scope.workspaceId },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
      if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "Offerte niet gevonden." });
      if (quote.items.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Kan geen factuur maken zonder offerte-items.",
        });
      }

      const existing = await ctx.db.workspaceInvoice.findFirst({
        where: { createdById: scope.workspaceId, quoteId: quote.id },
        include: invoiceInclude,
      });
      if (existing) return serializeInvoice(existing);

      const issueDate = new Date();
      const dueDate = input.dueDate
        ? new Date(input.dueDate)
        : new Date(issueDate.getTime() + 14 * 24 * 60 * 60 * 1000);

      const row = await ctx.db.workspaceInvoice.create({
        data: {
          createdById: scope.workspaceId,
          invoiceNumber: await nextInvoiceNumber(ctx.db, scope.workspaceId),
          quoteId: quote.id,
          leadId: quote.leadId,
          clientName: quote.clientName,
          clientEmail: quote.clientEmail,
          clientCompany: quote.clientCompany,
          clientAddress: quote.clientAddress,
          clientVat: quote.clientVat,
          status: "DRAFT",
          issueDate,
          dueDate,
          subtotal: quote.subtotal,
          vatRate: quote.vatRate,
          vatAmount: quote.vatAmount,
          total: quote.total,
          currency: "EUR",
          paymentReference: `+++${Math.floor(Math.random() * 900000000) + 100000000}+++`,
          notes: quote.notes,
          items: {
            create: quote.items.map((item, index) => ({
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
              sortOrder: index,
            })),
          },
        },
        include: invoiceInclude,
      });

      await ctx.db.activity.create({
        data: {
          userId: ctx.user.id,
          leadId: quote.leadId,
          type: "QUOTE_CREATED",
          title: `Factuur ${row.invoiceNumber} aangemaakt vanuit offerte ${quote.quoteNumber}`,
          metadata: { invoiceId: row.id, quoteId: quote.id, total: row.total },
        },
      });

      return serializeInvoice(row);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        clientName: z.string().min(1).optional(),
        clientEmail: z.string().email().optional().or(z.literal("")),
        clientCompany: z.string().optional(),
        clientAddress: z.string().optional(),
        clientVat: z.string().optional(),
        dueDate: z.string().datetime().optional(),
        vatRate: z.number().min(0).max(100).optional(),
        notes: z.string().optional(),
        items: z.array(invoiceItemInput).min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const scope = workspaceScopeFromUser(ctx.user);
      const row = await ctx.db.workspaceInvoice.findFirst({
        where: { id: input.id, createdById: scope.workspaceId },
        include: invoiceInclude,
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Factuur niet gevonden." });
      assertInvoiceEditable(row.status);

      const vatRate = input.vatRate ?? row.vatRate;
      const items =
        input.items ??
        row.items.map((item) => ({
          name: item.name,
          description: item.description ?? undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }));

      const totals = recalcInvoiceTotals(items, vatRate);

      const updated = await ctx.db.$transaction(async (tx) => {
        if (input.items) {
          await tx.workspaceInvoiceItem.deleteMany({ where: { invoiceId: row.id } });
          await tx.workspaceInvoiceItem.createMany({
            data: items.map((item, index) => ({
              invoiceId: row.id,
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.quantity * item.unitPrice,
              sortOrder: index,
            })),
          });
        }

        return tx.workspaceInvoice.update({
          where: { id: row.id },
          data: {
            clientName: input.clientName ?? row.clientName,
            clientEmail:
              input.clientEmail !== undefined
                ? input.clientEmail || null
                : row.clientEmail,
            clientCompany: input.clientCompany ?? row.clientCompany,
            clientAddress: input.clientAddress ?? row.clientAddress,
            clientVat: input.clientVat ?? row.clientVat,
            dueDate: input.dueDate ? new Date(input.dueDate) : row.dueDate,
            vatRate,
            notes: input.notes ?? row.notes,
            subtotal: totals.subtotal,
            vatAmount: totals.vatAmount,
            total: totals.total,
          },
          include: invoiceInclude,
        });
      });

      return serializeInvoice(updated);
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(MANUAL_INVOICE_STATUSES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const scope = workspaceScopeFromUser(ctx.user);
      const row = await ctx.db.workspaceInvoice.findFirst({
        where: { id: input.id, createdById: scope.workspaceId },
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Factuur niet gevonden." });

      const updated = await ctx.db.workspaceInvoice.update({
        where: { id: input.id },
        data: {
          status: input.status,
          paidAt: input.status === "PAID" ? new Date() : row.paidAt,
        },
        include: invoiceInclude,
      });
      return serializeInvoice(updated);
    }),

  createOutboundDraft: protectedProcedure
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const scope = workspaceScopeFromUser(ctx.user);
      const invoice = await ctx.db.workspaceInvoice.findFirst({
        where: { id: input.invoiceId, createdById: scope.workspaceId },
      });
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Factuur niet gevonden." });
      if (!invoice.leadId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Deze factuur heeft geen gekoppelde lead voor Outbound.",
        });
      }
      if (!invoice.clientEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Voeg eerst een klant-e-mailadres toe aan de factuur.",
        });
      }
      if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Deze factuur kan niet meer worden verstuurd.",
        });
      }

      if (invoice.status !== "DRAFT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Alleen concept-facturen kunnen via Outbound worden verstuurd.",
        });
      }

      const body = buildInvoiceOutboundBody({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
        total: invoice.total,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        paymentReference: invoice.paymentReference,
      });

      const draft = await ctx.db.emailDraft.create({
        data: {
          leadId: invoice.leadId,
          subject: `Factuur ${invoice.invoiceNumber}`,
          body,
          toEmail: invoice.clientEmail,
          status: "PENDING_APPROVAL",
          type: "TRANSACTIONAL",
          authorId: ctx.user.id,
        },
      });

      await ctx.db.activity.create({
        data: {
          leadId: invoice.leadId,
          userId: ctx.user.id,
          type: "EMAIL_DRAFTED",
          title: `Factuur ${invoice.invoiceNumber} ingediend ter goedkeuring`,
          metadata: { invoiceId: invoice.id },
        },
      });

      return { draftId: draft.id };
    }),

  sendReminder: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.workspaceInvoice.findFirst({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
        include: invoiceInclude,
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Factuur niet gevonden." });

      const current = serializeInvoice(row);
      if (current.status === "DRAFT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Verstuur de factuur eerst via Outbound voordat je een herinnering stuurt.",
        });
      }
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

      const updated = await ctx.db.workspaceInvoice.update({
        where: { id: input.id },
        data: {
          reminderCount: row.reminderCount + 1,
          lastReminderAt: new Date(),
        },
        include: invoiceInclude,
      });
      return serializeInvoice(updated);
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.workspaceInvoice.deleteMany({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
      });
      if (result.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Factuur niet gevonden." });
      }
      return { success: true };
    }),
});
