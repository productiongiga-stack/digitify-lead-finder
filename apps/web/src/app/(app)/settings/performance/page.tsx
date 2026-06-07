"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { readSettingBoolean, readSettingString } from "@/lib/settings";
import { SETTINGS_PAGE_QUERY_OPTS } from "@/lib/settings-query-options";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@digitify/ui";
import { ArrowLeft, Database, RefreshCw, Save, Trash2 } from "lucide-react";
import { useToast } from "@/components/feedback/toast-provider";

function formatMs(value: number) {
  if (!Number.isFinite(value)) return "-";
  return `${Math.round(value)} ms`;
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("nl-BE");
}

function formatTrend(direction: "up" | "down" | "flat" | "na", value: number | null) {
  if (direction === "na" || value === null) return "n.v.t.";
  if (direction === "flat") return `${value}% (stabiel)`;
  return direction === "up" ? `+${value}%` : `${value}%`;
}

function CacheSettingsPanel() {
  const utils = trpc.useUtils();
  const { showToast } = useToast();
  const cacheQuery = trpc.settings.getCacheSettings.useQuery(undefined, SETTINGS_PAGE_QUERY_OPTS);
  const clearCaches = trpc.settings.clearWorkspaceCaches.useMutation({
    onSuccess: () => showToast({ title: "Caches geleegd", description: "Settings- en dashboard-cache zijn gereset." }),
  });
  const batchUpdate = trpc.settings.batchUpdate.useMutation({
    onSuccess: () => {
      utils.settings.getCacheSettings.invalidate();
      showToast({ title: "Cache-instellingen opgeslagen" });
    },
  });

  const [dashboardTtl, setDashboardTtl] = useState("5");
  const [settingsTtl, setSettingsTtl] = useState("45");
  const [clientStale, setClientStale] = useState("5");
  const [prefetchEnabled, setPrefetchEnabled] = useState(true);

  useEffect(() => {
    if (!cacheQuery.data) return;
    setDashboardTtl(readSettingString(cacheQuery.data, "cache.dashboard_ttl_minutes", "5"));
    setSettingsTtl(readSettingString(cacheQuery.data, "cache.settings_ttl_seconds", "45"));
    setClientStale(readSettingString(cacheQuery.data, "cache.client_stale_time_minutes", "5"));
    setPrefetchEnabled(readSettingBoolean(cacheQuery.data, "cache.prefetch_enabled", true));
  }, [cacheQuery.data]);

  if (cacheQuery.isLoading) return <Skeleton className="h-48 w-full" />;

  const defaults = cacheQuery.data?.defaults;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" />
            Server cache
          </CardTitle>
          <CardDescription>
            TTL voor dashboard-aggregaties en settings-bundles. Standaard: dashboard {defaults?.dashboardTtlMinutes ?? 5} min, settings {defaults?.settingsTtlSeconds ?? 45}s.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Dashboard cache (minuten)</Label>
            <Input value={dashboardTtl} onChange={(e) => setDashboardTtl(e.target.value)} type="number" min={1} max={60} />
          </div>
          <div className="space-y-2">
            <Label>Settings cache (seconden)</Label>
            <Input value={settingsTtl} onChange={(e) => setSettingsTtl(e.target.value)} type="number" min={15} max={300} />
          </div>
          <div className="space-y-2">
            <Label>Client stale-time (minuten)</Label>
            <Input value={clientStale} onChange={(e) => setClientStale(e.target.value)} type="number" min={1} max={30} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Prefetch ingeschakeld</p>
              <p className="text-xs text-muted-foreground">Navigatie vooraf laden waar mogelijk.</p>
            </div>
            <Switch checked={prefetchEnabled} onCheckedChange={setPrefetchEnabled} />
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              onClick={() =>
                batchUpdate.mutate([
                  { key: "cache.dashboard_ttl_minutes", value: dashboardTtl.trim() || "5" },
                  { key: "cache.settings_ttl_seconds", value: settingsTtl.trim() || "45" },
                  { key: "cache.client_stale_time_minutes", value: clientStale.trim() || "5" },
                  { key: "cache.prefetch_enabled", value: String(prefetchEnabled) },
                ])
              }
              disabled={batchUpdate.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              Opslaan
            </Button>
            <Button variant="outline" onClick={() => clearCaches.mutate()} disabled={clearCaches.isPending}>
              <Trash2 className="mr-2 h-4 w-4" />
              Alle caches legen
            </Button>
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Bezoekers- en tracker-instellingen staan onder{" "}
        <Link href="/settings/analytics" className="font-medium text-primary underline-offset-2 hover:underline">
          Analytics & tracking
        </Link>
        .
      </p>
    </div>
  );
}

