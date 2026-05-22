import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";

export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe for load balancers and uptime monitors.
 * Does not require authentication.
 */
export async function GET() {
  const started = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      db: "ok",
      latencyMs: Date.now() - started,
      ts: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "degraded",
        db: "error",
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : "database unreachable",
      },
      { status: 503 },
    );
  }
}
