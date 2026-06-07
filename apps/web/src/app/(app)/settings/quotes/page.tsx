"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const QuoteSettingsPageView = dynamic(
  () => import("./quote-settings-inner").then((module) => module.QuoteSettingsPageInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="Offerte-instellingen laden..." />,
  },
);

export default function QuoteSettingsPage() {
  return <QuoteSettingsPageView />;
}
