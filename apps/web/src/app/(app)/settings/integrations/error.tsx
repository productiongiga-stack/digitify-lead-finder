"use client";

import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@digitify/ui";

export default function IntegrationsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-3xl items-center justify-center px-4 py-10">
      <div className="w-full rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
          <AlertCircle className="h-7 w-7 text-red-600" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Integraties konden niet geladen worden</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Er liep iets fout bij het laden van deze pagina. Probeer opnieuw.
        </p>
        <div className="mt-6 flex justify-center">
          <Button onClick={reset}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Probeer opnieuw
          </Button>
        </div>
      </div>
    </div>
  );
}
