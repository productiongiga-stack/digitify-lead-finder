"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const LeadSearchView = dynamic(
  () => import("./lead-search-inner").then((module) => module.LeadSearchInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="Lead zoeken laden..." />,
  },
);

export default function LeadSearchPage() {
  return <LeadSearchView />;
}
