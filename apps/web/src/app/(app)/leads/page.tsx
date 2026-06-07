"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const LeadsPageView = dynamic(
  () => import("./leads-page-inner").then((module) => module.LeadsPageInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="Leads laden..." />,
  },
);

export default function LeadsPage() {
  return <LeadsPageView />;
}
