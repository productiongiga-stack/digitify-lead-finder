import { NextResponse } from "next/server";

export function GET(request: Request) {
  const url = new URL(request.url);
  const domainId = url.searchParams.get("domain") || "";
  const origin = url.origin;

  const script = `(() => {
    try {
      const domainId = ${JSON.stringify(domainId)};
      if (!domainId) return;
      const VISITOR_KEY = "digitify_tracker_visitor_id";
      const SESSION_KEY = "digitify_tracker_session_id";
      const ensureId = (storage, key) => {
        try {
          const current = storage.getItem(key);
          if (current) return current;
          const next = Math.random().toString(36).slice(2) + Date.now().toString(36);
          storage.setItem(key, next);
          return next;
        } catch (_) {
          return Math.random().toString(36).slice(2) + Date.now().toString(36);
        }
      };
      const visitorId = ensureId(window.localStorage, VISITOR_KEY);
      const sessionId = ensureId(window.sessionStorage, SESSION_KEY);
      const payload = {
        domainId,
        visitorId,
        sessionId,
        hostname: window.location.hostname || "",
        path: window.location.pathname || "/",
        pageUrl: window.location.href,
        referrer: document.referrer || "",
        title: document.title || "",
        userAgent: navigator.userAgent || "",
        language: navigator.language || "",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        screenWidth: window.innerWidth || screen.width || 0,
        screenHeight: window.innerHeight || screen.height || 0,
        utmSource: new URLSearchParams(window.location.search).get('utm_source') || '',
        utmMedium: new URLSearchParams(window.location.search).get('utm_medium') || '',
        utmCampaign: new URLSearchParams(window.location.search).get('utm_campaign') || ''
      };
      const endpoint = ${JSON.stringify(`${origin}/api/public/tracker`)};
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        mode: "cors",
        credentials: "omit",
        keepalive: true
      }).catch(() => {
        if (navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
          navigator.sendBeacon(endpoint, blob);
        }
      });
    } catch (_) {}
  })();`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
