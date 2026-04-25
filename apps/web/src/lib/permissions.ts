export type AppRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export function normalizeRole(role: string | null | undefined): AppRole {
  if (role === "OWNER" || role === "ADMIN" || role === "VIEWER") return role;
  return "MEMBER";
}

export function hasRole(roleValue: string | null | undefined, roles: AppRole[]) {
  return roles.includes(normalizeRole(roleValue));
}

export function canAccessSettingsPath(roleValue: string | null | undefined, pathname: string) {
  const role = normalizeRole(roleValue);
  const path = pathname.replace(/\/$/, "") || "/settings";

  if (path === "/settings") return true;
  if (role === "OWNER") return path.startsWith("/settings/");

  const adminPaths = new Set([
    "/settings/bookings",
    "/settings/reviews",
    "/settings/quotes",
    "/settings/chatbot",
    "/settings/pipeline",
    "/settings/scoring",
    "/settings/team",
    "/settings/feedback",
    "/settings/display",
  ]);

  if (role === "ADMIN") return adminPaths.has(path);
  return path === "/settings/display";
}
