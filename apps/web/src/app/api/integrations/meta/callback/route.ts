import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@digitify/db";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageIntegrations, integrationAccessDeniedUrl } from "@/lib/auth/integration-access";
import { resolveOAuthAppUrl } from "@digitify/api/src/lib/oauth-app-url";
import {
  exchangeMetaOAuthCode,
  loadMetaWorkspaceConfig,
  loadMetaManagedPages,
  pickDefaultMetaPage,
  upsertMetaSettings,
  workspaceScopeFromAuthenticatedUser,
} from "@digitify/api/src/lib/social-meta";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  if (!canManageIntegrations(user)) {
    return NextResponse.redirect(integrationAccessDeniedUrl(request.url, "meta"));
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code")?.trim() || "";
  const state = requestUrl.searchParams.get("state")?.trim() || "";
  const error = requestUrl.searchParams.get("error")?.trim() || "";

  if (error) {
    return NextResponse.redirect(new URL(`/settings/integrations?meta=${encodeURIComponent(error)}`, request.url));
  }

  const cookieStore = await cookies();
  const cookieState = cookieStore.get("digitify_meta_oauth_state")?.value || "";
  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/settings/integrations?meta=invalid-state", request.url));
  }

  const scope = workspaceScopeFromAuthenticatedUser({ id: user.id, workspaceId: user.workspaceId });

  try {
    const metaConfig = await loadMetaWorkspaceConfig(prisma, scope);
    const appId = metaConfig.appId;
    const appSecret = metaConfig.appSecret;

    if (!appId || !appSecret) {
      return NextResponse.redirect(new URL("/settings/integrations?meta=missing-config", request.url));
    }

    const appUrl = resolveOAuthAppUrl(request);
    const redirectUri = `${appUrl}/api/integrations/meta/callback`;

    const token = await exchangeMetaOAuthCode({
      code,
      redirectUri,
      appId,
      appSecret,
    });

    const pages = await loadMetaManagedPages(token.accessToken);
    const selectedPage = pickDefaultMetaPage(pages);
    if (!selectedPage) {
      throw new Error("Geen beheerde Facebook pagina gevonden. Controleer of de app rechten heeft op je pagina.");
    }

    const expiresAt = token.expiresInSeconds > 0
      ? new Date(Date.now() + token.expiresInSeconds * 1000).toISOString()
      : "";

    const settingsToSave: Array<{ key: string; value: string }> = [
      { key: "social.meta_access_token", value: token.accessToken },
      { key: "social.meta_refresh_meta", value: token.accessToken },
      { key: "social.meta_page_id", value: selectedPage.id },
      { key: "social.meta_page_access_token", value: selectedPage.accessToken },
      { key: "social.meta_instagram_business_id", value: selectedPage.instagramBusinessId || "" },
      { key: "social.meta_token_expires_at", value: expiresAt },
    ];
    if (!metaConfig.autopostEnabled) {
      settingsToSave.push({ key: "social.autopost_enabled", value: "true" });
    }
    await upsertMetaSettings(prisma, scope, settingsToSave);

    const response = NextResponse.redirect(new URL("/settings/integrations?meta=connected", request.url));
    response.cookies.set("digitify_meta_oauth_state", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: appUrl.startsWith("https://"),
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (callbackError) {
    console.error("[meta-callback] OAuth callback failed", callbackError);
    return NextResponse.redirect(new URL("/settings/integrations?meta=error", request.url));
  }
}
