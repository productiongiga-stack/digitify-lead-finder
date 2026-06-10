import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import {
  isValidGoogleOAuthClientId,
  isValidGoogleOAuthClientSecret,
} from "@digitify/api/src/lib/oauth-credentials";
import { loadGoogleOAuthClientConfig } from "@digitify/api/src/lib/google-calendar";
import { resolveOAuthAppUrl } from "@digitify/api/src/lib/oauth-app-url";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", "/settings/integrations?tab=google-oauth");
    return NextResponse.redirect(loginUrl);
  }
  if (!["OWNER", "ADMIN"].includes(String(user.role || ""))) {
    return NextResponse.redirect(new URL("/settings/integrations?tab=google-oauth&google=forbidden", request.url));
  }

  const userId = (user as { id?: string }).id;
  const { clientId, clientSecret } = await loadGoogleOAuthClientConfig(
    prisma as any,
    userId ? { userId } : undefined,
  );
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/settings/integrations?tab=google-oauth&google=missing-config", request.url));
  }

  if (!isValidGoogleOAuthClientId(clientId)) {
    return NextResponse.redirect(new URL("/settings/integrations?tab=google-oauth&google=invalid-client-id", request.url));
  }

  if (!isValidGoogleOAuthClientSecret(clientSecret)) {
    return NextResponse.redirect(new URL("/settings/integrations?tab=google-oauth&google=invalid-client-secret", request.url));
  }

  const appUrl = resolveOAuthAppUrl(request);
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
