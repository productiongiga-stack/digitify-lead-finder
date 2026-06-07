"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const CrmPageView = dynamic(
  () => import("./crm-page-inner").then((module) => module.CrmPageInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="CRM laden..." />,
  },
);

export default function CrmPage() {
  return <CrmPageView />;
}
