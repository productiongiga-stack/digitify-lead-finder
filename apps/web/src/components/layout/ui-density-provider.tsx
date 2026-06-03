"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc/client";

function applyDensity(value: "comfortable" | "compact") {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-density", value);
}

export function UiDensityProvider() {
  const pathname = usePathname();
  const isPublicMarketingPath = ["/", "/product", "/oplossingen", "/over-ons", "/contact"].includes(pathname);
  const isPublicRuntimePath =
    isPublicMarketingPath ||
    pathname.startsWith("/embed") ||
    pathname.startsWith("/review/") ||
    pathname.startsWith("/client-portal/");
  const { data: densitySetting } = trpc.settings.get.useQuery(
    { key: "ui.density" },
    {
      enabled: !isPublicRuntimePath,
      staleTime: 5 * 60_000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  );

  useEffect(() => {
    try {
      const localDensity = localStorage.getItem("ui-density");
      if (localDensity === "compact" || localDensity === "comfortable") {
        applyDensity(localDensity);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const settingDensity = typeof densitySetting === "string" ? densitySetting : "";
    if (settingDensity === "compact" || settingDensity === "comfortable") {
      applyDensity(settingDensity);
      try {
        localStorage.setItem("ui-density", settingDensity);
      } catch {
        // ignore
      }
    }
  }, [densitySetting]);

  return null;
}
