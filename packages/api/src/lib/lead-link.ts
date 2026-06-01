import type { Lead, LeadContact, PrismaClient } from "@digitify/db";

export type LinkedLead = Lead & {
  contacts: Array<Pick<LeadContact, "name" | "isPrimary">>;
};

type EnsureLeadLinkInput = {
  db: PrismaClient;
  userId: string;
  workspaceId?: string;
  leadId?: string;
  email?: string;
  companyName?: string;
  phone?: string;
  address?: string;
  source?: string;
  createIfMissing?: boolean;
};

const leadInclude = {
  contacts: {
    select: { name: true, isPrimary: true },
    orderBy: { isPrimary: "desc" as const },
    take: 3,
  },
};

function cleanEmail(value?: string) {
  return value?.trim().toLowerCase() || "";
}

function deriveCompanyFromEmail(email: string) {
  const domain = email.split("@")[1] || "";
  const root = domain.split(".")[0] || "";
  const normalized = root.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return "Nieuwe lead";
  return normalized
    .split(" ")
    .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join(" ");
}

/** Find lead in workspace by primary email or contact email. */
export async function findLeadByEmailInWorkspace(
  db: PrismaClient,
  workspaceId: string,
  email: string,
): Promise<LinkedLead | null> {
  const normalized = cleanEmail(email);
  if (!normalized) return null;

  const byLeadEmail = await db.lead.findFirst({
    where: { createdById: workspaceId, email: normalized },
    include: leadInclude,
    orderBy: { updatedAt: "desc" },
  });
  if (byLeadEmail) return byLeadEmail;

  const viaContact = await db.leadContact.findFirst({
    where: {
      email: normalized,
      lead: { createdById: workspaceId },
    },
    include: {
      lead: { include: leadInclude },
    },
  });
  return viaContact?.lead ?? null;
}

export async function resolveLeadForEmail(
  db: PrismaClient,
  workspaceId: string,
  email: string,
  options?: { createIfMissing?: boolean; source?: string },
): Promise<LinkedLead | null> {
  const existing = await findLeadByEmailInWorkspace(db, workspaceId, email);
  if (existing) return existing;
  if (!options?.createIfMissing) return null;

  return ensureLeadLink({
    db,
    userId: workspaceId,
    workspaceId,
    email,
    source: options.source || "inbox_auto",
    createIfMissing: true,
  });
}

export async function ensureLeadLink(input: EnsureLeadLinkInput): Promise<LinkedLead | null> {
  const email = cleanEmail(input.email);
  const companyName = input.companyName?.trim() || "";
  const workspaceId = input.workspaceId || input.userId;

  if (input.leadId) {
    const existing = await input.db.lead.findFirst({
      where: { id: input.leadId, createdById: workspaceId },
      include: leadInclude,
    });
    if (existing) return existing;
  }

  if (email) {
    const byEmail = await findLeadByEmailInWorkspace(input.db, workspaceId, email);
    if (byEmail) return byEmail;
  }

  if (companyName) {
    const byCompany = await input.db.lead.findFirst({
      where: { companyName, createdById: workspaceId },
      include: leadInclude,
      orderBy: { updatedAt: "desc" },
    });
    if (byCompany) return byCompany;
  }

  if (!input.createIfMissing && !input.leadId) {
    if (!email && !companyName) return null;
    return null;
  }

  if (!email && !companyName) return null;

  return input.db.lead.create({
    data: {
      createdById: workspaceId,
      savedById: input.userId,
      lastEditedById: input.userId,
      companyName: companyName || deriveCompanyFromEmail(email),
      email: email || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      source: input.source || "manual_link",
    },
    include: leadInclude,
  });
}
