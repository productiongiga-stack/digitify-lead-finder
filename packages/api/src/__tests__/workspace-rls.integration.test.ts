/**
 * Postgres RLS integration — runs only when RUN_DB_INTEGRATION=1 and DATABASE_URL is set.
 * Requires migrations applied (including workspace_row_level_security).
 */
import { describe, expect, it } from "vitest";
import { PrismaClient } from "@digitify/db";
import { withWorkspaceRls, setWorkspaceRlsContext, isWorkspaceRlsEnabled } from "@digitify/db";

const runIntegration = process.env.RUN_DB_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!runIntegration)("workspace RLS (integration)", () => {
  const prisma = new PrismaClient();

  it("isolates leads when app.workspace_id is set in transaction", async () => {
    const previous = process.env.ENABLE_WORKSPACE_RLS;
    process.env.ENABLE_WORKSPACE_RLS = "true";

    const seededEmails = [
      process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase(),
      process.env.SEED_RLS_OWNER_B_EMAIL?.trim().toLowerCase() || "owner-b@digitify.local",
    ].filter((email): email is string => Boolean(email));

    let owners = await prisma.user.findMany({
      where: seededEmails.length >= 2 ? { email: { in: seededEmails } } : { role: "OWNER" },
      take: 2,
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    if (owners.length < 2) {
      const extra = await prisma.user.create({
        data: {
          email: `rls-ci-${Date.now()}@digitify.local`,
          name: "RLS CI Owner",
          role: "OWNER",
          passwordHash: "ci-no-login",
        },
        select: { id: true },
      });
      await prisma.lead.create({
        data: {
          companyName: "RLS isolation probe",
          createdById: extra.id,
          status: "NEW",
        },
      });
      owners = [...owners, extra];
    }

    const [workspaceA, workspaceB] = owners;

    const countForWorkspace = async (workspaceId: string) =>
      withWorkspaceRls(prisma, workspaceId, async (db) =>
        db.lead.count({ where: { createdById: workspaceId } }),
      );

    const countA = await countForWorkspace(workspaceA.id);
    const countB = await countForWorkspace(workspaceB.id);

    await prisma.$transaction(async (tx) => {
      await setWorkspaceRlsContext(tx, workspaceA.id);
      const visibleAsA = await tx.lead.count();
      expect(visibleAsA).toBe(countA);
    });

    await prisma.$transaction(async (tx) => {
      await setWorkspaceRlsContext(tx, workspaceB.id);
      const visibleAsB = await tx.lead.count();
      expect(visibleAsB).toBe(countB);
    });

    process.env.ENABLE_WORKSPACE_RLS = previous;
  });

  it("hides another workspace lead by id when RLS context is set", async () => {
    const previous = process.env.ENABLE_WORKSPACE_RLS;
    process.env.ENABLE_WORKSPACE_RLS = "true";

    const ownerA = await prisma.user.create({
      data: {
        email: `rls-a-${Date.now()}@digitify.local`,
        name: "RLS Owner A",
        role: "OWNER",
        passwordHash: "ci-no-login",
      },
      select: { id: true },
    });
    const ownerB = await prisma.user.create({
      data: {
        email: `rls-b-${Date.now()}@digitify.local`,
        name: "RLS Owner B",
        role: "OWNER",
        passwordHash: "ci-no-login",
      },
      select: { id: true },
    });

    const leadA = await withWorkspaceRls(prisma, ownerA.id, async (db) =>
      db.lead.create({
        data: {
          companyName: "RLS tenant A lead",
          createdById: ownerA.id,
          status: "NEW",
        },
        select: { id: true },
      }),
    );

    await prisma.$transaction(async (tx) => {
      await setWorkspaceRlsContext(tx, ownerB.id);
      const leaked = await tx.lead.findFirst({ where: { id: leadA.id } });
      expect(leaked).toBeNull();
    });

    const visibleToOwner = await withWorkspaceRls(prisma, ownerA.id, async (db) =>
      db.lead.findFirst({ where: { id: leadA.id }, select: { id: true } }),
    );
    expect(visibleToOwner?.id).toBe(leadA.id);

    process.env.ENABLE_WORKSPACE_RLS = previous;
  });

  it("reports RLS flag from environment", () => {
    const prev = process.env.ENABLE_WORKSPACE_RLS;
    process.env.ENABLE_WORKSPACE_RLS = "true";
    expect(isWorkspaceRlsEnabled()).toBe(true);
    delete process.env.ENABLE_WORKSPACE_RLS;
    expect(isWorkspaceRlsEnabled()).toBe(false);
    process.env.ENABLE_WORKSPACE_RLS = prev;
  });
});
