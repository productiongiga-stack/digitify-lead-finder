import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@digitify/db";

export function ownedLeadWhere(userId: string, extra: Record<string, unknown> = {}) {
  return { ...extra, createdById: userId };
}

export async function assertLeadAccess(db: PrismaClient, userId: string, leadId: string) {
  const lead = await db.lead.findFirst({
    where: { id: leadId, createdById: userId },
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
