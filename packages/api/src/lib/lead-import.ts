import type { Prisma, PrismaClient } from "@digitify/db";

type LeadIdentity = {
  companyName: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  gmbPlaceId?: string | null;
};

const normalize = (value?: string | null) => (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export function sameLeadIdentity(left: LeadIdentity, right: LeadIdentity) {
  const leftId = left.gmbPlaceId?.trim();
  const rightId = right.gmbPlaceId?.trim();
  if (leftId && rightId) return leftId === rightId;
  // A name, shared mailbox, domain or central phone alone cannot identify a branch.
  if (!normalize(left.address) || !normalize(right.address)) return false;
  if (!normalize(left.city) && !/[,].*\d{4,5}\s+\S/.test(left.address!)) return false;
  if (!normalize(right.city) && !/[,].*\d{4,5}\s+\S/.test(right.address!)) return false;
  if (normalize(left.companyName) !== normalize(right.companyName) || normalize(left.address) !== normalize(right.address)) return false;
  for (const field of ["city", "country"] as const) {
    if (normalize(left[field]) && normalize(right[field]) && normalize(left[field]) !== normalize(right[field])) return false;
  }
  return true;
}

export async function importLeadRecords(db: PrismaClient, workspaceId: string, inputs: Prisma.LeadCreateManyInput[]) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`lead-import:${workspaceId}`}, 0))`;
    const existing = await tx.lead.findMany({
      where: { createdById: workspaceId },
      select: { id: true, companyName: true, address: true, city: true, country: true, gmbPlaceId: true },
    });
    const created = [];
    const duplicates: string[] = [];
    for (const input of inputs) {
      const duplicate = existing.find((lead) => sameLeadIdentity(lead, input));
      if (duplicate) { duplicates.push(duplicate.id); continue; }
      const lead = await tx.lead.create({ data: { ...input, companyName: input.companyName.trim(), createdById: workspaceId } });
      existing.push(lead);
      created.push(lead);
    }
    return { created, duplicates };
  });
}
