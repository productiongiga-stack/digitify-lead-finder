"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const MarketingPage = dynamic(
  () => import("@/components/marketing/marketing-page").then((module) => module.MarketingPage),
  {
    loading: () => <RouteLoading label="Pagina laden..." />,
  },
);

export function MarketingHomeClient() {
  return <MarketingPage page="home" />;
}
