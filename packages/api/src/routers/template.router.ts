import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import {
  emailTemplateDataFromInput,
  listParsedEmailTemplates,
  parseTemplateRow,
} from "../lib/email-templates";
import { sanitizeCtaUrl } from "@digitify/email";
import {
  EMAIL_TEMPLATE_STARTER_PACK,
  syncEmailTemplateStarterPack,
} from "../lib/email-template-starter-pack";
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

export const templateRouter = router({
  /** Canonical starter templates — single source for Studio UI and seedStarterPack */
  starterPack: protectedProcedure.query(() => ({
    items: EMAIL_TEMPLATE_STARTER_PACK,
  })),

  list: protectedProcedure
    .input(
      z
        .object({
          type: templateTypeSchema.optional(),
          search: z.string().max(120).optional(),
          forOutbound: z.boolean().optional(),
          campaignId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const typeFilter = input?.type;
      const parsed = await listParsedEmailTemplates(ctx.db, ctx.user.workspaceId!, {
        forOutbound: input?.forOutbound,
        campaignId: input?.campaignId,
        type: typeFilter,
      });
      const search = input?.search?.trim().toLowerCase();

      const filtered = search
        ? parsed.filter((item) =>
            item.name.toLowerCase().includes(search) ||
            item.subject.toLowerCase().includes(search) ||
            item.description.toLowerCase().includes(search) ||
            item.cleanBody.toLowerCase().includes(search),
          )
        : parsed;

      return {
        templates: filtered,
        total: parsed.length,
        layouts: layoutSchema.options,
        types: templateTypeSchema.options,
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

  save: protectedProcedure
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
            select: { id: true },
          });
          if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Template niet gevonden." });

          const row = await ctx.db.emailTemplate.update({
            where: { id: input.id },
            data: {
              name: input.name.trim(),
              subject: input.subject.trim(),
              ...templateData,
              campaignId: input.campaignId ?? null,
              isGlobal: input.isGlobal ?? false,
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

  duplicate: protectedProcedure
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

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.emailTemplate.findFirst({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Template niet gevonden." });
      await ctx.db.emailTemplate.delete({ where: { id: input.id } });
      return { success: true };
    }),

  seedStarterPack: protectedProcedure.mutation(async ({ ctx }) =>
    syncEmailTemplateStarterPack(ctx.db, ctx.user.workspaceId!),
  ),

  legacyLibraryStatus: protectedProcedure.query(async ({ ctx }) => {
    const scope = workspaceScopeFromUser(ctx.user);
    const raw = await readLegacyTemplateLibrary(ctx.db, scope);
    const pending = countLegacyLibraryEntries(raw);
    return { pending, hasLegacy: pending > 0 };
  }),

  migrateLegacyLibrary: protectedProcedure.mutation(async ({ ctx }) => {
    const scope = workspaceScopeFromUser(ctx.user);
    return migrateLegacyTemplateLibrary(ctx.db, scope);
  }),
});
