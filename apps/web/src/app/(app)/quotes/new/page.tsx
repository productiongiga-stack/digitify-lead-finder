"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const QuotesNewPageView = dynamic(
  () => import("./quotes-new-page-inner").then((module) => module.QuotesNewPageInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="Offerte configurator laden..." />,
  },
);

export default function NewQuotePage() {
  return <QuotesNewPageView />;
}
