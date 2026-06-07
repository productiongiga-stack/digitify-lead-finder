import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router, mutationProcedure } from "../trpc";
import {
  emailTemplateDataFromInput,
  listParsedEmailTemplates,
  parseTemplateRow,
} from "../lib/email-templates";
import { sanitizeCtaUrl } from "@digitify/email";
import {
  EMAIL_TEMPLATE_STARTER_PACK,
  EMAIL_SYSTEM_TEMPLATES,
  ensureSystemEmailTemplates,
  syncEmailTemplateStarterPack,
} from "../lib/email-template-starter-pack";
import {
  SYSTEM_MESSAGE_REGISTRY,
  SYSTEM_MESSAGE_MODULES,
  SYSTEM_MESSAGE_MODULE_LABELS,
} from "../lib/email-system-message-registry";
import {
  countLegacyLibraryEntries,
  migrateLegacyTemplateLibrary,
  readLegacyTemplateLibrary,
} from "../lib/migrate-legacy-template-library";
import { workspaceScopeFromUser } from "../lib/workspace-settings";
const templateTypeSchema = z.enum([
  "OUTREACH",
  "FOLLOW_UP",
  "PROPOSAL",
  "REPORT",
  "BOOKING",
  "REVIEW",
  "REENGAGEMENT",
  "CUSTOM",
]);
const layoutSchema = z.enum(["modern", "minimal", "business", "proposal", "followup"]);
const moduleSchema = z.enum([
  "LEADS",
  "CAMPAIGNS",
  "QUOTES",
  "INVOICES",
  "BOOKINGS",
  "REVIEWS",
  "AUTH",
  "INBOX",
  "SYSTEM",
]);

