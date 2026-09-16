import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { probeRedis, probeUpstashRest } from "@digitify/api/src/lib/health-probes";
import { getUpstashRestConfig } from "@digitify/api/src/lib/rate-limit-upstash";

export const dynamic = "force-dynamic";

async function checkRedis(): Promise<"ok" | "skipped" | "error"> {
  const url = process.env.REDIS_URL?.trim();
  if (url) return probeRedis(url);

  const upstash = getUpstashRestConfig();
  if (upstash) return probeUpstashRest(upstash);

  return "skipped";
}

/**
 * Liveness/readiness probe for load balancers and uptime monitors.
 * Does not require authentication.
 */
export async function GET() {
  const started = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const redis = await checkRedis();
    const degraded = redis === "error";

    return NextResponse.json(
      {
        status: degraded ? "degraded" : "ok",
        db: "ok",
        redis,
        latencyMs: Date.now() - started,
        ts: new Date().toISOString(),
      },
      degraded ? { status: 503 } : undefined,
    );
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        db: "error",
        redis: "skipped",
        latencyMs: Date.now() - started,
        message: "database unreachable",
      },
      { status: 503 },
    );
  }
}
