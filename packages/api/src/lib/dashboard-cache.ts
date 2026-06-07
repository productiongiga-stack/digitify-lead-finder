import { getDashboardCacheTtlMs } from "./cache-config";

const dashboardCache = new Map<string, { expiresAt: number; value: unknown }>();

function resolveTtlMs(key: string) {
  const workspaceId = key.split(":").pop();
  return getDashboardCacheTtlMs(workspaceId);
}

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
    expiresAt: Date.now() + resolveTtlMs(key),
    value,
  });
}

export function invalidateDashboardCacheForUser(userId: string) {
  const prefix = `:${userId}`;
  for (const key of dashboardCache.keys()) {
    if (key.endsWith(prefix)) dashboardCache.delete(key);
  }
}

export function clearAllDashboardCache() {
  dashboardCache.clear();
}
