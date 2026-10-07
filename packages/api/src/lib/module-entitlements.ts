import { type PrismaClient } from "@digitify/db";
import { TRPCError } from "@trpc/server";
import { FREE_MODULE_IDS } from "./tenant-context";

export async function ensureDefaultModuleEntitlements(db: PrismaClient, workspaceId: string) {
  if (!db.workspaceModuleEntitlement?.createMany) return;
  try {
    await db.workspaceModuleEntitlement.createMany({
      data: FREE_MODULE_IDS.map((moduleId) => ({ workspaceId, moduleId, status: "ACTIVE", source: "FREE" })),
      skipDuplicates: true,
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "P2021" && code !== "P2022") throw error;
  }
}

export async function assertModuleEntitlement(db: PrismaClient, workspaceId: string, moduleId: string) {
  if (!db.workspaceModuleEntitlement?.findUnique) return;
  let entitlement;
  try {
    entitlement = await db.workspaceModuleEntitlement.findUnique({ where: { workspaceId_moduleId: { workspaceId, moduleId } }, select: { status: true, startsAt: true, endsAt: true } });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "P2021" || code === "P2022") return;
    throw error;
  }
  if (!entitlement) return; // legacy workspaces are backfilled by migration and remain compatible during rollout.
  const active = (entitlement.status === "ACTIVE" || entitlement.status === "TRIAL") && entitlement.startsAt <= new Date() && (!entitlement.endsAt || entitlement.endsAt > new Date());
  if (!active) throw new TRPCError({ code: "FORBIDDEN", message: "Deze module is nog niet geactiveerd." });
}
