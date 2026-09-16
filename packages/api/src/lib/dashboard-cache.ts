import { getDashboardCacheTtlMs } from "./cache-config";

const dashboardCache = new Map<string, { expiresAt: number; value: unknown }>();
const pendingDashboardLoads = new Map<string, Promise<unknown>>();

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

/**
 * Coalesce concurrent cache misses within one runtime instance. This avoids
 * running the same workspace dashboard queries repeatedly during SSR/client
 * hydration without sharing tenant data between workspaces.
 */
export async function getOrLoadDashboardCache<T>(
  key: string,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = readDashboardCache<T>(key);
  if (cached !== null) return cached;

  const pending = pendingDashboardLoads.get(key);
  if (pending) return pending as Promise<T>;

  const load = loader()
    .then((value) => {
      // A mutation may invalidate this key while the query is still running.
      // Do not repopulate the cache with that stale in-flight result.
      if (pendingDashboardLoads.get(key) === load) writeDashboardCache(key, value);
      return value;
    })
    .finally(() => {
      if (pendingDashboardLoads.get(key) === load) pendingDashboardLoads.delete(key);
    });

  pendingDashboardLoads.set(key, load);
  return load;
}

export function invalidateDashboardCacheForUser(userId: string) {
  const prefix = `:${userId}`;
  for (const key of dashboardCache.keys()) {
    if (key.endsWith(prefix)) dashboardCache.delete(key);
  }
  for (const key of pendingDashboardLoads.keys()) {
    if (key.endsWith(prefix)) pendingDashboardLoads.delete(key);
  }
}

export function clearAllDashboardCache() {
  dashboardCache.clear();
  pendingDashboardLoads.clear();
}
