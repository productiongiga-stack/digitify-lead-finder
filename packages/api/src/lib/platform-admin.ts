import { TRPCError } from "@trpc/server";

type PlatformUser = { email: string; role: string; workspaceRole?: string } | null | undefined;

/** Platform-wide access is an explicit runtime allowlist, never an OWNER-wide default. */
export function isPlatformOwner(user: PlatformUser): boolean {
  if (!user || (user.workspaceRole ?? user.role) !== "OWNER") return false;
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
