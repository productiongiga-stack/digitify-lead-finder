import { NextResponse } from "next/server";
import { FactorError } from "@digitify/api/src/lib/two-factor";
import { log } from "@digitify/api/src/lib/logger";
import { ZodError } from "zod";

export const LOGIN_COOKIE = process.env.NODE_ENV === "production" ? "__Host-digitify-login-challenge" : "digitify-login-challenge";
export const RECOVERY_COOKIE = process.env.NODE_ENV === "production" ? "__Host-digitify-factor-recovery" : "digitify-factor-recovery";
export const factorCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/" };
export function requireAuthOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  const allowed = new Set<string>();
  if (process.env.NEXTAUTH_URL) allowed.add(new URL(process.env.NEXTAUTH_URL).origin);
  if (process.env.NODE_ENV !== "production") {
    allowed.add(requestUrl.origin);
    if (["localhost", "127.0.0.1"].includes(requestUrl.hostname)) {
      allowed.add(`${requestUrl.protocol}//localhost:${requestUrl.port || "80"}`);
      allowed.add(`${requestUrl.protocol}//127.0.0.1:${requestUrl.port || "80"}`);
    }
  }
  if (!origin || !allowed.has(origin)) throw new FactorError("Ongeldige aanvraag.", 403);
}
export function authJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
export function authError(error: unknown, context?: { route?: string }) {
  if (error instanceof ZodError || error instanceof SyntaxError) return authJson({ message: "Controleer de ingevulde gegevens." }, 400);
  if (!(error instanceof FactorError)) {
    log.auth.error("Beveiligingsaanvraag mislukt", { route: context?.route ?? "unknown" }, error);
  }
  return authJson({ message: error instanceof FactorError ? error.message : "Beveiligingscontrole niet beschikbaar. Probeer later opnieuw." }, error instanceof FactorError ? error.status : 503);
}
