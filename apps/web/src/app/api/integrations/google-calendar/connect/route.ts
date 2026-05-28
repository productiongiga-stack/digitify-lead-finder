import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { loadGoogleOAuthClientConfig } from "@digitify/api/src/lib/google-calendar";
import { getCurrentUser } from "@/lib/auth/session";

function resolveAppUrl() {
  const candidates = [
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    // VERCEL_URL is deployment-specific and differs from the registered redirect URI
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
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", "/settings/bookings#google-agenda");
    return NextResponse.redirect(loginUrl);
  }

  const { clientId, clientSecret } = await loadGoogleOAuthClientConfig(prisma as any);
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/settings/bookings?google=missing-config", request.url));
  }

  const appUrl = resolveAppUrl();
  const redirectUri = `${appUrl}/api/integrations/google-calendar/callback`;
  const state = randomUUID();
  const nonce = randomUUID();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar",
  ].join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);

  const response = NextResponse.redirect(url);
  response.cookies.set("digitify_google_calendar_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: appUrl.startsWith("https://"),
    path: "/",
    maxAge: 60 * 15,
  });
  response.cookies.set("digitify_google_calendar_nonce", nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: appUrl.startsWith("https://"),
    path: "/",
    maxAge: 60 * 15,
  });
  return response;
}
