import { checkRateLimit as checkMemoryRateLimit } from "./rate-limit-bucket";
import type { RateLimitResult } from "./rate-limit-bucket";
import { checkRedisRateLimit } from "./rate-limit-redis";
import { checkUpstashRateLimit, getUpstashRestConfig } from "./rate-limit-upstash";

function isNodeRuntime() {
  return typeof process !== "undefined" && process.env.NEXT_RUNTIME !== "edge";
}

/**
 * Rate limit with best available backend:
 * 1. Upstash REST (Edge + Node) when UPSTASH_REDIS_REST_* is set
 * 2. Redis TCP (Node only) when REDIS_URL is set
 * 3. In-memory fallback (single instance / dev)
 */
export async function checkRateLimitDistributed(params: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const upstash = getUpstashRestConfig();
  if (upstash) {
    const upstashResult = await checkUpstashRateLimit(params, upstash);
    if (upstashResult) return upstashResult;
  }

  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl && isNodeRuntime()) {
    const redisResult = await checkRedisRateLimit(redisUrl, params);
    if (redisResult) return redisResult;
  }

  return checkMemoryRateLimit(params);
}
