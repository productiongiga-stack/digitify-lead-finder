import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@digitify/db";

export const PUBLIC_OWNER_PARAM = "account";
export const PUBLIC_OWNER_QUERY_KEYS = ["account", "tenant", "owner", "user", "u"] as const;

export type PublicOwner = {
  id: string;
  publicId: string;
  email?: string | null;
  name?: string | null;
};

export function getPublicOwnerKey(searchParams: URLSearchParams) {
  for (const key of PUBLIC_OWNER_QUERY_KEYS) {
    const value = searchParams.get(key)?.trim();
    if (value) return value;
  }
  return "";
}

export function getPublicOwnerKeyFromUrl(url: string | URL) {
  const parsed = typeof url === "string" ? new URL(url) : url;
  return getPublicOwnerKey(parsed.searchParams);
}

export async function resolvePublicOwner(db: PrismaClient, ownerKey: string | null | undefined): Promise<PublicOwner | null> {
  const key = ownerKey?.trim();
  if (!key) return null;

  return db.user.findFirst({
    where: {
      OR: [
        { publicId: key },
        { id: key },
      ],
    },
    select: {
      id: true,
      publicId: true,
      email: true,
      name: true,
    },
  });
}

export function tenantSettingWhere(userId: string, key: string) {
  return {
    userId_key: {
      userId,
      key,
    },
  } as const;
}

export function tenantSettingsWhere(userId: string, keys?: string[]) {
  return {
    userId,
    ...(keys?.length ? { key: { in: keys } } : {}),
  };
}

export function leadOwnerWhere(userId: string) {
  return { createdById: userId };
}

export function relatedLeadOwnerWhere(userId: string) {
  return { lead: { createdById: userId } };
}

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
