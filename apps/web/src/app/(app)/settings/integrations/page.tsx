"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const IntegrationsSettingsView = dynamic(
  () =>
    import("./integrations-settings-inner").then((module) => module.IntegrationsSettingsInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="Integraties laden..." />,
  },
);

export default function IntegrationsSettingsPage() {
  return <IntegrationsSettingsView />;
}
