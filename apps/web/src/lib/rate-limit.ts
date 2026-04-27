/**
 * Re-exports the shared in-memory rate-limit bucket from @digitify/api.
 *
 * The implementation is dependency-free (no Prisma, no Node-only APIs), so it
 * is safe to import from Edge middleware as well as Node API routes.
 */
export { checkRateLimit, createBucketStore } from "@digitify/api/src/lib/rate-limit-bucket";
export type { RateLimitResult, BucketStore } from "@digitify/api/src/lib/rate-limit-bucket";
