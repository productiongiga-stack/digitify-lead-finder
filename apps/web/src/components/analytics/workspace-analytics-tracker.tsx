"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { useShellContext } from "@/components/layout/shell-provider";

function getSessionId() {
  if (typeof window === "undefined") return undefined;
  const key = "digitify_analytics_session";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.sessionStorage.setItem(key, created);
  return created;
}

function browserRequestsDnt() {
  if (typeof navigator === "undefined") return false;
  return (
    navigator.doNotTrack === "1"
    || (window as Window & { doNotTrack?: string }).doNotTrack === "1"
  );
}

export function WorkspaceAnalyticsTracker() {
  const pathname = usePathname();
  const { data: shell, isAppShell } = useShellContext();
  const trackingConfig = shell?.tracking;
  const status = isAppShell ? "authenticated" : "unauthenticated";
  const { mutate: trackPageView } = trpc.analytics.trackPageView.useMutation();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !pathname || !trackingConfig?.trackAppUsage) return;
    if (trackingConfig.respectDnt && browserRequestsDnt()) return;
    if (lastTracked.current === pathname) return;
    lastTracked.current = pathname;

    trackPageView({
      path: pathname,
      name: document.title || pathname,
      sessionId: getSessionId(),
    });
  }, [pathname, status, trackingConfig?.trackAppUsage, trackingConfig?.respectDnt, trackPageView]);

  return null;
}
