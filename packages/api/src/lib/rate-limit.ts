import { TRPCError } from "@trpc/server";
import { createBucketStore, type RateLimitResult } from "./rate-limit-bucket";
import { checkRateLimitDistributed } from "./rate-limit-distributed";

export type { RateLimitResult, BucketStore } from "./rate-limit-bucket";
export { createBucketStore } from "./rate-limit-bucket";
export { checkRateLimitDistributed } from "./rate-limit-distributed";
export { getUpstashRestConfig } from "./rate-limit-upstash";

/** Node/tRPC: Upstash REST → Redis TCP → in-memory */
export async function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  return checkRateLimitDistributed(params);
}

export async function enforceRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
  message?: string;
}) {
  const result = await checkRateLimit(params);
  if (!result.allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: params.message ?? "Te veel verzoeken. Probeer het over een moment opnieuw.",
    });
  }
  return result;
}
