const DASHBOARD_CACHE_TTL_MS = 20_000;
const dashboardCache = new Map<string, { expiresAt: number; value: unknown }>();

export function readDashboardCache<T>(key: string): T | null {
  const entry = dashboardCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    dashboardCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function writeDashboardCache<T>(key: string, value: T) {
  dashboardCache.set(key, {
    expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
    value,
  });
}

export function invalidateDashboardCacheForUser(userId: string) {
  const prefix = `:${userId}`;
  for (const key of dashboardCache.keys()) {
    if (key.endsWith(prefix)) dashboardCache.delete(key);
  }
}
