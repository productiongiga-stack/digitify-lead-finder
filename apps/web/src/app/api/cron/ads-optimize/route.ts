import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { createWorkspaceRlsClient } from "@digitify/db/src/workspace-rls";
import { isCronAuthorized } from "@digitify/api/src/lib/cron-auth";
import { enqueueAdsJobs, processAdsJobs } from "@digitify/api/src/lib/ads-background-jobs";
import { safeAdError } from "@digitify/api/src/lib/ads-workflow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owners = await prisma.user.findMany({ where: { workspaceOwnerId: null }, select: { id: true }, orderBy: { id: "asc" } });
  const results: Array<{ workspaceId: string; jobs?: Array<{ id: string; status: string }>; error?: string }> = [];
  const deadline = Date.now() + 240000;
  for (const owner of owners) {
    if (Date.now() + 60000 > deadline) break;
    const db = createWorkspaceRlsClient(prisma, owner.id, owner.id);
    try {
      for (const provider of ["GOOGLE", "META"] as const) await enqueueAdsJobs(db, owner.id, provider);
      results.push({ workspaceId: owner.id, jobs: await processAdsJobs(db, owner.id, deadline) });
    } catch (error) { results.push({ workspaceId: owner.id, error: safeAdError(error) }); }
  }
  return NextResponse.json({ results });
}
