"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@digitify/ui";

type QueryErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
};

export function QueryErrorState({
  title = "Gegevens laden mislukt",
  message = "Controleer je verbinding en probeer opnieuw.",
  onRetry,
  className,
}: QueryErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-8 text-center ${className ?? ""}`}
    >
      <AlertCircle className="h-8 w-8 text-destructive" />
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="max-w-md text-xs text-muted-foreground">{message}</p>
      </div>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Opnieuw proberen
        </Button>
      ) : null}
    </div>
  );
}
