import { type Prisma, type PrismaClient } from "@digitify/db";
import { TRPCError } from "@trpc/server";

/** Prisma filter: users that belong to a workspace (owner account + team members). */
export function workspaceMemberWhere(workspaceId: string): Prisma.UserWhereInput {
  return {
    OR: [{ id: workspaceId }, { workspaceOwnerId: workspaceId }],
  };
}

export async function assertWorkspaceMember(
  db: PrismaClient,
  workspaceId: string,
  userId: string,
) {
  const member = await db.user.findFirst({
    where: { id: userId, ...workspaceMemberWhere(workspaceId) },
    select: { id: true, role: true },
  });
  if (!member) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Gebruiker niet gevonden in deze workspace.",
    });
  }
  return member;
}

export async function countWorkspaceOwners(db: PrismaClient, workspaceId: string) {
  return db.user.count({
    where: { role: "OWNER", ...workspaceMemberWhere(workspaceId) },
  });
}

export async function notifyWorkspaceAdmins(
  db: PrismaClient,
  workspaceId: string,
  subject: string,
  body: string,
  send: (args: { toEmail: string; subject: string; body: string }) => Promise<unknown>,
) {
  const admins = await db.user.findMany({
    where: {
      role: { in: ["OWNER", "ADMIN"] },
      email: { not: "" },
      ...workspaceMemberWhere(workspaceId),
    },
    select: { email: true },
  });

  await Promise.allSettled(
    admins.map((admin) =>
      send({
        toEmail: admin.email,
        subject,
        body,
      }),
    ),
  );
}
