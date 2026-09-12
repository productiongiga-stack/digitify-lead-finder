import { requireWorkspace } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { Users, Target, FileText, Receipt, Calendar, TrendingUp } from "lucide-react";
import { ActivityFeed } from "@/components/shared/activity-feed";
import Link from "next/link";

/**
 * Dashboard — workspace home page.
 * Server component with parallel data fetching for KPIs.
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { workspace } = await requireWorkspace(workspaceSlug);
  const wId = workspace.id;

  // Parallel KPI queries
  const [
    contactCount,
    activeLeadCount,
    openQuoteCount,
    openQuoteValue,
    wonDealValue,
    upcomingBookings,
    recentActivities,
  ] = await Promise.all([
    db.contact.count({ where: { workspaceId: wId, archivedAt: null } }),
    db.lead.count({ where: { workspaceId: wId, status: { in: ["NEW", "CONTACTED", "QUALIFIED"] } } }),
    db.quote.count({ where: { workspaceId: wId, status: { in: ["SENT", "VIEWED"] } } }),
    db.quote.aggregate({
      where: { workspaceId: wId, status: { in: ["SENT", "VIEWED"] } },
      _sum: { total: true },
    }),
    db.deal.aggregate({
      where: { workspaceId: wId, stage: { isWon: true } },
      _sum: { value: true },
    }),
    db.booking.count({
      where: { workspaceId: wId, startAt: { gte: new Date() }, status: { in: ["PENDING", "CONFIRMED"] } },
    }),
    db.activity.findMany({
      where: { workspaceId: wId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const kpis = [
    { label: "Contacten", value: contactCount, icon: Users, color: "text-blue-600 bg-blue-50" },
    { label: "Actieve leads", value: activeLeadCount, icon: Target, color: "text-amber-600 bg-amber-50" },
    { label: "Open offertes", value: openQuoteCount, sub: formatCurrency(Number(openQuoteValue._sum.total ?? 0)), icon: FileText, color: "text-indigo-600 bg-indigo-50" },
    { label: "Omzet (gewonnen)", value: formatCurrency(Number(wonDealValue._sum.value ?? 0)), icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
    { label: "Komende afspraken", value: upcomingBookings, icon: Calendar, color: "text-violet-600 bg-violet-50" },
  ];

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Dashboard</h1>

      {/* KPI cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${kpi.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-tight">
                    {kpi.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  {kpi.sub && (
                    <p className="text-xs text-muted-foreground">{kpi.sub}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="mb-8 flex flex-wrap gap-2">
        {[
          { label: "+ Contact", href: `/${workspaceSlug}/contacts?new=1` },
          { label: "Leads bekijken", href: `/${workspaceSlug}/leads` },
          { label: "Nieuwe offerte", href: `/${workspaceSlug}/quotes/new` },
          { label: "Planning", href: `/${workspaceSlug}/scheduling` },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            {action.label}
          </Link>
        ))}
      </div>

      {/* Activity feed */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold">Recente activiteit</h2>
        <ActivityFeed activities={recentActivities} />
      </div>
    </>
  );
}
