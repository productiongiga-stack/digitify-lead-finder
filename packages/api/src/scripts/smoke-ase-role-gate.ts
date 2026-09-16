import { prisma } from "@digitify/db";
import { appRouter } from "../root";

async function main() {
  const member = await prisma.user.findFirst({ where: { role: "MEMBER" } });
  const owner = await prisma.user.findFirst({
    where: { role: "OWNER", email: "admin@digitify.local" },
  });
  if (!owner) throw new Error("no owner");

  const makeCaller = (user: { id: string; email: string; name: string | null; role: string }) =>
    appRouter.createCaller({
      db: prisma,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      requestId: "role-gate-test",
    });

  const ownerCaller = makeCaller(owner);
  const list = await ownerCaller.aseLicense.list();
  console.log("owner_list_count", list.items.length, "pending", list.pendingCount);

  if (member) {
    const memberCaller = makeCaller(member);
    for (const label of ["list", "create"] as const) {
      try {
        if (label === "list") await memberCaller.aseLicense.list();
        else await memberCaller.aseLicense.createForEmail({ email: "member-blocked@example.com" });
        console.log(`member_${label}`, "UNEXPECTED_OK");
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string };
        console.log(`member_${label}`, err.code || err.message);
      }
    }
  } else {
    console.log("member_list", "NO_MEMBER_USER");
  }

  const created = await ownerCaller.aseLicense.createForEmail({
    email: "caller-test@example.com",
    name: "Caller",
  });
  console.log(
    JSON.stringify({
      owner_create: {
        emailSent: created.emailSent,
        keyPrefix: created.key.slice(0, 12),
      },
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
