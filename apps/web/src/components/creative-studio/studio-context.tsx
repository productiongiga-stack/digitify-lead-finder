"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { trpc } from "@/lib/trpc/client";
export type StudioState = {
  brandKitId?: string;
  generatorType?: string;
  destination?: string;
  slot?: string;
  targetPlanId?: string;
  fields?: Record<string, unknown>;
  social?: Record<string, unknown>;
};
export const StudioContext = createContext<{
  state: StudioState;
  setState: Dispatch<SetStateAction<StudioState>>;
  step: number;
  draftId?: string;
} | null>(null);
export function useStudioField<T>(
  name: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const studio = useContext(StudioContext);
  const [local, setLocal] = useState(initial);
  const legacyKey = `${studio?.state.generatorType || "images"}:${name}`;
  const key = name.startsWith("social:") ? name : legacyKey;
  const value =
    studio && key in (studio.state.fields || {})
      ? (studio.state.fields![key] as T)
      : studio && legacyKey in (studio.state.fields || {})
        ? (studio.state.fields![legacyKey] as T)
        : local;
  const initialRef = useRef(initial);
  const update = studio?.setState;
  const set: Dispatch<SetStateAction<T>> = useCallback(
    (next) => {
      if (!update) return setLocal(next);
      update((previous) => {
        const current =
          key in (previous.fields || {})
            ? (previous.fields![key] as T)
            : legacyKey in (previous.fields || {})
              ? (previous.fields![legacyKey] as T)
              : initialRef.current;
        const nextValue =
          typeof next === "function"
            ? (next as (value: T) => T)(current)
            : next;
        if (Object.is(current, nextValue)) return previous;
        const fieldScope = legacyKey.slice(0, legacyKey.indexOf(":"));
        const invalidate = [
          "prompt",
          "model",
          "resolution",
          "quality",
          "aspectRatio",
          "duration",
          "mode",
          "referenceUrls",
          "startframeUrls",
          "audioUrl",
          "videoUrl",
          "imageUrls",
          "productImageUrl",
          "avatarImageUrl",
          "referenceVideoUrl",
        ].includes(name);
        return {
          ...previous,
          fields: {
            ...previous.fields,
            [key]: nextValue,
            ...(invalidate
              ? {
                  [`${fieldScope}:jobId`]: null,
                  [`${fieldScope}:staleJobId`]:
                    previous.fields?.[`${fieldScope}:jobId`] ||
                    previous.fields?.[`${fieldScope}:staleJobId`] ||
                    null,
                }
              : {}),
          },
        };
      });
    },
    [update, key, legacyKey, name],
  );
  return [value, set];
}
export function StudioSection({
  children,
  kind,
}: {
  children: ReactNode;
  kind: "content" | "result" | "advanced";
}) {
  const studio = useContext(StudioContext);
  if (kind === "advanced")
    return (
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Geavanceerd
        </summary>
        <div className="mt-4 space-y-4">{children}</div>
      </details>
    );
  return (
    <div
      hidden={Boolean(
        studio && (kind === "content" ? studio.step !== 1 : studio.step !== 2),
      )}
      className="space-y-5"
    >
      {children}
    </div>
  );
}
export function StudioHelp({
  children,
  label = "Uitleg",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <details className="inline-block align-middle">
      <summary
        aria-label={label}
        className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full border text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary"
      >
        ?
      </summary>
      <div className="mt-2 max-w-md rounded-lg border bg-muted/30 p-3 text-sm font-normal text-muted-foreground">
        {children}
      </div>
    </details>
  );
}
export type CreativeQuote = {
  wallet: {
    data?: { enabled: boolean; available: number; providerReady: boolean };
    isLoading: boolean;
    isError: boolean;
  };
  quote: { data?: { credits: number }; error: { message: string } | null };
  canGenerate: boolean;
};
export function useCreativeQuote(
  model: string,
  settings: {
    resolution?: string;
    quality?: string;
    duration?: number;
    aspectRatio?: string;
  },
): CreativeQuote {
  const wallet = trpc.media.getCreativeCredits.useQuery(undefined, {
    staleTime: 10000,
  });
  const quote = trpc.media.quoteCreative.useQuery(
    { model, settings },
    { enabled: wallet.data?.enabled === true, retry: false },
  );
  return {
    wallet,
    quote,
    canGenerate:
      !wallet.isLoading &&
      !wallet.isError &&
      (!wallet.data?.enabled ||
        Boolean(
          wallet.data.providerReady &&
            quote.data &&
            quote.data.credits <= wallet.data.available,
        )),
  };
}
export function CreditQuote({
  pricing,
}: {
  pricing: ReturnType<typeof useCreativeQuote>;
}) {
  if (pricing.wallet.isError)
    return (
      <p role="alert" className="text-destructive">
        ! Creditgegevens zijn niet beschikbaar. Probeer later opnieuw.
      </p>
    );
  if (!pricing.wallet.data?.enabled) return null;
  if (!pricing.wallet.data.providerReady)
    return (
      <p role="alert" className="text-sm">
        ! Centrale AI is nog niet geconfigureerd. Je concept blijft bewaard; de platform-owner moet <code>CREATIVE_MUAPI_KEY</code> server-side toevoegen in Vercel en daarna opnieuw deployen. <a className="underline" href="/settings/integrations?tab=muapi">MuAPI-integratie openen</a>
      </p>
    );
  return (
    <div role="status" className="rounded-lg border p-3 text-sm">
      {pricing.quote.data ? (
        <>
          {pricing.quote.data.credits} credits · saldo{" "}
          {pricing.wallet.data.available}
          {!pricing.canGenerate && (
            <p className="text-destructive">! Onvoldoende credits.</p>
          )}
        </>
      ) : (
        <span>{pricing.quote.error?.message || "Creditprijs ophalen…"}</span>
      )}
    </div>
  );
}
