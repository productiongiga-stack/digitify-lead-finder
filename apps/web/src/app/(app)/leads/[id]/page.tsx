"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const LeadDetailView = dynamic(
  () => import("./lead-detail-inner").then((module) => module.LeadDetailInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="Lead laden..." />,
  },
);

export default function LeadDetailPage() {
  return <LeadDetailView />;
}
