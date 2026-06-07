"use client";

import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc/client";

function getWidgetSessionId() {
  if (typeof window === "undefined") return undefined;
  const key = "digitify_widget_session";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.sessionStorage.setItem(key, created);
  return created;
}

/** Fire once per mount for public embed widgets (bookings, reviews, quotes). */
export function useWidgetAnalytics(widget: string, tenant?: string | null) {
  const { mutate: trackWidgetView } = trpc.analytics.trackWidgetView.useMutation();
  const tracked = useRef(false);

  useEffect(() => {
    const token = tenant?.trim();
    if (!token || tracked.current) return;
    tracked.current = true;

    trackWidgetView({
      tenant: token,
      widget,
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
      sessionId: getWidgetSessionId(),
    });
  }, [tenant, widget, trackWidgetView]);
}
