import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, revealSettingValue } from "@digitify/db";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageIntegrations } from "@/lib/auth/integration-access";
import { exchangeGoogleAdsOAuthCode } from "@digitify/api/src/lib/google-ads-oauth";
import { loadGoogleOAuthClientConfig } from "@digitify/api/src/lib/google-calendar";
import { upsertGoogleDriveSettings } from "@digitify/api/src/lib/google-drive";
import { resolveOAuthAppUrl } from "@digitify/api/src/lib/oauth-app-url";
import { resolveSettingDbKey, workspaceScopeFromUser } from "@digitify/api/src/lib/workspace-settings";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!canManageIntegrations(user)) return NextResponse.redirect(new URL("/files?drive=forbidden", request.url));
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("digitify_google_drive_state")?.value || "";
  if (!url.searchParams.get("code") || !expectedState || expectedState !== url.searchParams.get("state")) return NextResponse.redirect(new URL("/files?drive=invalid-state", request.url));
  const { clientId, clientSecret } = await loadGoogleOAuthClientConfig(prisma, { userId: user.id });
  const appUrl = resolveOAuthAppUrl(request);
  try {
    const token = await exchangeGoogleAdsOAuthCode({ code: url.searchParams.get("code")!, redirectUri: `${appUrl}/api/integrations/google-drive/callback`, clientId, clientSecret });
    if (!token.access_token) throw new Error("Geen Google Drive-token ontvangen.");
    const scope = workspaceScopeFromUser({ id: user.id, workspaceId: user.workspaceId });
    const refreshKey = resolveSettingDbKey(scope, "files.google_drive_refresh_token");
    const existing = await prisma.setting.findUnique({ where: { key: refreshKey } });
    const refreshToken = token.refresh_token || String(revealSettingValue("files.google_drive_refresh_token", existing?.value) || "");
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } });
    const profile = profileResponse.ok ? await profileResponse.json() as { email?: string } : {};
    await upsertGoogleDriveSettings(prisma, scope, [
      { key: "files.google_drive_access_token", value: token.access_token },
      { key: "files.google_drive_refresh_token", value: refreshToken },
      { key: "files.google_drive_account_email", value: profile.email || "" },
      { key: "files.google_drive_token_expires_at", value: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : "" },
    ]);
    const response = NextResponse.redirect(new URL("/files?drive=connected", request.url));
    response.cookies.set("digitify_google_drive_state", "", { httpOnly: true, sameSite: "lax", secure: appUrl.startsWith("https://"), path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("[google-drive-callback]", error);
    return NextResponse.redirect(new URL("/files?drive=error", request.url));
  }
}
