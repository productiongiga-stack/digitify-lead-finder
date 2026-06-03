import { randomBytes, scryptSync } from "crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@digitify/db";
import { router, ownerProcedure, protectedProcedure, publicProcedure } from "../trpc";
import { sendBrandedEmail } from "../lib/email-sender";
import { ensureUserWorkspace } from "../lib/user-workspace";
import { passwordPolicySchema } from "../lib/password-policy";
import { notifyWorkspaceAdmins } from "../lib/workspace-members";

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

async function notifyRegistrationAdmins(db: any, subject: string, body: string) {
  const workspaceId = process.env.REGISTRATION_NOTIFY_WORKSPACE_ID?.trim();
  if (!workspaceId) return;

  await notifyWorkspaceAdmins(db, workspaceId, subject, body, (args) =>
    sendBrandedEmail(db, {
      toEmail: args.toEmail,
      subject: args.subject,
      body: args.body,
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

async function activateTargetedInvitation(ctx: { db: any }, request: {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  targetWorkspaceOwnerId: string | null;
}) {
  if (!request.targetWorkspaceOwnerId) return null;

  const existingUser = await ctx.db.user.findUnique({
    where: { email: request.email },
    select: { id: true, role: true, workspaceOwnerId: true, name: true },
  });

  if (existingUser) {
    if (existingUser.id === request.targetWorkspaceOwnerId || existingUser.role === "OWNER") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Owner-accounts kunnen niet als teamlid aan een andere workspace worden gekoppeld.",
      });
    }
    if (existingUser.workspaceOwnerId && existingUser.workspaceOwnerId !== request.targetWorkspaceOwnerId) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Deze gebruiker hoort al bij een andere workspace.",
      });
    }

    const user = await ctx.db.user.update({
      where: { id: existingUser.id },
      data: {
        workspaceOwnerId: request.targetWorkspaceOwnerId,
        role: "MEMBER",
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
      workspaceOwnerId: request.targetWorkspaceOwnerId,
    },
  });

  await ctx.db.registrationRequest.update({
    where: { id: request.id },
    data: { status: "APPROVED", reviewedAt: new Date() },
  });

  return user;
}

export const registrationRouter = router({
  requestAccess: publicProcedure
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
        throw new TRPCError({ code: "CONFLICT", message: "Er bestaat al een gebruiker met dit e-mailadres." });
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
      await sendBrandedEmail(ctx.db, {
        toEmail: email,
        subject: "Verifieer je toegang tot Digitify Lead Finder",
        body: `Hallo ${request.name},\n\nBedankt voor je registratieaanvraag voor Digitify Lead Finder.\n\nBevestig je e-mailadres via deze link:\n${verifyUrl}\n\nDaarna kan een admin je aanvraag goedkeuren.\n\nDigitify`,
      });

      return { success: true };
    }),

  verifyEmail: publicProcedure
    .input(z.object({ token: z.string().min(20) }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.registrationRequest.findUnique({
        where: { emailVerificationToken: input.token },
      });
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deze verificatielink is ongeldig." });
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

      if (updated.targetWorkspaceOwnerId) {
        await activateTargetedInvitation(ctx, updated);
        await sendBrandedEmail(ctx.db, {
          toEmail: updated.email,
          subject: "Je team-uitnodiging is geactiveerd",
          body: `Hallo ${updated.name},\n\nJe hebt de team-uitnodiging bevestigd. Je kunt nu inloggen en werkt voortaan in de gedeelde workspace van je team.\n\nLogin: ${appUrl()}/login\n\nDigitify`,
        });
        return { success: true, status: "APPROVED" };
      }

      await notifyRegistrationAdmins(
        ctx.db,
        "Nieuwe registratieaanvraag voor Digitify Lead Finder",
        `Er is een nieuwe geverifieerde registratieaanvraag.\n\nNaam: ${updated.name}\nE-mail: ${updated.email}\nBedrijf: ${updated.company || "-"}\n\nBekijk de aanvraag bij Instellingen > Team & Rollen.`,
      );

      return { success: true, status: updated.status };
    }),

  listRequests: ownerProcedure.query(({ ctx }) => {
    const workspaceId = ctx.user.workspaceId ?? ctx.user.id;
    const includeGlobal = canReviewGlobalRegistrations(workspaceId);
    return ctx.db.registrationRequest.findMany({
      where: {
        OR: [
          { targetWorkspaceOwnerId: workspaceId },
          ...(includeGlobal ? [{ targetWorkspaceOwnerId: null }] : []),
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
      if (
        request.targetWorkspaceOwnerId &&
        request.targetWorkspaceOwnerId !== currentWorkspaceId
      ) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Deze aanvraag hoort bij een andere workspace." });
      }
      if (!request.targetWorkspaceOwnerId && !canReviewGlobalRegistrations(currentWorkspaceId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Alleen de website-owner kan globale registraties goedkeuren." });
      }

      const workspaceId = request.targetWorkspaceOwnerId || null;
      const user = await ctx.db.user.create({
        data: {
          name: request.name,
          email: request.email,
          passwordHash: request.passwordHash,
          role: "MEMBER",
          emailVerified: request.emailVerifiedAt || new Date(),
          workspaceOwnerId: workspaceId,
        },
      });
      await ensureUserWorkspace(ctx.db, workspaceId || user.id, workspaceId ? ctx.user.name : request.name);

      await ctx.db.registrationRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED", reviewedById: ctx.user.id, reviewedAt: new Date() },
      });

      await sendBrandedEmail(ctx.db, {
        toEmail: request.email,
        subject: "Je toegang tot Digitify Lead Finder is goedgekeurd",
        body: `Hallo ${request.name},\n\nJe aanvraag is goedgekeurd. Je start in je eigen persoonlijke workspace, zodat je geen leads of instellingen van andere teams ziet. Een owner kan je later expliciet aan een team-workspace toevoegen.\n\nLogin: ${appUrl()}/login\n\nDigitify`,
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
      if (
        existing.targetWorkspaceOwnerId &&
        existing.targetWorkspaceOwnerId !== currentWorkspaceId
      ) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Deze aanvraag hoort bij een andere workspace." });
      }
      if (!existing.targetWorkspaceOwnerId && !canReviewGlobalRegistrations(currentWorkspaceId)) {
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

      await sendBrandedEmail(ctx.db, {
        toEmail: request.email,
        subject: "Je aanvraag voor Digitify Lead Finder",
        body: `Hallo ${request.name},\n\nJe aanvraag werd niet goedgekeurd.${input.reason ? `\n\nReden: ${input.reason}` : ""}\n\nDigitify`,
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

  updateFeedbackStatus: protectedProcedure
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

  sendFeedback: protectedProcedure
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
          sendBrandedEmail(ctx.db, {
            toEmail: args.toEmail,
            subject: args.subject,
            body: args.body,
            userId: feedbackWorkspaceId,
          }),
      );

      return feedback;
    }),
});
