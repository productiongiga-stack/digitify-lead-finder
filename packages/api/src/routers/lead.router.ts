import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { assertLeadAccess } from "../lib/tenant";

const DEMO_LEAD_NAMES = [
  "Bakkerij Van Damme",
  "Loodgieter Peeters",
  "Restaurant Le Petit Bruxellois",
  "Garage Janssens",
  "Kapsalon Belleza",
  "Elektricien De Smet",
  "Transport Maes",
  "Immokantoor Verstraete",
  "Drukkerij Claes",
  "Advocatenkantoor Willems",
  "Tuinaanleg Vermeersch",
  "Fysiotherapie Centrum Gent",
  "Slagerij Demuynck",
  "Schoonheidssalon Pure Glow",
  "Dakwerken Vandenberghe",
  "Boekhouder Leysen & Partners",
  "Pizzeria Da Marco",
  "Rijschool TopDrive",
  "Dierenarts Willockx",
  "Fietsenmaker Velodroom",
] as const;

const leadFilterSchema = z.object({
  search: z.string().optional(),
  status: z.array(z.string()).optional(),
  pipelineStageIds: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  scoreMin: z.number().min(0).max(100).optional(),
  scoreMax: z.number().min(0).max(100).optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  industry: z.string().optional(),
  source: z.string().optional(),
  assignedToId: z.string().optional(),
  hasEmail: z.boolean().optional(),
  hasWebsite: z.boolean().optional(),
  campaignId: z.string().optional(),
  scorePriority: z.string().optional(),
  excludeDemo: z.boolean().optional(),
});

