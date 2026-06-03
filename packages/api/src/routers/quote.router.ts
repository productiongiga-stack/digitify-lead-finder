import { z } from "zod";
import { router, protectedProcedure, mutationProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@digitify/db";
import {
  appendQuoteIdMarker,
  buildQuoteOutboundEmailBody,
  syncQuoteOutboundDrafts,
} from "../lib/quote-outbound-email";
import { ensureLeadLink } from "../lib/lead-link";
import { assertLeadAccess } from "../lib/tenant";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

type QuoteForEmail = {
  id: string;
  leadId: string | null;
  clientName: string;
  clientCompany: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  total: number;
  quoteNumber: string;
  items: Array<{ id: string }>;
  lead?: { id: string; companyName: string } | null;
};

type QuoteLeadResolution =
  | { mode: "linked"; leadId: string; leadName: string }
  | { mode: "matched"; leadId: string; leadName: string }
  | { mode: "will_create"; leadId: null; leadName: string | null }
  | { mode: "missing"; leadId: null; leadName: null };

async function resolveQuoteLeadForEmail(db: PrismaClient, quote: QuoteForEmail, userId: string): Promise<QuoteLeadResolution> {
  if (quote.leadId && quote.lead?.id) {
    return {
      mode: "linked",
      leadId: quote.lead.id,
      leadName: quote.lead.companyName,
    };
  }

  const byEmail = quote.clientEmail
    ? await db.lead.findFirst({
        where: { email: quote.clientEmail.trim().toLowerCase(), createdById: userId },
        select: { id: true, companyName: true },
        orderBy: { updatedAt: "desc" },
      })
    : null;
  if (byEmail) {
    return {
      mode: "matched",
      leadId: byEmail.id,
      leadName: byEmail.companyName,
    };
  }

  const companyCandidate = (quote.clientCompany || quote.clientName || "").trim();
  const byCompany = companyCandidate
    ? await db.lead.findFirst({
        where: { companyName: companyCandidate, createdById: userId },
        select: { id: true, companyName: true },
        orderBy: { updatedAt: "desc" },
      })
    : null;
  if (byCompany) {
    return {
      mode: "matched",
      leadId: byCompany.id,
      leadName: byCompany.companyName,
    };
  }

  if (quote.clientEmail || companyCandidate) {
    return {
      mode: "will_create",
      leadId: null,
      leadName: companyCandidate || null,
    };
  }

  return {
    mode: "missing",
    leadId: null,
    leadName: null,
  };
}

function buildQuoteEmailPreflight(quote: QuoteForEmail, leadResolution: QuoteLeadResolution) {
  const checks = [
    {
      key: "clientEmail",
      label: "Klant e-mail",
      ok: Boolean(quote.clientEmail),
      blocking: true,
      detail: quote.clientEmail || "Ontbreekt",
    },
    {
      key: "items",
      label: "Minstens 1 dienst",
      ok: quote.items.length > 0,
      blocking: true,
      detail: quote.items.length > 0 ? `${quote.items.length} item(s)` : "Geen items",
    },
    {
      key: "total",
      label: "Totaal > €0",
      ok: quote.total > 0,
      blocking: true,
      detail: formatCurrency(quote.total),
    },
    {
      key: "lead",
      label: "Lead koppeling",
      ok: leadResolution.mode !== "missing",
      blocking: true,
      detail:
        leadResolution.mode === "linked"
          ? `Gekoppeld: ${leadResolution.leadName}`
          : leadResolution.mode === "matched"
            ? `Wordt gelinkt aan: ${leadResolution.leadName}`
            : leadResolution.mode === "will_create"
              ? "Wordt automatisch aangemaakt bij verzenden"
              : "Niet mogelijk",
    },
  ];

  const blockingIssues = checks.filter((check) => check.blocking && !check.ok);
  const warnings: string[] = [];
  if (leadResolution.mode === "will_create") {
    warnings.push("Bij indienen wordt automatisch een nieuwe lead aangemaakt.");
  }
  warnings.push("Offertes worden niet automatisch verstuurd. Indienen gaat naar Outbound ter goedkeuring.");

  return {
    canSend: blockingIssues.length === 0,
    checks,
    blockingIssues: blockingIssues.map((check) => check.label),
    warnings,
    leadResolution,
  };
}

export const quoteRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          page: z.number().min(1).default(1),
          perPage: z.number().min(1).max(50).default(10),
          leadId: z.string().optional(),
          status: z
            .enum([
              "DRAFT",
              "SENT",
              "VIEWED",
              "ACCEPTED",
              "REJECTED",
              "EXPIRED",
            ])
            .optional(),
        })
        .default({})
    )
    .query(async ({ ctx, input }) => {
      const { page, perPage, status, leadId } = input;
      if (leadId) await assertLeadAccess(ctx.db, ctx.user.workspaceId!, leadId);
      const where: Record<string, unknown> = { createdById: ctx.user.workspaceId! };
      if (status) where.status = status;
      if (leadId) where.leadId = leadId;
      const [quotes, total] = await Promise.all([
        ctx.db.quote.findMany({
          where: where as any,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * perPage,
          take: perPage,
          include: {
            lead: { select: { id: true, companyName: true } },
            createdBy: { select: { id: true, name: true } },
            _count: { select: { items: true } },
          },
        }),
        ctx.db.quote.count({ where: where as any }),
      ]);
      return {
        quotes,
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const quote = await ctx.db.quote.findFirst({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
        include: {
          lead: {
            select: {
              id: true,
              companyName: true,
              website: true,
              city: true,
              industry: true,
            },
          },
          createdBy: { select: { id: true, name: true } },
          items: { orderBy: { sortOrder: "asc" } },
        },
      });
      if (!quote)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Offerte niet gevonden",
        });
      return quote;
    }),

  emailPreflight: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const quote = await ctx.db.quote.findFirst({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
        include: {
          lead: { select: { id: true, companyName: true } },
          items: { select: { id: true } },
        },
      });

      if (!quote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Offerte niet gevonden",
        });
      }

      const leadResolution = await resolveQuoteLeadForEmail(ctx.db, quote, ctx.user.id);
      return buildQuoteEmailPreflight(quote, leadResolution);
    }),

  create: mutationProcedure
    .input(
      z.object({
        leadId: z.string().optional(),
        clientName: z.string().min(1),
        clientEmail: z.string().optional(),
        clientPhone: z.string().optional(),
        clientCompany: z.string().optional(),
        clientAddress: z.string().optional(),
        clientVat: z.string().optional(),
        validUntil: z.string().optional(),
        vatRate: z.number().default(21),
        notes: z.string().optional(),
        terms: z.string().optional(),
        items: z
          .array(
            z.object({
              category: z.string().optional(),
              name: z.string().min(1),
              description: z.string().optional(),
              quantity: z.number().min(1).default(1),
              unitPrice: z.number().min(0),
            })
          )
          .default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Generate quote number: OFF-YYYY-XXXX
      const year = new Date().getFullYear();
      const count = await ctx.db.quote.count({
        where: { createdById: ctx.user.workspaceId! },
      });
      const quoteNumber = `OFF-${year}-${ctx.user.id.slice(-4).toUpperCase()}-${String(count + 1).padStart(4, "0")}`;
      let resolvedLeadId = input.leadId || null;
      if (resolvedLeadId) {
        await assertLeadAccess(ctx.db, ctx.user.workspaceId!, resolvedLeadId);
      } else {
        const clientEmail = input.clientEmail?.trim().toLowerCase();
        const companyCandidate = (input.clientCompany || input.clientName || "").trim();
        if (clientEmail || companyCandidate) {
          const existingLead = await ctx.db.lead.findFirst({
            where: {
              createdById: ctx.user.workspaceId!,
              OR: [
                ...(clientEmail ? [{ email: clientEmail }] : []),
                ...(companyCandidate ? [{ companyName: companyCandidate }] : []),
              ],
            },
            select: { id: true },
            orderBy: { updatedAt: "desc" },
          });
          resolvedLeadId = existingLead?.id ?? null;
        }
      }

      // Calculate totals
      const items = input.items.map((item, i) => ({
        ...item,
        total: item.quantity * item.unitPrice,
        sortOrder: i,
      }));
      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const vatAmount =
        Math.round(subtotal * (input.vatRate / 100) * 100) / 100;
      const total = subtotal + vatAmount;

      const quote = await ctx.db.quote.create({
        data: {
          quoteNumber,
          leadId: resolvedLeadId,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          clientPhone: input.clientPhone,
          clientCompany: input.clientCompany,
          clientAddress: input.clientAddress,
          clientVat: input.clientVat,
          validUntil: input.validUntil
            ? new Date(input.validUntil)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          vatRate: input.vatRate,
          subtotal,
          vatAmount,
          total,
          notes: input.notes,
          terms: input.terms,
          createdById: ctx.user.workspaceId!,
          items: {
            create: items,
          },
        },
        include: {
          lead: { select: { id: true, companyName: true } },
          createdBy: { select: { id: true, name: true } },
          items: { orderBy: { sortOrder: "asc" } },
        },
      });

      await ctx.db.activity.create({
        data: {
          leadId: resolvedLeadId,
          userId: ctx.user.id,
          type: "QUOTE_CREATED",
          title: `Offerte ${quoteNumber} aangemaakt voor ${input.clientName}`,
          metadata: { quoteId: quote.id, total, leadLinked: Boolean(resolvedLeadId) },
        },
      });

      return quote;
    }),

  update: mutationProcedure
    .input(
      z.object({
        id: z.string(),
        clientName: z.string().optional(),
        clientEmail: z.string().optional(),
        clientPhone: z.string().optional(),
        clientCompany: z.string().optional(),
        clientAddress: z.string().optional(),
        clientVat: z.string().optional(),
        validUntil: z.string().optional(),
        vatRate: z.number().optional(),
        discount: z.number().optional(),
        notes: z.string().optional(),
        terms: z.string().optional(),
        internalNotes: z.string().optional(),
        items: z
          .array(
            z.object({
              id: z.string().optional(),
              category: z.string().optional(),
              name: z.string().min(1),
              description: z.string().optional(),
              quantity: z.number().min(1).default(1),
              unitPrice: z.number().min(0),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.quote.findFirst({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
      });
      if (!existing)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Offerte niet gevonden",
        });
      if (existing.status === "ACCEPTED")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Geaccepteerde offerte kan niet worden bewerkt",
        });

      const vatRate = input.vatRate ?? existing.vatRate;
      const discount = input.discount ?? existing.discount;

      let subtotal = existing.subtotal;

      // If items are provided, replace all items
      if (input.items) {
        await ctx.db.quoteItem.deleteMany({ where: { quoteId: input.id } });
        const items = input.items.map((item, i) => ({
          quoteId: input.id,
          category: item.category,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
          sortOrder: i,
        }));
        await ctx.db.quoteItem.createMany({ data: items });
        subtotal = items.reduce((sum, item) => sum + item.total, 0);
      }

      const discountedSubtotal = subtotal - discount;
      const vatAmount =
        Math.round(discountedSubtotal * (vatRate / 100) * 100) / 100;
      const total = discountedSubtotal + vatAmount;

      const quote = await ctx.db.quote.update({
        where: { id: input.id },
        data: {
          ...(input.clientName && { clientName: input.clientName }),
          ...(input.clientEmail !== undefined && {
            clientEmail: input.clientEmail,
          }),
          ...(input.clientPhone !== undefined && {
            clientPhone: input.clientPhone,
          }),
          ...(input.clientCompany !== undefined && {
            clientCompany: input.clientCompany,
          }),
          ...(input.clientAddress !== undefined && {
            clientAddress: input.clientAddress,
          }),
          ...(input.clientVat !== undefined && { clientVat: input.clientVat }),
          ...(input.validUntil && { validUntil: new Date(input.validUntil) }),
          ...(input.vatRate !== undefined && { vatRate }),
          ...(input.discount !== undefined && { discount }),
          ...(input.notes !== undefined && { notes: input.notes }),
          ...(input.terms !== undefined && { terms: input.terms }),
          ...(input.internalNotes !== undefined && {
            internalNotes: input.internalNotes,
          }),
          subtotal,
          vatAmount,
          total,
        },
        include: {
          lead: { select: { id: true, companyName: true } },
          items: { orderBy: { sortOrder: "asc" } },
        },
      });

      await ctx.db.activity.create({
        data: {
          leadId: quote.leadId,
          userId: ctx.user.id,
          type: "LEAD_UPDATED",
          title: `Offerte ${existing.quoteNumber} bijgewerkt`,
          metadata: { quoteId: quote.id, total, source: "quote.update" },
        },
      });

      await syncQuoteOutboundDrafts(ctx.db, quote.id, ctx.user.workspaceId!);

      return quote;
    }),

  updateStatus: mutationProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum([
          "DRAFT",
          "SENT",
          "VIEWED",
          "ACCEPTED",
          "REJECTED",
          "EXPIRED",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const quote = await ctx.db.quote.findFirst({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
      });
      if (!quote)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Offerte niet gevonden",
        });

      const updateData: Record<string, any> = { status: input.status };
      if (input.status === "SENT") updateData.sentAt = new Date();
      if (input.status === "ACCEPTED") updateData.acceptedAt = new Date();
      if (input.status === "REJECTED") updateData.rejectedAt = new Date();

      const updated = await ctx.db.quote.update({
        where: { id: input.id },
        data: updateData,
      });

      if (input.status === "SENT") {
        await ctx.db.activity.create({
          data: {
            leadId: quote.leadId,
            userId: ctx.user.id,
            type: "QUOTE_SENT",
            title: `Offerte ${quote.quoteNumber} verstuurd naar ${quote.clientName}`,
            metadata: { quoteId: quote.id, status: input.status, source: "quote.status" },
          },
        });
      } else {
        await ctx.db.activity.create({
          data: {
            leadId: quote.leadId,
            userId: ctx.user.id,
            type: "LEAD_STATUS_CHANGED",
            title: `Offerte ${quote.quoteNumber} status gewijzigd naar ${input.status}`,
            metadata: { quoteId: quote.id, status: input.status, source: "quote.status" },
          },
        });
      }

      return updated;
    }),

  sendEmail: mutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const quote = await ctx.db.quote.findFirst({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
        include: {
          lead: { select: { id: true, companyName: true } },
          items: { orderBy: { sortOrder: "asc" } },
        },
      });

      if (!quote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Offerte niet gevonden",
        });
      }

      const preflight = buildQuoteEmailPreflight(
        quote,
        await resolveQuoteLeadForEmail(ctx.db, quote, ctx.user.id),
      );
      if (!preflight.canSend) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Offerte kan nog niet verzonden worden: ${preflight.blockingIssues.join(", ")}.`,
        });
      }

      if (!quote.clientEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Deze offerte heeft geen klant e-mailadres.",
        });
      }

      const linkedLead = await ensureLeadLink({
        db: ctx.db,
        userId: ctx.user.workspaceId!,
        workspaceId: ctx.user.workspaceId!,
        leadId: quote.leadId || undefined,
        email: quote.clientEmail || undefined,
        companyName: quote.clientCompany || quote.clientName,
        phone: quote.clientPhone || undefined,
        address: quote.clientAddress || undefined,
        source: "quote_send",
        createIfMissing: true,
      });

      if (!linkedLead) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Geen lead gevonden of aangemaakt voor deze offerte.",
        });
      }

      if (quote.leadId !== linkedLead.id) {
        await ctx.db.quote.update({
          where: { id: quote.id },
          data: { leadId: linkedLead.id },
        });
      }

      const existingDraft = await ctx.db.emailDraft.findFirst({
        where: {
          type: "QUOTE",
          status: { in: ["PENDING_APPROVAL", "APPROVED"] },
          lead: { createdById: ctx.user.workspaceId! },
          body: { contains: `[[QUOTE_ID=${quote.id}]]` },
        },
        select: { id: true, status: true },
      });
      if (existingDraft) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            existingDraft.status === "APPROVED"
              ? "Deze offerte is al goedgekeurd in Outbound. Verzend de mail via Outbound Center."
              : "Deze offerte staat al in de goedkeuringswachtrij van Outbound.",
        });
      }

      const { body: composedBody, attachmentName } = buildQuoteOutboundEmailBody(quote);
      const emailDraft = await ctx.db.emailDraft.create({
        data: {
          leadId: linkedLead.id,
          authorId: ctx.user.id,
          toEmail: quote.clientEmail,
          subject: `Offerte ${quote.quoteNumber} voor ${quote.clientCompany || quote.clientName}`,
          body: appendQuoteIdMarker(composedBody, quote.id),
          status: "PENDING_APPROVAL",
          type: "QUOTE",
        },
      });

      await ctx.db.activity.create({
        data: {
          leadId: linkedLead.id,
          userId: ctx.user.id,
          type: "EMAIL_DRAFTED",
          title: `Offerte ${quote.quoteNumber} ingediend ter goedkeuring`,
          metadata: {
            quoteId: quote.id,
            draftId: emailDraft.id,
            attachmentName,
            source: "quote.submit_outbound",
          },
        },
      });

      return {
        quote,
        draftId: emailDraft.id,
        queued: true as const,
      };
    }),

  addNote: mutationProcedure
    .input(z.object({ id: z.string(), note: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const quote = await ctx.db.quote.findFirst({ where: { id: input.id, createdById: ctx.user.workspaceId! } });
      if (!quote)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Offerte niet gevonden",
        });
      const existing = quote.internalNotes || "";
      const timestamp = new Date().toLocaleString("nl-BE");
      const newNotes = existing
        ? `${existing}\n\n[${timestamp}] ${input.note}`
        : `[${timestamp}] ${input.note}`;
      const updated = await ctx.db.quote.update({
        where: { id: input.id },
        data: { internalNotes: newNotes },
        include: {
          lead: { select: { id: true, companyName: true } },
          items: { orderBy: { sortOrder: "asc" } },
        },
      });
      await ctx.db.activity.create({
        data: {
          leadId: quote.leadId,
          userId: ctx.user.id,
          type: "NOTE_ADDED",
          title: `Interne notitie toegevoegd aan offerte ${quote.quoteNumber}`,
          metadata: { quoteId: quote.id, source: "quote.note" },
        },
      });
      return updated;
    }),

  getTimeline: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const quote = await ctx.db.quote.findFirst({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
        include: {
          lead: { select: { id: true, companyName: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });
      if (!quote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Offerte niet gevonden",
        });
      }

      const activityFilters: Array<Record<string, unknown>> = [
        { metadata: { path: ["quoteId"], equals: quote.id } },
      ];
      if (quote.leadId) activityFilters.push({ leadId: quote.leadId });

      const activities = await ctx.db.activity.findMany({
        where: {
          OR: activityFilters,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          lead: { select: { id: true, companyName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      });

      type TimelineEntry = {
        id: string;
        type: string;
        title: string;
        createdAt: Date;
        user: { id: string; name: string | null; email?: string | null } | null;
      };

      const filteredActivities = activities.filter((activity) => {
        const metadata = (activity.metadata ?? {}) as Record<string, unknown>;
        const quoteId = typeof metadata.quoteId === "string" ? metadata.quoteId : null;
        return quoteId === quote.id;
      }) as TimelineEntry[];

      const systemEvents: TimelineEntry[] = [
        {
          id: `quote-created-${quote.id}`,
          type: "QUOTE_CREATED",
          title: `Offerte ${quote.quoteNumber} aangemaakt`,
          createdAt: quote.createdAt,
          user: quote.createdBy,
        },
      ];
      if (quote.sentAt) {
        systemEvents.push({
          id: `quote-sent-${quote.id}`,
          type: "QUOTE_SENT",
          title: `Offerte ${quote.quoteNumber} verzonden`,
          createdAt: quote.sentAt,
          user: null,
        });
      }
      if (quote.acceptedAt) {
        systemEvents.push({
          id: `quote-accepted-${quote.id}`,
          type: "QUOTE_ACCEPTED",
          title: `Offerte ${quote.quoteNumber} geaccepteerd`,
          createdAt: quote.acceptedAt,
          user: null,
        });
      }
      if (quote.rejectedAt) {
        systemEvents.push({
          id: `quote-rejected-${quote.id}`,
          type: "QUOTE_REJECTED",
          title: `Offerte ${quote.quoteNumber} afgewezen`,
          createdAt: quote.rejectedAt,
          user: null,
        });
      }

      return [...filteredActivities, ...systemEvents].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );
    }),

  delete: mutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.quote.findFirst({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Offerte niet gevonden" });
      await ctx.db.quote.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // Service catalog
  getServices: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.serviceCatalog.findMany({
      where: { isActive: true, createdById: ctx.user.workspaceId! },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    });
  }),

  upsertService: mutationProcedure
    .input(
      z.object({
        id: z.string().optional(),
        category: z.string(),
        name: z.string(),
        description: z.string().optional(),
        basePrice: z.number().min(0),
        unit: z.string().optional(),
        isActive: z.boolean().default(true),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        const existing = await ctx.db.serviceCatalog.findFirst({
          where: { id: input.id, createdById: ctx.user.workspaceId! },
          select: { id: true },
        });
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Service niet gevonden." });
        }
        return ctx.db.serviceCatalog.update({
          where: { id: input.id },
          data: {
            category: input.category,
            name: input.name,
            description: input.description,
            basePrice: input.basePrice,
            unit: input.unit,
            isActive: input.isActive,
            sortOrder: input.sortOrder,
          },
        });
      }
      return ctx.db.serviceCatalog.create({
        data: {
          ...input,
          createdById: ctx.user.workspaceId!,
        },
      });
    }),

  deleteService: mutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.serviceCatalog.deleteMany({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
      });
      if (deleted.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Service niet gevonden." });
      }
      return { success: true };
    }),

  // Stats for dashboard
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [total, draft, sent, accepted, rejected] = await Promise.all([
      ctx.db.quote.count({ where: { createdById: ctx.user.workspaceId! } }),
      ctx.db.quote.count({ where: { status: "DRAFT", createdById: ctx.user.workspaceId! } }),
      ctx.db.quote.count({ where: { status: "SENT", createdById: ctx.user.workspaceId! } }),
      ctx.db.quote.count({ where: { status: "ACCEPTED", createdById: ctx.user.workspaceId! } }),
      ctx.db.quote.count({ where: { status: "REJECTED", createdById: ctx.user.workspaceId! } }),
    ]);

    const acceptedQuotes = await ctx.db.quote.findMany({
      where: { status: "ACCEPTED", createdById: ctx.user.workspaceId! },
      select: { total: true },
    });
    const totalValue = acceptedQuotes.reduce((sum, q) => sum + q.total, 0);

    const allSentOrLater = await ctx.db.quote.findMany({
      where: {
        status: { in: ["SENT", "VIEWED", "ACCEPTED", "REJECTED"] },
        createdById: ctx.user.workspaceId!,
      },
      select: { total: true },
    });
    const pipelineValue = allSentOrLater.reduce((sum, q) => sum + q.total, 0);

    return {
      total,
      draft,
      sent,
      accepted,
      rejected,
      totalValue,
      pipelineValue,
    };
  }),

  // Create from lead (pre-fill)
  createFromLead: mutationProcedure
    .input(z.object({ leadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.lead.findFirstOrThrow({
        where: { id: input.leadId, createdById: ctx.user.workspaceId! },
        include: {
          scoringFactors: { include: { scoringWeight: true } },
        },
      });

      // Suggest services based on scoring factors
      const suggestedServices = lead.scoringFactors
        .filter((f) => f.rawValue >= 6)
        .map((f) => ({
          category: f.scoringWeight.category || "extras",
          name: f.scoringWeight.label,
          description: f.explanation || undefined,
          quantity: 1,
          unitPrice: 0, // User fills in
        }));

      // Generate quote number
      const year = new Date().getFullYear();
      const count = await ctx.db.quote.count({
        where: { createdById: ctx.user.workspaceId! },
      });
      const quoteNumber = `OFF-${year}-${ctx.user.id.slice(-4).toUpperCase()}-${String(count + 1).padStart(4, "0")}`;

      const quote = await ctx.db.quote.create({
        data: {
          quoteNumber,
          leadId: input.leadId,
          clientName: lead.companyName,
          clientEmail: lead.email,
          clientPhone: lead.phone,
          clientCompany: lead.companyName,
          clientAddress: lead.address,
          createdById: ctx.user.workspaceId!,
          items: {
            create: suggestedServices.map((s, i) => ({
              ...s,
              total: 0,
              sortOrder: i,
            })),
          },
        },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          lead: { select: { id: true, companyName: true } },
        },
      });

      await ctx.db.activity.create({
        data: {
          leadId: input.leadId,
          userId: ctx.user.id,
          type: "QUOTE_CREATED",
          title: `Offerte ${quoteNumber} aangemaakt vanuit lead "${lead.companyName}"`,
        },
      });

      return quote;
    }),
});
