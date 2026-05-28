"use client";

import { RouteErrorState } from "@/components/layout/route-states";

export default function IntegrationsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorState
      title="Integraties konden niet geladen worden"
      description="Er liep iets fout bij het laden van externe diensten en API-sleutels."
      reset={reset}
    />
  );
}
