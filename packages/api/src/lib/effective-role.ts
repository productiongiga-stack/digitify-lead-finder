import type { Context } from "../trpc";

type RoleContext = {
  user?: {
    workspaceRole?: string | null;
    role?: string | null;
  } | null;
};

/** Workspace membership role when set; otherwise global User.role. */
export function effectiveWorkspaceRole(ctx: RoleContext | Context): string {
  return ctx.user?.workspaceRole ?? ctx.user?.role ?? "MEMBER";
}
