/**
 * Distributed rate limits for Edge middleware and Node route handlers.
 * Sync in-memory fallback is exported for tests only.
 */
export { checkRateLimitDistributed as checkRateLimit } from "@digitify/api/src/lib/rate-limit-distributed";
export { getUpstashRestConfig } from "@digitify/api/src/lib/rate-limit-upstash";
export {
  checkRateLimit as checkRateLimitSync,
  createBucketStore,
} from "@digitify/api/src/lib/rate-limit-bucket";
export type { RateLimitResult, BucketStore } from "@digitify/api/src/lib/rate-limit-bucket";
