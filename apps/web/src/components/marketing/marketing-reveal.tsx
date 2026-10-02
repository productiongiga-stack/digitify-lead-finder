"use client";

import { useEffect } from "react";

/** Keeps scroll animations isolated from the static marketing page bundle. */
export function MarketingReveal() {
  useEffect(() => {
    const elements = document.querySelectorAll(".reveal, .reveal-left, .reveal-right, .reveal-scale");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const element = entry.target as HTMLElement;
          window.setTimeout(() => element.classList.add("in-view"), Number(element.dataset.delay ?? 0));
          observer.unobserve(element);
        });
      },
      { threshold: 0.1 },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return null;
}
