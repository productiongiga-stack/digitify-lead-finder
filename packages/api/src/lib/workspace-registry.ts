import { type PrismaClient, type UserRole } from "@digitify/db";
import { TRPCError } from "@trpc/server";
import { ensureUserWorkspace } from "./user-workspace";
import { invalidateWorkspaceOwnerIdCache } from "./workspace";

export function personalWorkspaceName(userName: string | null | undefined, email?: string | null) {
  const base = userName?.trim() || email?.split("@")[0] || "Mijn";
  return `${base} — persoonlijk`;
}

export async function ensurePersonalWorkspace(
  db: PrismaClient,
  userId: string,
  displayName?: string | null,
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) return;

  const name = personalWorkspaceName(displayName ?? user.name, user.email);
  const existing = await db.workspace.findUnique({
    where: { id: userId },
    select: { type: true },
  });

  if (!existing) {
    await db.workspace.create({
      data: {
        id: userId,
        name,
        type: "PERSONAL",
        ownerUserId: userId,
      },
    });
  } else if (existing.type === "PERSONAL") {
    await db.workspace.update({
      where: { id: userId },
      data: { name },
    });
  }

  await db.workspaceMembership.upsert({
    where: {
      workspaceId_userId: { workspaceId: userId, userId },
    },
    create: {
      workspaceId: userId,
      userId,
      role: "OWNER",
      status: "ACTIVE",
    },
    update: {
      status: "ACTIVE",
      role: "OWNER",
    },
  });

  await ensureUserWorkspace(db, userId, displayName ?? user.name);
}

export async function hasWorkspaceAccess(
  db: PrismaClient,
  userId: string,
  workspaceId: string,
  statuses: Array<"ACTIVE" | "INVITED"> = ["ACTIVE"],
) {
  if (workspaceId === userId) return true;
  const membership = await db.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { status: true },
  });
  if (membership && statuses.includes(membership.status as "ACTIVE" | "INVITED")) {
    return true;
  }
  const legacy = await db.user.findFirst({
    where: {
      id: userId,
      OR: [{ id: workspaceId }, { workspaceOwnerId: workspaceId }],
    },
    select: { id: true },
  });
  return Boolean(legacy);
}

export async function resolveActiveWorkspaceId(db: PrismaClient, userId: string): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, activeWorkspaceId: true, name: true, email: true },
  });
  if (!user) return userId;

  await ensurePersonalWorkspace(db, userId, user.name);

  const preferred = user.activeWorkspaceId;
  if (preferred && (await hasWorkspaceAccess(db, userId, preferred))) {
    return preferred;
  }

  if (preferred && preferred !== userId) {
    await db.user.update({
      where: { id: userId },
      data: { activeWorkspaceId: userId },
    });
    invalidateWorkspaceOwnerIdCache(userId);
  }

  return userId;
}

export type WorkspaceListItem = {
  id: string;
  name: string;
  type: "PERSONAL" | "TEAM";
  role: UserRole;
  status: "ACTIVE" | "INVITED" | "DECLINED";
  isPersonal: boolean;
  isActive: boolean;
  memberCount: number;
  ownerName: string;
};

export async function listWorkspacesForUser(
  db: PrismaClient,
  userId: string,
  activeWorkspaceId: string,
): Promise<WorkspaceListItem[]> {
  await ensurePersonalWorkspace(db, userId);

  const memberships = await db.workspaceMembership.findMany({
    where: {
      userId,
      status: { in: ["ACTIVE", "INVITED"] },
    },
    include: {
      workspace: {
        include: {
          owner: { select: { name: true, email: true } },
          _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  return memberships.map((membership) => ({
    id: membership.workspaceId,
    name: membership.workspace.name,
    type: membership.workspace.type,
    role: membership.role,
    status: membership.status,
    isPersonal: membership.workspaceId === userId,
    isActive: membership.workspaceId === activeWorkspaceId,
    memberCount: membership.workspace._count.memberships,
    ownerName:
      membership.workspace.owner.name ||
      membership.workspace.owner.email ||
      "Onbekend",
  }));
}

export async function assertWorkspaceAdmin(
  db: PrismaClient,
  userId: string,
  workspaceId: string,
) {
  if (workspaceId === userId) return { role: "OWNER" as UserRole };

  const membership = await db.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true, status: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Je hebt geen toegang tot deze werkruimte.",
    });
  }

  if (!["OWNER", "ADMIN"].includes(membership.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Alleen eigenaar of admin kan deze actie uitvoeren.",
    });
  }

  return membership;
}

export async function createTeamWorkspace(
  db: PrismaClient,
  userId: string,
  name: string,
) {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Geef een naam van minstens 2 tekens op.",
    });
  }

  const workspace = await db.workspace.create({
    data: {
      name: trimmed,
      type: "TEAM",
      ownerUserId: userId,
      memberships: {
        create: {
          userId,
          role: "OWNER",
          status: "ACTIVE",
        },
      },
    },
  });

  await ensureUserWorkspace(db, workspace.id, trimmed);
  return workspace;
}

