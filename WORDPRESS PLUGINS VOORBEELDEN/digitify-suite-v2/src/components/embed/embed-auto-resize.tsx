"use client";

import { useEffect, useRef } from "react";

/**
 * Embed Auto-Resize — postMessage-based iframe height synchronization.
 *
 * When this component is mounted inside an iframe, it:
 * 1. Observes the document height via ResizeObserver
 * 2. Sends height changes to the parent window via postMessage
 * 3. Parent's embed script receives and adjusts iframe height
 *
 * Message format:
 *   { type: "digitify:resize", height: 750 }
 *
 * Also listens for parent messages:
 *   { type: "digitify:init" } — confirms embed is ready
 *   { type: "digitify:theme", theme: "dark" } — theme switching (future)
 */
export function EmbedAutoResize() {
  const lastHeight = useRef(0);

  useEffect(() => {
    // Only run inside an iframe
    if (typeof window === "undefined" || window === window.parent) return;

    const sendHeight = () => {
      const height = document.documentElement.scrollHeight;
      // Only send if height changed by more than 2px (avoid jitter)
      if (Math.abs(height - lastHeight.current) > 2) {
        lastHeight.current = height;
        window.parent.postMessage(
          {
            type: "digitify:resize",
            height,
          },
          "*"
        );
      }
    };

    // Send ready signal
    window.parent.postMessage({ type: "digitify:ready" }, "*");

    // Initial measurement
    sendHeight();

    // Observe DOM changes
    const observer = new ResizeObserver(() => {
      sendHeight();
    });
    observer.observe(document.documentElement);

    // Also listen for dynamic content (images loading, etc.)
    const mutationObserver = new MutationObserver(() => {
      // Debounced resize check
      requestAnimationFrame(sendHeight);
    });
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    // Listen for messages from parent
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;

      switch (event.data.type) {
        case "digitify:init":
          sendHeight();
          break;
        case "digitify:theme":
          // Future: apply theme to embed root
          break;
      }
    };
    window.addEventListener("message", handleMessage);

    // Periodic fallback (every 2s) for edge cases
    const interval = setInterval(sendHeight, 2000);

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("message", handleMessage);
      clearInterval(interval);
    };
  }, []);

  return null;
}
