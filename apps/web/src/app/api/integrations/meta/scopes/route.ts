import { NextResponse } from "next/server";
import { resolveMetaOAuthScopeSummary } from "@digitify/api/src/lib/social-meta";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageIntegrations } from "@/lib/auth/integration-access";
import { resolveOAuthAppUrl } from "@digitify/api/src/lib/oauth-app-url";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  if (!canManageIntegrations(user)) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const summary = resolveMetaOAuthScopeSummary();
  const appUrl = resolveOAuthAppUrl(request);

  return NextResponse.json({
    ...summary,
    redirectUri: `${appUrl}/api/integrations/meta/callback`,
    hint:
      summary.hasDeprecatedInstagramBusinessScopes || summary.usesLegacyEnvOverride
        ? "Verwijder META_OAUTH_SCOPES in Vercel of zet alleen facebook-login scopes. instagram_business_* hoort niet bij Page-koppeling."
        : null,
  });
}
