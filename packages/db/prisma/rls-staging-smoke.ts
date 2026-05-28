/**
 * Staging smoke for Postgres workspace RLS — run after seed with two OWNER accounts.
 *
 *   ENABLE_WORKSPACE_RLS=true pnpm db:rls-smoke
 *
 * Uses SEED_ADMIN_EMAIL + SEED_RLS_OWNER_B_EMAIL (default owner-b@digitify.local).
 */
import { PrismaClient } from "@prisma/client";
import { setWorkspaceRlsContext, withWorkspaceRls } from "../src/workspace-rls";

export const RLS_WORKSPACE_B_LEAD_MARKER = "RLS Workspace B —";

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function pass(message: string) {
  console.log(`✓ ${message}`);
}

async function main() {
  if (process.env.ENABLE_WORKSPACE_RLS !== "true") {
    fail('Set ENABLE_WORKSPACE_RLS=true before running (e.g. ENABLE_WORKSPACE_RLS=true pnpm db:rls-smoke)');
  }

  const ownerAEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const ownerBEmail = (
    process.env.SEED_RLS_OWNER_B_EMAIL?.trim().toLowerCase() || "owner-b@digitify.local"
  );

  if (!ownerAEmail) {
    fail("SEED_ADMIN_EMAIL is required (same as db:seed).");
  }

  const prisma = new PrismaClient();

  try {
    const owners = await prisma.user.findMany({
      where: { email: { in: [ownerAEmail, ownerBEmail] } },
      select: { id: true, email: true, role: true },
    });

    const ownerA = owners.find((u) => u.email === ownerAEmail);
    const ownerB = owners.find((u) => u.email === ownerBEmail);

    if (!ownerA || ownerA.role !== "OWNER") {
      fail(`OWNER A not found: ${ownerAEmail}. Run pnpm db:seed first.`);
    }
    if (!ownerB || ownerB.role !== "OWNER") {
      fail(`OWNER B not found: ${ownerBEmail}. Run pnpm db:seed (SEED_RLS_OWNER_B_EMAIL).`);
    }

    pass(`OWNER A ${ownerA.email} (${ownerA.id})`);
    pass(`OWNER B ${ownerB.email} (${ownerB.id})`);

    const leadA = await prisma.lead.findFirst({
      where: { createdById: ownerA.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, companyName: true },
    });
    const leadB = await prisma.lead.findFirst({
      where: {
        createdById: ownerB.id,
        companyName: { startsWith: RLS_WORKSPACE_B_LEAD_MARKER },
      },
      select: { id: true, companyName: true },
    });

    if (!leadA) fail(`No lead for OWNER A (${ownerAEmail}).`);
    if (!leadB) fail(`No RLS marker lead for OWNER B — re-run db:seed.`);

    pass(`Probe lead A: ${leadA.companyName}`);
    pass(`Probe lead B: ${leadB.companyName}`);

    await prisma.$transaction(async (tx) => {
      await setWorkspaceRlsContext(tx, ownerB.id);
      const leakedA = await tx.lead.findFirst({ where: { id: leadA.id } });
      if (leakedA) fail(`OWNER B could read OWNER A lead by id (${leadA.id}).`);
    });
    pass("OWNER B cannot read OWNER A lead by id");

    await prisma.$transaction(async (tx) => {
      await setWorkspaceRlsContext(tx, ownerA.id);
      const leakedB = await tx.lead.findFirst({ where: { id: leadB.id } });
      if (leakedB) fail(`OWNER A could read OWNER B lead by id (${leadB.id}).`);
    });
    pass("OWNER A cannot read OWNER B lead by id");

    const countA = await withWorkspaceRls(prisma, ownerA.id, async (db) => db.lead.count());
    const countB = await withWorkspaceRls(prisma, ownerB.id, async (db) => db.lead.count());

    const rawA = await prisma.lead.count({ where: { createdById: ownerA.id } });
    const rawB = await prisma.lead.count({ where: { createdById: ownerB.id } });

    if (countA !== rawA) {
      fail(`OWNER A RLS count mismatch: visible=${countA} owned=${rawA}`);
    }
    if (countB !== rawB) {
      fail(`OWNER B RLS count mismatch: visible=${countB} owned=${rawB}`);
    }
    pass(`OWNER A sees ${countA} lead(s) in RLS context`);
    pass(`OWNER B sees ${countB} lead(s) in RLS context`);

    console.log("\n--- Manual staging checklist (browser) ---");
    console.log(`1. Log in as ${ownerBEmail} — must NOT see "${leadA.companyName}" in lead list.`);
    console.log(`2. Open ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"}/leads/${leadA.id} as OWNER B — expect 404 or access denied.`);
    console.log(`3. Log in as ${ownerAEmail} — must NOT see "${leadB.companyName}".`);
    console.log(`4. Smoke outbound + Template Studio on staging with ENABLE_WORKSPACE_RLS=true.`);
    console.log("\nRLS staging smoke passed.\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
