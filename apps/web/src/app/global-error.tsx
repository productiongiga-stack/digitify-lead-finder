"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@digitify/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="nl">
      <body className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Er ging iets mis</h1>
          <p className="text-sm text-muted-foreground">
            De applicatie kon deze pagina niet laden. Probeer opnieuw of ga terug naar het dashboard.
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => reset()}>Opnieuw proberen</Button>
            <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
              Naar dashboard
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
