import { protectedProcedure, router } from "../trpc";
import { workspaceScopeFromUser } from "../lib/workspace-settings";

export const paymentRouter = router({
  overview: protectedProcedure.query(async ({ ctx }) => {
    const scope = workspaceScopeFromUser(ctx.user);

    const where = { createdById: scope.workspaceId };
    const soon = new Date();
    soon.setDate(soon.getDate() + 14);

    const [groups, open, dueSoon, recent] = await Promise.all([
      ctx.db.workspaceInvoice.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
        _sum: { total: true },
      }),
      ctx.db.workspaceInvoice.aggregate({
        where: { ...where, status: { notIn: ["PAID", "CANCELLED"] } },
        _count: { _all: true },
        _sum: { total: true },
      }),
      ctx.db.workspaceInvoice.findMany({
        where: {
          ...where,
          status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
          dueDate: { lte: soon },
        },
        orderBy: { dueDate: "asc" },
        take: 5,
        select: {
          id: true,
          invoiceNumber: true,
          clientName: true,
          total: true,
          currency: true,
          status: true,
          dueDate: true,
          leadId: true,
        },
      }),
      ctx.db.workspaceInvoice.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          invoiceNumber: true,
          clientName: true,
          total: true,
          currency: true,
          status: true,
          updatedAt: true,
          leadId: true,
        },
      }),
    ]);

    const status = Object.fromEntries(groups.map((group) => [group.status, {
      count: group._count._all,
      amount: group._sum.total ?? 0,
    }]));

    return {
      status,
      open: {
        count: open._count._all,
        amount: open._sum.total ?? 0,
      },
      dueSoon,
      recent,
      lastUpdated: new Date(),
    };
  }),
});
