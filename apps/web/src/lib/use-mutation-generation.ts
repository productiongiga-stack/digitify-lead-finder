import { useCallback, useRef } from "react";

/** Guards async mutation results so stale responses are ignored after a newer request starts. */
export function useMutationGeneration() {
  const generationRef = useRef(0);

  const beginGeneration = useCallback(() => {
    generationRef.current += 1;
    return generationRef.current;
  }, []);

  const isCurrentGeneration = useCallback((generation: number) => {
    return generation === generationRef.current;
  }, []);

  return { beginGeneration, isCurrentGeneration };
}
