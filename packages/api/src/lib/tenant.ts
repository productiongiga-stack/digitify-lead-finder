import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@digitify/db";

function hasGlobalLeadAccess(role: string | null | undefined) {
  return role === "OWNER" || role === "ADMIN";
}

export function leadAccessWhere(userId: string, role?: string | null) {
  if (hasGlobalLeadAccess(role)) return {};
  return {
    OR: [
      { createdById: userId },
      { assignedToId: userId },
    ],
  };
}

export function ownedLeadWhere(userId: string, extra: Record<string, unknown> = {}, role?: string | null) {
  return { AND: [leadAccessWhere(userId, role), extra] };
}

export async function assertLeadAccess(db: PrismaClient, userId: string, leadId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  const lead = await db.lead.findFirst({
    where: ownedLeadWhere(userId, { id: leadId }, user?.role),
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

export function ownedChatSessionWhere(userId: string) {
  return {
    OR: [
      { lead: { createdById: userId } },
      { assignedToId: userId },
      { tags: { has: `tenant:${userId}` } },
    ],
  };
}
