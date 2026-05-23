import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { assertLeadAccess } from "../lib/tenant";
import { migrateLegacyWorkspaceTasks } from "../lib/migrate-workspace-tasks";
import { workspaceScopeFromUser } from "../lib/workspace-settings";

async function resolveRelatedLabels(
  db: any,
  workspaceId: string,
  tasks: Array<{
    relatedType: string | null;
    relatedId: string | null;
  }>,
) {
  const leadIds = new Set<string>();
  const quoteIds = new Set<string>();
  const bookingIds = new Set<string>();
  const clientIds = new Set<string>();

  for (const task of tasks) {
    if (!task.relatedType || !task.relatedId) continue;
    if (task.relatedType === "LEAD") leadIds.add(task.relatedId);
    if (task.relatedType === "QUOTE") quoteIds.add(task.relatedId);
    if (task.relatedType === "BOOKING") bookingIds.add(task.relatedId);
    if (task.relatedType === "CLIENT") clientIds.add(task.relatedId);
  }

  const [leads, quotes, bookings, clients] = await Promise.all([
    leadIds.size > 0
      ? db.lead.findMany({
          where: { id: { in: Array.from(leadIds) }, createdById: workspaceId },
          select: { id: true, companyName: true },
        })
      : Promise.resolve([]),
    quoteIds.size > 0
      ? db.quote.findMany({
          where: { id: { in: Array.from(quoteIds) }, createdById: workspaceId },
          select: { id: true, quoteNumber: true, clientCompany: true, clientName: true },
        })
      : Promise.resolve([]),
    bookingIds.size > 0
      ? db.booking.findMany({
          where: { id: { in: Array.from(bookingIds) }, createdById: workspaceId },
          select: { id: true, clientName: true, date: true },
        })
      : Promise.resolve([]),
    clientIds.size > 0
      ? db.lead.findMany({
          where: { id: { in: Array.from(clientIds) }, createdById: workspaceId },
          select: { id: true, companyName: true },
        })
      : Promise.resolve([]),
  ]);

  const leadMap = new Map(leads.map((item: any) => [item.id, item.companyName]));
  const quoteMap = new Map(
    quotes.map((item: any) => [
      item.id,
      `${item.quoteNumber} • ${item.clientCompany || item.clientName}`,
    ]),
  );
  const bookingMap = new Map(
    bookings.map((item: any) => [
      item.id,
      `${item.clientName} • ${new Date(item.date).toLocaleDateString("nl-BE")}`,
    ]),
  );
  const clientMap = new Map(clients.map((item: any) => [item.id, item.companyName]));

  return (task: { relatedType: string | null; relatedId: string | null }) => {
    let relatedLabel: string | null = null;
    if (task.relatedType === "LEAD" && task.relatedId) relatedLabel = String(leadMap.get(task.relatedId) || "") || null;
    if (task.relatedType === "QUOTE" && task.relatedId) relatedLabel = String(quoteMap.get(task.relatedId) || "") || null;
    if (task.relatedType === "BOOKING" && task.relatedId) relatedLabel = String(bookingMap.get(task.relatedId) || "") || null;
    if (task.relatedType === "CLIENT" && task.relatedId) relatedLabel = String(clientMap.get(task.relatedId) || "") || null;
    return relatedLabel;
  };
}

