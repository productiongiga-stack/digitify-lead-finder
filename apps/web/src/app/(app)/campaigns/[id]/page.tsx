"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const CampaignDetailView = dynamic(
  () => import("./campaign-detail-inner").then((module) => module.CampaignDetailInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="Campagne laden..." />,
  },
);

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <CampaignDetailView params={params} />;
}
