import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, revealSettingValue } from "@digitify/db";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageIntegrations } from "@/lib/auth/integration-access";
import { exchangeGoogleAdsOAuthCode, upsertGoogleAdsSettings } from "@digitify/api/src/lib/google-ads-oauth";
import { loadGoogleOAuthClientConfig } from "@digitify/api/src/lib/google-calendar";
import { resolveOAuthAppUrl } from "@digitify/api/src/lib/oauth-app-url";
import { resolveSettingDbKey, workspaceScopeFromUser } from "@digitify/api/src/lib/workspace-settings";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!canManageIntegrations(user)) return NextResponse.redirect(new URL("/settings/seo?searchConsole=forbidden", request.url));
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const state = cookieStore.get("digitify_search_console_state")?.value || "";
  if (!url.searchParams.get("code") || !state || state !== url.searchParams.get("state")) return NextResponse.redirect(new URL("/settings/seo?searchConsole=invalid-state", request.url));
  const { clientId, clientSecret } = await loadGoogleOAuthClientConfig(prisma, { userId: user.id });
  const appUrl = resolveOAuthAppUrl(request);
  try {
    const token = await exchangeGoogleAdsOAuthCode({ code: url.searchParams.get("code")!, redirectUri: `${appUrl}/api/integrations/google-search-console/callback`, clientId, clientSecret });
    if (!token.access_token) throw new Error("Geen Google access token ontvangen.");
    const scope = workspaceScopeFromUser({ id: user.id, workspaceId: (user as { workspaceId?: string }).workspaceId });
    const refreshKey = resolveSettingDbKey(scope, "seo.google_search_console_refresh_token");
    const existing = await prisma.setting.findUnique({ where: { key: refreshKey } });
    const refreshToken = token.refresh_token || (typeof existing?.value === "string" ? String(revealSettingValue("seo.google_search_console_refresh_token", existing.value) || "") : "");
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } });
    const profile = profileResponse.ok ? await profileResponse.json() as { email?: string } : {};
    const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : "";
    await upsertGoogleAdsSettings(prisma, scope, [
      { key: "seo.google_search_console_access_token", value: token.access_token },
      { key: "seo.google_search_console_refresh_token", value: refreshToken },
      { key: "seo.google_search_console_account_email", value: profile.email || "" },
      { key: "seo.google_search_console_token_expires_at", value: expiresAt },
    ]);
    const response = NextResponse.redirect(new URL("/settings/seo?searchConsole=connected", request.url));
    response.cookies.set("digitify_search_console_state", "", { httpOnly: true, sameSite: "lax", secure: appUrl.startsWith("https://"), path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("[search-console-callback]", error);
    return NextResponse.redirect(new URL("/settings/seo?searchConsole=error", request.url));
  }
}
