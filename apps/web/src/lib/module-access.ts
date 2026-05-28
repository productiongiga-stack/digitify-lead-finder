import { ALL_MODULES } from "@/lib/navigation";

/** Longest-prefix wins. Paths without moduleId are always allowed. */
export const ROUTE_MODULE_RULES: Array<{ prefix: string; moduleId: string }> = [
  { prefix: "/campaigns", moduleId: "campaigns" },
  { prefix: "/contacts", moduleId: "contacts" },
  { prefix: "/templates", moduleId: "templates" },
  { prefix: "/quotes", moduleId: "quotes" },
  { prefix: "/invoices", moduleId: "invoices" },
  { prefix: "/reports", moduleId: "reports" },
  { prefix: "/crm", moduleId: "crm" },
  { prefix: "/tasks", moduleId: "tasks" },
  { prefix: "/bookings", moduleId: "bookings" },
  { prefix: "/domains", moduleId: "domains" },
  { prefix: "/reviews", moduleId: "reviews" },
  { prefix: "/chatbot", moduleId: "chatbot" },
  { prefix: "/audit", moduleId: "reports" },
];

export function resolveModuleIdForPath(pathname: string): string | null {
  const sorted = ROUTE_MODULE_RULES.slice().sort((a, b) => b.prefix.length - a.prefix.length);
  for (const rule of sorted) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      return rule.moduleId;
    }
  }
  return null;
}

export function moduleLabel(moduleId: string) {
  return ALL_MODULES.find((item) => item.id === moduleId)?.label ?? moduleId;
}

export function isModuleDisabled(pathname: string, disabledModules: Set<string>) {
  const moduleId = resolveModuleIdForPath(pathname);
  if (!moduleId) return false;
  return disabledModules.has(moduleId);
}
