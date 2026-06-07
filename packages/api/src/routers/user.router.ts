import { z } from "zod";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure, ownerProcedure } from "../trpc";
import { ensureUserWorkspace } from "../lib/user-workspace";
import { sendTemplatedEmail } from "../lib/send-templated-email";
import {
  assertWorkspaceMember,
  countWorkspaceOwners,
  getWorkspaceOwnerProfile,
  isWorkspaceOwner,
} from "../lib/workspace";
import { workspaceMemberUserIds } from "../lib/workspace-members";
import { invalidateWorkspaceOwnerIdCache } from "../lib/workspace";
import { passwordPolicySchema } from "../lib/password-policy";
import { getSettingString, settingsRowsToMap } from "../lib/settings";
import { invalidateUserSettingsCache, loadUserSettingRows } from "../lib/user-settings";
import { filterReadableSettingsForRole } from "../lib/permissions";
import { loadWorkspaceSettingRows, workspaceScopeFromUser } from "../lib/workspace-settings";
import { redactSecretSettingValue } from "@digitify/db";

const SHELL_BRANDING_KEYS = [
  "branding.company_name",
  "branding.company_slogan",
  "branding.logo_url",
  "branding.favicon_url",
  "branding.primary_color",
  "branding.website",
  "branding.phone",
  "branding.email",
  "branding.address",
  "branding.vat_number",
  "branding.bank_account",
  "company.name",
  "company.website",
  "company.phone",
  "company.email",
  "company.address",
  "company.vat",
  "company.kbo",
  "company.niche",
  "email.from_name",
  "email.from_email",
  "ui.density",
] as const;

function sanitizeShellSettings(settings: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(settings).map(([key, value]) => [key, redactSecretSettingValue(key, value)]),
  );
}

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

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash.includes(":")) {
    const { createHash } = require("crypto");
    return createHash("sha256").update(password).digest("hex") === storedHash;
  }
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const derivedHash = scryptSync(password, salt, 64);
  return timingSafeEqual(hashBuffer, derivedHash);
}

