"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isPublicRuntimePath } from "@/lib/shell-paths";
import { useShellContext } from "@/components/layout/shell-provider";

function applyDensity(value: "comfortable" | "compact") {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-density", value);
}

/** Applies ui.density from shell context on app routes; localStorage bootstrap on public routes. */
export function UiDensityProvider() {
  const pathname = usePathname();
  const isPublic = isPublicRuntimePath(pathname);
  const shell = useShellContext();

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
    if (isPublic || !shell.data?.density) return;
    const density = shell.data.density;
    if (density !== "compact" && density !== "comfortable") return;
    applyDensity(density);
    try {
      localStorage.setItem("ui-density", density);
    } catch {
      // ignore
    }
  }, [isPublic, shell.data?.density]);

  return null;
}
