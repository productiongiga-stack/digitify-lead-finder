import type { PrismaClient } from "@digitify/db";
import {
  fetchMuapiResultOnce,
  isTerminalFailure,
  isTerminalSuccess,
} from "@digitify/media-studio";
import { requireCentralCreativeKey, settleCreativeJob, settleTerminalCreativeJobs } from "./creative-credits";
import { loadUserMuapiKey } from "./muapi-key";

const STALE_AFTER_MS = 15 * 60 * 1000;
const BATCH_SIZE = 25;

export async function reconcileStaleMediaJobs(db: PrismaClient) {
  await settleTerminalCreativeJobs();
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);
  const staleJobs = await db.mediaGeneration.findMany({
    where: {
      status: { in: ["PENDING", "PROCESSING"] },
      updatedAt: { lt: cutoff },
    },
    orderBy: { updatedAt: "asc" },
    take: BATCH_SIZE,
  });

  let completed = 0;
  let failed = 0;
  let skipped = 0;

  for (const job of staleJobs) {
    if (!job.requestId) {
      await db.mediaGeneration.update({ where: {id:job.id}, data: {status:"FAILED",errorMessage:"De generatie kon niet worden gestart. Je credits worden vrijgegeven."} });
      await settleCreativeJob(job.id,false);
      failed += 1;
      continue;
    }

    let apiKey:string;
    try { apiKey = (job.metadata as Record<string, unknown> | null)?.provider === "central" ? requireCentralCreativeKey() : await loadUserMuapiKey(db, job.userId); } catch { skipped += 1; continue; }
    if (!apiKey) {
      skipped += 1;
      continue;
    }

    try {
      const result = await fetchMuapiResultOnce(apiKey, job.requestId);
      if (isTerminalFailure(result.status)) {
        await db.mediaGeneration.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            errorMessage: result.error || "Generatie mislukt",
          },
        });
        await settleCreativeJob(job.id, false);
        failed += 1;
        continue;
      }
      if (isTerminalSuccess(result.status) && result.url) {
        await db.mediaGeneration.update({
          where: { id: job.id },
          data: {
            status: "COMPLETED",
            outputUrl: result.url,
          },
        });
        await settleCreativeJob(job.id, true);
        completed += 1;
        continue;
      }
      skipped += 1;
    } catch {
      skipped += 1;
    }
  }

  return {
    scanned: staleJobs.length,
    completed,
    failed,
    skipped,
  };
}
