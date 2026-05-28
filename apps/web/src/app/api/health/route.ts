import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { probeRedis } from "@digitify/api/src/lib/health-probes";

export const dynamic = "force-dynamic";

async function checkRedis(): Promise<"ok" | "skipped" | "error"> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return "skipped";
  return probeRedis(url);
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
  } catch (error) {
    return NextResponse.json(
      {
        status: "degraded",
        db: "error",
        redis: "skipped",
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : "database unreachable",
      },
      { status: 503 },
    );
  }
}
