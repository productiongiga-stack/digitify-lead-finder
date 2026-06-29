import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Edge middleware: rate-limit credential login + registration.
 * Uses Upstash REST when UPSTASH_REDIS_REST_* is set; otherwise in-memory per edge node.
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
  if (process.env.E2E_DISABLE_RATE_LIMITS === "true") return NextResponse.next();

  const path = req.nextUrl.pathname;
  const ip = clientIp(req);

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/auth/callback/:path*", "/api/trpc/:path*"],
};
