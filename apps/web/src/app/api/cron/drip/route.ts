import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { runAllDueDripsWorker } from "@digitify/api/src/routers/campaign.router";
import { log } from "@digitify/api/src/lib/logger";
import { cronAuthFailureReason, isCronAuthorized } from "@digitify/api/src/lib/cron-auth";

async function runDripWorker(request: Request) {
  if (!isCronAuthorized(request)) {
    log.security.warn("Drip cron unauthorized request", { reason: cronAuthFailureReason() });
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const actor = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  try {
    log.job.info("Drip cron started", { actorId: actor?.id || null });
    const summary = await runAllDueDripsWorker(prisma, actor?.id);
    log.job.info("Drip cron completed", {
      actorId: actor?.id || null,
      sequences: summary.sequences,
      due: summary.due,
      sent: summary.sent,
      failed: summary.failed,
      stopped: summary.stopped,
    });
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    log.job.error("Drip cron failed", { actorId: actor?.id || null }, error);
    return NextResponse.json({ success: false, error: "Worker failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return runDripWorker(request);
}

export async function POST(request: Request) {
  return runDripWorker(request);
}
