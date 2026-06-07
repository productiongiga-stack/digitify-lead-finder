"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const DomainsPageView = dynamic(
  () => import("./domains-page-inner").then((module) => module.DomainsPageInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="Domeinen laden..." />,
  },
);

export default function DomainsPage() {
  return <DomainsPageView />;
}
