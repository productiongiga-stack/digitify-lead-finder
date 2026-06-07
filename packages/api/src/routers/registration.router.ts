import { randomBytes, scryptSync } from "crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@digitify/db";
import { router, ownerProcedure, protectedProcedure, publicRateLimitedProcedure, mutationProcedure } from "../trpc";
import { sendTemplatedEmail } from "../lib/send-templated-email";
import { ensureUserWorkspace } from "../lib/user-workspace";
import {
  ensurePersonalWorkspace,
  inviteUserToWorkspace,
} from "../lib/workspace-registry";
import { passwordPolicySchema } from "../lib/password-policy";
import { notifyWorkspaceAdmins } from "../lib/workspace-members";
import { log } from "../lib/logger";

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

async function notifyRegistrationAdmins(
  db: any,
  placeholderContext: Record<string, string | number | undefined>,
) {
  const workspaceId = process.env.REGISTRATION_NOTIFY_WORKSPACE_ID?.trim();
  if (!workspaceId) return;

  await notifyWorkspaceAdmins(
    db,
    workspaceId,
    String(placeholderContext.feedbackSubject || "Nieuwe registratieaanvraag"),
    String(placeholderContext.feedbackBody || ""),
    (args) =>
      sendTemplatedEmail(db, workspaceId, {
        templateKey: "system.registration_admin",
        toEmail: args.toEmail,
        placeholderContext: {
          ...placeholderContext,
          contactName: placeholderContext.contactName || args.toEmail,
          clientEmail: placeholderContext.clientEmail || args.toEmail,
        },
        userId: workspaceId,
      }),
  );
}

function canReviewGlobalRegistrations(workspaceId: string) {
  return Boolean(process.env.REGISTRATION_NOTIFY_WORKSPACE_ID?.trim() === workspaceId);
}

async function getFeedbackWorkspaceUserIds(ctx: { db: any; user: { id: string; workspaceId?: string | null } }) {
  const workspaceId = ctx.user.workspaceId || ctx.user.id;
  const users = await ctx.db.user.findMany({
    where: {
      OR: [{ id: workspaceId }, { workspaceOwnerId: workspaceId }],
    },
    select: { id: true },
  });
  const ids = users.map((user: { id: string }) => user.id);
  if (!ids.includes(ctx.user.id)) ids.push(ctx.user.id);
  return ids;
}

function resolveInviteWorkspaceId(request: {
  targetWorkspaceId: string | null;
  targetWorkspaceOwnerId: string | null;
}) {
  return request.targetWorkspaceId || request.targetWorkspaceOwnerId;
}

async function activateTargetedInvitation(
  ctx: { db: any },
  request: {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    emailVerifiedAt: Date | null;
    targetWorkspaceOwnerId: string | null;
    targetWorkspaceId: string | null;
    invitedById: string | null;
    requestedRole: string;
  },
) {
  const workspaceId = resolveInviteWorkspaceId(request);
  if (!workspaceId) return null;

  const existingUser = await ctx.db.user.findUnique({
    where: { email: request.email },
    select: { id: true, role: true, workspaceOwnerId: true, name: true },
  });

  if (existingUser) {
    if (existingUser.id === workspaceId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Deze gebruiker is al eigenaar van deze werkruimte.",
      });
    }

    await ensurePersonalWorkspace(ctx.db, existingUser.id, existingUser.name || request.name);
    await inviteUserToWorkspace(ctx.db, {
      workspaceId,
      invitedById: request.invitedById || workspaceId,
      userId: existingUser.id,
      role: request.requestedRole as "MEMBER",
    });

    const user = await ctx.db.user.update({
      where: { id: existingUser.id },
      data: {
        emailVerified: request.emailVerifiedAt || new Date(),
        name: existingUser.name || request.name,
      },
    });

    await ctx.db.registrationRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED", reviewedAt: new Date() },
    });

    return user;
  }

  const user = await ctx.db.user.create({
    data: {
      name: request.name,
      email: request.email,
      passwordHash: request.passwordHash,
      role: "MEMBER",
      emailVerified: request.emailVerifiedAt || new Date(),
    },
  });

  await ensurePersonalWorkspace(ctx.db, user.id, request.name);
  await inviteUserToWorkspace(ctx.db, {
    workspaceId,
    invitedById: request.invitedById || workspaceId,
    userId: user.id,
    role: request.requestedRole as "MEMBER",
  });

  await ctx.db.registrationRequest.update({
    where: { id: request.id },
    data: { status: "APPROVED", reviewedAt: new Date() },
  });

  return user;
}

