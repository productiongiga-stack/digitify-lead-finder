import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma, protectSettingValue, revealSettingValue } from "@digitify/db";
import { getCurrentUser } from "@/lib/auth/session";
import { userSettingKey } from "@digitify/api/src/lib/user-settings";
import {
  isValidGoogleOAuthClientId,
  isValidGoogleOAuthClientSecret,
} from "@digitify/api/src/lib/oauth-credentials";
import { resolveOAuthAppUrl } from "@digitify/api/src/lib/oauth-app-url";
import { loadGoogleOAuthClientConfig } from "@digitify/api/src/lib/google-calendar";
import { resolveSettingDbKey, workspaceScopeFromUser } from "@digitify/api/src/lib/workspace-settings";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!["OWNER", "ADMIN"].includes(String(user.role || ""))) {
    return NextResponse.redirect(new URL("/settings/integrations?tab=google-oauth&google=forbidden", request.url));
  }
  const userId = (user as any).id as string | undefined;
  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code")?.trim() || "";
  const state = requestUrl.searchParams.get("state")?.trim() || "";
  const error = requestUrl.searchParams.get("error")?.trim() || "";
  const cookieStore = await cookies();
  const cookieState = cookieStore.get("digitify_google_calendar_state")?.value || "";

  if (error) {
    return NextResponse.redirect(new URL(`/settings/integrations?tab=google-oauth&google=${encodeURIComponent(error)}`, request.url));
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/settings/integrations?tab=google-oauth&google=invalid-state", request.url));
  }

  const { clientId, clientSecret } = await loadGoogleOAuthClientConfig(prisma as any, { userId });
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/settings/integrations?tab=google-oauth&google=missing-config", request.url));
  }
  if (!isValidGoogleOAuthClientId(clientId)) {
    return NextResponse.redirect(new URL("/settings/integrations?tab=google-oauth&google=invalid-client-id", request.url));
  }
  if (!isValidGoogleOAuthClientSecret(clientSecret)) {
    return NextResponse.redirect(new URL("/settings/integrations?tab=google-oauth&google=invalid-client-secret", request.url));
  }

  try {
    const appUrl = resolveOAuthAppUrl(request);
    const redirectUri = `${appUrl}/api/integrations/google-calendar/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      throw new Error(`Google token exchange fout (${tokenResponse.status}): ${body.slice(0, 200)}`);
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
    };

    if (!tokenData.access_token) {
      throw new Error("Geen Google access token ontvangen.");
    }

    const scope = workspaceScopeFromUser({
      id: userId,
      workspaceId: (user as { workspaceId?: string }).workspaceId,
    });
    const workspaceRefreshKey = resolveSettingDbKey(scope, "bookings.google_oauth_refresh_token");
    const memberRefreshKey = userSettingKey(userId, "bookings.google_oauth_refresh_token");

    const [profileResponse, calendarListResponse, workspaceRefreshRow, memberRefreshRow] = await Promise.all([
      fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }),
      fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }),
      prisma.setting.findUnique({ where: { key: workspaceRefreshKey } }),
      prisma.setting.findUnique({ where: { key: memberRefreshKey } }),
    ]);
    const currentRefreshRow = workspaceRefreshRow || memberRefreshRow;

    const profile = profileResponse.ok
      ? ((await profileResponse.json()) as { email?: string })
      : { email: "" };
    const calendarList = calendarListResponse.ok
      ? ((await calendarListResponse.json()) as {
          items?: Array<{ id?: string; primary?: boolean; timeZone?: string }>;
        })
      : { items: [] };

    const primaryCalendar =
      calendarList.items?.find((item) => item.primary) ||
      calendarList.items?.[0] ||
      null;

    const refreshToken =
      tokenData.refresh_token ||
      (typeof currentRefreshRow?.value === "string"
        ? String(revealSettingValue("bookings.google_oauth_refresh_token", currentRefreshRow.value) || "")
        : "");

    const existingTimezoneRow = await prisma.setting.findUnique({
      where: { key: resolveSettingDbKey(scope, "bookings.google_calendar_timezone") },
      select: { value: true },
    });
    const existingTimezone =
      typeof existingTimezoneRow?.value === "string" ? existingTimezoneRow.value.trim() : "";
    const calendarTimezone = primaryCalendar?.timeZone?.trim() || "Europe/Brussels";

    const updates: Array<{ key: string; value: string }> = [
      { key: "bookings.google_sync_enabled", value: "true" },
      { key: "bookings.google_calendar_id", value: primaryCalendar?.id || "primary" },
      {
        key: "bookings.google_calendar_timezone",
        value: existingTimezone || calendarTimezone,
      },
      { key: "bookings.google_oauth_access_token", value: tokenData.access_token },
      { key: "bookings.google_oauth_refresh_token", value: refreshToken },
      { key: "bookings.google_oauth_account_email", value: profile.email?.trim() || "" },
    ];

    await prisma.$transaction(
      updates.map((entry) => {
        const dbKey = resolveSettingDbKey(scope, entry.key);
        const protectedValue = protectSettingValue(entry.key, entry.value) as any;
        return prisma.setting.upsert({
          where: { key: dbKey },
          update: { value: protectedValue },
          create: { key: dbKey, value: protectedValue },
        });
      })
    );

    const response = NextResponse.redirect(new URL("/settings/integrations?tab=google-oauth&google=connected", request.url));
    response.cookies.set("digitify_google_calendar_state", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: appUrl.startsWith("https://"),
      path: "/",
      maxAge: 0,
    });
    response.cookies.set("digitify_google_calendar_nonce", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: appUrl.startsWith("https://"),
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (callbackError) {
    console.error("[google-calendar-callback] OAuth callback failed", callbackError);
    return NextResponse.redirect(new URL("/settings/integrations?tab=google-oauth&google=error", request.url));
  }
}
