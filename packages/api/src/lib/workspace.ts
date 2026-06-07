import { type PrismaClient, type UserRole } from "@digitify/db";
import { resolveActiveWorkspaceId } from "./workspace-registry";

export type WorkspaceUser = {
  id: string;
  role: string;
  workspaceOwnerId?: string | null;
  activeWorkspaceId?: string | null;
  workspaceId?: string | null;
};

/** Resolve active workspace id from session/JWT payload (no DB). */
export function resolveWorkspaceOwnerIdSync(user: WorkspaceUser): string {
  if (typeof user.workspaceId === "string" && user.workspaceId.length > 0) {
    return user.workspaceId;
  }
  if (user.activeWorkspaceId) return user.activeWorkspaceId;
  return user.id;
}

const workspaceIdCache = new Map<string, { expiresAt: number; workspaceId: string }>();
const WORKSPACE_ID_CACHE_TTL_MS = 5 * 60_000;

/**
 * Returns the active workspace id for data scoping (leads, templates, campaigns, …).
 */
export async function resolveWorkspaceOwnerId(
  db: PrismaClient,
  userId: string,
): Promise<string> {
  const cached = workspaceIdCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) return cached.workspaceId;

  const workspaceId = await resolveActiveWorkspaceId(db, userId);
  workspaceIdCache.set(userId, {
    workspaceId,
    expiresAt: Date.now() + WORKSPACE_ID_CACHE_TTL_MS,
  });
  return workspaceId;
}

export function invalidateWorkspaceOwnerIdCache(userId: string) {
  workspaceIdCache.delete(userId);
}

export function isWorkspaceOwner(
  user: WorkspaceUser & { workspaceRole?: string; isPersonalWorkspace?: boolean },
  workspaceId: string,
) {
  if (user.isPersonalWorkspace || user.id === workspaceId) return true;
  if (user.workspaceRole === "OWNER") return true;
  return user.role === "OWNER";
}

export async function getWorkspaceOwnerProfile(db: PrismaClient, workspaceId: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      owner: { select: { id: true, name: true, email: true } },
    },
  });
  if (workspace?.owner) return workspace.owner;
  return db.user.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, email: true },
  });
}

export function workspaceMemberRoles(): UserRole[] {
  return ["ADMIN", "MODERATOR", "MEMBER", "TRIAL", "TESTER", "VIEWER"];
}

export type { WorkspaceScope } from "./workspace-settings";
export { workspaceScopeFromUser } from "./workspace-settings";
export {
  assertWorkspaceMember,
  countWorkspaceOwners,
  notifyWorkspaceAdmins,
  workspaceMemberWhere,
} from "./workspace-members";