export default function PerformanceSettingsPage() {
  const utils = trpc.useUtils();
  const { showToast } = useToast();

  const metricsQuery = trpc.settings.getPerformanceMetrics.useQuery(
    { limit: 60 },
    {
      refetchInterval: 15_000,
      refetchOnWindowFocus: false,
      retry: 1,
    }
  );

  const clearMutation = trpc.settings.clearPerformanceMetrics.useMutation({
    onSuccess: async () => {
      await utils.settings.getPerformanceMetrics.invalidate();
      showToast({
        title: "Performance metrics leeggemaakt",
        description: "Nieuwe metingen starten vanaf nu.",
      });
    },
    onError: (error) => {
      showToast({
        title: "Reset mislukt",
        description: error.message,
        variant: "error",
      });
    },
  });

  const data = metricsQuery.data;
  const topRoute = data?.routes?.[0];
  const topQuery = data?.recentSlowQueries?.[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Terug naar instellingen
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Prestaties & cache</h1>
          <p className="text-sm text-muted-foreground">
            API-latency, trage queries en cache-TTL. Alleen voor workspace owners.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => metricsQuery.refetch()}
            disabled={metricsQuery.isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${metricsQuery.isFetching ? "animate-spin" : ""}`} />
            Vernieuwen
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Metrics resetten
          </Button>
        </div>
      </div>

      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList className="settings-domain-tabs settings-domain-tabs-cols-2 w-full max-w-md">
          <TabsTrigger value="metrics" className="settings-domain-tab">API-metrics</TabsTrigger>
          <TabsTrigger value="cache" className="settings-domain-tab">Cache</TabsTrigger>
        </TabsList>

        <TabsContent value="cache" className="mt-0">
          <CacheSettingsPanel />
        </TabsContent>

        <TabsContent value="metrics" className="mt-0 space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Threshold route</CardDescription>
            <CardTitle className="text-lg">{formatMs(data?.thresholds?.slowRouteMs ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Threshold query</CardDescription>
            <CardTitle className="text-lg">{formatMs(data?.thresholds?.slowQueryMs ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Laatst geupdate</CardDescription>
            <CardTitle className="text-base">{formatDateTime(data?.generatedAt)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top trage route</CardTitle>
            <CardDescription>Hoogste p95 requesttijd</CardDescription>
          </CardHeader>
          <CardContent>
            {metricsQuery.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : topRoute ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{topRoute.type}</Badge>
                  <span className="font-medium">{topRoute.path}</span>
                </div>
                <p className="text-muted-foreground">
                  p50 {formatMs(topRoute.p50Ms)} · p95 {formatMs(topRoute.p95Ms)} · calls {topRoute.count}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nog geen metrics beschikbaar.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top trage query</CardTitle>
            <CardDescription>Langste recente database query</CardDescription>
          </CardHeader>
          <CardContent>
            {metricsQuery.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : topQuery ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{topQuery.type || "query"}</Badge>
                  <span className="font-medium">{topQuery.path || "-"}</span>
                </div>
                <p className="text-muted-foreground">
                  {formatMs(topQuery.durationMs)} · model {topQuery.model} · {formatDateTime(topQuery.at)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nog geen trage queries gelogd.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Routes</CardTitle>
          <CardDescription>Gesorteerd op hoogste p95 latency</CardDescription>
        </CardHeader>
        <CardContent>
          {metricsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Avg</TableHead>
                  <TableHead>P50</TableHead>
                  <TableHead>P95</TableHead>
                  <TableHead>Trend</TableHead>
                  <TableHead>Calls</TableHead>
                  <TableHead>Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.routes || []).map((route) => (
                  <TableRow key={`${route.type}-${route.path}`}>
                    <TableCell className="font-medium">{route.path}</TableCell>
                    <TableCell>{route.type}</TableCell>
                    <TableCell>{formatMs(route.avgMs)}</TableCell>
                    <TableCell>{formatMs(route.p50Ms)}</TableCell>
                    <TableCell>{formatMs(route.p95Ms)}</TableCell>
                    <TableCell>{formatTrend(route.trendDirection, route.trendPct)}</TableCell>
                    <TableCell>{route.count}</TableCell>
                    <TableCell>{route.errorCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Slow queries</CardTitle>
          <CardDescription>Recente database queries boven threshold</CardDescription>
        </CardHeader>
        <CardContent>
          {metricsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tijd</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Duur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.recentSlowQueries || []).map((item, index) => (
                  <TableRow key={`${item.requestId || "req"}-${item.at}-${index}`}>
                    <TableCell>{formatDateTime(item.at)}</TableCell>
                    <TableCell>{item.path || "-"}</TableCell>
                    <TableCell>{item.model}</TableCell>
                    <TableCell>{item.action}</TableCell>
                    <TableCell>{formatMs(item.durationMs)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
