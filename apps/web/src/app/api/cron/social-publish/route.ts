import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { runDueSocialPostsWorker } from "@digitify/api/src/routers/social.router";
import { log } from "@digitify/api/src/lib/logger";
import { cronAuthFailureReason, isCronAuthorized } from "@digitify/api/src/lib/cron-auth";

async function runSocialPublishWorker(request: Request) {
  if (!isCronAuthorized(request)) {
    log.security.warn("Social publish cron unauthorized request", { reason: cronAuthFailureReason() });
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    log.job.info("Social publish cron started");
    const summary = await runDueSocialPostsWorker(prisma);
    log.job.info("Social publish cron completed", summary);
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    log.job.error("Social publish cron failed", {}, error);
    return NextResponse.json({ success: false, error: "Worker failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return runSocialPublishWorker(request);
}

export async function POST(request: Request) {
  return runSocialPublishWorker(request);
}
