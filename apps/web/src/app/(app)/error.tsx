"use client";

import { RouteErrorState } from "@/components/layout/route-states";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorState
      title="Werkruimte kon niet geladen worden"
      description="Er liep iets fout in deze appmodule. Probeer opnieuw of keer terug naar het dashboard."
      reset={reset}
    />
  );
}
