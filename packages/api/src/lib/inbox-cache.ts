const INBOX_LIST_CACHE_TTL_MS = 60_000;
const inboxListCache = new Map<string, { expiresAt: number; value: unknown }>();

export function readInboxListCache<T>(key: string): T | null {
  const entry = inboxListCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    inboxListCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function writeInboxListCache<T>(key: string, value: T) {
  inboxListCache.set(key, {
    expiresAt: Date.now() + INBOX_LIST_CACHE_TTL_MS,
    value,
  });
}

export function invalidateInboxListCacheForWorkspace(workspaceId: string) {
  const prefix = `inbox:list:${workspaceId}:`;
  for (const key of inboxListCache.keys()) {
    if (key.startsWith(prefix)) inboxListCache.delete(key);
  }
}
