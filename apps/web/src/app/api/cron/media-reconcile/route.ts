import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { cronAuthFailureReason, isCronAuthorized } from "@digitify/api/src/lib/cron-auth";
import { reconcileStaleMediaJobs } from "@digitify/api/src/lib/reconcile-media-jobs";
import { log } from "@digitify/api/src/lib/logger";

async function runMediaReconcile(request: Request) {
  if (!isCronAuthorized(request)) {
    log.security.warn("Media reconcile cron unauthorized request", { reason: cronAuthFailureReason() });
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    log.job.info("Media reconcile cron started");
    const summary = await reconcileStaleMediaJobs(prisma);
    log.job.info("Media reconcile cron completed", summary);
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    log.job.error("Media reconcile cron failed", {}, error);
    return NextResponse.json({ success: false, error: "Worker failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return runMediaReconcile(request);
}

export async function POST(request: Request) {
  return runMediaReconcile(request);
}
