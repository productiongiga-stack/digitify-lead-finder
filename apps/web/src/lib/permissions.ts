export type AppRole = "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER" | "TRIAL" | "TESTER" | "VIEWER";

type SessionRoleSource = {
  role?: string | null;
  workspaceRole?: string | null;
};

export function effectiveAppRole(session: SessionRoleSource | null | undefined): AppRole {
  return normalizeRole(session?.workspaceRole ?? session?.role);
}

const VIEWER_HIDDEN_NAV_HREFS = new Set([
  "/contacts/compose",
  "/leads/new",
  "/campaigns/new",
  "/quotes/new",
]);

const TESTER_TRIAL_HIDDEN_NAV_HREFS = new Set([
  "/settings/branding",
  "/settings/seo",
  "/settings/email",
  "/settings/analytics",
  "/settings/performance",
  "/settings/company",
  "/settings/ai",
  "/settings/scoring",
  "/settings/team",
  "/settings/pipeline",
]);

export function canAccessNavItem(roleValue: string | null | undefined, href: string) {
  const role = normalizeRole(roleValue);
  if (role === "VIEWER" && VIEWER_HIDDEN_NAV_HREFS.has(href)) return false;
  if ((role === "TESTER" || role === "TRIAL") && TESTER_TRIAL_HIDDEN_NAV_HREFS.has(href)) return false;
  return true;
}

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
  if (path === "/settings/workspaces") return true;
  if (role === "OWNER") return path.startsWith("/settings/");

  const adminPaths = new Set([
    "/settings/integrations",
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
      "/settings/integrations",
      "/settings/reviews",
      "/settings/chatbot",
      "/settings/feedback",
      "/settings/display",
    ]).has(path);
  }
  if (role === "MEMBER") {
    return new Set([
      "/settings",
      "/settings/workspaces",
      "/settings/integrations",
      "/settings/creative-studio",
      "/settings/bookings",
      "/settings/reviews",
      "/settings/quotes",
      "/settings/chatbot",
      "/settings/display",
      "/settings/feedback",
    ]).has(path);
  }
  if (role === "TESTER" || role === "TRIAL") {
    return (
      path === "/settings/display" ||
      path === "/settings/workspaces" ||
      path === "/settings/integrations" ||
      path === "/settings/creative-studio"
    );
  }
  if (role === "VIEWER") {
    return path === "/settings/display" || path === "/settings/workspaces";
  }
  return path === "/settings/display" || path === "/settings/workspaces";
}
