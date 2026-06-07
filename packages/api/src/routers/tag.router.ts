import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, mutationProcedure } from "../trpc";
import { assertLeadAccess } from "../lib/tenant";

export const tagRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.tag.findMany({
      where: { createdById: ctx.user.workspaceId! },
      orderBy: { name: "asc" },
      take: 100,
      include: { _count: { select: { leads: true } } },
    });
  }),

  create: mutationProcedure
    .input(z.object({ name: z.string().min(1), color: z.string().default("#6366f1") }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.tag.create({ data: { ...input, createdById: ctx.user.workspaceId! } });
    }),

  update: mutationProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), color: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const tag = await ctx.db.tag.findFirst({
        where: { id, createdById: ctx.user.workspaceId! },
        select: { id: true },
      });
      if (!tag) throw new TRPCError({ code: "NOT_FOUND", message: "Tag niet gevonden." });
      return ctx.db.tag.update({ where: { id }, data });
    }),

  delete: mutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tag = await ctx.db.tag.findFirst({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
        select: { id: true },
      });
      if (!tag) throw new TRPCError({ code: "NOT_FOUND", message: "Tag niet gevonden." });
      await ctx.db.tag.delete({ where: { id: input.id } });
      return { success: true };
    }),

  addToLead: mutationProcedure
    .input(z.object({ leadId: z.string(), tagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertLeadAccess(ctx.db, ctx.user.workspaceId!, input.leadId);
      const tag = await ctx.db.tag.findFirst({
        where: { id: input.tagId, createdById: ctx.user.workspaceId! },
        select: { id: true },
      });
      if (!tag) throw new TRPCError({ code: "NOT_FOUND", message: "Tag niet gevonden." });
      await ctx.db.leadTag.createMany({ data: [input], skipDuplicates: true });
      return { success: true };
    }),

  removeFromLead: mutationProcedure
    .input(z.object({ leadId: z.string(), tagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertLeadAccess(ctx.db, ctx.user.workspaceId!, input.leadId);
      const tag = await ctx.db.tag.findFirst({
        where: { id: input.tagId, createdById: ctx.user.workspaceId! },
        select: { id: true },
      });
      if (!tag) throw new TRPCError({ code: "NOT_FOUND", message: "Tag niet gevonden." });
      await ctx.db.leadTag.deleteMany({
        where: { leadId: input.leadId, tagId: input.tagId },
      });
      return { success: true };
    }),
});
