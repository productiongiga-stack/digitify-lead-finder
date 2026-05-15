"use client";

/**
 * Booking Analytics Dashboard
 * ----------------------------
 * Visualises booking statistics for a selectable rolling window (7/14/30/90 days).
 * All charts are pure CSS/Tailwind — no external chart library is used.
 *
 * Sections:
 *  1. Page header  — back link, title, window selector, CSV export button
 *  2. KPI cards    — totals, trend, confirmation %, conversion %, no-show %
 *  3. Drukte per weekdag  — horizontal bar chart (7 days)
 *  4. Drukte per uur      — vertical bar chart (0-23h, sparse)
 *  5. Verdeling per status — coloured pill list
 *  6. Top boekingstypes   — name + proportional bar + count
 */

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Skeleton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@digitify/ui";
import {
  ArrowLeft,
  BarChart3,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarCheck,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  XCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WindowDays = 7 | 14 | 30 | 90;

/** Colour tokens for each booking status. */
const STATUS_COLORS: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  PENDING: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-400",
    label: "In Afwachting",
  },
  CONFIRMED: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
    label: "Bevestigd",
  },
  SCHEDULED: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
    label: "Gepland",
  },
  COMPLETED: {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-400",
    label: "Voltooid",
  },
  CANCELLED: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    label: "Geannuleerd",
  },
  REJECTED: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    label: "Afgewezen",
  },
  NO_SHOW: {
    bg: "bg-slate-100 dark:bg-slate-800/60",
    text: "text-slate-600 dark:text-slate-400",
    label: "Niet Verschenen",
  },
};

