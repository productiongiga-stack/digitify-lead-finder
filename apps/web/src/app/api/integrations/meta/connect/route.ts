import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageIntegrations, integrationAccessDeniedUrl } from "@/lib/auth/integration-access";
import { isValidMetaAppId } from "@digitify/api/src/lib/oauth-credentials";
import { resolveOAuthAppUrl } from "@digitify/api/src/lib/oauth-app-url";
import {
  loadMetaWorkspaceConfig,
  resolveMetaGraphVersion,
  resolveMetaOAuthScopes,
  workspaceScopeFromAuthenticatedUser,
} from "@digitify/api/src/lib/social-meta";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(integrationAccessDeniedUrl(request.url, "meta", "login"));
  }

  if (!canManageIntegrations(user)) {
    return NextResponse.redirect(integrationAccessDeniedUrl(request.url, "meta"));
  }

  const scope = workspaceScopeFromAuthenticatedUser({ id: user.id, workspaceId: user.workspaceId });
  const config = await loadMetaWorkspaceConfig(prisma, scope);

  if (!config.appId || !config.appSecret) {
    return NextResponse.redirect(new URL("/settings/integrations?meta=missing-config", request.url));
  }
  if (!isValidMetaAppId(config.appId)) {
    return NextResponse.redirect(new URL("/settings/integrations?meta=invalid-app-id", request.url));
  }

  const appUrl = resolveOAuthAppUrl(request);
  const redirectUri = `${appUrl}/api/integrations/meta/callback`;
  const state = randomUUID();

  const authUrl = new URL(`https://www.facebook.com/${resolveMetaGraphVersion()}/dialog/oauth`);
  authUrl.searchParams.set("client_id", config.appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", resolveMetaOAuthScopes().join(","));

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("digitify_meta_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: appUrl.startsWith("https://"),
    path: "/",
    maxAge: 60 * 15,
  });
  return response;
}
