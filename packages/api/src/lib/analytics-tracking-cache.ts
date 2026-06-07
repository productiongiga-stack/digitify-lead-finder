const TRACKING_CACHE_TTL_MS = 5 * 60_000;

const trackingCache = new Map<string, { expiresAt: number; value: boolean }>();

export function readAnalyticsTrackingCache(workspaceId: string): boolean | null {
  const entry = trackingCache.get(workspaceId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    trackingCache.delete(workspaceId);
    return null;
  }
  return entry.value;
}

export function writeAnalyticsTrackingCache(workspaceId: string, value: boolean) {
  trackingCache.set(workspaceId, {
    expiresAt: Date.now() + TRACKING_CACHE_TTL_MS,
    value,
  });
}

export function invalidateAnalyticsTrackingCache(workspaceId: string) {
  trackingCache.delete(workspaceId);
}
