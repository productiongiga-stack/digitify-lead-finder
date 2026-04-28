import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { readUserJsonSetting, writeUserJsonSetting } from "../lib/user-json-setting";

const TEMPLATE_LIBRARY_KEY = "templates.library_json";

const templateSchema = z.object({
  id: z.string(),
  type: z.enum(["EMAIL", "QUOTE", "REPORT", "CHATBOT", "FOLLOW_UP", "ADS"]),
  name: z.string().min(1).max(160),
  subject: z.string().nullable().default(null),
  content: z.string().min(1).max(20000),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type TemplateItem = z.infer<typeof templateSchema>;

async function loadTemplates(db: any, userId: string): Promise<TemplateItem[]> {
  const raw = await readUserJsonSetting<unknown[]>(db, userId, TEMPLATE_LIBRARY_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => templateSchema.safeParse(item))
    .filter((item) => item.success)
    .map((item) => item.data);
}

export const templateRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const [customTemplates, emailTemplates, reportTemplates] = await Promise.all([
      loadTemplates(ctx.db, ctx.user.id),
      ctx.db.emailTemplate.findMany({
        where: { createdById: ctx.user.id },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, subject: true, body: true, updatedAt: true },
      }),
      ctx.db.reportTemplate.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, description: true, createdAt: true },
      }),
    ]);

    return {
      custom: customTemplates.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
      builtIn: {
        email: emailTemplates.map((item) => ({
          id: item.id,
          type: "EMAIL",
          name: item.name,
          subject: item.subject,
          content: item.body,
          updatedAt: item.updatedAt,
          source: "email_template",
        })),
        report: reportTemplates.map((item) => ({
          id: item.id,
          type: "REPORT",
          name: item.name,
          subject: item.description || null,
          content: "Gebruik dit rapporttemplate in rapporten.",
          updatedAt: item.createdAt,
          source: "report_template",
        })),
      },
    };
  }),

  create: protectedProcedure
    .input(
      z.object({
        type: z.enum(["EMAIL", "QUOTE", "REPORT", "CHATBOT", "FOLLOW_UP", "ADS"]),
        name: z.string().min(1).max(160),
        subject: z.string().max(300).optional(),
        content: z.string().min(1).max(20000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const templates = await loadTemplates(ctx.db, ctx.user.id);
      const now = new Date().toISOString();
      const created: TemplateItem = {
        id: randomUUID(),
        type: input.type,
        name: input.name.trim(),
        subject: input.subject?.trim() || null,
        content: input.content.trim(),
        createdAt: now,
        updatedAt: now,
      };
      templates.unshift(created);
      await writeUserJsonSetting(ctx.db, ctx.user.id, TEMPLATE_LIBRARY_KEY, templates.slice(0, 500));
      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        type: z.enum(["EMAIL", "QUOTE", "REPORT", "CHATBOT", "FOLLOW_UP", "ADS"]).optional(),
        name: z.string().min(1).max(160).optional(),
        subject: z.string().max(300).nullable().optional(),
        content: z.string().min(1).max(20000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const templates = await loadTemplates(ctx.db, ctx.user.id);
      const index = templates.findIndex((item) => item.id === input.id);
      if (index < 0) throw new TRPCError({ code: "NOT_FOUND", message: "Template niet gevonden." });
      const current = templates[index];
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Template niet gevonden." });
      const next: TemplateItem = {
        ...current,
        type: input.type || current.type,
        name: input.name?.trim() || current.name,
        subject: input.subject !== undefined ? (input.subject?.trim() || null) : current.subject,
        content: input.content?.trim() || current.content,
        updatedAt: new Date().toISOString(),
      };
      templates[index] = next;
      await writeUserJsonSetting(ctx.db, ctx.user.id, TEMPLATE_LIBRARY_KEY, templates);
      return next;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const templates = await loadTemplates(ctx.db, ctx.user.id);
      const filtered = templates.filter((item) => item.id !== input.id);
      if (filtered.length === templates.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template niet gevonden." });
      }
      await writeUserJsonSetting(ctx.db, ctx.user.id, TEMPLATE_LIBRARY_KEY, filtered);
      return { success: true };
    }),
});
