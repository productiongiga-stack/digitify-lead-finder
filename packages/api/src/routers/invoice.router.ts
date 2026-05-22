import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { migrateLegacyWorkspaceInvoices } from "../lib/migrate-workspace-invoices";
import { nextInvoiceNumber, serializeInvoice } from "../lib/invoice-serializer";
import { sendBrandedEmail } from "../lib/email-sender";
import { workspaceScopeFromUser } from "../lib/workspace-settings";

const invoiceInclude = { items: { orderBy: { sortOrder: "asc" as const } } };

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

      let items = rows.map(serializeInvoice);
      if (input.status) items = items.filter((item) => item.status === input.status);
      const summary = {
        total: items.length,
        draft: items.filter((item) => item.status === "DRAFT").length,
        sent: items.filter((item) => item.status === "SENT").length,
        overdue: items.filter((item) => item.status === "OVERDUE").length,
        paid: items.filter((item) => item.status === "PAID").length,
        totalOpenAmount: items
          .filter((item) => !["PAID", "CANCELLED"].includes(item.status))
          .reduce((sum, item) => sum + item.total, 0),
      };
      return { items, summary };
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
          status: quote.status === "ACCEPTED" ? "SENT" : "DRAFT",
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

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.workspaceInvoice.findFirst({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
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

  sendReminder: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.workspaceInvoice.findFirst({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
        include: invoiceInclude,
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Factuur niet gevonden." });

      const current = serializeInvoice(row);
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
          status: row.status === "DRAFT" ? "SENT" : row.status,
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