export const userRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const workspaceId = ctx.user.workspaceId!;
    if (isWorkspaceOwner(ctx.user, workspaceId)) {
      await ensureUserWorkspace(ctx.db, workspaceId, ctx.user.name);
    }
    const profile = await ctx.db.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        createdAt: true,
        workspaceOwnerId: true,
      },
    });
    const owner = await getWorkspaceOwnerProfile(ctx.db, workspaceId);
    return {
      ...profile,
      workspaceId,
      workspaceOwnerName: owner?.name || owner?.email || "Workspace",
      isWorkspaceOwner: isWorkspaceOwner(ctx.user, workspaceId),
    };
  }),

  getWorkspaceInfo: protectedProcedure.query(async ({ ctx }) => {
    const workspaceId = ctx.user.workspaceId!;
    const workspace = await ctx.db.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        type: true,
        ownerUserId: true,
        _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
      },
    });
    const owner = await getWorkspaceOwnerProfile(ctx.db, workspaceId);
    const memberCount =
      workspace?._count.memberships ??
      (await workspaceMemberUserIds(ctx.db, workspaceId)).length;
    const isOwner =
      ctx.user.workspaceRole === "OWNER" ||
      ctx.user.id === workspace?.ownerUserId ||
      ctx.user.id === workspaceId;
    return {
      workspaceId,
      workspaceType: workspace?.type ?? "PERSONAL",
      ownerName: owner?.name || owner?.email || "Eigenaar",
      ownerEmail: owner?.email ?? "",
      isOwner,
      isPersonal: ctx.user.isPersonalWorkspace ?? workspaceId === ctx.user.id,
      memberCount,
      sharedResources: [
        "Leads & pipeline",
        "Campagnes & templates",
        "Offertes & dienstencatalogus",
        "Bookings & agenda",
        "Dashboard & KPI's",
        "Reviews & domeinen",
        "CRM & chatbot",
        "Instellingen (branding, e-mail, integraties)",
        "Inbox (gedeelde mailbox-config)",
        "Taken & facturen (gedeelde tabellen)",
      ],
    };
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1, "Naam is verplicht.").max(120),
        image: z.string().max(3_000_000).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.update({
        where: { id: ctx.user.id },
        data: {
          name: input.name,
          image: input.image || null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          role: true,
          createdAt: true,
        },
      });
      await ensureUserWorkspace(ctx.db, user.id, user.name);
      return user;
    }),

  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1, "Huidig wachtwoord is verplicht."),
        newPassword: passwordPolicySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.user.id },
        select: { id: true, passwordHash: true },
      });
      if (!user?.passwordHash) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Dit account heeft geen lokaal wachtwoord." });
      }
      if (!verifyPassword(input.currentPassword, user.passwordHash)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Huidig wachtwoord klopt niet." });
      }
      await ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { passwordHash: hashPassword(input.newPassword) },
      });
      return { success: true };
    }),

  list: adminProcedure.query(async ({ ctx }) => {
    const workspaceId = ctx.user.workspaceId!;
    const userIds = await workspaceMemberUserIds(ctx.db, workspaceId);
    const memberships = await ctx.db.workspaceMembership.findMany({
      where: { workspaceId, status: "ACTIVE", userId: { in: userIds } },
      select: { userId: true, role: true },
    });
    const roleByUserId = new Map(memberships.map((row) => [row.userId, row.role]));
    const workspace = await ctx.db.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerUserId: true },
    });

    const users = await ctx.db.user.findMany({
      where: { id: { in: userIds } },
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
    const googleStatuses = await Promise.all(
      users.map(async (user) => {
        const rows = await loadUserSettingRows(ctx.db, user.id, [
          "bookings.google_sync_enabled",
          "bookings.google_calendar_id",
          "bookings.google_calendar_timezone",
          "bookings.google_oauth_account_email",
          "bookings.google_oauth_refresh_token",
        ]);
        const settings = settingsRowsToMap(rows);
        const oauthEmail = getSettingString(settings, "bookings.google_oauth_account_email");
        const calendarId = getSettingString(settings, "bookings.google_calendar_id");
        const refreshToken = getSettingString(settings, "bookings.google_oauth_refresh_token");
        return {
          userId: user.id,
          googleCalendar: {
            connected: Boolean(oauthEmail && refreshToken),
            syncEnabled: String(settings["bookings.google_sync_enabled"] ?? "").toLowerCase() === "true",
            accountEmail: oauthEmail,
            calendarId,
            timezone: getSettingString(settings, "bookings.google_calendar_timezone", "Europe/Brussels"),
          },
        };
      }),
    );
    const statusByUserId = new Map(googleStatuses.map((status) => [status.userId, status.googleCalendar]));
    return users.map((user) => ({
      ...user,
      role:
        roleByUserId.get(user.id) ??
        (user.id === workspace?.ownerUserId ? "OWNER" : user.role),
      googleCalendar: statusByUserId.get(user.id) || {
        connected: false,
        syncEnabled: false,
        accountEmail: "",
        calendarId: "",
        timezone: "Europe/Brussels",
      },
    }));
  }),

  updateRole: ownerProcedure
    .input(z.object({ userId: z.string(), role: z.enum(["OWNER", "ADMIN", "MODERATOR", "MEMBER", "TRIAL", "TESTER", "VIEWER"]) }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      const workspace = await ctx.db.workspace.findUnique({
        where: { id: workspaceId },
        select: { ownerUserId: true, type: true },
      });
      const target = await assertWorkspaceMember(ctx.db, workspaceId, input.userId);
      if (input.userId === workspace?.ownerUserId && input.role !== "OWNER") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "De workspace-eigenaar moet de rol Eigenaar behouden.",
        });
      }
      if (target.role === "OWNER" && input.role !== "OWNER") {
        const owners = await countWorkspaceOwners(ctx.db, workspaceId);
        if (owners <= 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Er moet minstens één owner blijven." });
        }
      }

      const membership = await ctx.db.workspaceMembership.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: input.userId } },
        select: { id: true, status: true },
      });
      if (membership?.status === "ACTIVE") {
        await ctx.db.workspaceMembership.update({
          where: { id: membership.id },
          data: { role: input.role },
        });
      }

      if (workspace?.type === "TEAM" && workspaceId === workspace.ownerUserId) {
        await ctx.db.user.update({
          where: { id: input.userId },
          data: { role: input.role },
        });
      }

      return { success: true, role: input.role };
    }),

  updateUserDetails: ownerProcedure
    .input(
      z.object({
        userId: z.string(),
        name: z.string().trim().min(1).max(120),
        email: z.string().email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      const normalizedEmail = input.email.trim().toLowerCase();
      await assertWorkspaceMember(ctx.db, workspaceId, input.userId);

      const existing = await ctx.db.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (existing && existing.id !== input.userId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Er bestaat al een gebruiker met dit e-mailadres.",
        });
      }

      return ctx.db.user.update({
        where: { id: input.userId },
        data: {
          name: input.name.trim(),
          email: normalizedEmail,
        },
      });
    }),

  createUser: ownerProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: passwordPolicySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.email.trim().toLowerCase();
      const workspaceId = ctx.user.workspaceId!;
      const existing = await ctx.db.user.findUnique({
        where: { email },
        select: { id: true, name: true, role: true, workspaceOwnerId: true, passwordHash: true },
      });
      if (existing) {
        const activeMembership = await ctx.db.workspaceMembership.findFirst({
          where: { workspaceId, userId: existing.id, status: "ACTIVE" },
          select: { id: true },
        });
        if (activeMembership) {
          throw new TRPCError({ code: "CONFLICT", message: "Deze gebruiker zit al in je team." });
        }
        const pendingMembership = await ctx.db.workspaceMembership.findFirst({
          where: { workspaceId, userId: existing.id, status: "INVITED" },
          select: { id: true },
        });
        if (pendingMembership) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Er staat al een open uitnodiging open voor deze gebruiker.",
          });
        }
      }
      const existingRequest = await ctx.db.registrationRequest.findFirst({
        where: {
          email,
          status: {
            in: ["PENDING_EMAIL_VERIFICATION", "PENDING_APPROVAL"],
          },
        },
        select: { id: true },
      });
      if (existingRequest) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Voor dit e-mailadres bestaat al een open uitnodiging.",
        });
      }

      const token = randomBytes(32).toString("hex");
      await ctx.db.registrationRequest.create({
        data: {
          name: existing?.name || input.name,
          email,
          passwordHash: existing?.passwordHash || hashPassword(input.password),
          requestedRole: "MEMBER",
          status: "PENDING_EMAIL_VERIFICATION",
          emailVerificationToken: token,
          targetWorkspaceId: workspaceId,
          targetWorkspaceOwnerId: workspaceId,
          invitedById: ctx.user.id,
        },
      });

      const verifyUrl = `${appUrl()}/register/verify?token=${token}`;
      await sendTemplatedEmail(ctx.db, workspaceId, {
        templateKey: "auth.team_invite",
        toEmail: email,
        placeholderContext: {
          contactName: input.name,
          verifyUrl,
        },
        userId: workspaceId,
      });

      return { success: true };
    }),

  deleteUser: ownerProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = ctx.user.workspaceId!;
      const workspace = await ctx.db.workspace.findUnique({
        where: { id: workspaceId },
        select: { ownerUserId: true },
      });
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Je kunt jezelf niet verwijderen." });
      }
      if (input.userId === workspace?.ownerUserId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "De workspace-eigenaar kan niet verwijderd worden." });
      }
      const target = await assertWorkspaceMember(ctx.db, workspaceId, input.userId);
      if (target.role === "OWNER") {
        const owners = await countWorkspaceOwners(ctx.db, workspaceId);
        if (owners <= 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "De laatste owner kan niet verwijderd worden." });
        }
      }

      await ctx.db.workspaceMembership.deleteMany({
        where: { workspaceId, userId: input.userId },
      });
      await ctx.db.user.updateMany({
        where: { id: input.userId, workspaceOwnerId: workspaceId },
        data: { workspaceOwnerId: null },
      });

      const removedUser = await ctx.db.user.findUnique({
        where: { id: input.userId },
        select: { activeWorkspaceId: true },
      });
      if (removedUser?.activeWorkspaceId === workspaceId) {
        await ctx.db.user.update({
          where: { id: input.userId },
          data: { activeWorkspaceId: input.userId },
        });
        invalidateWorkspaceOwnerIdCache(input.userId);
      }

      return { success: true };
    }),

  // ─── Module access (owner-only) ──────────────────────────────────────────────

  getUserModules: ownerProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertWorkspaceMember(ctx.db, ctx.user.workspaceId!, input.userId);
      const rows = await loadUserSettingRows(ctx.db as any, input.userId, ["modules.disabled"]);
      const map = settingsRowsToMap(rows);
      const raw = getSettingString(map, "modules.disabled", "");
      const disabled = raw ? raw.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
      return { disabled };
    }),

  setUserModule: ownerProcedure
    .input(z.object({
      userId: z.string(),
      module: z.string().min(1),
      enabled: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertWorkspaceMember(ctx.db, ctx.user.workspaceId!, input.userId);
      const rows = await loadUserSettingRows(ctx.db as any, input.userId, ["modules.disabled"]);
      const map = settingsRowsToMap(rows);
      const raw = getSettingString(map, "modules.disabled", "");
      const disabled = raw ? raw.split(",").map((s: string) => s.trim()).filter(Boolean) : [];

      const next = input.enabled
        ? disabled.filter((m: string) => m !== input.module) // re-enable: remove from disabled
        : [...new Set([...disabled, input.module])];           // disable: add to disabled set

      const key = `user:${input.userId}:modules.disabled`;
      const value = next.join(",");
      await ctx.db.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
      invalidateUserSettingsCache(input.userId);
      return { success: true, disabled: next };
    }),

  // Used by client to load own module access (no owner restriction)
  getMyModules: protectedProcedure.query(async ({ ctx }) => {
    const rows = await loadUserSettingRows(ctx.db as any, ctx.user.id, ["modules.disabled"]);
    const map = settingsRowsToMap(rows);
    const raw = getSettingString(map, "modules.disabled", "");
    const disabled = raw ? raw.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
    return { disabled };
  }),

  /** App shell bundle: modules + branding subset + density (avoids multiple round-trips). */
  getShellContext: protectedProcedure.query(async ({ ctx }) => {
    const scope = workspaceScopeFromUser(ctx.user);
    await ensureUserWorkspace(ctx.db, scope.workspaceId, ctx.user.name);

    const [moduleRows, workspaceRows] = await Promise.all([
      loadUserSettingRows(ctx.db as any, ctx.user.id, ["modules.disabled"]),
      loadWorkspaceSettingRows(ctx.db, scope, [...SHELL_BRANDING_KEYS]),
    ]);

    const moduleMap = settingsRowsToMap(moduleRows);
    const raw = getSettingString(moduleMap, "modules.disabled", "");
    const disabled = raw ? raw.split(",").map((s: string) => s.trim()).filter(Boolean) : [];

    const settingsMap = settingsRowsToMap(workspaceRows);
    const readable = filterReadableSettingsForRole(ctx.user.role, settingsMap);
    const settings = sanitizeShellSettings(readable);

    const densityRaw = getSettingString(settings, "ui.density", "comfortable");
    const density = densityRaw === "compact" ? "compact" : "comfortable";

    return { disabled, settings, density };
  }),
});