export const templateRouter = router({
  /** Canonical starter templates — handmatige outreach-teksten */
  starterPack: protectedProcedure.query(() => ({
    items: EMAIL_TEMPLATE_STARTER_PACK.filter((item) => !item.isSystem && !item.templateKey),
  })),

  listSystemMessages: protectedProcedure
    .input(z.object({ module: moduleSchema.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      await ensureSystemEmailTemplates(ctx.db, workspaceId);

      const moduleFilter = input?.module;
      const registryEntries = moduleFilter
        ? SYSTEM_MESSAGE_REGISTRY.filter((entry) => entry.module === moduleFilter)
        : SYSTEM_MESSAGE_REGISTRY;

      const rows = await ctx.db.emailTemplate.findMany({
        where: {
          createdById: workspaceId,
          isSystem: true,
          templateKey: { not: null },
          ...(moduleFilter ? { module: moduleFilter } : {}),
        },
        orderBy: [{ module: "asc" }, { name: "asc" }],
      });

      const rowByKey = new Map(rows.map((row) => [row.templateKey!, row]));
      const items = registryEntries.map((registry) => {
        const row = rowByKey.get(registry.templateKey);
        const fallback = EMAIL_SYSTEM_TEMPLATES.find((item) => item.templateKey === registry.templateKey);
        const parsed = row ? parseTemplateRow(row) : null;
        return {
          id: row?.id ?? null,
          templateKey: registry.templateKey,
          module: registry.module,
          moduleLabel: SYSTEM_MESSAGE_MODULE_LABELS[registry.module as keyof typeof SYSTEM_MESSAGE_MODULE_LABELS],
          name: row?.name ?? fallback?.name ?? registry.templateKey,
          description: row?.description ?? fallback?.description ?? "",
          trigger: registry.trigger,
          placeholders: registry.placeholders,
          subject: parsed?.subject ?? fallback?.subject ?? "",
          body: parsed?.cleanBody ?? fallback?.body ?? "",
          bodyFormat: parsed?.bodyFormat ?? fallback?.bodyFormat ?? "TEXT",
          ctaText: parsed?.ctaText ?? fallback?.ctaText ?? "",
          ctaUrl: parsed?.ctaUrl ?? fallback?.ctaUrl ?? "",
          updatedAt: row?.updatedAt ?? null,
        };
      });

      return {
        modules: SYSTEM_MESSAGE_MODULES.map((id) => ({
          id,
          label: SYSTEM_MESSAGE_MODULE_LABELS[id],
          count: SYSTEM_MESSAGE_REGISTRY.filter((entry) => entry.module === id).length,
        })),
        items,
      };
    }),

  updateSystemMessage: mutationProcedure
    .input(
      z.object({
        templateKey: z.string().min(1).max(120),
        subject: z.string().min(1).max(300),
        body: z.string().min(1).max(100000),
        bodyFormat: z.enum(["TEXT", "HTML"]).default("TEXT"),
        ctaText: z.string().max(120).optional(),
        ctaUrl: z
          .string()
          .max(500)
          .optional()
          .refine((value) => !value?.trim() || Boolean(sanitizeCtaUrl(value)), {
            message: "CTA URL moet http(s), mailto, een relatief pad of {{placeholder}} zijn.",
          }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      await ensureSystemEmailTemplates(ctx.db, workspaceId);

      const existing = await ctx.db.emailTemplate.findFirst({
        where: {
          createdById: workspaceId,
          templateKey: input.templateKey,
          isSystem: true,
        },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Systeembericht niet gevonden.",
        });
      }

      const templateData = emailTemplateDataFromInput({
        body: input.body,
        bodyFormat: input.bodyFormat,
        layout: existing.layout,
        type: existing.type,
        description: existing.description,
        ctaText: input.ctaText,
        ctaUrl: input.ctaUrl,
      });

      const row = await ctx.db.emailTemplate.update({
        where: { id: existing.id },
        data: {
          subject: input.subject.trim(),
          ...templateData,
        },
      });
      return parseTemplateRow(row);
    }),

  list: protectedProcedure
    .input(
      z
        .object({
          type: templateTypeSchema.optional(),
          module: moduleSchema.optional(),
          search: z.string().max(120).optional(),
          forOutbound: z.boolean().optional(),
          campaignId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const typeFilter = input?.type;
      const search = input?.search?.trim();
      const parsed = await listParsedEmailTemplates(ctx.db, ctx.user.workspaceId!, {
        forOutbound: input?.forOutbound,
        campaignId: input?.campaignId,
        type: typeFilter,
        module: input?.module,
        search,
      });

      return {
        templates: parsed,
        total: parsed.length,
        layouts: layoutSchema.options,
        types: templateTypeSchema.options,
        modules: moduleSchema.options,
      };
    }),

  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const row = await ctx.db.emailTemplate.findFirst({
      where: { id: input.id, createdById: ctx.user.workspaceId! },
      include: { campaign: { select: { id: true, name: true } } },
    });
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Template niet gevonden." });
    return parseTemplateRow(row);
  }),

  save: mutationProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1).max(160),
        subject: z.string().min(1).max(300),
        body: z.string().min(1).max(100000),
        bodyFormat: z.enum(["TEXT", "HTML"]).default("TEXT"),
        layout: layoutSchema.default("modern"),
        type: templateTypeSchema.default("CUSTOM"),
        description: z.string().max(300).optional(),
        ctaText: z.string().max(120).optional(),
        ctaUrl: z
          .string()
          .max(500)
          .optional()
          .refine((value) => !value?.trim() || Boolean(sanitizeCtaUrl(value)), {
            message: "CTA URL moet http(s), mailto, een relatief pad of {{placeholder}} zijn.",
          }),
        campaignId: z.string().nullable().optional(),
        isGlobal: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (input.campaignId) {
          const campaign = await ctx.db.campaign.findFirst({
            where: { id: input.campaignId, createdById: ctx.user.workspaceId! },
            select: { id: true },
          });
          if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campagne niet gevonden." });
        }

        const templateData = emailTemplateDataFromInput({
          body: input.body,
          bodyFormat: input.bodyFormat,
          layout: input.layout,
          type: input.type,
          description: input.description,
          ctaText: input.ctaText,
          ctaUrl: input.ctaUrl,
        });

        if (input.id) {
          const existing = await ctx.db.emailTemplate.findFirst({
            where: { id: input.id, createdById: ctx.user.workspaceId! },
            select: { id: true, isSystem: true, name: true, templateKey: true, module: true },
          });
          if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Template niet gevonden." });

          const row = await ctx.db.emailTemplate.update({
            where: { id: input.id },
            data: {
              name: existing.isSystem ? existing.name : input.name.trim(),
              subject: input.subject.trim(),
              ...templateData,
              campaignId: input.campaignId ?? null,
              isGlobal: existing.isSystem ? false : (input.isGlobal ?? false),
            },
            include: { campaign: { select: { id: true, name: true } } },
          });
          return parseTemplateRow(row);
        }

        const row = await ctx.db.emailTemplate.create({
          data: {
            createdById: ctx.user.workspaceId!,
            name: input.name.trim(),
            subject: input.subject.trim(),
            ...templateData,
            campaignId: input.campaignId ?? null,
            isGlobal: input.isGlobal ?? false,
          },
          include: { campaign: { select: { id: true, name: true } } },
        });
        return parseTemplateRow(row);
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: string }).code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Er bestaat al een template met deze naam. Kies een andere naam.",
          });
        }
        throw error;
      }
    }),

  duplicate: mutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const source = await ctx.db.emailTemplate.findFirst({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
      });
      if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Template niet gevonden." });

      const row = await ctx.db.emailTemplate.create({
        data: {
          createdById: ctx.user.workspaceId!,
          name: `${source.name} (kopie)`,
          subject: source.subject,
          body: source.body,
          bodyFormat: source.bodyFormat,
          type: source.type,
          layout: source.layout,
          description: source.description,
          ctaText: source.ctaText,
          ctaUrl: source.ctaUrl,
          campaignId: source.campaignId,
          isGlobal: false,
        },
        include: { campaign: { select: { id: true, name: true } } },
      });
      return parseTemplateRow(row);
    }),

  remove: mutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.emailTemplate.findFirst({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
        select: { id: true, isSystem: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Template niet gevonden." });
      if (existing.isSystem) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Systeem-templates kunnen niet verwijderd worden.",
        });
      }
      await ctx.db.emailTemplate.delete({ where: { id: input.id } });
      return { success: true };
    }),

  seedStarterPack: mutationProcedure.mutation(async ({ ctx }) => {
    const result = await syncEmailTemplateStarterPack(ctx.db, ctx.user.workspaceId!);
    const { ensureSystemEmailTemplates } = await import("../lib/email-template-starter-pack");
    await ensureSystemEmailTemplates(ctx.db, ctx.user.workspaceId!);
    return result;
  }),

  legacyLibraryStatus: protectedProcedure.query(async ({ ctx }) => {
    const scope = workspaceScopeFromUser(ctx.user);
    const raw = await readLegacyTemplateLibrary(ctx.db, scope);
    const pending = countLegacyLibraryEntries(raw);
    return { pending, hasLegacy: pending > 0 };
  }),

  migrateLegacyLibrary: mutationProcedure.mutation(async ({ ctx }) => {
    const scope = workspaceScopeFromUser(ctx.user);
    return migrateLegacyTemplateLibrary(ctx.db, scope);
  }),
});
