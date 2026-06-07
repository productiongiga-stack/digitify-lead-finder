"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { isAppShellPath } from "@/lib/shell-paths";

const SCRIPT_MARKER = "data-digitify-analytics";

function browserRequestsDnt() {
  if (typeof navigator === "undefined") return false;
  return (
    navigator.doNotTrack === "1"
    || (window as Window & { doNotTrack?: string }).doNotTrack === "1"
  );
}

function injectAnalyticsScripts(data: {
  enabled: boolean;
  scripts: Array<{ type: string; content: string }>;
  plausibleDomain?: string | null;
  ga4Id?: string | null;
  linkedinPartnerId?: string | null;
  respectDnt?: boolean;
}) {
  if (!data.enabled) return;
  if (data.respectDnt && browserRequestsDnt()) return;

  document.querySelectorAll(`script[${SCRIPT_MARKER}]`).forEach((node) => node.remove());

  for (const script of data.scripts) {
    if (script.type === "plausible" && data.plausibleDomain) {
      const el = document.createElement("script");
      el.setAttribute(SCRIPT_MARKER, "true");
      el.defer = true;
      el.dataset.domain = data.plausibleDomain;
      el.src = script.content;
      document.head.appendChild(el);
      continue;
    }

    if (script.type === "ga4" && data.ga4Id) {
      const loader = document.createElement("script");
      loader.setAttribute(SCRIPT_MARKER, "true");
      loader.async = true;
      loader.src = `https://www.googletagmanager.com/gtag/js?id=${data.ga4Id}`;
      loader.onload = () => {
        const inline = document.createElement("script");
        inline.setAttribute(SCRIPT_MARKER, "true");
        inline.text = script.content;
        document.head.appendChild(inline);
      };
      document.head.appendChild(loader);
      continue;
    }

    if (script.type === "linkedin" && data.linkedinPartnerId) {
      const inline = document.createElement("script");
      inline.setAttribute(SCRIPT_MARKER, "true");
      inline.text = script.content;
      document.head.appendChild(inline);

      const loader = document.createElement("script");
      loader.setAttribute(SCRIPT_MARKER, "true");
      loader.async = true;
      loader.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
      document.head.appendChild(loader);
      continue;
    }

    if (!script.content.trim()) continue;

    const el = document.createElement("script");
    el.setAttribute(SCRIPT_MARKER, "true");
    el.text = script.content;
    document.head.appendChild(el);
  }
}

function AnalyticsScriptsContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tenant = searchParams.get("tenant");
  const isAppRoute = isAppShellPath(pathname);

  const workspaceScriptsQuery = trpc.analytics.getWorkspaceScripts.useQuery(undefined, {
    enabled: isAppRoute,
    retry: false,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const publicScriptsQuery = trpc.analytics.getPublicScripts.useQuery(
    { tenant: tenant || undefined },
    {
      enabled: !isAppRoute,
      staleTime: 10 * 60_000,
      refetchOnWindowFocus: false,
    },
  );

  const scriptsData = isAppRoute ? workspaceScriptsQuery.data : publicScriptsQuery.data;

  useEffect(() => {
    if (!scriptsData) return;
    injectAnalyticsScripts(scriptsData);
  }, [scriptsData]);

  return null;
}

export function AnalyticsScripts() {
  return (
    <Suspense fallback={null}>
      <AnalyticsScriptsContent />
    </Suspense>
  );
}
