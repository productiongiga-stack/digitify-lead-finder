"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const CampaignsPageView = dynamic(
  () => import("./campaigns-page-inner").then((module) => module.CampaignsPageInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="Campagnes laden..." />,
  },
);

export default function CampaignsPage() {
  return <CampaignsPageView />;
}
