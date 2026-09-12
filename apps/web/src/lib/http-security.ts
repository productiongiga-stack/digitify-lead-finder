import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

export function getClientIp(request: Request) {
  // Trust Cloudflare's visitor IP only on requests marked by Cloudflare.
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp && request.headers.get("cf-ray")?.trim()) return cloudflareIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

export async function enforceRateLimit(
  request: Request,
  options: {
    key: string;
    limit: number;
    windowMs: number;
    message: string;
  },
) {
  const result = await checkRateLimit({
    key: `${options.key}:${getClientIp(request)}`,
    limit: options.limit,
    windowMs: options.windowMs,
  });
  if (result.allowed) return null;

  const retryAfterSec = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return NextResponse.json(
    {
      error: "rate_limited",
      message: options.message,
      retryAfter: retryAfterSec,
    },
    {
      status: 429,
      headers: {
        "retry-after": String(retryAfterSec),
        "x-ratelimit-limit": String(options.limit),
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}