export const registrationRouter = router({
  requestAccess: publicRateLimitedProcedure
    .input(
      z.object({
        name: z.string().min(2),
        email: z.string().email(),
        company: z.string().max(160).optional(),
        message: z.string().max(1200).optional(),
        password: passwordPolicySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.email.toLowerCase().trim();
      const existingUser = await ctx.db.user.findUnique({ where: { email } });
      if (existingUser) {
        log.security.info("Registration attempt for existing email", {
          requestId: ctx.requestId,
          email,
        });
        return { success: true };
      }

      const pendingRequest = await ctx.db.registrationRequest.findFirst({
        where: {
          email,
          status: { in: ["PENDING_EMAIL_VERIFICATION", "PENDING_APPROVAL"] },
        },
        select: { id: true },
      });
      if (pendingRequest) {
        log.security.info("Duplicate registration request", {
          requestId: ctx.requestId,
          email,
        });
        return { success: true };
      }

      const token = randomBytes(32).toString("hex");
      const request = await ctx.db.registrationRequest.create({
        data: {
          name: input.name.trim(),
          email,
          company: input.company?.trim() || null,
          message: input.message?.trim() || null,
          passwordHash: hashPassword(input.password),
          emailVerificationToken: token,
        },
      });

      const verifyUrl = `${appUrl()}/register/verify?token=${token}`;
      const registrationWorkspaceId = process.env.REGISTRATION_NOTIFY_WORKSPACE_ID?.trim() || "";
      await sendTemplatedEmail(ctx.db, registrationWorkspaceId, {
        templateKey: "auth.verify_email",
        toEmail: email,
        placeholderContext: {
          contactName: request.name,
          verifyUrl,
        },
        userId: registrationWorkspaceId || undefined,
      });

      return { success: true };
    }),

  verifyEmail: publicRateLimitedProcedure
    .input(z.object({ token: z.string().min(20) }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.registrationRequest.findUnique({
        where: { emailVerificationToken: input.token },
      });
      if (!request) {
        return { success: true };
      }
      if (request.status !== "PENDING_EMAIL_VERIFICATION") {
        return { success: true, status: request.status };
      }

      const updated = await ctx.db.registrationRequest.update({
        where: { id: request.id },
        data: {
          status: "PENDING_APPROVAL",
          emailVerifiedAt: new Date(),
        },
      });

      const inviteWorkspaceId = resolveInviteWorkspaceId(updated);
      if (inviteWorkspaceId) {
        await activateTargetedInvitation(ctx, updated);
        await sendTemplatedEmail(ctx.db, inviteWorkspaceId, {
          templateKey: "auth.team_invite",
          toEmail: updated.email,
          placeholderContext: {
            contactName: updated.name,
            verifyUrl: `${appUrl()}/settings/workspaces`,
            loginUrl: `${appUrl()}/login`,
          },
          userId: inviteWorkspaceId,
        });
        return { success: true, status: "INVITED" };
      }

      await notifyRegistrationAdmins(ctx.db, {
        contactName: updated.name,
        clientEmail: updated.email,
        companyName: updated.company || "-",
      });

      return { success: true, status: updated.status };
    }),

  listRequests: ownerProcedure.query(({ ctx }) => {
    const workspaceId = ctx.user.workspaceId ?? ctx.user.id;
    const includeGlobal = canReviewGlobalRegistrations(workspaceId);
    return ctx.db.registrationRequest.findMany({
      where: {
        OR: [
          { targetWorkspaceId: workspaceId },
          { targetWorkspaceOwnerId: workspaceId },
          ...(includeGlobal
            ? [{ targetWorkspaceId: null, targetWorkspaceOwnerId: null }]
            : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        message: true,
        status: true,
        createdAt: true,
        emailVerifiedAt: true,
      },
    });
  }),

  approve: ownerProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.registrationRequest.findUnique({ where: { id: input.requestId } });
      if (!request || request.status !== "PENDING_APPROVAL") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Deze aanvraag kan niet worden goedgekeurd." });
      }

      const currentWorkspaceId = ctx.user.workspaceId ?? ctx.user.id;
      const requestWorkspaceId = resolveInviteWorkspaceId(request);
      if (
        requestWorkspaceId &&
        requestWorkspaceId !== currentWorkspaceId
      ) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Deze aanvraag hoort bij een andere workspace." });
      }
      if (!requestWorkspaceId && !canReviewGlobalRegistrations(currentWorkspaceId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Alleen de website-owner kan globale registraties goedkeuren." });
      }

      const workspaceId = requestWorkspaceId;
      const user = await ctx.db.user.create({
        data: {
          name: request.name,
          email: request.email,
          passwordHash: request.passwordHash,
          role: workspaceId ? "MEMBER" : "OWNER",
          emailVerified: request.emailVerifiedAt || new Date(),
        },
      });
      await ensurePersonalWorkspace(ctx.db, user.id, request.name);
      if (workspaceId) {
        await inviteUserToWorkspace(ctx.db, {
          workspaceId,
          invitedById: ctx.user.id,
          userId: user.id,
          role: request.requestedRole as "MEMBER",
        });
      } else {
        await ensureUserWorkspace(ctx.db, user.id, request.name);
      }

      await ctx.db.registrationRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED", reviewedById: ctx.user.id, reviewedAt: new Date() },
      });

      const approvalWorkspaceId = workspaceId || user.id;
      await sendTemplatedEmail(ctx.db, approvalWorkspaceId, {
        templateKey: "auth.approved",
        toEmail: request.email,
        placeholderContext: {
          contactName: request.name,
          loginUrl: `${appUrl()}/login`,
        },
        userId: approvalWorkspaceId,
      });

      return user;
    }),

  reject: ownerProcedure
    .input(z.object({ requestId: z.string(), reason: z.string().max(800).optional() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.registrationRequest.findUnique({ where: { id: input.requestId } });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Aanvraag niet gevonden." });
      }
      const currentWorkspaceId = ctx.user.workspaceId ?? ctx.user.id;
      const requestWorkspaceId = resolveInviteWorkspaceId(existing);
      if (requestWorkspaceId && requestWorkspaceId !== currentWorkspaceId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Deze aanvraag hoort bij een andere workspace." });
      }
      if (!requestWorkspaceId && !canReviewGlobalRegistrations(currentWorkspaceId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Alleen de website-owner kan globale registraties afkeuren." });
      }

      const request = await ctx.db.registrationRequest.update({
        where: { id: input.requestId },
        data: {
          status: "REJECTED",
          rejectionReason: input.reason || null,
          reviewedById: ctx.user.id,
          reviewedAt: new Date(),
        },
      });

      const rejectWorkspaceId = ctx.user.workspaceId ?? ctx.user.id;
      await sendTemplatedEmail(ctx.db, rejectWorkspaceId, {
        templateKey: "auth.rejected",
        toEmail: request.email,
        placeholderContext: {
          contactName: request.name,
          rejectionReason: input.reason ? `\n\nReden: ${input.reason}` : "",
        },
        userId: rejectWorkspaceId,
      });

      return { success: true };
    }),

  listFeedback: protectedProcedure.query(async ({ ctx }) => {
    if (!["OWNER", "ADMIN", "MODERATOR", "MEMBER"].includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Geen toegang tot feedbackbeheer." });
    }
    try {
      const workspaceUserIds = await getFeedbackWorkspaceUserIds(ctx);
      return await ctx.db.feedbackItem.findMany({
        where: {
          userId: { in: workspaceUserIds },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          userId: true,
          userEmail: true,
          subject: true,
          message: true,
          pageUrl: true,
          status: true,
          createdAt: true,
          reviewedAt: true,
          reviewedBy: { select: { id: true, name: true, email: true } },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2021", "P2022"].includes(error.code)
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Feedback tabel ontbreekt nog in Supabase. Run eerst de feedback SQL migration.",
        });
      }
      throw error;
    }
  }),

  updateFeedbackStatus: mutationProcedure
    .input(z.object({ id: z.string(), status: z.enum(["OPEN", "TRIAGED", "CLOSED"]) }))
    .mutation(async ({ ctx, input }) => {
      if (!["OWNER", "ADMIN", "MODERATOR", "MEMBER"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Geen toegang tot feedbackbeheer." });
      }
      const workspaceUserIds = await getFeedbackWorkspaceUserIds(ctx);
      const feedback = await ctx.db.feedbackItem.findFirst({
        where: {
          id: input.id,
          userId: { in: workspaceUserIds },
        },
        select: { id: true },
      });
      if (!feedback) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feedback niet gevonden." });
      }
      return ctx.db.feedbackItem.update({
        where: { id: input.id },
        data: {
          status: input.status,
          reviewedById: ctx.user.id,
          reviewedAt: new Date(),
        },
      });
    }),

  sendFeedback: mutationProcedure
    .input(z.object({ subject: z.string().min(3), message: z.string().min(10), pageUrl: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      let feedback;
      try {
        feedback = await ctx.db.feedbackItem.create({
          data: {
            userId: ctx.user.id,
            userEmail: ctx.user.email,
            subject: input.subject,
            message: input.message,
            pageUrl: input.pageUrl || null,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ["P2021", "P2022"].includes(error.code)
        ) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Feedback tabel ontbreekt nog in Supabase. Run eerst de feedback SQL migration.",
          });
        }
        throw error;
      }

      const feedbackWorkspaceId = ctx.user.workspaceId ?? ctx.user.id;
      await notifyWorkspaceAdmins(
        ctx.db,
        feedbackWorkspaceId,
        `Feedback: ${input.subject}`,
        `Nieuwe feedback van ${ctx.user.name || ctx.user.email}.\n\nPagina: ${input.pageUrl || "-"}\n\n${input.message}`,
        (args) =>
          sendTemplatedEmail(ctx.db, feedbackWorkspaceId, {
            templateKey: "feedback.admin_notify",
            toEmail: args.toEmail,
            placeholderContext: {
              feedbackSubject: args.subject,
              feedbackBody: args.body,
            },
            userId: feedbackWorkspaceId,
          }),
      );

      return feedback;
    }),
});
