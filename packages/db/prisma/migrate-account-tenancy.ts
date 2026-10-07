import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");
const freeModules = ["leads", "leadFinder", "campaigns", "scoring", "crm", "tasks"];
const platformEmails = new Set((process.env.PLATFORM_OWNER_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log(JSON.stringify({ dryRun: !apply, skipped: true, reason: "DATABASE_URL ontbreekt; voer dit uit in de lokale of productieomgeving." }, null, 2));
    return;
  }
  let users;
  try {
    users = await db.user.findMany({ select: { id: true, email: true, role: true, accountClass: true, platformRole: true, trialEndsAt: true, createdAt: true } });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "P2021" || code === "P2022") {
      console.log(JSON.stringify({ dryRun: !apply, skipped: true, reason: "De account-tenancy migratie is nog niet toegepast; voer eerst pnpm db:migrate uit." }, null, 2));
      return;
    }
    throw error;
  }
  const workspaces = await db.workspace.findMany({ select: { id: true, ownerUserId: true } });
  const report = { dryRun: !apply, users: users.length, workspaces: workspaces.length, accountClassUpdates: 0, platformRoleUpdates: 0, trials: 0, entitlements: 0 };
  for (const user of users) {
    const isPlatform = platformEmails.has(user.email.toLowerCase());
    const nextClass = isPlatform ? "PLATFORM_OWNER" : user.role === "TESTER" ? "TESTER" : user.role === "TRIAL" ? "TRIAL" : user.role === "OWNER" ? "CLIENT_OWNER" : "CLIENT_MEMBER";
    const nextPlatformRole = isPlatform ? "OWNER" : null;
    const nextTrialEndsAt = nextClass === "TRIAL" && !user.trialEndsAt ? new Date(user.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000) : user.trialEndsAt;
    if (user.accountClass !== nextClass) report.accountClassUpdates++;
    if (user.platformRole !== nextPlatformRole) report.platformRoleUpdates++;
    if (nextTrialEndsAt && !user.trialEndsAt) report.trials++;
    if (apply) await db.user.update({ where: { id: user.id }, data: { accountClass: nextClass, platformRole: nextPlatformRole, trialEndsAt: nextTrialEndsAt } });
  }
  for (const workspace of workspaces) {
    for (const moduleId of freeModules) {
      const existing = await db.workspaceModuleEntitlement.findUnique({ where: { workspaceId_moduleId: { workspaceId: workspace.id, moduleId } }, select: { id: true } });
      if (!existing) {
        report.entitlements++;
        if (apply) await db.workspaceModuleEntitlement.create({ data: { workspaceId: workspace.id, moduleId, status: "ACTIVE", source: "FREE" } });
      }
    }
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
