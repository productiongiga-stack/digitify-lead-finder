import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, protectedProcedure, router } from "../trpc";
import { recordSecurityAuditEvent } from "../lib/security-audit";

const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "kennis";
const entryInput = z.object({ title: z.string().trim().min(2).max(160), content: z.string().trim().min(1).max(30000), slug: z.string().trim().max(120).optional() });

export const knowledgeRouter = router({
  list: protectedProcedure.query(({ ctx }) => ctx.db.knowledgeEntry.findMany({
    where: { createdById: ctx.user.workspaceId! }, orderBy: { updatedAt: "desc" }, take: 100,
    select: { id: true, title: true, slug: true, status: true, publishedAt: true, updatedAt: true, _count: { select: { versions: true } } },
  })),

  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const entry = await ctx.db.knowledgeEntry.findFirst({ where: { id: input.id, createdById: ctx.user.workspaceId! }, include: { versions: { orderBy: { version: "desc" }, take: 20, select: { id: true, version: true, title: true, content: true, createdAt: true } } } });
    if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "Kennisitem niet gevonden." });
    return entry;
  }),

  create: adminProcedure.input(entryInput).mutation(async ({ ctx, input }) => {
    const slug = slugify(input.slug || input.title);
    return ctx.db.knowledgeEntry.create({ data: { createdById: ctx.user.workspaceId!, title: input.title, content: input.content, slug, versions: { create: { version: 1, title: input.title, content: input.content, createdById: ctx.user.id } } }, select: { id: true, title: true, status: true } });
  }),

  update: adminProcedure.input(z.object({ id: z.string() }).merge(entryInput)).mutation(async ({ ctx, input }) => {
    const entry = await ctx.db.knowledgeEntry.findFirst({ where: { id: input.id, createdById: ctx.user.workspaceId! }, select: { id: true, title: true, content: true } });
    if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "Kennisitem niet gevonden." });
    const latest = await ctx.db.knowledgeEntryVersion.findFirst({ where: { entryId: entry.id }, orderBy: { version: "desc" }, select: { version: true } });
    return ctx.db.$transaction(async (tx) => {
      const updated = await tx.knowledgeEntry.update({ where: { id: entry.id }, data: { title: input.title, content: input.content, slug: slugify(input.slug || input.title), status: "DRAFT", publishedAt: null }, select: { id: true, title: true, status: true } });
      await tx.knowledgeEntryVersion.create({ data: { entryId: entry.id, version: (latest?.version ?? 0) + 1, title: input.title, content: input.content, createdById: ctx.user.id } });
      return updated;
    });
  }),

  setStatus: adminProcedure.input(z.object({ id: z.string(), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) })).mutation(async ({ ctx, input }) => {
    const entry = await ctx.db.knowledgeEntry.findFirst({ where: { id: input.id, createdById: ctx.user.workspaceId! }, select: { id: true, title: true } });
    if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "Kennisitem niet gevonden." });
    const updated = await ctx.db.knowledgeEntry.update({ where: { id: entry.id }, data: { status: input.status, publishedAt: input.status === "PUBLISHED" ? new Date() : null }, select: { id: true, status: true, publishedAt: true } });
    await recordSecurityAuditEvent(ctx.db, { workspaceId: ctx.user.workspaceId, actorUserId: ctx.user.actorUserId ?? ctx.user.id, targetUserId: ctx.user.id, action: "KNOWLEDGE_STATUS_CHANGED", resource: "KnowledgeEntry", resourceId: entry.id, result: "SUCCESS", requestId: ctx.requestId, metadata: { title: entry.title, status: input.status } });
    return updated;
  }),

  publishedContext: protectedProcedure.query(async ({ ctx }) => ctx.db.knowledgeEntry.findMany({ where: { createdById: ctx.user.workspaceId!, status: "PUBLISHED" }, orderBy: { updatedAt: "desc" }, take: 50, select: { title: true, slug: true, content: true, updatedAt: true } })),
});
