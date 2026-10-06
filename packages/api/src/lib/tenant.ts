import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@digitify/db";

/** Scope for shared workspace resources (leads, campaigns, templates, …). */
export function workspaceDataWhere(workspaceId: string) {
  return {
    createdById: workspaceId,
  };
}

export function ownedLeadWhere(workspaceId: string, extra: Record<string, unknown> = {}) {
  return { ...extra, ...workspaceDataWhere(workspaceId) };
}

/**
 * Leads are a legacy CRM table whose createdById is a foreign key to users.
 * Team workspaces have their own cuid, so a workspace id cannot be written to
 * this column. Resolve the workspace owner for all lead reads and writes while
 * keeping the active workspace id for shared settings, jobs and analysis.
 */
export async function resolveLeadOwnerId(db: PrismaClient, workspaceId: string) {
  const user = await db.user.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (user) return user.id;
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId }, select: { ownerUserId: true } });
  return workspace?.ownerUserId ?? workspaceId;
}

export async function ownedLeadWhereAsync(
  db: PrismaClient,
  workspaceId: string,
  extra: Record<string, unknown> = {},
) {
  return ownedLeadWhere(await resolveLeadOwnerId(db, workspaceId), extra);
}

export async function assertLeadAccess(db: PrismaClient, workspaceId: string, leadId: string) {
  const lead = await db.lead.findFirst({
    where: await ownedLeadWhereAsync(db, workspaceId, { id: leadId }),
    select: { id: true },
  });
  if (!lead) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Lead niet gevonden." });
  }
}

export async function assertOwnedRecord(
  findRecord: () => Promise<{ id: string } | null>,
  message = "Item niet gevonden.",
) {
  const record = await findRecord();
  if (!record) throw new TRPCError({ code: "NOT_FOUND", message });
  return record;
}

export function ownedChatSessionWhere(workspaceId: string, memberId?: string) {
  return {
    OR: [
      { lead: { createdById: workspaceId } },
      ...(memberId ? [{ assignedToId: memberId }] : []),
      { tags: { has: `tenant:${workspaceId}` } },
    ],
  };
}
