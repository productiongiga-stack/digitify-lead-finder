import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { assertLeadAccess, ownedLeadWhere } from "../lib/tenant";

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

function normalizeCompanyName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b(bv|bvba|nv|vzw|vof|commv|sprl|srl|gmbh|ltd|llc|inc)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function similarity(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const min = Math.min(left.length, right.length);
  let prefix = 0;
  while (prefix < min && left[prefix] === right[prefix]) prefix += 1;
  const containsBoost = left.includes(right) || right.includes(left) ? 0.2 : 0;
  return Math.max(0, Math.min(1, (prefix / Math.max(left.length, right.length)) + containsBoost));
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "\"") {
      if (inQuotes && text[i + 1] === "\"") {
        cell += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      if (row.some((part) => part.length > 0)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell.trim());
  if (row.some((part) => part.length > 0)) rows.push(row);
  return rows;
}

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
      const where: Record<string, unknown> = ownedLeadWhere(ctx.user.id, {}, ctx.user.role);
      const [ownedPipelineStageIds, ownedTagIds] = await Promise.all([
        filters?.pipelineStageIds?.length
          ? ctx.db.pipelineStage.findMany({
              where: { id: { in: filters.pipelineStageIds }, createdById: ctx.user.id },
              select: { id: true },
            }).then((rows) => rows.map((row) => row.id))
          : Promise.resolve<string[]>([]),
        filters?.tags?.length
          ? ctx.db.tag.findMany({
              where: { id: { in: filters.tags }, createdById: ctx.user.id },
              select: { id: true },
            }).then((rows) => rows.map((row) => row.id))
          : Promise.resolve<string[]>([]),
      ]);

      if (filters?.search) {
        where.OR = [
          { companyName: { contains: filters.search, mode: "insensitive" } },
          { email: { contains: filters.search, mode: "insensitive" } },
          { city: { contains: filters.search, mode: "insensitive" } },
          { industry: { contains: filters.search, mode: "insensitive" } },
        ];
      }
      if (filters?.status?.length) where.status = { in: filters.status };
      if (filters?.pipelineStageIds?.length) {
        where.pipelineStageId = { in: ownedPipelineStageIds.length ? ownedPipelineStageIds : ["__no_stage__"] };
      }
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
        where.tags = { some: { tagId: { in: ownedTagIds.length ? ownedTagIds : ["__no_tag__"] } } };
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
        where: { id: input.id },
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
        if (pipelineStageId) {
          const stage = await ctx.db.pipelineStage.findFirst({
            where: { id: pipelineStageId, createdById: ctx.user.id },
            select: { id: true },
          });
          if (!stage) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline stage niet gevonden." });
          }
        }
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
      const tag = await ctx.db.tag.findFirst({
        where: { id: input.tagId, createdById: ctx.user.id },
        select: { id: true },
      });
      if (!tag) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tag niet gevonden." });
      }
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

  findDuplicates: protectedProcedure
    .input(z.object({ leadId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertLeadAccess(ctx.db, ctx.user.id, input.leadId);
      const current = await ctx.db.lead.findFirst({
        where: { id: input.leadId, createdById: ctx.user.id },
        select: {
          id: true,
          companyName: true,
          email: true,
          phone: true,
          website: true,
          gmbPlaceId: true,
        },
      });
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Lead niet gevonden." });

      const peers = await ctx.db.lead.findMany({
        where: {
          createdById: ctx.user.id,
          id: { not: current.id },
          OR: [
            current.email ? { email: { equals: current.email, mode: "insensitive" } } : undefined,
            current.phone ? { phone: current.phone } : undefined,
            current.gmbPlaceId ? { gmbPlaceId: current.gmbPlaceId } : undefined,
            { companyName: { contains: current.companyName.slice(0, 5), mode: "insensitive" } },
          ].filter(Boolean) as any,
        },
        select: {
          id: true,
          companyName: true,
          email: true,
          phone: true,
          website: true,
          gmbPlaceId: true,
          overallScore: true,
          scorePriority: true,
          createdAt: true,
        },
        take: 40,
      });

      const currentName = normalizeCompanyName(current.companyName);
      return peers
        .map((peer) => {
          const peerName = normalizeCompanyName(peer.companyName);
          const nameSimilarity = similarity(currentName, peerName);
          let confidence = nameSimilarity;
          const reasons: string[] = [];
          if (current.email && peer.email && current.email.toLowerCase() === peer.email.toLowerCase()) {
            confidence += 0.45;
            reasons.push("zelfde e-mail");
          }
          if (current.phone && peer.phone && current.phone === peer.phone) {
            confidence += 0.35;
            reasons.push("zelfde telefoonnummer");
          }
          if (current.gmbPlaceId && peer.gmbPlaceId && current.gmbPlaceId === peer.gmbPlaceId) {
            confidence = 1;
            reasons.push("zelfde Google Place ID");
          }
          if (nameSimilarity >= 0.75) reasons.push("gelijkaardige bedrijfsnaam");
          return {
            ...peer,
            confidence: Math.min(1, Math.round(confidence * 100) / 100),
            reasons,
          };
        })
        .filter((peer) => peer.confidence >= 0.7 || peer.reasons.length > 0)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 12);
    }),

  explainValue: protectedProcedure
    .input(z.object({ leadId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertLeadAccess(ctx.db, ctx.user.id, input.leadId);
      const lead = await ctx.db.lead.findFirst({
        where: { id: input.leadId, createdById: ctx.user.id },
        select: {
          companyName: true,
          overallScore: true,
          scorePriority: true,
          website: true,
          gmbRating: true,
          gmbReviewCount: true,
          email: true,
          phone: true,
          industry: true,
          city: true,
          scoringFactors: {
            include: { scoringWeight: { select: { label: true } } },
            orderBy: { weightedValue: "desc" },
            take: 4,
          },
        },
      });
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead niet gevonden." });

      const bullets: string[] = [];
      if (!lead.website) bullets.push("Geen website gevonden: directe opportuniteit voor webproject.");
      if ((lead.gmbReviewCount || 0) < 10) bullets.push("Lage reviewdekking op Google, reputatiegroei mogelijk.");
      if ((lead.gmbRating || 0) > 0 && (lead.gmbRating || 0) < 4) bullets.push("Reviewscore onder 4.0 vraagt actieve reputatie-opvolging.");
      if (!lead.email || !lead.phone) bullets.push("Contactpunten zijn onvolledig, wat vaak wijst op lage digitale maturiteit.");

      for (const factor of lead.scoringFactors) {
        if (factor.rawValue >= 6) {
          bullets.push(`${factor.scoringWeight.label}: ${factor.explanation || "hoge impact op commerciële kans."}`);
        }
      }

      if (bullets.length === 0) {
        bullets.push("Lead heeft gezonde basisdata maar blijft relevant door sectorfit en uitbreidingspotentieel.");
      }

      return {
        companyName: lead.companyName,
        score: lead.overallScore ?? null,
        priority: lead.scorePriority ?? null,
        explanation: bullets.slice(0, 6).join(" "),
        bullets: bullets.slice(0, 6),
      };
    }),

  importCsv: protectedProcedure
    .input(z.object({ csv: z.string().min(1), source: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const rows = parseCsv(input.csv);
      if (rows.length < 2) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "CSV bevat geen data." });
      }
      const [headerRow, ...dataRows] = rows;
      const headers = (headerRow || []).map((item) => item.trim().toLowerCase());
      const index = (aliases: string[]) => {
        for (const alias of aliases) {
          const idx = headers.indexOf(alias);
          if (idx >= 0) return idx;
        }
        return -1;
      };
      const companyIndex = index(["company", "companyname", "bedrijf", "bedrijfnaam", "name"]);
      if (companyIndex < 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "CSV mist verplichte kolom voor bedrijf (company/companyName/bedrijf).",
        });
      }
      const emailIndex = index(["email", "mail"]);
      const phoneIndex = index(["phone", "telefoon", "gsm"]);
      const websiteIndex = index(["website", "url", "site"]);
      const industryIndex = index(["industry", "sector", "niche"]);
      const cityIndex = index(["city", "stad"]);
      const countryIndex = index(["country", "land"]);
      const addressIndex = index(["address", "adres"]);

      const existing = await ctx.db.lead.findMany({
        where: { createdById: ctx.user.id },
        select: { companyName: true, email: true },
      });
      const existingNames = new Set(existing.map((item) => normalizeCompanyName(item.companyName)));
      const existingEmails = new Set(existing.map((item) => item.email?.toLowerCase()).filter(Boolean));

      const toCreate: Array<Record<string, unknown>> = [];
      let skipped = 0;
      for (const row of dataRows) {
        const companyName = (row[companyIndex] || "").trim();
        if (!companyName) continue;
        const email = emailIndex >= 0 ? (row[emailIndex] || "").trim().toLowerCase() : "";
        const normalizedCompany = normalizeCompanyName(companyName);
        if (
          (normalizedCompany && existingNames.has(normalizedCompany)) ||
          (email && existingEmails.has(email))
        ) {
          skipped += 1;
          continue;
        }
        const payload: Record<string, unknown> = {
          companyName,
          createdById: ctx.user.id,
          source: input.source || "csv_import",
        };
        if (email) payload.email = email;
        if (phoneIndex >= 0 && row[phoneIndex]) payload.phone = row[phoneIndex]!.trim();
        if (websiteIndex >= 0 && row[websiteIndex]) payload.website = row[websiteIndex]!.trim();
        if (industryIndex >= 0 && row[industryIndex]) payload.industry = row[industryIndex]!.trim();
        if (cityIndex >= 0 && row[cityIndex]) payload.city = row[cityIndex]!.trim();
        if (countryIndex >= 0 && row[countryIndex]) payload.country = row[countryIndex]!.trim();
        if (addressIndex >= 0 && row[addressIndex]) payload.address = row[addressIndex]!.trim();
        toCreate.push(payload);
        if (normalizedCompany) existingNames.add(normalizedCompany);
        if (email) existingEmails.add(email);
      }

      if (toCreate.length === 0) return { created: 0, skipped };

      await ctx.db.lead.createMany({ data: toCreate as any });
      await ctx.db.activity.create({
        data: {
          userId: ctx.user.id,
          type: "LEAD_CREATED",
          title: `${toCreate.length} leads geïmporteerd via CSV`,
          metadata: { source: "lead.importCsv", created: toCreate.length, skipped },
        },
      });
      return { created: toCreate.length, skipped };
    }),

  exportCsv: protectedProcedure
    .input(
      z
        .object({
          ids: z.array(z.string()).optional(),
          filters: leadFilterSchema.optional(),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { createdById: ctx.user.id };
      if (input.ids?.length) where.id = { in: input.ids };
      const filters = input.filters;
      if (filters?.status?.length) where.status = { in: filters.status };
      if (filters?.scorePriority) where.scorePriority = filters.scorePriority;
      if (filters?.search) {
        where.OR = [
          { companyName: { contains: filters.search, mode: "insensitive" } },
          { email: { contains: filters.search, mode: "insensitive" } },
          { city: { contains: filters.search, mode: "insensitive" } },
        ];
      }

      const leads = await ctx.db.lead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 5000,
      });
      const header = [
        "companyName",
        "email",
        "phone",
        "website",
        "industry",
        "city",
        "country",
        "status",
        "scorePriority",
        "overallScore",
        "source",
      ];
      const escape = (value: unknown) => {
        const text = value == null ? "" : String(value);
        if (!text.includes(",") && !text.includes("\"") && !text.includes("\n")) return text;
        return `"${text.replace(/"/g, "\"\"")}"`;
      };
      const lines = [
        header.join(","),
        ...leads.map((lead) =>
          [
            lead.companyName,
            lead.email,
            lead.phone,
            lead.website,
            lead.industry,
            lead.city,
            lead.country,
            lead.status,
            lead.scorePriority,
            lead.overallScore,
            lead.source,
          ].map(escape).join(","),
        ),
      ];
      return { csv: lines.join("\n"), count: leads.length };
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
