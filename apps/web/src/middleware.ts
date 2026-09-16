import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/http-security";

/**
 * Edge middleware: rate-limit credential login + registration.
 * Uses Upstash REST when UPSTASH_REDIS_REST_* is set; otherwise in-memory per edge node.
 */

const LIMITS: { match: (path: string) => boolean; key: string; limit: number; windowMs: number }[] = [
  {
    match: (p) => p.startsWith("/api/auth/callback/credentials"),
    key: "auth-login",
    limit: 8,
    windowMs: 60_000,
  },
  {
    match: (p) => p.startsWith("/api/auth/callback/credentials"),
    key: "auth-login-hour",
    limit: 60,
    windowMs: 60 * 60_000,
  },
  {
    match: (p) => p.startsWith("/api/trpc/registration.requestAccess"),
    key: "auth-register",
    limit: 8,
    windowMs: 60 * 60_000,
  },
  {
    match: (p) => p.startsWith("/api/trpc/registration.verifyEmail"),
    key: "auth-register-verify",
    limit: 30,
    windowMs: 60 * 60_000,
  },
];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const ip = getClientIp(req);

  for (const rule of LIMITS) {
    if (!rule.match(path)) continue;
    const result = await checkRateLimit({
      key: `${rule.key}:${ip}`,
      limit: rule.limit,
      windowMs: rule.windowMs,
    });
    if (!result.allowed) {
      const retryAfterSec = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
      return new NextResponse(
        JSON.stringify({
          error: "rate_limited",
          message: "Te veel pogingen. Probeer het later opnieuw.",
          retryAfter: retryAfterSec,
        }),
        {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": String(retryAfterSec),
            "x-ratelimit-limit": String(rule.limit),
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": String(Math.ceil(result.resetAt / 1000)),
          },
        },
      );
    }
  }

  // Keep a per-request nonce available to Next.js and server-rendered inline scripts.
  // CSP remains report-only until all client-injected analytics scripts are nonce-aware.
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-csp-nonce", nonce);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const frameAncestors = path.startsWith("/embed/") ? "*" : "'self'";
  const developmentScriptAllowances = process.env.NODE_ENV === "development"
    ? " 'unsafe-inline' 'unsafe-eval'"
    : "";
  response.headers.set(
    "Content-Security-Policy-Report-Only",
    [
      `default-src 'self'`,
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
      `script-src 'self' 'nonce-${nonce}'${developmentScriptAllowances} https://www.googletagmanager.com https://snap.licdn.com`,
      `style-src 'self' 'nonce-${nonce}'`,
      `style-src-elem 'self' 'nonce-${nonce}'`,
      "style-src-attr 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-src 'self'",
      `frame-ancestors ${frameAncestors}`,
      "worker-src 'self' blob:",
    ].join("; "),
  );
  if (path.startsWith("/api/auth/") || path.startsWith("/api/trpc/")) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
