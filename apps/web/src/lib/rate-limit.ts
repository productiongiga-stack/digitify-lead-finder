type Bucket = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Bucket>();

export function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();

  for (const [entryKey, bucket] of store.entries()) {
    if (bucket.resetAt <= now) store.delete(entryKey);
  }

  const bucket = store.get(params.key);
  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + params.windowMs;
    store.set(params.key, { count: 1, resetAt });
    return { allowed: true, remaining: Math.max(0, params.limit - 1), resetAt };
  }

  if (bucket.count >= params.limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  store.set(params.key, bucket);
  return { allowed: true, remaining: Math.max(0, params.limit - bucket.count), resetAt: bucket.resetAt };
}
