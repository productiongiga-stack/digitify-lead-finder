import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { readWorkspaceJsonSetting, writeWorkspaceJsonSetting } from "../lib/user-json-setting";
import { assertLeadAccess } from "../lib/tenant";
import { workspaceScopeFromUser, type WorkspaceScope } from "../lib/workspace-settings";

const TASKS_KEY = "tasks.items_json";

const taskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().default(""),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  dueAt: z.string().nullable().default(null),
  relatedType: z.enum(["LEAD", "QUOTE", "BOOKING", "CLIENT"]).nullable().default(null),
  relatedId: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type TaskItem = z.infer<typeof taskSchema>;

async function loadTasks(db: any, scope: WorkspaceScope): Promise<TaskItem[]> {
  const raw = await readWorkspaceJsonSetting<unknown[]>(db, scope, TASKS_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => taskSchema.safeParse(item))
    .filter((item) => item.success)
    .map((item) => item.data);
}

async function resolveRelatedLabels(
  db: any,
  workspaceId: string,
  tasks: TaskItem[],
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

  return tasks.map((task) => {
    let relatedLabel: string | null = null;
    if (task.relatedType === "LEAD" && task.relatedId) relatedLabel = String(leadMap.get(task.relatedId) || "") || null;
    if (task.relatedType === "QUOTE" && task.relatedId) relatedLabel = String(quoteMap.get(task.relatedId) || "") || null;
    if (task.relatedType === "BOOKING" && task.relatedId) relatedLabel = String(bookingMap.get(task.relatedId) || "") || null;
    if (task.relatedType === "CLIENT" && task.relatedId) relatedLabel = String(clientMap.get(task.relatedId) || "") || null;
    return { ...task, relatedLabel };
  });
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
      let tasks = await loadTasks(ctx.db, scope);
      if (input.status) tasks = tasks.filter((task) => task.status === input.status);
      if (input.relatedType) tasks = tasks.filter((task) => task.relatedType === input.relatedType);
      tasks.sort((a, b) => {
        if (a.status !== b.status) {
          const order = ["TODO", "IN_PROGRESS", "DONE"];
          return order.indexOf(a.status) - order.indexOf(b.status);
        }
        const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        if (aDue !== bDue) return aDue - bDue;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      const withRelations = await resolveRelatedLabels(ctx.db, scope.workspaceId, tasks);
      const summary = {
        total: tasks.length,
        todo: tasks.filter((task) => task.status === "TODO").length,
        inProgress: tasks.filter((task) => task.status === "IN_PROGRESS").length,
        done: tasks.filter((task) => task.status === "DONE").length,
      };
      return { items: withRelations, summary };
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

      const now = new Date().toISOString();
      const task: TaskItem = {
        id: randomUUID(),
        title: input.title.trim(),
        description: input.description?.trim() || "",
        status: "TODO",
        priority: input.priority,
        dueAt: input.dueAt || null,
        relatedType: input.relatedType || null,
        relatedId: input.relatedId || null,
        createdAt: now,
        updatedAt: now,
      };
      const scope = workspaceScopeFromUser(ctx.user);
      const tasks = await loadTasks(ctx.db, scope);
      tasks.unshift(task);
      await writeWorkspaceJsonSetting(ctx.db, scope, TASKS_KEY, tasks.slice(0, 3000));
      return task;
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
      const scope = workspaceScopeFromUser(ctx.user);
      const tasks = await loadTasks(ctx.db, scope);
      const index = tasks.findIndex((task) => task.id === input.id);
      if (index < 0) throw new TRPCError({ code: "NOT_FOUND", message: "Taak niet gevonden." });
      const current = tasks[index];
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Taak niet gevonden." });

      const next: TaskItem = {
        ...current,
        title: input.title?.trim() || current.title,
        description: input.description !== undefined ? input.description.trim() : current.description,
        status: input.status || current.status,
        priority: input.priority || current.priority,
        dueAt: input.dueAt !== undefined ? input.dueAt : current.dueAt,
        updatedAt: new Date().toISOString(),
      };
      tasks[index] = next;
      await writeWorkspaceJsonSetting(ctx.db, scope, TASKS_KEY, tasks);
      return next;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const scope = workspaceScopeFromUser(ctx.user);
      const tasks = await loadTasks(ctx.db, scope);
      const filtered = tasks.filter((task) => task.id !== input.id);
      if (filtered.length === tasks.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Taak niet gevonden." });
      }
      await writeWorkspaceJsonSetting(ctx.db, scope, TASKS_KEY, filtered);
      return { success: true };
    }),
});
