/**
 * Tiny in-memory rate-limit bucket store.
 *
 * Pure JS — no Prisma, no Node-only APIs — so it is safe to import from the
 * Edge runtime (Next.js middleware) as well as the Node server.
 *
 * Buckets are keyed by an arbitrary string (typically `${rule}:${ip}` or
 * `${rule}:${userId}`). Each bucket has a count and a reset timestamp.
 *
 * Limitations:
 *  - Per-process. Server routes use `rate-limit.ts` (Redis when REDIS_URL is set).
 *    Edge middleware imports this module directly for sync in-memory limits.
 *  - No bounded memory. The check() function opportunistically prunes expired
 *    buckets every call; that's enough at typical request rates.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface BucketStore {
  check(params: { key: string; limit: number; windowMs: number; now?: number }): RateLimitResult;
  /** Number of live buckets (testing aid). */
  size(): number;
  /** Reset all buckets (testing aid). */
  reset(): void;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createBucketStore(): BucketStore {
  const store = new Map<string, Bucket>();

  return {
    check({ key, limit, windowMs, now: nowOverride }) {
      const now = nowOverride ?? Date.now();

      // Opportunistic GC of expired buckets — bounded by the number of
      // buckets we've ever created. Cheap at typical traffic levels.
      for (const [k, b] of store.entries()) {
        if (b.resetAt <= now) store.delete(k);
      }

      const existing = store.get(key);
      if (!existing || existing.resetAt <= now) {
        const resetAt = now + windowMs;
        store.set(key, { count: 1, resetAt });
        return { allowed: true, remaining: Math.max(0, limit - 1), resetAt };
      }

      if (existing.count >= limit) {
        return { allowed: false, remaining: 0, resetAt: existing.resetAt };
      }

      existing.count += 1;
      store.set(key, existing);
      return {
        allowed: true,
        remaining: Math.max(0, limit - existing.count),
        resetAt: existing.resetAt,
      };
    },
    size() {
      return store.size;
    },
    reset() {
      store.clear();
    },
  };
}

// A shared default store. Most callers use this; tests instantiate their own.
const defaultStore = createBucketStore();

export function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  return defaultStore.check(params);
}
