/** Shared React Query options for narrow settings bundles (avoids refetch storms). */
export const SETTINGS_PAGE_QUERY_OPTS = {
  staleTime: 5 * 60_000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
} as const;
