import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { runAllDueDripsWorker } from "@digitify/api/src/routers/campaign.router";

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
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const actor = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const summary = await runAllDueDripsWorker(prisma, actor?.id);
  return NextResponse.json({ success: true, ...summary });
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return runDripWorker(request);
}

export async function POST(request: Request) {
  return runDripWorker(request);
}
