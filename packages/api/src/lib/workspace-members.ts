import { type Prisma, type PrismaClient } from "@digitify/db";
import { TRPCError } from "@trpc/server";
import { getMembershipRole, hasWorkspaceAccess } from "./workspace-registry";

/** Prisma filter: users that belong to a workspace (legacy owner + team members). */
export function workspaceMemberWhere(workspaceId: string): Prisma.UserWhereInput {
  return {
    OR: [{ id: workspaceId }, { workspaceOwnerId: workspaceId }],
  };
}

export async function workspaceMemberUserIds(db: PrismaClient, workspaceId: string) {
  const memberships = await db.workspaceMembership.findMany({
    where: { workspaceId, status: "ACTIVE" },
    select: { userId: true },
  });
  const ids = new Set(memberships.map((row) => row.userId));
  const legacy = await db.user.findMany({
    where: workspaceMemberWhere(workspaceId),
    select: { id: true },
  });
  for (const row of legacy) ids.add(row.id);
  return [...ids];
}

export async function assertWorkspaceMember(
  db: PrismaClient,
  workspaceId: string,
  userId: string,
) {
  if (!(await hasWorkspaceAccess(db, userId, workspaceId))) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Gebruiker niet gevonden in deze workspace.",
    });
  }

  const member = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!member) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Gebruiker niet gevonden in deze workspace.",
    });
  }

  const membershipRole = await getMembershipRole(db, workspaceId, userId);
  return {
    id: member.id,
    role: membershipRole ?? member.role,
  };
}

export async function countWorkspaceOwners(db: PrismaClient, workspaceId: string) {
  const membershipOwners = await db.workspaceMembership.count({
    where: { workspaceId, status: "ACTIVE", role: "OWNER" },
  });
  if (membershipOwners > 0) return membershipOwners;
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
  const userIds = await workspaceMemberUserIds(db, workspaceId);
  const membershipAdmins = await db.workspaceMembership.findMany({
    where: {
      workspaceId,
      status: "ACTIVE",
      userId: { in: userIds },
      role: { in: ["OWNER", "ADMIN"] },
    },
    include: {
      user: { select: { email: true } },
    },
  });

  const admins =
    membershipAdmins.length > 0
      ? membershipAdmins
          .map((row) => row.user)
          .filter((user) => user.email)
      : await db.user.findMany({
          where: {
            id: { in: userIds },
            role: { in: ["OWNER", "ADMIN"] },
            email: { not: "" },
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
