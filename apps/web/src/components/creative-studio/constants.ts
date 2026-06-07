export const MEDIA_MODELS_QUERY_OPTIONS = {
  staleTime: 30 * 60_000,
  gcTime: 60 * 60_000,
  refetchOnWindowFocus: false,
} as const;

export const MUAPI_KEY_QUERY_OPTIONS = {
  staleTime: 5 * 60_000,
  refetchOnWindowFocus: false,
} as const;

export const LIBRARY_SAVE_LABEL = "Opslaan in bibliotheek";
