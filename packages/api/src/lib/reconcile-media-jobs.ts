import type { PrismaClient } from "@digitify/db";
import {
  fetchMuapiResultOnce,
  isTerminalFailure,
  isTerminalSuccess,
} from "@digitify/media-studio";
import { loadUserMuapiKey } from "./muapi-key";

const STALE_AFTER_MS = 15 * 60 * 1000;
const BATCH_SIZE = 25;

export async function reconcileStaleMediaJobs(db: PrismaClient) {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);
  const staleJobs = await db.mediaGeneration.findMany({
    where: {
      status: { in: ["PENDING", "PROCESSING"] },
      updatedAt: { lt: cutoff },
      requestId: { not: null },
    },
    orderBy: { updatedAt: "asc" },
    take: BATCH_SIZE,
  });

  let completed = 0;
  let failed = 0;
  let skipped = 0;

  for (const job of staleJobs) {
    if (!job.requestId) {
      skipped += 1;
      continue;
    }

    const apiKey = await loadUserMuapiKey(db, job.userId);
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
