import { Skeleton } from "@digitify/ui";

/** Matches login/register card shape inside AuthLayout — avoids hydration mismatch with route Suspense. */
export function AuthFormSkeleton() {
  return (
    <div className="w-full rounded-2xl border border-border/60 bg-card/90 p-6 shadow-2xl shadow-slate-950/10">
      <Skeleton className="mx-auto h-14 w-14 rounded-2xl" />
      <Skeleton className="mx-auto mt-6 h-7 w-44 rounded-xl" />
      <Skeleton className="mx-auto mt-3 h-4 w-56 rounded-xl" />
      <div className="mt-8 space-y-4">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-full" />
      </div>
    </div>
  );
}