// ---------------------------------------------------------------------------
// Helper: format a ratio (0-1) as a percentage string
// ---------------------------------------------------------------------------
function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// ---------------------------------------------------------------------------
// Sub-component: skeleton placeholder while data loads
// ---------------------------------------------------------------------------
function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: empty-state inside a card
// ---------------------------------------------------------------------------
function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-xl border border-dashed">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function BookingAnalyticsPage() {
  const [windowDays, setWindowDays] = useState<WindowDays>(30);

  const { data, isLoading } = trpc.booking.getAnalyticsSummary.useQuery({
    windowDays,
  });

  // ------------------------------------------------------------------
  // Derived values used across sections
  // ------------------------------------------------------------------
  const maxDayCount = data
    ? Math.max(...data.byDayOfWeek.map((d) => d.count), 1)
    : 1;

  const maxHourCount = data
    ? Math.max(...data.byHour.map((h) => h.count), 1)
    : 1;

  // Build a full 0-23 hour map for the vertical bar chart
  const hourMap: Record<number, number> = {};
  if (data) {
    for (const { hour, count } of data.byHour) {
      hourMap[hour] = count;
    }
  }

  const maxEventTypeCount = data?.topEventTypes.length
    ? Math.max(...data.topEventTypes.map((e) => e.count), 1)
    : 1;

  // Status entries sorted descending by count
  const statusEntries = data
    ? Object.entries(data.byStatus).sort((a, b) => b[1] - a[1])
    : [];

  const totalStatusCount = statusEntries.reduce((s, [, c]) => s + c, 0);

  // Trend direction helpers
  const trendChange = data?.trend.changePercent ?? 0;
  const TrendIcon =
    trendChange > 0
      ? ArrowUpRight
      : trendChange < 0
        ? ArrowDownRight
        : Minus;
  const trendColor =
    trendChange > 0
      ? "text-emerald-600"
      : trendChange < 0
        ? "text-red-500"
        : "text-muted-foreground";

  return (
    <div className="app-page">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Page header                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="app-page-header">
        <div className="flex items-start gap-4">
          {/* Back link */}
          <Link
            href="/bookings"
            className="mt-1 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Boekingen
          </Link>

          <div className="app-page-heading">
            <h1 className="app-page-title flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Booking Analytics
            </h1>
            <p className="app-page-subtitle">
              Inzichten over je boekingen
            </p>
          </div>
        </div>

        {/* Right-side controls */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Window selector */}
          <Select
            value={String(windowDays)}
            onValueChange={(v) => setWindowDays(Number(v) as WindowDays)}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Laatste 7 dagen</SelectItem>
              <SelectItem value="14">Laatste 14 dagen</SelectItem>
              <SelectItem value="30">Laatste 30 dagen</SelectItem>
              <SelectItem value="90">Laatste 90 dagen</SelectItem>
            </SelectContent>
          </Select>

          {/* CSV export */}
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/bookings/export?days=${windowDays}`} download>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </a>
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Loading state                                                        */}
      {/* ------------------------------------------------------------------ */}
      {isLoading && <AnalyticsSkeleton />}

      {/* ------------------------------------------------------------------ */}
      {/* Data sections — only rendered once data arrives                      */}
      {/* ------------------------------------------------------------------ */}
      {!isLoading && data && (
        <div className="space-y-6">
          {/* ---------------------------------------------------------------- */}
          {/* 2. KPI cards (5 cards: 2×2 on mobile, 5 cols on lg)              */}
          {/* ---------------------------------------------------------------- */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            {/* Total boekingen */}
            <Card className="col-span-2 lg:col-span-1">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Totaal
                  </p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <p className="mt-3 text-3xl font-bold">{data.totalInWindow}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  boekingen in {windowDays} dagen
                </p>
              </CardContent>
            </Card>

            {/* Trend card */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Trend
                  </p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <TrendIcon className={`h-4 w-4 ${trendColor}`} />
                  </div>
                </div>
                <p className={`mt-3 text-3xl font-bold ${trendColor}`}>
                  {trendChange > 0 ? "+" : ""}
                  {Math.round(trendChange)}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.trend.current} nu vs {data.trend.previous} vorige periode
                </p>
              </CardContent>
            </Card>

            {/* Bevestigingsratio */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Bevestigd
                  </p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                    <CalendarCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <p className="mt-3 text-3xl font-bold">
                  {pct(data.confirmationRate)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  bevestigingsratio
                </p>
              </CardContent>
            </Card>

            {/* Conversieratio */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Conversie
                  </p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                    <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <p className="mt-3 text-3xl font-bold">
                  {pct(data.conversionRate)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  conversieratio
                </p>
              </CardContent>
            </Card>

            {/* No-show ratio */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    No-show
                  </p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                    <XCircle className="h-4 w-4 text-slate-500" />
                  </div>
                </div>
                <p className="mt-3 text-3xl font-bold">
                  {pct(data.noShowRate)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  no-show ratio
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Avg duration — inline highlight below KPIs                        */}
          {/* ---------------------------------------------------------------- */}
          <div className="flex items-center gap-2 rounded-2xl border bg-muted/30 px-4 py-2.5">
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Gemiddelde duur:{" "}
              <span className="font-semibold text-foreground">
                {Math.round(data.avgDurationMinutes)} min
              </span>
            </p>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* 3 & 4. Day-of-week + Hourly charts side by side on xl            */}
          {/* ---------------------------------------------------------------- */}
          <div className="grid gap-4 xl:grid-cols-2">
            {/* ----- 3. Drukte per weekdag (horizontal bars) ----- */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Drukte per weekdag</CardTitle>
                <CardDescription>
                  Aantal boekingen per dag van de week
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-1">
                {data.byDayOfWeek.length === 0 ? (
                  <EmptyChartState message="Geen weekdag-data beschikbaar." />
                ) : (
                  data.byDayOfWeek.map(({ day, label, count }) => {
                    const widthPct =
                      maxDayCount > 0
                        ? Math.max((count / maxDayCount) * 100, count > 0 ? 2 : 0)
                        : 0;
                    return (
                      <div key={day} className="flex items-center gap-3">
                        {/* Day label — fixed width so bars align */}
                        <span className="w-8 shrink-0 text-right text-xs font-medium text-muted-foreground">
                          {label}
                        </span>

                        {/* Bar track */}
                        <div className="relative h-7 flex-1 overflow-hidden rounded-full bg-muted/50">
                          <div
                            className="absolute inset-y-0 left-0 h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>

                        {/* Count */}
                        <span className="w-8 shrink-0 text-xs font-semibold tabular-nums text-foreground">
                          {count}
                        </span>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* ----- 4. Drukte per uur (vertical bars) ----- */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Drukte per uur</CardTitle>
                <CardDescription>
                  Verdeling van boekingen over het uur van de dag
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-1">
                {data.byHour.length === 0 ? (
                  <EmptyChartState message="Geen uur-data beschikbaar." />
                ) : (
                  /* Fixed-height container — bars grow from bottom up */
                  <div className="flex h-24 items-end gap-0.5">
                    {Array.from({ length: 24 }, (_, hour) => {
                      const count = hourMap[hour] ?? 0;
                      const heightPct =
                        maxHourCount > 0
                          ? Math.max(
                              (count / maxHourCount) * 100,
                              count > 0 ? 4 : 0,
                            )
                          : 0;
                      return (
                        <div
                          key={hour}
                          className="group relative flex flex-1 flex-col items-center justify-end"
                          title={`${hour}u: ${count}`}
                        >
                          {/* Bar */}
                          <div
                            className="w-full rounded-t-sm transition-all duration-500"
                            style={{
                              height: `${heightPct}%`,
                              backgroundColor:
                                count > 0
                                  ? "hsl(var(--primary))"
                                  : "transparent",
                              opacity: count > 0 ? 1 : 0,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Hour axis labels — show every 3 hours to avoid crowding */}
                {data.byHour.length > 0 && (
                  <div className="mt-1 flex">
                    {Array.from({ length: 24 }, (_, hour) => (
                      <div key={hour} className="flex flex-1 justify-center">
                        {hour % 3 === 0 ? (
                          <span className="text-[9px] text-muted-foreground">
                            {hour}u
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* 5 & 6. Status + Top event types side by side on xl               */}
          {/* ---------------------------------------------------------------- */}
          <div className="grid gap-4 xl:grid-cols-2">
            {/* ----- 5. Verdeling per status ----- */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Verdeling per status
                </CardTitle>
                <CardDescription>
                  Aantal boekingen per statustype
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-1">
                {statusEntries.length === 0 ? (
                  <EmptyChartState message="Geen statusdata beschikbaar." />
                ) : (
                  <div className="space-y-3">
                    {/* Stacked proportion bar */}
                    {totalStatusCount > 0 && (
                      <div className="flex h-3 overflow-hidden rounded-full">
                        {statusEntries.map(([status, count]) => {
                          const colors = STATUS_COLORS[status];
                          const widthPct = (count / totalStatusCount) * 100;
                          // Convert the bg class to an inline color for the proportion bar
                          const colorMap: Record<string, string> = {
                            PENDING: "#f59e0b",
                            CONFIRMED: "#3b82f6",
                            SCHEDULED: "#60a5fa",
                            COMPLETED: "#10b981",
                            CANCELLED: "#ef4444",
                            REJECTED: "#f87171",
                            NO_SHOW: "#94a3b8",
                          };
                          return (
                            <div
                              key={status}
                              className="h-full transition-all duration-500"
                              style={{
                                width: `${widthPct}%`,
                                backgroundColor:
                                  colorMap[status] ?? "#94a3b8",
                              }}
                              title={`${colors?.label ?? status}: ${count}`}
                            />
                          );
                        })}
                      </div>
                    )}

                    {/* List rows */}
                    <div className="space-y-1.5">
                      {statusEntries.map(([status, count]) => {
                        const colors =
                          STATUS_COLORS[status] ?? {
                            bg: "bg-muted",
                            text: "text-muted-foreground",
                            label: status,
                          };
                        return (
                          <div
                            key={status}
                            className="flex items-center justify-between gap-3"
                          >
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
                            >
                              {colors.label}
                            </span>
                            <span className="text-sm font-semibold tabular-nums">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ----- 6. Top boekingstypes ----- */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top boekingstypes</CardTitle>
                <CardDescription>
                  Meest gebruikte evenementtypes in de geselecteerde periode
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-1">
                {data.topEventTypes.length === 0 ? (
                  <EmptyChartState message="Geen boekingstypes gevonden voor deze periode." />
                ) : (
                  <div className="space-y-3">
                    {data.topEventTypes.map(({ id, name, count }) => {
                      const widthPct =
                        maxEventTypeCount > 0
                          ? Math.max(
                              (count / maxEventTypeCount) * 100,
                              count > 0 ? 2 : 0,
                            )
                          : 0;
                      return (
                        <div key={id} className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="truncate text-sm font-medium"
                              title={name}
                            >
                              {name}
                            </span>
                            <span className="shrink-0 text-sm font-bold tabular-nums">
                              {count}
                            </span>
                          </div>
                          {/* Proportional bar */}
                          <div className="h-2 overflow-hidden rounded-full bg-muted/50">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-500"
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Empty state when data is loaded but completely empty                 */}
      {/* ------------------------------------------------------------------ */}
      {!isLoading && !data && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-20 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            Geen analyticsdata beschikbaar
          </p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Er zijn nog geen boekingen in de geselecteerde periode. Kies een
            langere periode of wacht tot er boekingen binnenkomen.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/bookings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Terug naar boekingen
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
