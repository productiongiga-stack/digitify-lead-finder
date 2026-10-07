import type { PrismaClient } from "@digitify/db";
import { resolveLeadOwnerId } from "./tenant";

type FileRelationType = "LEAD" | "QUOTE" | "CUSTOMER" | "PROJECT";

/** Ensures a file relation cannot point at a resource from another workspace. */
export async function assertWorkspaceFileRelation(
  db: PrismaClient,
  workspaceId: string,
  relatedType?: FileRelationType | null,
  relatedId?: string | null,
) {
  if (!relatedType && !relatedId) return;
  if (!relatedType || !relatedId) throw new Error("Een bestandrelatie is onvolledig.");

  // Leads, quotes and projects are legacy records keyed by the company
  // owner's user id. The active workspace id is only the tenant boundary.
  const ownerUserId = await resolveLeadOwnerId(db, workspaceId);

  const found = relatedType === "LEAD" || relatedType === "CUSTOMER"
    ? await db.lead.findFirst({ where: { id: relatedId, createdById: ownerUserId }, select: { id: true } })
      : relatedType === "QUOTE"
      ? await db.quote.findFirst({ where: { id: relatedId, createdById: ownerUserId }, select: { id: true } })
      : await db.project.findFirst({ where: { id: relatedId, createdById: ownerUserId }, select: { id: true } });

  if (!found) throw new Error("Gekoppelde resource niet gevonden.");
}
