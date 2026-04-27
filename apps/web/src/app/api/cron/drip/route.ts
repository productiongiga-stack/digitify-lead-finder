import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { runAllDueDripsWorker } from "@digitify/api/src/routers/campaign.router";
import { log } from "@digitify/api/src/lib/logger";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";

  if (cronSecret) {
    return bearerToken.length > 0 && bearerToken === cronSecret;
  }

  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return isVercelCron;
}

async function runDripWorker(request: Request) {
  if (!isAuthorized(request)) {
    log.security.warn("Drip cron unauthorized request");
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
