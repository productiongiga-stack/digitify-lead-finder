"use client";

import type { ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@digitify/ui";
import { cn } from "@/lib/utils";

type QueryErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** Stacked (default) for empty pages; inline for toolbars and forms */
  variant?: "stacked" | "inline";
  action?: ReactNode;
  className?: string;
};

export function QueryErrorState({
  title = "Gegevens laden mislukt",
  message = "Controleer je verbinding en probeer opnieuw.",
  onRetry,
  retryLabel = "Opnieuw proberen",
  variant = "stacked",
  action,
  className,
}: QueryErrorStateProps) {
  const actionNode =
    action ??
    (onRetry ? (
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />
        {retryLabel}
      </Button>
    ) : null);

  if (variant === "inline") {
    return (
      <div
        role="alert"
        className={cn(
          "rounded-xl border border-destructive/25 bg-gradient-to-r from-destructive/8 via-destructive/5 to-transparent p-4 shadow-sm",
          className,
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 ring-1 ring-destructive/15">
              <AlertCircle className="h-5 w-5 text-destructive" aria-hidden />
            </div>
            <div className="min-w-0 space-y-0.5 pt-0.5">
              <p className="text-sm font-semibold leading-tight text-foreground">{title}</p>
              <p className="text-sm leading-snug text-muted-foreground">{message}</p>
            </div>
          </div>
          {actionNode ? <div className="shrink-0 sm:pl-1">{actionNode}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-8 text-center shadow-sm",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 ring-1 ring-destructive/15">
        <AlertCircle className="h-6 w-6 text-destructive" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      </div>
      {actionNode}
    </div>
  );
}
