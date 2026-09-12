import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create test user
  const passwordHash = await hash("digitify123", 12);

  const user = await db.user.upsert({
    where: { email: "klim@digitify.be" },
    update: {},
    create: {
      email: "klim@digitify.be",
      name: "Klim",
      passwordHash,
      emailVerified: new Date(),
    },
  });

  console.log(`✅ User: ${user.email}`);

  // Create workspace
  const workspace = await db.workspace.upsert({
    where: { slug: "digitify" },
    update: {},
    create: {
      name: "Digitify",
      slug: "digitify",
      brandColor: "#6366f1",
    },
  });

  console.log(`✅ Workspace: ${workspace.name} (/${workspace.slug})`);

  // Add user as owner
  await db.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: "OWNER",
    },
  });

  console.log(`✅ ${user.email} is OWNER of ${workspace.name}`);

  // Create default pipeline
  const pipeline = await db.pipeline.upsert({
    where: {
      workspaceId_name: {
        workspaceId: workspace.id,
        name: "Sales",
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      name: "Sales",
      isDefault: true,
      stages: {
        create: [
          { name: "Nieuw", color: "#6366f1", position: 0 },
          { name: "Contact gehad", color: "#8b5cf6", position: 1 },
          { name: "Offerte gestuurd", color: "#f59e0b", position: 2 },
          { name: "Onderhandeling", color: "#f97316", position: 3 },
          { name: "Gewonnen", color: "#10b981", position: 4, isWon: true },
          { name: "Verloren", color: "#ef4444", position: 5, isLost: true },
        ],
      },
    },
  });

  console.log(`✅ Pipeline: ${pipeline.name} (6 stages)`);

  // Create availability rules (Mon-Fri 9-17)
  for (let day = 1; day <= 5; day++) {
    await db.availabilityRule.create({
      data: {
        workspaceId: workspace.id,
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "17:00",
      },
    });
  }

  console.log(`✅ Availability: Ma-Vr 09:00-17:00`);

  console.log("\n🎉 Seed complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📧 Email:      klim@digitify.be");
  console.log("🔑 Wachtwoord: digitify123");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
