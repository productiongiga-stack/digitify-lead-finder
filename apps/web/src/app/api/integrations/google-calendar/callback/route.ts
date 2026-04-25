import { NextResponse } from "next/server";
import { prisma, protectSettingValue, revealSettingValue } from "@digitify/db";
import { getCurrentUser } from "@/lib/auth/session";
import { tenantSettingWhere } from "@digitify/api/src/lib/tenant";

function resolveAppUrl() {
  const candidates = [
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;
    try {
      return new URL(trimmed).toString().replace(/\/$/, "");
    } catch {
      continue;
    }
  }

  return "http://localhost:3000";
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const userId = (user as any).id as string | undefined;
  if (!userId) {
    return NextResponse.redirect(new URL("/settings/bookings?google=error", request.url));
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code")?.trim() || "";
  const state = requestUrl.searchParams.get("state")?.trim() || "";
  const cookieState = request.headers.get("cookie")?.match(/digitify_google_calendar_state=([^;]+)/)?.[1] || "";

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/settings/bookings?google=invalid-state", request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/settings/bookings?google=missing-config", request.url));
  }

  try {
    const appUrl = resolveAppUrl();
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

    const [profileResponse, calendarListResponse, currentRefreshRow] = await Promise.all([
      fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }),
      fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }),
      prisma.setting.findUnique({ where: tenantSettingWhere(userId, "bookings.google_oauth_refresh_token") }),
    ]);

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

    const updates: Array<{ key: string; value: string }> = [
      { key: "bookings.google_sync_enabled", value: "true" },
      { key: "bookings.google_calendar_id", value: primaryCalendar?.id || "primary" },
      { key: "bookings.google_calendar_timezone", value: primaryCalendar?.timeZone || "Europe/Brussels" },
      { key: "bookings.google_oauth_access_token", value: tokenData.access_token },
      { key: "bookings.google_oauth_refresh_token", value: refreshToken },
      { key: "bookings.google_oauth_account_email", value: profile.email?.trim() || "" },
    ];

    await prisma.$transaction(
      updates.map((entry) =>
        prisma.setting.upsert({
          where: tenantSettingWhere(userId, entry.key),
          update: { value: protectSettingValue(entry.key, entry.value) as any },
          create: { userId, key: entry.key, value: protectSettingValue(entry.key, entry.value) as any },
        })
      )
    );

    const response = NextResponse.redirect(new URL("/settings/bookings?google=connected", request.url));
    response.cookies.set("digitify_google_calendar_state", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: appUrl.startsWith("https://"),
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/settings/bookings?google=error", request.url));
  }
}
