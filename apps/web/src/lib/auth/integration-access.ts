import { effectiveAppRole, type AppRole } from "@/lib/permissions";

type IntegrationAccessUser = {
  role?: string | null;
  workspaceRole?: string | null;
};

const INTEGRATION_MANAGER_ROLES = new Set<AppRole>(["OWNER", "ADMIN"]);

export function canManageIntegrations(user: IntegrationAccessUser | null | undefined) {
  return INTEGRATION_MANAGER_ROLES.has(effectiveAppRole(user));
}

export function integrationAccessDeniedUrl(requestUrl: string, provider: string, reason: "login" | "forbidden" = "forbidden") {
  if (reason === "login") {
    const loginUrl = new URL("/login", requestUrl);
    loginUrl.searchParams.set("callbackUrl", `/settings/integrations?${provider}=login`);
    return loginUrl;
  }
  return new URL(`/settings/integrations?${provider}=forbidden`, requestUrl);
}
