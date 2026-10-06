import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageIntegrations } from "@/lib/auth/integration-access";
import { GOOGLE_DRIVE_FILE_SCOPE } from "@digitify/api/src/lib/google-drive";
import { loadGoogleOAuthClientConfig } from "@digitify/api/src/lib/google-calendar";
import { isValidGoogleOAuthClientId, isValidGoogleOAuthClientSecret } from "@digitify/api/src/lib/oauth-credentials";
import { resolveOAuthAppUrl } from "@digitify/api/src/lib/oauth-app-url";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login?callbackUrl=/files", request.url));
  if (!canManageIntegrations(user)) return NextResponse.redirect(new URL("/files?drive=forbidden", request.url));
  const { clientId, clientSecret } = await loadGoogleOAuthClientConfig(prisma, { userId: user.id });
  if (!isValidGoogleOAuthClientId(clientId) || !isValidGoogleOAuthClientSecret(clientSecret)) return NextResponse.redirect(new URL("/files?drive=missing-config", request.url));
  const appUrl = resolveOAuthAppUrl(request);
  const state = randomUUID();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${appUrl}/api/integrations/google-drive/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", ["openid", "email", "profile", GOOGLE_DRIVE_FILE_SCOPE].join(" "));
  url.searchParams.set("state", state);
  const response = NextResponse.redirect(url);
  response.cookies.set("digitify_google_drive_state", state, { httpOnly: true, sameSite: "lax", secure: appUrl.startsWith("https://"), path: "/", maxAge: 900 });
  return response;
}
