"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const InvoicesPageView = dynamic(
  () => import("./invoices-page-inner").then((module) => module.InvoicesPageInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="Facturen laden..." />,
  },
);

export default function InvoicesPage() {
  return <InvoicesPageView />;
}
