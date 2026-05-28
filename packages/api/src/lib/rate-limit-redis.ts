import type { RateLimitResult } from "./rate-limit-bucket";

type RedisClient = {
  incr(key: string): Promise<number>;
  pExpire(key: string, ms: number): Promise<boolean>;
  pTTL(key: string): Promise<number>;
  connect(): Promise<unknown>;
  on(event: "error", listener: (error: unknown) => void): void;
};

let clientPromise: Promise<RedisClient | null> | null = null;
let connectFailed = false;

async function getRedisClient(url: string): Promise<RedisClient | null> {
  if (connectFailed) return null;
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const { createClient } = await import("redis");
        const client = createClient({ url }) as RedisClient;
        client.on("error", () => {});
        await client.connect();
        return client;
      } catch {
        connectFailed = true;
        return null;
      }
    })();
  }
  return clientPromise;
}

export async function checkRedisRateLimit(
  url: string,
  params: { key: string; limit: number; windowMs: number },
): Promise<RateLimitResult | null> {
  const client = await getRedisClient(url);
  if (!client) return null;

  const redisKey = `digitify:rl:${params.key}`;
  const now = Date.now();

  try {
    const count = await client.incr(redisKey);
    if (count === 1) {
      await client.pExpire(redisKey, params.windowMs);
    }
    const ttlMs = await client.pTTL(redisKey);
    const resetAt = ttlMs > 0 ? now + ttlMs : now + params.windowMs;
    return {
      allowed: count <= params.limit,
      remaining: Math.max(0, params.limit - count),
      resetAt,
    };
  } catch {
    connectFailed = true;
    clientPromise = null;
    return null;
  }
}

/** Reset cached client (tests). */
export function resetRedisRateLimitClient() {
  connectFailed = false;
  clientPromise = null;
}
