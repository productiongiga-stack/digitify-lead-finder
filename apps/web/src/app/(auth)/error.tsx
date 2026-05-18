"use client";

import { RouteErrorState } from "@/components/layout/route-states";

export default function AuthError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorState
      title="Authenticatie kon niet geladen worden"
      description="De loginmodule reageerde niet zoals verwacht. Probeer opnieuw."
      reset={reset}
    />
  );
}
