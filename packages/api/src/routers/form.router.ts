import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, mutationProcedure, protectedProcedure, router } from "../trpc";

const formFieldSchema = z.object({
  key: z.enum(["name", "email", "company", "phone", "message"]),
  label: z.string().trim().min(1).max(80),
  required: z.boolean().default(false),
});

const defaultFields = [
  { key: "name", label: "Naam", required: true },
  { key: "email", label: "E-mailadres", required: true },
  { key: "company", label: "Bedrijf", required: true },
  { key: "phone", label: "Telefoon", required: false },
  { key: "message", label: "Bericht", required: false },
] as const;

export const formRouter = router({
  list: protectedProcedure.query(async ({ ctx }) =>
    ctx.db.leadForm.findMany({
      where: { createdById: ctx.user.workspaceId! },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, publicKey: true, status: true, fields: true, createdAt: true, _count: { select: { submissions: true } } },
    }),
  ),

  create: adminProcedure
    .input(z.object({ name: z.string().trim().min(2).max(120), fields: z.array(formFieldSchema).min(1).max(5).default([...defaultFields]) }))
    .mutation(async ({ ctx, input }) =>
      ctx.db.leadForm.create({
        data: { createdById: ctx.user.workspaceId!, name: input.name, fields: input.fields },
        select: { id: true, name: true, publicKey: true, status: true },
      }),
    ),

  setStatus: mutationProcedure
    .input(z.object({ id: z.string(), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.leadForm.findFirst({ where: { id: input.id, createdById: ctx.user.workspaceId! }, select: { id: true } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Formulier niet gevonden" });
      return ctx.db.leadForm.update({ where: { id: input.id }, data: { status: input.status }, select: { id: true, status: true } });
    }),

  submissions: protectedProcedure
    .input(z.object({ formId: z.string() }))
    .query(async ({ ctx, input }) => {
      const form = await ctx.db.leadForm.findFirst({ where: { id: input.formId, createdById: ctx.user.workspaceId! }, select: { id: true } });
      if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "Formulier niet gevonden" });
      return ctx.db.formSubmission.findMany({ where: { formId: form.id }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, leadId: true, data: true, createdAt: true } });
    }),
});
