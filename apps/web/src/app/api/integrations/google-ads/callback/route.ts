import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, revealSettingValue } from "@digitify/db";
import { getCurrentUser } from "@/lib/auth/session";
import {
  isValidGoogleOAuthClientId,
  isValidGoogleOAuthClientSecret,
} from "@digitify/api/src/lib/oauth-credentials";
import {
  exchangeGoogleAdsOAuthCode,
  upsertGoogleAdsSettings,
} from "@digitify/api/src/lib/google-ads-oauth";
import { loadGoogleOAuthClientConfig } from "@digitify/api/src/lib/google-calendar";
import { resolveOAuthAppUrl } from "@digitify/api/src/lib/oauth-app-url";
import { resolveSettingDbKey, workspaceScopeFromUser } from "@digitify/api/src/lib/workspace-settings";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!["OWNER", "ADMIN"].includes(String(user.role || ""))) {
    return NextResponse.redirect(new URL("/settings/integrations?googleAds=forbidden", request.url));
  }
  const userId = (user as { id?: string }).id;
  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code")?.trim() || "";
  const state = requestUrl.searchParams.get("state")?.trim() || "";
  const error = requestUrl.searchParams.get("error")?.trim() || "";
  const cookieStore = await cookies();
  const cookieState = cookieStore.get("digitify_google_ads_state")?.value || "";

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings/integrations?googleAds=${encodeURIComponent(error)}`, request.url),
    );
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/settings/integrations?googleAds=invalid-state", request.url));
  }

  const { clientId, clientSecret } = await loadGoogleOAuthClientConfig(prisma as any, { userId });
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/settings/integrations?googleAds=missing-config", request.url));
  }
  if (!isValidGoogleOAuthClientId(clientId) || !isValidGoogleOAuthClientSecret(clientSecret)) {
    return NextResponse.redirect(new URL("/settings/integrations?googleAds=invalid-config", request.url));
  }

  try {
    const appUrl = resolveOAuthAppUrl(request);
    const redirectUri = `${appUrl}/api/integrations/google-ads/callback`;
    const tokenData = await exchangeGoogleAdsOAuthCode({
      code,
      redirectUri,
      clientId,
      clientSecret,
    });

    if (!tokenData.access_token) {
      throw new Error("Geen Google access token ontvangen.");
    }

    const scope = workspaceScopeFromUser({
      id: userId,
      workspaceId: (user as { workspaceId?: string }).workspaceId,
    });

    const refreshKey = resolveSettingDbKey(scope, "ads.google_oauth_refresh_token");
    const existingRefresh = await prisma.setting.findUnique({ where: { key: refreshKey } });
    const refreshToken =
      tokenData.refresh_token ||
      (typeof existingRefresh?.value === "string"
        ? String(revealSettingValue("ads.google_oauth_refresh_token", existingRefresh.value) || "")
        : "");

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = profileResponse.ok
      ? ((await profileResponse.json()) as { email?: string })
      : { email: "" };

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : "";

    await upsertGoogleAdsSettings(prisma as any, scope, [
      { key: "ads.google_oauth_access_token", value: tokenData.access_token },
      { key: "ads.google_oauth_refresh_token", value: refreshToken },
      { key: "ads.google_oauth_account_email", value: profile.email?.trim() || "" },
      { key: "ads.google_oauth_token_expires_at", value: expiresAt },
    ]);

    const response = NextResponse.redirect(new URL("/settings/integrations?googleAds=connected", request.url));
    response.cookies.set("digitify_google_ads_state", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: appUrl.startsWith("https://"),
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (callbackError) {
    console.error("[google-ads-callback] OAuth callback failed", callbackError);
    return NextResponse.redirect(new URL("/settings/integrations?googleAds=error", request.url));
  }
}
