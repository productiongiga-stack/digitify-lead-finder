"use client";

import { Button } from "@digitify/ui";
import { Loader2, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type JobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | null;

function statusLabel(status: JobStatus): string {
  if (status === "PENDING") return "In wachtrij";
  if (status === "PROCESSING") return "AI aan het werk";
  if (status === "FAILED") return "Mislukt";
  return "Bezig";
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

type Props = {
  status: JobStatus;
  elapsedSeconds: number;
  pollError?: string | null;
  onRetry?: () => void;
  hint?: string;
};

export function MediaJobProgress({ status, elapsedSeconds, pollError, onRetry, hint }: Props) {
  if (!status || status === "COMPLETED") return null;

  if (pollError) {
    return (
      <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4" role="alert">
        <p className="text-sm text-destructive">{pollError}</p>
        {onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCcw className="mr-2 h-3.5 w-3.5" />
            Opnieuw proberen
          </Button>
        ) : null}
      </div>
    );
  }

  if (status === "FAILED") return null;

  return (
    <div className="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-background to-primary/5">
      <div className="relative flex items-center gap-3 px-4 py-3 text-sm">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
          <span
            aria-hidden
            className="absolute inset-0 animate-ping rounded-full bg-primary/20"
            style={{ animationDuration: "2s" }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{statusLabel(status)}</p>
          <p className="text-xs text-muted-foreground">
            {elapsedSeconds > 0 ? formatElapsed(elapsedSeconds) : "Gestart"}
            {hint ? ` · ${hint}` : ""}
          </p>
        </div>
      </div>
      <div className="h-1 w-full overflow-hidden bg-muted">
        <div className="h-full w-2/5 animate-pulse bg-gradient-to-r from-transparent via-primary to-transparent" />
      </div>
    </div>
  );
}
