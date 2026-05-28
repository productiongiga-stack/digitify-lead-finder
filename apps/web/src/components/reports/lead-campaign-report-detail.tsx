"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@digitify/ui";
import { Download, Users, TrendingUp, Flame, Thermometer } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const CHART_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#f97316",
];

interface ReportData {
  totalLeads: number;
  avgScore: number;
  scoreBuckets: { range: string; count: number }[];
  hotCount: number;
  warmCount: number;
  lowCount: number;
  topNiches: { name: string; count: number }[];
  topCities: { name: string; count: number }[];
  pipelineBreakdown: { name: string; count: number }[];
  statusBreakdown: { name: string; count: number }[];
  campaignName: string;
  generatedAt: string;
}

type ReportRecord = {
  title: string;
  createdAt: Date;
  data: unknown;
  generatedBy?: { name: string | null } | null;
};

export function LeadCampaignReportDetail({
  report,
  onExportPdf,
}: {
  report: ReportRecord;
  onExportPdf: () => void;
}) {
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    setChartsReady(true);
  }, []);

  const data = useMemo<ReportData>(() => {
    const raw = (report?.data ?? {}) as Partial<ReportData>;
    const safeList = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

    return {
      totalLeads: Number(raw.totalLeads ?? 0),
      avgScore: Number(raw.avgScore ?? 0),
      scoreBuckets: safeList<{ range: string; count: number }>(raw.scoreBuckets).filter(Boolean),
      hotCount: Number(raw.hotCount ?? 0),
      warmCount: Number(raw.warmCount ?? 0),
      lowCount: Number(raw.lowCount ?? 0),
      topNiches: safeList<{ name: string; count: number }>(raw.topNiches).filter(Boolean),
      topCities: safeList<{ name: string; count: number }>(raw.topCities).filter(Boolean),
      pipelineBreakdown: safeList<{ name: string; count: number }>(raw.pipelineBreakdown).filter(Boolean),
      statusBreakdown: safeList<{ name: string; count: number }>(raw.statusBreakdown).filter(Boolean),
      campaignName: String(raw.campaignName ?? "Onbekend"),
      generatedAt: String(raw.generatedAt ?? ""),
    };
  }, [report]);

  const priorityPieData = [
    { name: "Hot", value: data.hotCount },
    { name: "Warm", value: data.warmCount },
    { name: "Low", value: data.lowCount },
  ].filter((d) => d.value > 0);

  const priorityColors = ["#ef4444", "#f59e0b", "#94a3b8"];

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <h1 className="text-xl font-bold tracking-tight">{report.title}</h1>
        <p className="text-sm text-muted-foreground">
          Gegenereerd op {new Date(report.createdAt).toLocaleDateString("nl-BE")} door{" "}
          {report.generatedBy?.name ?? "Onbekend"}
        </p>
        <Button className="mt-3 print:hidden" size="sm" variant="outline" onClick={onExportPdf}>
          <Download className="mr-2 h-4 w-4" />
          Exporteer PDF
        </Button>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">{report.title}</h1>
        <p className="text-sm text-muted-foreground">
          Gegenereerd op {new Date(report.createdAt).toLocaleDateString("nl-BE")}
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-900/30">
                <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Totaal Leads</p>
                <p className="text-2xl font-bold">{data.totalLeads}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-100 p-2 dark:bg-violet-900/30">
                <TrendingUp className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gem. Score</p>
                <p className="text-2xl font-bold">{data.avgScore}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
                <Flame className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hot Leads</p>
                <p className="text-2xl font-bold">{data.hotCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
                <Thermometer className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Warm Leads</p>
                <p className="text-2xl font-bold">{data.warmCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Score Distribution + Priority Pie */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scoreverdeling</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.scoreBuckets}>
                    <XAxis dataKey="range" fontSize={12} />
                    <YAxis fontSize={12} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Aantal" radius={[4, 4, 0, 0]}>
                      {data.scoreBuckets.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full animate-pulse rounded-xl bg-muted/60" />
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lead Prioriteit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={priorityPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {priorityPieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={priorityColors[index]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full animate-pulse rounded-xl bg-muted/60" />
              )}
            </div>
            <div className="mt-2 flex justify-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span className="text-xs text-muted-foreground">Hot ({data.hotCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-amber-500" />
                <span className="text-xs text-muted-foreground">Warm ({data.warmCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-slate-400" />
                <span className="text-xs text-muted-foreground">Low ({data.lowCount})</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Top Niches + Top Cities */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Niches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.topNiches} layout="vertical">
                    <XAxis type="number" fontSize={12} allowDecimals={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      fontSize={11}
                      width={100}
                      tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 14) + "..." : v)}
                    />
                    <Tooltip />
                    <Bar dataKey="count" name="Aantal" radius={[0, 4, 4, 0]}>
                      {data.topNiches.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full animate-pulse rounded-xl bg-muted/60" />
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Steden</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.topCities} layout="vertical">
                    <XAxis type="number" fontSize={12} allowDecimals={false} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      fontSize={11}
                      width={100}
                      tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 14) + "..." : v)}
                    />
                    <Tooltip />
                    <Bar dataKey="count" name="Aantal" radius={[0, 4, 4, 0]}>
                      {data.topCities.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full animate-pulse rounded-xl bg-muted/60" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline & Status Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline Overzicht</CardTitle>
          </CardHeader>
          <CardContent>
            {data.pipelineBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Geen pipeline data beschikbaar</p>
            ) : (
              <div className="space-y-3">
                {data.pipelineBreakdown.map((stage, i) => (
                  <div key={stage.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="text-sm">{stage.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(stage.count / data.totalLeads) * 100}%`,
                            backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium tabular-nums">{stage.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Verdeling</CardTitle>
          </CardHeader>
          <CardContent>
            {data.statusBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Geen status data beschikbaar</p>
            ) : (
              <div className="space-y-3">
                {data.statusBreakdown.map((status, i) => (
                  <div key={status.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="text-sm">{status.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(status.count / data.totalLeads) * 100}%`,
                            backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium tabular-nums">{status.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
