import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { assertLeadAccess } from "../lib/tenant";

const crmSegmentSchema = z.enum(["ALL", "CUSTOMERS", "PROSPECTS"]);

const customerRelationshipFilter = {
  OR: [
    { status: "WON" as const },
    { quotes: { some: { status: "ACCEPTED" as const } } },
    { bookings: { some: { status: { in: ["SCHEDULED", "CONFIRMED", "COMPLETED"] } } } },
  ],
};

export const crmRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          segment: crmSegmentSchema.default("ALL"),
          page: z.number().min(1).default(1),
          pageSize: z.number().min(1).max(50).default(20),
        })
        .default({})
    )
    .query(async ({ ctx, input }) => {
      const search = input.search?.trim();
      const where: Record<string, unknown> = { createdById: ctx.user.id };

      if (search) {
        where.OR = [
          { companyName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { city: { contains: search, mode: "insensitive" } },
          { industry: { contains: search, mode: "insensitive" } },
        ];
      }

      if (input.segment === "CUSTOMERS") {
        where.AND = [customerRelationshipFilter];
      } else if (input.segment === "PROSPECTS") {
        where.AND = [{ NOT: customerRelationshipFilter }];
      }

      const [items, total, totalCustomers, totalProspects] = await Promise.all([
        ctx.db.lead.findMany({
          where: where as any,
          orderBy: [{ updatedAt: "desc" }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          include: {
            _count: {
              select: {
                quotes: true,
                emailDrafts: true,
                campaignLeads: true,
                reports: true,
                bookings: true,
              },
            },
            quotes: {
              where: { createdById: ctx.user.id },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                status: true,
                total: true,
                createdAt: true,
              },
            },
            emailDrafts: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                status: true,
                createdAt: true,
                subject: true,
              },
            },
            campaignLeads: {
              take: 3,
              include: {
                campaign: {
                  select: {
                    id: true,
                    name: true,
                    status: true,
                  },
                },
              },
            },
            reports: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                title: true,
                createdAt: true,
              },
            },
            bookings: {
              where: { createdById: ctx.user.id },
              orderBy: { date: "desc" },
              take: 1,
              select: {
                id: true,
                date: true,
                status: true,
              },
            },
            activities: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                title: true,
                type: true,
                createdAt: true,
              },
            },
          },
        }),
        ctx.db.lead.count({ where: where as any }),
        ctx.db.lead.count({
          where: {
            createdById: ctx.user.id,
            AND: [customerRelationshipFilter],
          },
        }),
        ctx.db.lead.count({
          where: {
            createdById: ctx.user.id,
            AND: [{ NOT: customerRelationshipFilter }],
          },
        }),
      ]);

      const leadIds = items.map((item) => item.id);

      const quoteBreakdown = leadIds.length
        ? await ctx.db.quote.groupBy({
            by: ["leadId", "status"],
            where: {
              createdById: ctx.user.id,
              leadId: { in: leadIds },
            },
            _sum: { total: true },
            _count: { _all: true },
          })
        : [];

      const quoteStatsByLead = new Map<
        string,
        {
          acceptedCount: number;
          acceptedValue: number;
          openCount: number;
          openValue: number;
        }
      >();

      for (const row of quoteBreakdown) {
        if (!row.leadId) continue;
        const current = quoteStatsByLead.get(row.leadId) ?? {
          acceptedCount: 0,
          acceptedValue: 0,
          openCount: 0,
          openValue: 0,
        };

        if (row.status === "ACCEPTED") {
          current.acceptedCount += row._count._all;
          current.acceptedValue += row._sum.total ?? 0;
        }

        if (row.status === "SENT" || row.status === "VIEWED" || row.status === "DRAFT") {
          current.openCount += row._count._all;
          current.openValue += row._sum.total ?? 0;
        }

        quoteStatsByLead.set(row.leadId, current);
      }

      const mapped = items.map((lead) => {
        const quoteStats = quoteStatsByLead.get(lead.id) ?? {
          acceptedCount: 0,
          acceptedValue: 0,
          openCount: 0,
          openValue: 0,
        };
        const hasCustomerSignals =
          lead.status === "WON" || quoteStats.acceptedCount > 0 || lead.bookings.length > 0;
        const latestQuote = lead.quotes[0] ?? null;
        const latestDraft = lead.emailDrafts[0] ?? null;
        const latestReport = lead.reports[0] ?? null;
        const latestBooking = lead.bookings[0] ?? null;
        const latestActivity = lead.activities[0] ?? null;

        const activityDates = [
          lead.updatedAt,
          lead.lastContactedAt ?? null,
          latestQuote?.createdAt ?? null,
          latestDraft?.createdAt ?? null,
          latestReport?.createdAt ?? null,
          latestBooking?.date ?? null,
          latestActivity?.createdAt ?? null,
        ].filter(Boolean) as Date[];
        const lastTouchAt = activityDates.sort((a, b) => b.getTime() - a.getTime())[0] ?? lead.updatedAt;

        return {
          ...lead,
          crmSegment: hasCustomerSignals ? "CUSTOMER" : "PROSPECT",
          quoteStats,
          latestQuote,
          latestDraft,
          latestReport,
          latestBooking,
          latestActivity,
          lastTouchAt,
        };
      });

      return {
        items: mapped,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
        summary: {
          totalCustomers,
          totalProspects,
        },
      };
    }),

  createCustomer: protectedProcedure
    .input(
      z.object({
        companyName: z.string().min(1),
        contactName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        website: z.string().optional(),
        industry: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.email?.trim().toLowerCase();
      const companyName = input.companyName.trim();

      const existing = await ctx.db.lead.findFirst({
        where: {
          createdById: ctx.user.id,
          OR: [
            ...(email ? [{ email }] : []),
            { companyName },
          ],
        },
        select: { id: true, companyName: true },
      });

      if (existing) {
        return { existed: true, lead: existing };
      }

      const lead = await ctx.db.lead.create({
        data: {
          createdById: ctx.user.id,
          companyName,
          email: email || undefined,
          phone: input.phone?.trim() || undefined,
          website: input.website?.trim() || undefined,
          industry: input.industry?.trim() || undefined,
          city: input.city?.trim() || undefined,
          country: input.country?.trim() || undefined,
          source: "crm_customer",
          status: "WON",
          contacts: input.contactName?.trim()
            ? {
                create: {
                  name: input.contactName.trim(),
                  email: email || undefined,
                  phone: input.phone?.trim() || undefined,
                  isPrimary: true,
                },
              }
            : undefined,
        },
        select: {
          id: true,
          companyName: true,
          email: true,
          phone: true,
          status: true,
          city: true,
          country: true,
        },
      });

      await ctx.db.activity.create({
        data: {
          leadId: lead.id,
          userId: ctx.user.id,
          type: "LEAD_CREATED",
          title: `Klant "${lead.companyName}" aangemaakt via CRM`,
          metadata: { source: "crm.customer" },
        },
      });

      return { existed: false, lead };
    }),

  markAsCustomer: protectedProcedure
    .input(z.object({ leadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertLeadAccess(ctx.db, ctx.user.id, input.leadId);
      const lead = await ctx.db.lead.update({
        where: { id: input.leadId, createdById: ctx.user.id },
        data: { status: "WON" },
        select: { id: true, companyName: true, status: true },
      });

      await ctx.db.activity.create({
        data: {
          leadId: lead.id,
          userId: ctx.user.id,
          type: "LEAD_STATUS_CHANGED",
          title: `Lead "${lead.companyName}" gemarkeerd als klant`,
          metadata: { source: "crm.markAsCustomer", status: "WON" },
        },
      });

      return lead;
    }),
});
