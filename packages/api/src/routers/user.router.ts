import { z } from "zod";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure, ownerProcedure } from "../trpc";
import { ensureUserWorkspace } from "../lib/user-workspace";
import { passwordPolicySchema } from "../lib/password-policy";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const derivedHash = scryptSync(password, salt, 64);
  return timingSafeEqual(hashBuffer, derivedHash);
}

export const userRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    await ensureUserWorkspace(ctx.db, ctx.user.id, ctx.user.name);
    return ctx.db.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        createdAt: true,
      },
    });
  }),

  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: { select: { leads: true, campaigns: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }),

  updateRole: ownerProcedure
    .input(z.object({ userId: z.string(), role: z.enum(["OWNER", "ADMIN", "MODERATOR", "MEMBER", "TRIAL", "TESTER", "VIEWER"]) }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.db.user.findUnique({
        where: { id: input.userId },
        select: { role: true },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Gebruiker niet gevonden." });
      if (target.role === "OWNER" && input.role !== "OWNER") {
        const owners = await ctx.db.user.count({ where: { role: "OWNER" } });
        if (owners <= 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Er moet minstens één owner blijven." });
        }
      }
      return ctx.db.user.update({
        where: { id: input.userId },
        data: { role: input.role },
      });
    }),

  createUser: ownerProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: passwordPolicySchema,
        role: z.enum(["ADMIN", "MODERATOR", "MEMBER", "TRIAL", "TESTER", "VIEWER"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.user.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Er bestaat al een gebruiker met dit e-mailadres." });
      }

      const user = await ctx.db.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash: hashPassword(input.password),
          role: input.role,
        },
      });
      await ensureUserWorkspace(ctx.db, user.id, user.name);
      return user;
    }),

  deleteUser: ownerProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Je kunt jezelf niet verwijderen." });
      }
      const target = await ctx.db.user.findUnique({
        where: { id: input.userId },
        select: { role: true },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Gebruiker niet gevonden." });
      if (target.role === "OWNER") {
        const owners = await ctx.db.user.count({ where: { role: "OWNER" } });
        if (owners <= 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "De laatste owner kan niet verwijderd worden." });
        }
      }

      await ctx.db.user.delete({ where: { id: input.userId } });
      return { success: true };
    }),
});
