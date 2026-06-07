"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const DashboardPageView = dynamic(
  () => import("./dashboard-page-inner").then((module) => module.DashboardPageInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="Dashboard laden..." />,
  },
);

export default function DashboardPage() {
  return <DashboardPageView />;
}
