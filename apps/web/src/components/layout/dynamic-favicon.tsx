"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useBranding } from "@/lib/branding";

export function DynamicFavicon() {
  const pathname = usePathname();
  const isPublicMarketingPath = ["/", "/product", "/oplossingen", "/over-ons", "/contact"].includes(pathname);
  const { branding } = useBranding(!isPublicMarketingPath);

  useEffect(() => {
    if (!branding.faviconUrl) return;

    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = branding.faviconUrl;
  }, [branding.faviconUrl]);

  return null;
}
