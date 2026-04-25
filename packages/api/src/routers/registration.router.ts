import { randomBytes, scryptSync } from "crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@digitify/db";
import { router, adminProcedure, protectedProcedure, publicProcedure } from "../trpc";
import { sendBrandedEmail } from "../lib/email-sender";

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

async function notifyAdmins(db: any, subject: string, body: string) {
  const admins = await db.user.findMany({
    where: { role: { in: ["OWNER", "ADMIN"] }, email: { not: "" } },
    select: { email: true },
  });

  await Promise.allSettled(
    admins.map((admin: { email: string }) =>
      sendBrandedEmail(db, {
        toEmail: admin.email,
        subject,
        body,
      })
    )
  );
}

export const registrationRouter = router({
  requestAccess: publicProcedure
    .input(
      z.object({
        name: z.string().min(2),
        email: z.string().email(),
        company: z.string().max(160).optional(),
        message: z.string().max(1200).optional(),
        password: z.string().min(8),
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

      await notifyAdmins(
        ctx.db,
        "Nieuwe registratieaanvraag voor Digitify Lead Finder",
        `Er is een nieuwe geverifieerde registratieaanvraag.\n\nNaam: ${updated.name}\nE-mail: ${updated.email}\nBedrijf: ${updated.company || "-"}\n\nBekijk de aanvraag bij Instellingen > Team & Rollen.`
      );

      return { success: true, status: updated.status };
    }),

  listRequests: adminProcedure.query(({ ctx }) =>
    ctx.db.registrationRequest.findMany({
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
    })
  ),

  approve: adminProcedure
    .input(z.object({ requestId: z.string(), role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER") }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.registrationRequest.findUnique({ where: { id: input.requestId } });
      if (!request || request.status !== "PENDING_APPROVAL") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Deze aanvraag kan niet worden goedgekeurd." });
      }

      const user = await ctx.db.user.create({
        data: {
          name: request.name,
          email: request.email,
          passwordHash: request.passwordHash,
          role: input.role,
          emailVerified: request.emailVerifiedAt || new Date(),
        },
      });

      await ctx.db.registrationRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED", reviewedById: ctx.user.id, reviewedAt: new Date() },
      });

      await sendBrandedEmail(ctx.db, {
        toEmail: request.email,
        subject: "Je toegang tot Digitify Lead Finder is goedgekeurd",
        body: `Hallo ${request.name},\n\nJe aanvraag is goedgekeurd. Je kunt nu inloggen met het wachtwoord dat je zelf hebt gekozen.\n\nLogin: ${appUrl()}/login\n\nDigitify`,
      });

      return user;
    }),

  reject: adminProcedure
    .input(z.object({ requestId: z.string(), reason: z.string().max(800).optional() }))
    .mutation(async ({ ctx, input }) => {
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

  listFeedback: adminProcedure.query(async ({ ctx }) => {
    try {
      return await ctx.db.feedbackItem.findMany({
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

  updateFeedbackStatus: adminProcedure
    .input(z.object({ id: z.string(), status: z.enum(["OPEN", "TRIAGED", "CLOSED"]) }))
    .mutation(async ({ ctx, input }) => {
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

      await notifyAdmins(
        ctx.db,
        `Feedback: ${input.subject}`,
        `Nieuwe feedback van ${ctx.user.name || ctx.user.email}.\n\nPagina: ${input.pageUrl || "-"}\n\n${input.message}`
      );

      return feedback;
    }),
});
