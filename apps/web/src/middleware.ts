import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Edge middleware: rate-limit credential login + registration to slow down
 * brute-force / credential-stuffing attempts.
 *
 * Limits are intentionally tight — legitimate users only attempt to log in a
 * handful of times per minute. The bucket is keyed by client IP, falling back
 * to the request URL host when no IP header is available (e.g. local dev).
 *
 * NOTE: this uses an in-memory store from `@/lib/rate-limit`, which is
 * per-process. For multi-instance deployments swap the store for a shared
 * backend (Redis/Upstash) — but the limits and keying stay the same.
 */

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

const LIMITS: { match: (path: string) => boolean; key: string; limit: number; windowMs: number }[] = [
  // Credential login attempts
  {
    match: (p) => p.startsWith("/api/auth/callback/credentials"),
    key: "auth-login",
    limit: 8,
    windowMs: 60_000, // 8 attempts / minute / IP
  },
  // Slower long-window guard for sustained brute force
  {
    match: (p) => p.startsWith("/api/auth/callback/credentials"),
    key: "auth-login-hour",
    limit: 60,
    windowMs: 60 * 60_000, // 60 attempts / hour / IP
  },
  // Public registration request endpoint (tRPC)
  {
    match: (p) => p.startsWith("/api/trpc/registration.requestAccess"),
    key: "auth-register",
    limit: 8,
    windowMs: 60 * 60_000, // 8 attempts / hour / IP
  },
  // Email verification retries
  {
    match: (p) => p.startsWith("/api/trpc/registration.verifyEmail"),
    key: "auth-register-verify",
    limit: 30,
    windowMs: 60 * 60_000, // 30 attempts / hour / IP
  },
];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const ip = clientIp(req);

  for (const rule of LIMITS) {
    if (!rule.match(path)) continue;
    const result = checkRateLimit({
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

  return NextResponse.next();
}

export const config = {
  // Keep middleware scoped to auth and registration surfaces.
  matcher: ["/api/auth/callback/:path*", "/api/trpc/:path*"],
};
