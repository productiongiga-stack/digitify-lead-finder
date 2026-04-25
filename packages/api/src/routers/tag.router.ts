import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const tagRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.tag.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { leads: true } } },
    });
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), color: z.string().default("#6366f1") }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.tag.create({ data: input });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), color: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.tag.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.tag.delete({ where: { id: input.id } });
      return { success: true };
    }),

  addToLead: protectedProcedure
    .input(z.object({ leadId: z.string(), tagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.leadTag.create({ data: input });
    }),

  removeFromLead: protectedProcedure
    .input(z.object({ leadId: z.string(), tagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.leadTag.delete({
        where: { leadId_tagId: { leadId: input.leadId, tagId: input.tagId } },
      });
      return { success: true };
    }),
});
