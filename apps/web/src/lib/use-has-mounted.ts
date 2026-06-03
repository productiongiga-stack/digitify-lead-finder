"use client";

import { useSyncExternalStore } from "react";

/** True after the client has mounted — use to gate UI that must not SSR (counts, theme, etc.). */
export function useHasMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
