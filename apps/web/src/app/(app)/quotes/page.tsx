"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const QuotesPageView = dynamic(
  () => import("./quotes-page-inner").then((module) => module.QuotesPageInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="Offertes laden..." />,
  },
);

export default function QuotesPage() {
  return <QuotesPageView />;
}
