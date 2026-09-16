import { createHash, randomBytes, scryptSync } from "crypto";
import { z } from "zod";
import { passwordResetRateLimitedProcedure, router } from "../trpc";
import { passwordPolicySchema } from "../lib/password-policy";
import { sendTemplatedEmail } from "../lib/send-templated-email";
import { log } from "../lib/logger";

const GENERIC_RESPONSE = {
  success: true,
  message: "Als er een account met dit e-mailadres bestaat, ontvang je instructies.",
} as const;

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");
}

export const passwordResetRouter = router({
  request: passwordResetRateLimitedProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const email = normalizeEmail(input.email);
      const user = await ctx.db.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          passwordHash: true,
          workspaceOwnerId: true,
        },
      });

      // Keep the response identical for unknown and valid accounts.
      // Mailbox ownership is proven by using the one-time reset link.
      if (!user?.passwordHash) return GENERIC_RESPONSE;

      const rawToken = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await ctx.db.$transaction([
        ctx.db.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        }),
        ctx.db.passwordResetToken.create({
          data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt },
        }),
      ]);

      const result = await sendTemplatedEmail(ctx.db, user.workspaceOwnerId || user.id, {
        templateKey: "auth.password_reset",
        toEmail: user.email,
        placeholderContext: {
          contactName: user.name || user.email,
          resetUrl: `${appUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`,
        },
        userId: user.workspaceOwnerId || user.id,
      });

      if (!result.success) {
        log.security.warn("Password reset email could not be sent", {
          requestId: ctx.requestId,
          userId: user.id,
        });
      }

      return GENERIC_RESPONSE;
    }),

  confirm: passwordResetRateLimitedProcedure
    .input(
      z.object({
        token: z.string().min(32).max(128),
        newPassword: passwordPolicySchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const token = await ctx.db.passwordResetToken.findUnique({
        where: { tokenHash: hashToken(input.token) },
        select: { id: true, userId: true, usedAt: true, expiresAt: true },
      });

      if (!token || token.usedAt || token.expiresAt <= new Date()) {
        return { success: false, message: "Deze resetlink is ongeldig of verlopen." };
      }

      const now = new Date();
      const claimed = await ctx.db.$transaction(async (tx) => {
        const claim = await tx.passwordResetToken.updateMany({
          where: {
            id: token.id,
            usedAt: null,
            expiresAt: { gt: now },
          },
          data: { usedAt: now },
        });
        if (claim.count !== 1) return false;

        await tx.passwordResetToken.updateMany({
          where: { userId: token.userId, id: { not: token.id }, usedAt: null },
          data: { usedAt: now },
        });
        await tx.user.update({
          where: { id: token.userId },
          data: { passwordHash: hashPassword(input.newPassword), sessionVersion: { increment: 1 } },
        });
        return true;
      });

      if (!claimed) {
        return { success: false, message: "Deze resetlink is ongeldig of verlopen." };
      }

      return { success: true, message: "Je wachtwoord is gewijzigd. Je kunt nu inloggen." };
    }),
});
