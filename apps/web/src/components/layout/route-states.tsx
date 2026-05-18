"use client";

import Link from "next/link";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button, Skeleton } from "@digitify/ui";
import { cn } from "@/lib/utils";

export function RouteLoading({ label = "Pagina laden..." }: { label?: string }) {
  return (
    <div className="app-page">
      <div className="app-page-header">
        <div className="app-page-heading">
          <Skeleton className="h-7 w-56 rounded-xl" />
          <Skeleton className="h-4 w-full max-w-lg rounded-xl" />
        </div>
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="app-surface p-4 sm:p-5">
        <p className="mb-4 text-sm font-medium text-muted-foreground">{label}</p>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function RouteErrorState({
  title = "Deze pagina kon niet geladen worden",
  description = "Er liep iets fout bij het ophalen of renderen van deze module.",
  reset,
  className,
}: {
  title?: string;
  description?: string;
  reset?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex min-h-[55vh] w-full max-w-3xl items-center justify-center px-4 py-10", className)}>
      <div className="app-surface w-full p-6 text-center sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {reset ? (
            <Button onClick={reset}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Probeer opnieuw
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/dashboard">Terug naar dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
