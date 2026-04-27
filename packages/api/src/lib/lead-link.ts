import type { Lead, LeadContact, PrismaClient } from "@digitify/db";

export type LinkedLead = Lead & {
  contacts: Array<Pick<LeadContact, "name" | "isPrimary">>;
};

type EnsureLeadLinkInput = {
  db: PrismaClient;
  userId: string;
  leadId?: string;
  email?: string;
  companyName?: string;
  phone?: string;
  address?: string;
  source?: string;
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

export async function ensureLeadLink(input: EnsureLeadLinkInput): Promise<LinkedLead | null> {
  const email = cleanEmail(input.email);
  const companyName = input.companyName?.trim() || "";

  if (input.leadId) {
    const existing = await input.db.lead.findUnique({
      where: { id: input.leadId },
      include: {
        contacts: {
          select: { name: true, isPrimary: true },
          orderBy: { isPrimary: "desc" },
          take: 3,
        },
      },
    });
    if (existing) return existing;
  }

  if (email) {
    const byEmail = await input.db.lead.findFirst({
      where: { email },
      include: {
        contacts: {
          select: { name: true, isPrimary: true },
          orderBy: { isPrimary: "desc" },
          take: 3,
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    if (byEmail) return byEmail;
  }

  if (companyName) {
    const byCompany = await input.db.lead.findFirst({
      where: { companyName },
      include: {
        contacts: {
          select: { name: true, isPrimary: true },
          orderBy: { isPrimary: "desc" },
          take: 3,
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    if (byCompany) return byCompany;
  }

  if (!email && !companyName) return null;

  return input.db.lead.create({
    data: {
      createdById: input.userId,
      companyName: companyName || deriveCompanyFromEmail(email),
      email: email || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      source: input.source || "manual_link",
    },
    include: {
      contacts: {
        select: { name: true, isPrimary: true },
        orderBy: { isPrimary: "desc" },
        take: 3,
      },
    },
  });
}