export async function inviteUserToWorkspace(
  db: PrismaClient,
  args: {
    workspaceId: string;
    invitedById: string;
    userId: string;
    role?: UserRole;
  },
) {
  const role = args.role ?? "MEMBER";
  const existing = await db.workspaceMembership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: args.workspaceId,
        userId: args.userId,
      },
    },
  });

  if (existing?.status === "ACTIVE") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Deze gebruiker zit al in de werkruimte.",
    });
  }
  if (existing?.status === "INVITED") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Er staat al een open uitnodiging open voor deze gebruiker.",
    });
  }

  return db.workspaceMembership.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: args.workspaceId,
        userId: args.userId,
      },
    },
    create: {
      workspaceId: args.workspaceId,
      userId: args.userId,
      role,
      status: "INVITED",
      invitedById: args.invitedById,
      invitedAt: new Date(),
    },
    update: {
      role,
      status: "INVITED",
      invitedById: args.invitedById,
      invitedAt: new Date(),
      respondedAt: null,
    },
  });
}

export async function respondToWorkspaceInvite(
  db: PrismaClient,
  userId: string,
  workspaceId: string,
  accept: boolean,
) {
  const membership = await db.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: { select: { ownerUserId: true, type: true } } },
  });

  if (!membership || membership.status !== "INVITED") {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Uitnodiging niet gevonden.",
    });
  }

  if (!accept) {
    await db.workspaceMembership.update({
      where: { id: membership.id },
      data: { status: "DECLINED", respondedAt: new Date() },
    });
    await resetActiveWorkspaceIfRemoved(db, userId, workspaceId);
    return { accepted: false, workspaceId };
  }

  await db.workspaceMembership.update({
    where: { id: membership.id },
    data: { status: "ACTIVE", respondedAt: new Date() },
  });

  const workspace = membership.workspace;
  if (workspace.type === "TEAM" && workspaceId === workspace.ownerUserId) {
    await db.user.update({
      where: { id: userId },
      data: {
        workspaceOwnerId: workspaceId,
        role: membership.role,
      },
    });
  }

  invalidateWorkspaceOwnerIdCache(userId);
  return { accepted: true, workspaceId };
}

async function resetActiveWorkspaceIfRemoved(
  db: PrismaClient,
  userId: string,
  workspaceId: string,
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { activeWorkspaceId: true },
  });
  if (user?.activeWorkspaceId !== workspaceId) return;
  await db.user.update({
    where: { id: userId },
    data: { activeWorkspaceId: userId },
  });
  invalidateWorkspaceOwnerIdCache(userId);
}

export async function switchActiveWorkspace(
  db: PrismaClient,
  userId: string,
  workspaceId: string,
) {
  if (!(await hasWorkspaceAccess(db, userId, workspaceId))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Je hebt geen toegang tot deze werkruimte.",
    });
  }

  const membership = await db.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { status: true },
  });
  if (membership?.status === "INVITED") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accepteer eerst de uitnodiging voordat je naar deze werkruimte wisselt.",
    });
  }

  await db.user.update({
    where: { id: userId },
    data: { activeWorkspaceId: workspaceId },
  });
  invalidateWorkspaceOwnerIdCache(userId);
  return workspaceId;
}

export type WorkspaceContext = {
  workspaceId: string;
  workspaceRole: UserRole;
  workspaceType: "PERSONAL" | "TEAM";
  isPersonalWorkspace: boolean;
};

export async function resolveWorkspaceContext(
  db: PrismaClient,
  userId: string,
): Promise<WorkspaceContext> {
  const workspaceId = await resolveActiveWorkspaceId(db, userId);

  if (workspaceId === userId) {
    return {
      workspaceId,
      workspaceRole: "OWNER",
      workspaceType: "PERSONAL",
      isPersonalWorkspace: true,
    };
  }

  const membership = await db.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true, status: true },
  });

  if (membership?.status === "ACTIVE") {
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { type: true, ownerUserId: true },
    });
    return {
      workspaceId,
      workspaceRole: membership.role,
      workspaceType: workspace?.type ?? "TEAM",
      isPersonalWorkspace: false,
    };
  }

  const legacyUser = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, workspaceOwnerId: true },
  });
  if (legacyUser?.workspaceOwnerId === workspaceId) {
    return {
      workspaceId,
      workspaceRole: legacyUser.role,
      workspaceType: "TEAM",
      isPersonalWorkspace: false,
    };
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Je hebt geen toegang tot deze werkruimte.",
  });
}

export async function getMembershipRole(
  db: PrismaClient,
  workspaceId: string,
  userId: string,
): Promise<UserRole | null> {
  if (workspaceId === userId) return "OWNER";
  const membership = await db.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true, status: true },
  });
  if (membership?.status === "ACTIVE") return membership.role;
  const legacy = await db.user.findFirst({
    where: { id: userId, workspaceOwnerId: workspaceId },
    select: { role: true },
  });
  return legacy?.role ?? null;
}
