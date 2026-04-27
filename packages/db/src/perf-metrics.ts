type RouteMetric = {
  path: string;
  type: string;
  count: number;
  errorCount: number;
  totalMs: number;
  avgMs: number;
  maxMs: number;
  slowCount: number;
  lastMs: number;
  lastSeenAt: string;
};

type SlowQueryMetric = {
  at: string;
  requestId?: string;
  userId?: string;
  path?: string;
  type?: string;
  model: string;
  action: string;
  durationMs: number;
};

type RouteStore = Omit<RouteMetric, "avgMs" | "lastSeenAt"> & { lastSeenMs: number };

const routeStore = new Map<string, RouteStore>();
const slowQueries: SlowQueryMetric[] = [];

const SLOW_QUERY_THRESHOLD_MS = Number(process.env.PERF_SLOW_QUERY_MS || 350);
const SLOW_ROUTE_THRESHOLD_MS = Number(process.env.PERF_SLOW_ROUTE_MS || 800);
const MAX_SLOW_QUERIES = 200;

function routeKey(path: string, type: string) {
  return `${type}:${path}`;
}

export function recordRouteMetric(input: {
  path: string;
  type: string;
  durationMs: number;
  ok: boolean;
}) {
  const key = routeKey(input.path, input.type);
  const existing = routeStore.get(key);
  const next: RouteStore = existing
    ? {
        ...existing,
        count: existing.count + 1,
        errorCount: existing.errorCount + (input.ok ? 0 : 1),
        totalMs: existing.totalMs + input.durationMs,
        maxMs: Math.max(existing.maxMs, input.durationMs),
        slowCount: existing.slowCount + (input.durationMs >= SLOW_ROUTE_THRESHOLD_MS ? 1 : 0),
        lastMs: input.durationMs,
        lastSeenMs: Date.now(),
      }
    : {
        path: input.path,
        type: input.type,
        count: 1,
        errorCount: input.ok ? 0 : 1,
        totalMs: input.durationMs,
        maxMs: input.durationMs,
        slowCount: input.durationMs >= SLOW_ROUTE_THRESHOLD_MS ? 1 : 0,
        lastMs: input.durationMs,
        lastSeenMs: Date.now(),
      };
  routeStore.set(key, next);
}

export function recordSlowQuery(input: {
  requestId?: string;
  userId?: string;
  path?: string;
  type?: string;
  model: string;
  action: string;
  durationMs: number;
}) {
  if (input.durationMs < SLOW_QUERY_THRESHOLD_MS) return;
  slowQueries.push({
    at: new Date().toISOString(),
    requestId: input.requestId,
    userId: input.userId,
    path: input.path,
    type: input.type,
    model: input.model,
    action: input.action,
    durationMs: input.durationMs,
  });
  if (slowQueries.length > MAX_SLOW_QUERIES) {
    slowQueries.splice(0, slowQueries.length - MAX_SLOW_QUERIES);
  }
}

export function getPerformanceSnapshot(limit = 50) {
  const routes = Array.from(routeStore.values())
    .map<RouteMetric>((item) => ({
      ...item,
      avgMs: item.count > 0 ? Number((item.totalMs / item.count).toFixed(2)) : 0,
      lastSeenAt: new Date(item.lastSeenMs).toISOString(),
    }))
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, Math.max(1, limit));

  const recentSlowQueries = [...slowQueries]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, Math.max(1, limit));

  return {
    generatedAt: new Date().toISOString(),
    thresholds: {
      slowRouteMs: SLOW_ROUTE_THRESHOLD_MS,
      slowQueryMs: SLOW_QUERY_THRESHOLD_MS,
    },
    routes,
    recentSlowQueries,
  };
}

export function clearPerformanceSnapshot() {
  routeStore.clear();
  slowQueries.length = 0;
}
