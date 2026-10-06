import { TRPCError } from "@trpc/server";

type PlatformUser = { id?: string; email: string; role: string; workspaceRole?: string; platformRole?: string | null; accountClass?: string } | null | undefined;

/** Platform-wide access is an explicit runtime allowlist, never an OWNER-wide default. */
export function isPlatformOwner(user: PlatformUser): boolean {
  if (!user) return false;
  if (user.platformRole === "OWNER" || user.accountClass === "PLATFORM_OWNER") return true;
  if ((user.workspaceRole ?? user.role) !== "OWNER") return false;
  const allowed = (process.env.PLATFORM_OWNER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(user.email.toLowerCase());
}

export function requirePlatformOwner(user: PlatformUser): asserts user is NonNullable<PlatformUser> {
  if (!isPlatformOwner(user)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Deze actie is alleen beschikbaar voor een aangewezen platform-owner.",
    });
  }
}
