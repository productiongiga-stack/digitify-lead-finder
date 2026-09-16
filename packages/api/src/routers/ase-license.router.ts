import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, ownerProcedure, sensitiveOwnerProcedure } from "../trpc";
import {
  createLicenseForEmail,
  isAseLicenseUnavailableError,
  issueLicense,
} from "../lib/ase-license";
import { sendLicenseKeyEmail } from "../lib/ase-license-email";

const optionalTrimmed = z
  .string()
  .max(500)
  .optional()
  .transform((v) => {
    const t = v?.trim();
    return t ? t : undefined;
  });

const listSelect = {
  id: true,
  keyPrefix: true,
  status: true,
  email: true,
  name: true,
  siteUrl: true,
  domain: true,
  message: true,
  issuedAt: true,
  activatedAt: true,
  lastSeenAt: true,
  expiresAt: true,
  createdAt: true,
} as const;

export const aseLicenseRouter = router({
  list: ownerProcedure.query(async ({ ctx }) => {
    try {
      const rows = await ctx.db.aseLicense.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        select: listSelect,
      });
      const pendingCount = rows.filter((r) => r.status === "pending").length;
      return { items: rows, pendingCount };
    } catch (err) {
      if (isAseLicenseUnavailableError(err)) {
        return { items: [], pendingCount: 0 };
      }
      throw err;
    }
  }),

  createForEmail: sensitiveOwnerProcedure
    .input(
      z.object({
        email: z.string().email().max(320),
        name: z
          .string()
          .max(200)
          .optional()
          .transform((v) => {
            const t = v?.trim();
            return t ? t : undefined;
          }),
        siteUrl: optionalTrimmed,
        message: z
          .string()
          .max(2000)
          .optional()
          .transform((v) => {
            const t = v?.trim();
            return t ? t : undefined;
          }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await createLicenseForEmail({
          email: input.email,
          name: input.name,
          siteUrl: input.siteUrl,
          message: input.message,
        });
        if (!result.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
        }

        const mail = await sendLicenseKeyEmail(ctx.db, {
          toEmail: result.license.email,
          name: result.license.name,
          key: result.key,
          userId: ctx.user.workspaceId ?? ctx.user.id,
        });

        return {
          id: result.license.id,
          key: result.key,
          status: result.license.status,
          email: result.license.email,
          emailSent: mail.success,
          emailError: mail.success ? null : mail.error || "Mail niet verzonden",
        };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        if (isAseLicenseUnavailableError(err)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "ase_licenses ontbreekt — run prisma migrate deploy",
          });
        }
        throw err;
      }
    }),

  issue: sensitiveOwnerProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await issueLicense(input.id);
        if (!result.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
        }

        const mail = await sendLicenseKeyEmail(ctx.db, {
          toEmail: result.license.email,
          name: result.license.name,
          key: result.key,
          userId: ctx.user.workspaceId ?? ctx.user.id,
        });

        return {
          id: result.license.id,
          key: result.key,
          status: result.license.status,
          email: result.license.email,
          emailSent: mail.success,
          emailError: mail.success ? null : mail.error || "Mail niet verzonden",
        };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        if (isAseLicenseUnavailableError(err)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "ase_licenses ontbreekt — run prisma migrate deploy",
          });
        }
        throw err;
      }
    }),

  revoke: sensitiveOwnerProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.aseLicense.update({
          where: { id: input.id },
          data: { status: "revoked" },
        });
        return { ok: true };
      } catch (err) {
        if (isAseLicenseUnavailableError(err)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "ase_licenses ontbreekt — run prisma migrate deploy",
          });
        }
        throw err;
      }
    }),
});
