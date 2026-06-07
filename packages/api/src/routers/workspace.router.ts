import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomBytes, scryptSync } from "crypto";
import { router, protectedProcedure, mutationProcedure } from "../trpc";
import { sendTemplatedEmail } from "../lib/send-templated-email";
import {
  assertWorkspaceAdmin,
  createTeamWorkspace,
  ensurePersonalWorkspace,
  inviteUserToWorkspace,
  listWorkspacesForUser,
  respondToWorkspaceInvite,
  switchActiveWorkspace,
} from "../lib/workspace-registry";
import { invalidateWorkspaceOwnerIdCache } from "../lib/workspace";
import { countWorkspaceOwners } from "../lib/workspace-members";
import { workspaceMemberUserIds } from "../lib/workspace-members";
import { passwordPolicySchema } from "../lib/password-policy";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");
}

export const workspaceRouter = router({
  listMine: protectedProcedure.query(async ({ ctx }) => {
    const activeWorkspaceId = ctx.user.workspaceId!;
    return listWorkspacesForUser(ctx.db, ctx.user.id, activeWorkspaceId);
  }),

  listPendingInvitations: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.workspaceMembership.findMany({
      where: { userId: ctx.user.id, status: "INVITED" },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            type: true,
            owner: { select: { name: true, email: true } },
          },
        },
        invitedBy: { select: { name: true, email: true } },
      },
      orderBy: { invitedAt: "desc" },
    });

    return rows.map((row) => ({
      membershipId: row.id,
      workspaceId: row.workspaceId,
      workspaceName: row.workspace.name,
      workspaceType: row.workspace.type,
      role: row.role,
      invitedAt: row.invitedAt,
      ownerName: row.workspace.owner.name || row.workspace.owner.email || "Onbekend",
      invitedByName: row.invitedBy?.name || row.invitedBy?.email || null,
    }));
  }),

  create: mutationProcedure
    .input(z.object({ name: z.string().trim().min(2).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const workspace = await createTeamWorkspace(ctx.db, ctx.user.id, input.name);
      await switchActiveWorkspace(ctx.db, ctx.user.id, workspace.id);
      return {
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
      };
    }),

  switch: mutationProcedure
    .input(z.object({ workspaceId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = await switchActiveWorkspace(ctx.db, ctx.user.id, input.workspaceId);
      return { workspaceId };
    }),

  respondToInvitation: mutationProcedure
    .input(
      z.object({
        workspaceId: z.string().min(1),
        accept: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return respondToWorkspaceInvite(
        ctx.db,
        ctx.user.id,
        input.workspaceId,
        input.accept,
      );
    }),

  inviteByEmail: mutationProcedure
    .input(
      z.object({
        workspaceId: z.string().min(1),
        email: z.string().email(),
        name: z.string().trim().min(1).max(120).optional(),
        password: passwordPolicySchema.optional(),
        role: z.enum(["ADMIN", "MODERATOR", "MEMBER", "TRIAL", "TESTER", "VIEWER"]).default("MEMBER"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertWorkspaceAdmin(ctx.db, ctx.user.id, input.workspaceId);
      const email = input.email.trim().toLowerCase();
      const workspace = await ctx.db.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { id: true, name: true, type: true },
      });
      if (!workspace) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Werkruimte niet gevonden." });
      }

      const existingUser = await ctx.db.user.findUnique({
        where: { email },
        select: { id: true, name: true, role: true },
      });

      if (existingUser) {
        if (existingUser.id === input.workspaceId) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Je kunt jezelf niet uitnodigen in je persoonlijke werkruimte.",
          });
        }
        await inviteUserToWorkspace(ctx.db, {
          workspaceId: input.workspaceId,
          invitedById: ctx.user.id,
          userId: existingUser.id,
          role: input.role,
        });
        await sendTemplatedEmail(ctx.db, input.workspaceId, {
          templateKey: "auth.team_invite",
          toEmail: email,
          placeholderContext: {
            contactName: existingUser.name || email,
            verifyUrl: `${appUrl()}/settings/workspaces`,
            workspaceName: workspace.name,
          },
          userId: input.workspaceId,
        });
        return { success: true, mode: "existing_user" as const };
      }

      const token = randomBytes(32).toString("hex");
      const pending = await ctx.db.registrationRequest.findFirst({
        where: {
          email,
          status: { in: ["PENDING_EMAIL_VERIFICATION", "PENDING_APPROVAL"] },
        },
        select: { id: true },
      });
      if (pending) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Voor dit e-mailadres bestaat al een open uitnodiging.",
        });
      }

      if (!input.password) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Geef een tijdelijk wachtwoord op voor nieuwe gebruikers.",
        });
      }

      await ctx.db.registrationRequest.create({
        data: {
          name: input.name?.trim() || email.split("@")[0] || "Nieuwe gebruiker",
          email,
          passwordHash: hashPassword(input.password),
          requestedRole: input.role,
          status: "PENDING_EMAIL_VERIFICATION",
          emailVerificationToken: token,
          targetWorkspaceId: input.workspaceId,
          targetWorkspaceOwnerId: input.workspaceId,
          invitedById: ctx.user.id,
        },
      });

      const verifyUrl = `${appUrl()}/register/verify?token=${token}`;
      await sendTemplatedEmail(ctx.db, input.workspaceId, {
        templateKey: "auth.team_invite",
        toEmail: email,
        placeholderContext: {
          contactName: input.name || email,
          verifyUrl,
          workspaceName: workspace.name,
        },
        userId: input.workspaceId,
      });

      return { success: true, mode: "new_user" as const };
    }),

  listMembers: protectedProcedure
    .input(z.object({ workspaceId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertWorkspaceAdmin(ctx.db, ctx.user.id, input.workspaceId);
      const userIds = await workspaceMemberUserIds(ctx.db, input.workspaceId);
      const memberships = await ctx.db.workspaceMembership.findMany({
        where: { workspaceId: input.workspaceId },
        include: {
          user: { select: { id: true, name: true, email: true, image: true, role: true } },
        },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      });

      const invited = memberships.filter((row) => row.status === "INVITED");
      const active = memberships.filter((row) => row.status === "ACTIVE");

      return {
        active: active.map((row) => ({
          membershipId: row.id,
          userId: row.user.id,
          name: row.user.name,
          email: row.user.email,
          image: row.user.image,
          role: row.role,
          status: row.status,
        })),
        invited: invited.map((row) => ({
          membershipId: row.id,
          userId: row.user.id,
          name: row.user.name,
          email: row.user.email,
          role: row.role,
          invitedAt: row.invitedAt,
        })),
        legacyMemberCount: userIds.length,
      };
    }),

  updateName: mutationProcedure
    .input(
      z.object({
        workspaceId: z.string().min(1),
        name: z.string().trim().min(2).max(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = await ctx.db.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { id: true, type: true, ownerUserId: true },
      });
      if (!workspace) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Werkruimte niet gevonden." });
      }
      if (workspace.type === "PERSONAL" && workspace.id !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Persoonlijke werkruimtes zijn niet hernoembaar." });
      }
      await assertWorkspaceAdmin(ctx.db, ctx.user.id, input.workspaceId);
      return ctx.db.workspace.update({
        where: { id: input.workspaceId },
        data: { name: input.name.trim() },
        select: { id: true, name: true, type: true },
      });
    }),

  updateMemberRole: mutationProcedure
    .input(
      z.object({
        workspaceId: z.string().min(1),
        userId: z.string().min(1),
        role: z.enum(["OWNER", "ADMIN", "MODERATOR", "MEMBER", "TRIAL", "TESTER", "VIEWER"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertWorkspaceAdmin(ctx.db, ctx.user.id, input.workspaceId);
      const workspace = await ctx.db.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { ownerUserId: true, type: true },
      });
      if (input.userId === workspace?.ownerUserId && input.role !== "OWNER") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "De workspace-eigenaar moet de rol Eigenaar behouden.",
        });
      }

      const membership = await ctx.db.workspaceMembership.findUnique({
        where: {
          workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId },
        },
        select: { id: true, role: true, status: true },
      });
      if (!membership || membership.status !== "ACTIVE") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lid niet gevonden." });
      }
      if (membership.role === "OWNER" && input.role !== "OWNER") {
        const owners = await countWorkspaceOwners(ctx.db, input.workspaceId);
        if (owners <= 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Er moet minstens één owner blijven." });
        }
      }

      await ctx.db.workspaceMembership.update({
        where: { id: membership.id },
        data: { role: input.role },
      });

      if (workspace?.type === "TEAM" && input.workspaceId === workspace.ownerUserId) {
        await ctx.db.user.update({
          where: { id: input.userId },
          data: { role: input.role },
        });
      }

      return { success: true, role: input.role };
    }),

  removeMember: mutationProcedure
    .input(
      z.object({
        workspaceId: z.string().min(1),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertWorkspaceAdmin(ctx.db, ctx.user.id, input.workspaceId);
      const workspace = await ctx.db.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { ownerUserId: true },
      });
      if (input.userId === workspace?.ownerUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "De eigenaar van de werkruimte kan niet verwijderd worden.",
        });
      }

      await ctx.db.workspaceMembership.deleteMany({
        where: {
          workspaceId: input.workspaceId,
          userId: input.userId,
        },
      });

      await ctx.db.user.updateMany({
        where: { id: input.userId, workspaceOwnerId: input.workspaceId },
        data: { workspaceOwnerId: null },
      });

      const removedUser = await ctx.db.user.findUnique({
        where: { id: input.userId },
        select: { activeWorkspaceId: true },
      });
      if (removedUser?.activeWorkspaceId === input.workspaceId) {
        await ctx.db.user.update({
          where: { id: input.userId },
          data: { activeWorkspaceId: input.userId },
        });
        invalidateWorkspaceOwnerIdCache(input.userId);
      }

      return { success: true };
    }),

  ensurePersonal: protectedProcedure.mutation(async ({ ctx }) => {
    await ensurePersonalWorkspace(ctx.db, ctx.user.id, ctx.user.name);
    return { success: true };
  }),
});
