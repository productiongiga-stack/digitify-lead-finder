import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router, mutationProcedure } from "../trpc";
import { migrateLegacyWorkspaceInvoices } from "../lib/migrate-workspace-invoices";
import { nextInvoiceNumber, serializeInvoice } from "../lib/invoice-serializer";
import { buildInvoiceOutboundBody } from "../lib/invoice-outbound";
import { sendTemplatedEmail } from "../lib/send-templated-email";
import { workspaceScopeFromUser, type WorkspaceScope } from "../lib/workspace-settings";

/** Quotes may use workspace id or legacy owner user id as createdById. */
function workspaceQuoteWhere(scope: WorkspaceScope) {
  return {
    OR: [{ createdById: scope.workspaceId }, { createdById: scope.memberId }],
  };
}

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
          page: z.number().min(1).default(1),
          pageSize: z.number().min(1).max(100).default(25),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const scope = workspaceScopeFromUser(ctx.user);
      await migrateLegacyWorkspaceInvoices(ctx.db, scope);

      const workspaceWhere = { createdById: scope.workspaceId };
      const listWhere = {
        ...workspaceWhere,
        ...(input.status ? { status: input.status } : {}),
      };

      const [rows, total, statusGroups, openAggregate, invoicedQuoteRows] = await Promise.all([
        ctx.db.workspaceInvoice.findMany({
          where: listWhere,
          include: invoiceInclude,
          orderBy: { issueDate: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.workspaceInvoice.count({ where: listWhere }),
        ctx.db.workspaceInvoice.groupBy({
          by: ["status"],
          where: workspaceWhere,
          _count: { _all: true },
        }),
        ctx.db.workspaceInvoice.aggregate({
          where: {
            ...workspaceWhere,
            status: { notIn: ["PAID", "CANCELLED"] },
          },
          _count: { _all: true },
          _sum: { total: true },
        }),
        ctx.db.workspaceInvoice.findMany({
          where: { ...workspaceWhere, quoteId: { not: null } },
          select: { quoteId: true },
        }),
      ]);

      const countByStatus = new Map(statusGroups.map((row) => [row.status, row._count._all]));
      const items = rows.map(serializeInvoice);
      const summary = {
        total: statusGroups.reduce((sum, row) => sum + row._count._all, 0),
        open: openAggregate._count._all,
        draft: countByStatus.get("DRAFT") ?? 0,
        sent: countByStatus.get("SENT") ?? 0,
        overdue: countByStatus.get("OVERDUE") ?? 0,
        paid: countByStatus.get("PAID") ?? 0,
        totalOpenAmount: openAggregate._sum.total ?? 0,
      };
      const invoicedQuoteIds = invoicedQuoteRows
        .map((row) => row.quoteId)
        .filter((id): id is string => typeof id === "string" && id.length > 0);

      return {
        items,
        summary,
        invoicedQuoteIds,
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      };
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
        ...workspaceQuoteWhere(scope),
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

  createFromQuote: mutationProcedure
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
        where: { id: input.quoteId, ...workspaceQuoteWhere(scope) },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
      if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "Offerte niet gevonden." });
      if (quote.status !== "ACCEPTED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Alleen geaccepteerde offertes kunnen worden gefactureerd.",
        });
      }
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

  update: mutationProcedure
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

  updateStatus: mutationProcedure
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

  createOutboundDraft: mutationProcedure
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

  sendReminder: mutationProcedure
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

      const result = await sendTemplatedEmail(ctx.db, ctx.user.workspaceId!, {
        templateKey: "invoice.reminder",
        toEmail: current.clientEmail,
        placeholderContext: {
          contactName: current.clientName,
          invoiceNumber: current.invoiceNumber,
          dueDate: new Date(current.dueDate).toLocaleDateString("nl-BE"),
          invoiceAmount: new Intl.NumberFormat("nl-BE", {
            style: "currency",
            currency: current.currency || "EUR",
          }).format(current.total),
          paymentReference: current.paymentReference,
        },
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

  remove: mutationProcedure
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
