import { Skeleton } from "@digitify/ui";

/** Placeholder while Google Ads Studio mounts (lazy chunk load). */
export function GoogleAdsPageFallback() {
  return (
    <div suppressHydrationWarning className="space-y-6" aria-busy="true" aria-label="Google Ads Studio laden">
      <Skeleton className="h-44 w-full rounded-[2rem]" />
      <div className="grid gap-2 sm:grid-cols-3">
        <Skeleton className="h-[4.5rem] rounded-2xl" />
        <Skeleton className="h-[4.5rem] rounded-2xl" />
        <Skeleton className="h-[4.5rem] rounded-2xl" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="min-h-[24rem] w-full rounded-2xl" />
    </div>
  );
}
