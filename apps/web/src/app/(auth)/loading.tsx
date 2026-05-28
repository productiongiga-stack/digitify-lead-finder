import { Skeleton } from "@digitify/ui";

export default function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/90 p-6">
        <Skeleton className="mx-auto h-14 w-14 rounded-2xl" />
        <Skeleton className="mx-auto mt-6 h-7 w-44 rounded-xl" />
        <Skeleton className="mx-auto mt-3 h-4 w-56 rounded-xl" />
        <div className="mt-8 space-y-4">
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-full" />
        </div>
      </div>
    </div>
  );
}
