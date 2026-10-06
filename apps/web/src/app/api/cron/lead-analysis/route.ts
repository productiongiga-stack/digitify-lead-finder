import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { createWorkspaceRlsClient } from "@digitify/db/src/workspace-rls";
import { isCronAuthorized } from "@digitify/api/src/lib/cron-auth";
import { claimLeadAnalysisRun, processLeadAnalysisRun } from "@digitify/api/src/lib/lead-analysis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owners = await prisma.user.findMany({ where: { workspaceOwnerId: null }, select: { id: true }, orderBy: { id: "asc" } });
  const results: Array<{ workspaceId: string; completed: number; failed: number }> = [];
  for (const owner of owners) {
    const db = createWorkspaceRlsClient(prisma, owner.id, owner.id);
    let completed = 0;
    let failed = 0;
    for (let index = 0; index < 20; index += 1) {
      const run = await claimLeadAnalysisRun(db, owner.id);
      if (!run) break;
      const result = await processLeadAnalysisRun(db, run.id);
      if (result.status === "completed") completed += 1;
      if (result.status === "failed") failed += 1;
    }
    results.push({ workspaceId: owner.id, completed, failed });
  }
  return NextResponse.json({ success: true, results });
}

export async function POST(request: Request) {
  return GET(request);
}
