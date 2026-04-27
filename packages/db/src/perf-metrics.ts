type RouteMetric = {
  path: string;
  type: string;
  count: number;
  errorCount: number;
  totalMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  slowCount: number;
  lastMs: number;
  recentAvgMs: number | null;
  previousAvgMs: number | null;
  trendPct: number | null;
  trendDirection: "up" | "down" | "flat" | "na";
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
type RouteStoreInternal = Omit<RouteStore, "p50Ms" | "p95Ms" | "recentAvgMs" | "previousAvgMs" | "trendPct" | "trendDirection">;
type RouteSample = { durationMs: number; atMs: number };

const routeStore = new Map<string, RouteStoreInternal>();
const routeSamples = new Map<string, RouteSample[]>();
const slowQueries: SlowQueryMetric[] = [];

const SLOW_QUERY_THRESHOLD_MS = Number(process.env.PERF_SLOW_QUERY_MS || 350);
const SLOW_ROUTE_THRESHOLD_MS = Number(process.env.PERF_SLOW_ROUTE_MS || 800);
const MAX_SLOW_QUERIES = 200;
const MAX_ROUTE_SAMPLES_PER_KEY = 400;
const TREND_WINDOW_MS = 5 * 60 * 1000;

function routeKey(path: string, type: string) {
  return `${type}:${path}`;
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getRouteTrend(samples: RouteSample[]) {
  const now = Date.now();
  const recentFrom = now - TREND_WINDOW_MS;
  const previousFrom = now - TREND_WINDOW_MS * 2;

  const recent = samples.filter((sample) => sample.atMs >= recentFrom).map((sample) => sample.durationMs);
  const previous = samples
    .filter((sample) => sample.atMs >= previousFrom && sample.atMs < recentFrom)
    .map((sample) => sample.durationMs);

  if (recent.length === 0 || previous.length === 0) {
    return {
      recentAvgMs: recent.length ? Number(average(recent).toFixed(2)) : null,
      previousAvgMs: previous.length ? Number(average(previous).toFixed(2)) : null,
      trendPct: null,
      trendDirection: "na" as const,
    };
  }

  const recentAvgMs = average(recent);
  const previousAvgMs = average(previous);
  const deltaPct = previousAvgMs > 0 ? ((recentAvgMs - previousAvgMs) / previousAvgMs) * 100 : 0;
  const normalizedDelta = Number(deltaPct.toFixed(2));
  const trendDirection: RouteMetric["trendDirection"] =
    Math.abs(normalizedDelta) < 3 ? "flat" : normalizedDelta > 0 ? "up" : "down";

  return {
    recentAvgMs: Number(recentAvgMs.toFixed(2)),
    previousAvgMs: Number(previousAvgMs.toFixed(2)),
    trendPct: normalizedDelta,
    trendDirection,
  };
}

export function recordRouteMetric(input: {
  path: string;
  type: string;
  durationMs: number;
  ok: boolean;
}) {
  const key = routeKey(input.path, input.type);
  const now = Date.now();
  const existing = routeStore.get(key);
  const next: RouteStoreInternal = existing
    ? {
        ...existing,
        count: existing.count + 1,
        errorCount: existing.errorCount + (input.ok ? 0 : 1),
        totalMs: existing.totalMs + input.durationMs,
        maxMs: Math.max(existing.maxMs, input.durationMs),
        slowCount: existing.slowCount + (input.durationMs >= SLOW_ROUTE_THRESHOLD_MS ? 1 : 0),
        lastMs: input.durationMs,
        lastSeenMs: now,
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
        lastSeenMs: now,
      };
  routeStore.set(key, next);

  const samples = routeSamples.get(key) ?? [];
  samples.push({ durationMs: input.durationMs, atMs: now });
  if (samples.length > MAX_ROUTE_SAMPLES_PER_KEY) {
    samples.splice(0, samples.length - MAX_ROUTE_SAMPLES_PER_KEY);
  }
  routeSamples.set(key, samples);
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
      p50Ms: Number(percentile((routeSamples.get(routeKey(item.path, item.type)) ?? []).map((sample) => sample.durationMs), 50).toFixed(2)),
      p95Ms: Number(percentile((routeSamples.get(routeKey(item.path, item.type)) ?? []).map((sample) => sample.durationMs), 95).toFixed(2)),
      ...getRouteTrend(routeSamples.get(routeKey(item.path, item.type)) ?? []),
      lastSeenAt: new Date(item.lastSeenMs).toISOString(),
    }))
    .sort((a, b) => b.p95Ms - a.p95Ms)
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
  routeSamples.clear();
  slowQueries.length = 0;
}
