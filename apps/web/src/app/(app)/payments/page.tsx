"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const PaymentsPageView = dynamic(
  () => import("./payments-page-inner").then((module) => module.PaymentsPageInner),
  { ssr: false, loading: () => <RouteLoading label="Betalingen laden..." /> },
);

export default function PaymentsPage() {
  return <PaymentsPageView />;
}
