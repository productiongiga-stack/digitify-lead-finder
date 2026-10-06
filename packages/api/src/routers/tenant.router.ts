import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { resolveTenantContext } from "../lib/tenant-context";
import { hasWorkspaceAccess } from "../lib/workspace-registry";

export const tenantRouter = router({
  getContext: protectedProcedure.query(async ({ ctx }) => {
    const tenant = await resolveTenantContext(ctx.db, ctx.user);
    return tenant;
  }),
  assertAccess: protectedProcedure.input(z.object({ workspaceId: z.string().min(1) })).query(async ({ ctx, input }) => {
    const access = await hasWorkspaceAccess(ctx.db, ctx.user.id, input.workspaceId);
    if (!access) throw new TRPCError({ code: "FORBIDDEN", message: "Je hebt geen toegang tot dit bedrijf." });
    return { allowed: true, workspaceId: input.workspaceId };
  }),
});
