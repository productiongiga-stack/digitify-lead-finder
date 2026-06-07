"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
  }, [error]);

  const tryAgain = () => {
    if (typeof reset === "function") {
      reset();
      return;
    }
    window.location.reload();
  };

  return (
    <html lang="nl">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 font-sans">
        <h1 className="text-xl font-semibold">Er ging iets mis</h1>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          De fout is geregistreerd. Probeer de pagina te vernieuwen of neem contact op met support.
        </p>
        <button
          type="button"
          onClick={tryAgain}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Opnieuw proberen
        </button>
      </body>
    </html>
  );
}
