import type { RateLimitResult } from "./rate-limit-bucket";

export type UpstashRestConfig = {
  url: string;
  token: string;
};

export function getUpstashRestConfig(): UpstashRestConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

async function upstashCommand(
  config: UpstashRestConfig,
  command: (string | number)[],
): Promise<unknown> {
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { result?: unknown };
  return payload.result ?? null;
}

/**
 * Fixed-window counter via Upstash REST (Edge-safe fetch only).
 */
export async function checkUpstashRateLimit(
  params: { key: string; limit: number; windowMs: number },
  config?: UpstashRestConfig | null,
): Promise<RateLimitResult | null> {
  const resolved = config ?? getUpstashRestConfig();
  if (!resolved) return null;

  const redisKey = `digitify:rl:${params.key}`;
  const now = Date.now();

  try {
    const countRaw = await upstashCommand(resolved, ["INCR", redisKey]);
    const count = typeof countRaw === "number" ? countRaw : Number(countRaw);
    if (!Number.isFinite(count) || count < 1) return null;

    if (count === 1) {
      await upstashCommand(resolved, ["PEXPIRE", redisKey, params.windowMs]);
    }

    const ttlRaw = await upstashCommand(resolved, ["PTTL", redisKey]);
    const ttlMs = typeof ttlRaw === "number" ? ttlRaw : Number(ttlRaw);
    const resetAt = ttlMs > 0 ? now + ttlMs : now + params.windowMs;

    return {
      allowed: count <= params.limit,
      remaining: Math.max(0, params.limit - count),
      resetAt,
    };
  } catch {
    return null;
  }
}