export const leadRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        filters: leadFilterSchema.optional(),
        sortBy: z.string().default("createdAt"),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const { filters, sortBy, sortDir, page, pageSize } = input;
      const where: Record<string, unknown> = { createdById: ctx.user.id };

      if (filters?.search) {
        where.OR = [
          { companyName: { contains: filters.search, mode: "insensitive" } },
          { email: { contains: filters.search, mode: "insensitive" } },
          { city: { contains: filters.search, mode: "insensitive" } },
          { industry: { contains: filters.search, mode: "insensitive" } },
        ];
      }
      if (filters?.status?.length) where.status = { in: filters.status };
      if (filters?.pipelineStageIds?.length) where.pipelineStageId = { in: filters.pipelineStageIds };
      if (filters?.scoreMin !== undefined || filters?.scoreMax !== undefined) {
        where.overallScore = {};
        if (filters?.scoreMin !== undefined) (where.overallScore as Record<string, unknown>).gte = filters.scoreMin;
        if (filters?.scoreMax !== undefined) (where.overallScore as Record<string, unknown>).lte = filters.scoreMax;
      }
      if (filters?.city) where.city = { contains: filters.city, mode: "insensitive" };
      if (filters?.country) where.country = { contains: filters.country, mode: "insensitive" };
      if (filters?.industry) where.industry = { contains: filters.industry, mode: "insensitive" };
      if (filters?.source) where.source = filters.source;
      if (filters?.assignedToId) where.assignedToId = filters.assignedToId;
      if (filters?.hasEmail === true) where.email = { not: null };
      if (filters?.hasEmail === false) where.email = null;
      if (filters?.hasWebsite === true) where.website = { not: null };
      if (filters?.hasWebsite === false) where.website = null;
      if (filters?.scorePriority) where.scorePriority = filters.scorePriority;
      if (filters?.tags?.length) {
        where.tags = { some: { tagId: { in: filters.tags } } };
      }
      if (filters?.campaignId) {
        where.campaignLeads = { some: { campaignId: filters.campaignId, campaign: { createdById: ctx.user.id } } };
      }
      if (filters?.excludeDemo) {
        where.NOT = {
          companyName: {
            in: [...DEMO_LEAD_NAMES],
          },
        };
      }

      const [items, total] = await Promise.all([
        ctx.db.lead.findMany({
          where,
          orderBy: { [sortBy]: sortDir },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            tags: { include: { tag: true } },
            pipelineStage: true,
            assignedTo: { select: { id: true, name: true, email: true } },
            _count: { select: { notes: true, emailDrafts: true } },
          },
        }),
        ctx.db.lead.count({ where }),
      ]);

      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const lead = await ctx.db.lead.findFirst({
        where: { id: input.id, createdById: ctx.user.id },
        include: {
          tags: { include: { tag: true } },
          pipelineStage: true,
          assignedTo: { select: { id: true, name: true, email: true } },
          contacts: true,
          notes: {
            orderBy: { createdAt: "desc" },
            include: { user: { select: { id: true, name: true } } },
          },
          activities: {
            orderBy: { createdAt: "desc" },
            take: 50,
            include: { user: { select: { id: true, name: true } } },
          },
          scoringFactors: {
            include: { scoringWeight: true },
            orderBy: { weightedValue: "desc" },
          },
          emailDrafts: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
          campaignLeads: {
            include: { campaign: { select: { id: true, name: true } } },
          },
          domains: {
            orderBy: { createdAt: "desc" },
          },
          enrichmentData: true,
          openclawSuggestions: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      });

      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
      return lead;
    }),

  create: protectedProcedure
    .input(
      z.object({
        companyName: z.string().min(1),
        website: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        industry: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        zipCode: z.string().optional(),
        source: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.lead.create({
        data: {
          ...input,
          createdById: ctx.user.id,
        },
      });

      await ctx.db.activity.create({
        data: {
          leadId: lead.id,
          userId: ctx.user.id,
          type: "LEAD_CREATED",
          title: `Lead "${lead.companyName}" aangemaakt`,
        },
      });

      return lead;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        companyName: z.string().optional(),
        website: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        industry: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
        state: z.string().nullable().optional(),
        country: z.string().nullable().optional(),
        zipCode: z.string().nullable().optional(),
        status: z.string().optional(),
        pipelineStageId: z.string().nullable().optional(),
        assignedToId: z.string().nullable().optional(),
        doNotContact: z.boolean().optional(),
        facebookUrl: z.string().nullable().optional(),
        linkedinUrl: z.string().nullable().optional(),
        instagramUrl: z.string().nullable().optional(),
        twitterUrl: z.string().nullable().optional(),
        tiktokUrl: z.string().nullable().optional(),
        youtubeUrl: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, status, pipelineStageId, assignedToId, ...rest } = input;
      await assertLeadAccess(ctx.db, ctx.user.id, id);
      const data: Record<string, unknown> = { ...rest };
      if (status !== undefined) data.status = status;
      if (pipelineStageId !== undefined) {
        data.pipelineStage = pipelineStageId
          ? { connect: { id: pipelineStageId } }
          : { disconnect: true };
      }
      if (assignedToId !== undefined) {
        data.assignedTo = assignedToId
          ? { connect: { id: assignedToId } }
          : { disconnect: true };
      }
      const lead = await ctx.db.lead.update({
        where: { id, createdById: ctx.user.id },
        data: data as any,
      });

      await ctx.db.activity.create({
        data: {
          leadId: lead.id,
          userId: ctx.user.id,
          type: "LEAD_UPDATED",
          title: `Lead "${lead.companyName}" bijgewerkt`,
        },
      });

      return lead;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertLeadAccess(ctx.db, ctx.user.id, input.id);
      await ctx.db.lead.delete({ where: { id: input.id } });
      return { success: true };
    }),

  bulkUpdateStatus: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string()).min(1).max(500),
        status: z.enum(["NEW", "RESEARCHING", "CONTACTED", "RESPONDED", "QUALIFIED", "PROPOSAL_SENT", "WON", "LOST", "ARCHIVED"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.lead.updateMany({
        where: { id: { in: input.ids }, createdById: ctx.user.id },
        data: { status: input.status },
      });
      return { updated: result.count };
    }),

  bulkDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.lead.deleteMany({
        where: { id: { in: input.ids }, createdById: ctx.user.id },
      });
      return { deleted: result.count };
    }),

  bulkAddTag: protectedProcedure
    .input(z.object({ leadIds: z.array(z.string()).min(1).max(500), tagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.leadTag.findMany({
        where: { leadId: { in: input.leadIds }, tagId: input.tagId, lead: { createdById: ctx.user.id } },
        select: { leadId: true },
      });
      const existingSet = new Set(existing.map((e) => e.leadId));
      const ownedLeads = await ctx.db.lead.findMany({
        where: { id: { in: input.leadIds }, createdById: ctx.user.id },
        select: { id: true },
      });
      const ownedSet = new Set(ownedLeads.map((lead) => lead.id));
      const toCreate = input.leadIds.filter((id) => ownedSet.has(id) && !existingSet.has(id));

      if (toCreate.length > 0) {
        await ctx.db.leadTag.createMany({
          data: toCreate.map((leadId) => ({ leadId, tagId: input.tagId })),
        });
      }
      return { added: toCreate.length };
    }),

  addNote: protectedProcedure
    .input(z.object({ leadId: z.string(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertLeadAccess(ctx.db, ctx.user.id, input.leadId);
      const note = await ctx.db.note.create({
        data: {
          leadId: input.leadId,
          userId: ctx.user.id,
          content: input.content,
        },
      });

      await ctx.db.activity.create({
        data: {
          leadId: input.leadId,
          userId: ctx.user.id,
          type: "NOTE_ADDED",
          title: "Notitie toegevoegd",
        },
      });

      return note;
    }),

  getIndustries: protectedProcedure.query(async ({ ctx }) => {
    const industries = await ctx.db.lead.findMany({
      where: { industry: { not: null }, createdById: ctx.user.id },
      distinct: ["industry"],
      select: { industry: true },
    });
    return industries.map((i) => i.industry!).sort();
  }),

  getCities: protectedProcedure.query(async ({ ctx }) => {
    const cities = await ctx.db.lead.findMany({
      where: { city: { not: null }, createdById: ctx.user.id },
      distinct: ["city"],
      select: { city: true },
    });
    return cities.map((c) => c.city!).sort();
  }),
});