function serializeTask(row: {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueAt: Date | null;
  relatedType: string | null;
  relatedId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as "TODO" | "IN_PROGRESS" | "DONE",
    priority: row.priority as "LOW" | "MEDIUM" | "HIGH",
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    relatedType: row.relatedType as "LEAD" | "QUOTE" | "BOOKING" | "CLIENT" | null,
    relatedId: row.relatedId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const taskRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
          relatedType: z.enum(["LEAD", "QUOTE", "BOOKING", "CLIENT"]).optional(),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const scope = workspaceScopeFromUser(ctx.user);
      await migrateLegacyWorkspaceTasks(ctx.db, scope);

      const baseWhere = {
        createdById: scope.workspaceId,
        ...(input.relatedType ? { relatedType: input.relatedType } : {}),
      };

      const [rows, statusGroups] = await Promise.all([
        ctx.db.workspaceTask.findMany({
          where: {
            ...baseWhere,
            ...(input.status ? { status: input.status } : {}),
          },
        }),
        ctx.db.workspaceTask.groupBy({
          by: ["status"],
          where: baseWhere,
          _count: { _all: true },
        }),
      ]);

      rows.sort((a, b) => {
        if (a.status !== b.status) {
          const order = ["TODO", "IN_PROGRESS", "DONE"];
          return order.indexOf(a.status) - order.indexOf(b.status);
        }
        const aDue = a.dueAt ? a.dueAt.getTime() : Number.MAX_SAFE_INTEGER;
        const bDue = b.dueAt ? b.dueAt.getTime() : Number.MAX_SAFE_INTEGER;
        if (aDue !== bDue) return aDue - bDue;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });

      const labelFor = await resolveRelatedLabels(ctx.db, scope.workspaceId, rows);
      const items = rows.map((row) => ({
        ...serializeTask(row),
        relatedLabel: labelFor(row),
      }));

      const countByStatus = new Map(statusGroups.map((row) => [row.status, row._count._all]));
      const summary = {
        total: statusGroups.reduce((sum, row) => sum + row._count._all, 0),
        todo: countByStatus.get("TODO") ?? 0,
        inProgress: countByStatus.get("IN_PROGRESS") ?? 0,
        done: countByStatus.get("DONE") ?? 0,
      };
      return { items, summary };
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(160),
        description: z.string().max(4000).optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
        dueAt: z.string().datetime().optional(),
        relatedType: z.enum(["LEAD", "QUOTE", "BOOKING", "CLIENT"]).optional(),
        relatedId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if ((input.relatedType && !input.relatedId) || (!input.relatedType && input.relatedId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Koppeltype en gekoppeld ID moeten samen ingevuld zijn.",
        });
      }
      if (input.relatedType === "LEAD" && input.relatedId) {
        await assertLeadAccess(ctx.db, ctx.user.workspaceId!, input.relatedId);
      }
      if (input.relatedType === "CLIENT" && input.relatedId) {
        await assertLeadAccess(ctx.db, ctx.user.workspaceId!, input.relatedId);
      }
      if (input.relatedType === "QUOTE" && input.relatedId) {
        const quote = await ctx.db.quote.findFirst({
          where: { id: input.relatedId, createdById: ctx.user.workspaceId! },
          select: { id: true },
        });
        if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "Offerte niet gevonden." });
      }
      if (input.relatedType === "BOOKING" && input.relatedId) {
        const booking = await ctx.db.booking.findFirst({
          where: { id: input.relatedId, createdById: ctx.user.workspaceId! },
          select: { id: true },
        });
        if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Boeking niet gevonden." });
      }

      const row = await ctx.db.workspaceTask.create({
        data: {
          createdById: ctx.user.workspaceId!,
          title: input.title.trim(),
          description: input.description?.trim() || "",
          priority: input.priority,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          relatedType: input.relatedType ?? null,
          relatedId: input.relatedId ?? null,
        },
      });
      return serializeTask(row);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(160).optional(),
        description: z.string().max(4000).optional(),
        status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
        dueAt: z.string().datetime().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.workspaceTask.findFirst({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Taak niet gevonden." });

      const row = await ctx.db.workspaceTask.update({
        where: { id: input.id },
        data: {
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description.trim() } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.priority !== undefined ? { priority: input.priority } : {}),
          ...(input.dueAt !== undefined ? { dueAt: input.dueAt ? new Date(input.dueAt) : null } : {}),
        },
      });
      return serializeTask(row);
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.workspaceTask.deleteMany({
        where: { id: input.id, createdById: ctx.user.workspaceId! },
      });
      if (result.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Taak niet gevonden." });
      }
      return { success: true };
    }),
});
