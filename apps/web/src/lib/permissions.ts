export type AppRole = "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER" | "TRIAL" | "TESTER" | "VIEWER";

export function normalizeRole(role: string | null | undefined): AppRole {
  if (
    role === "OWNER" ||
    role === "ADMIN" ||
    role === "MODERATOR" ||
    role === "MEMBER" ||
    role === "TRIAL" ||
    role === "TESTER" ||
    role === "VIEWER"
  ) return role;
  return "MEMBER";
}

export function hasRole(roleValue: string | null | undefined, roles: AppRole[]) {
  return roles.includes(normalizeRole(roleValue));
}

export function canAccessSettingsPath(roleValue: string | null | undefined, pathname: string) {
  const role = normalizeRole(roleValue);
  const path = pathname.replace(/\/$/, "") || "/settings";

  if (path === "/settings") return true;
  if (path === "/settings/account") return true;
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
  if (role === "MODERATOR") {
    return new Set([
      "/settings",
      "/settings/reviews",
      "/settings/chatbot",
      "/settings/feedback",
      "/settings/display",
    ]).has(path);
  }
  if (role === "MEMBER") {
    return new Set([
      "/settings",
      "/settings/bookings",
      "/settings/reviews",
      "/settings/quotes",
      "/settings/chatbot",
      "/settings/display",
      "/settings/feedback",
    ]).has(path);
  }
  if (role === "TESTER" || role === "TRIAL" || role === "VIEWER") {
    return path === "/settings/display";
  }
  return path === "/settings/display";
}
