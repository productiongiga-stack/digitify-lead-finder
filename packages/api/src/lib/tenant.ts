import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@digitify/db";

/** Scope for shared workspace resources (leads, campaigns, templates, …). */
export function workspaceDataWhere(workspaceId: string) {
  return {
    createdById: workspaceId,
  };
}

/** @deprecated Use workspaceDataWhere — kept as alias for leads. */
export function leadAccessWhere(workspaceId: string) {
  return workspaceDataWhere(workspaceId);
}

export function ownedLeadWhere(workspaceId: string, extra: Record<string, unknown> = {}) {
  return { ...extra, ...workspaceDataWhere(workspaceId) };
}

export async function assertLeadAccess(db: PrismaClient, workspaceId: string, leadId: string) {
  const lead = await db.lead.findFirst({
    where: ownedLeadWhere(workspaceId, { id: leadId }),
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
