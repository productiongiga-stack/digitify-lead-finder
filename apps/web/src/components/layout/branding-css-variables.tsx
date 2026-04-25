"use client";

import { useEffect } from "react";
import { useBranding } from "@/lib/branding";

function hexToHslString(hex: string) {
  const normalized = hex.replace("#", "").trim();
  const value = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    return null;
  }

  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return `0 0% ${Math.round(l * 100)}%`;
  }

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h = 0;

  switch (max) {
    case r:
      h = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
      break;
    case g:
      h = ((b - r) / delta + 2) * 60;
      break;
    default:
      h = ((r - g) / delta + 4) * 60;
      break;
  }

  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function BrandingCssVariables() {
  const { branding } = useBranding();

  useEffect(() => {
    const primary = hexToHslString(branding.primaryColor);
    if (!primary) return;

    const root = document.documentElement;
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--ring", primary);
    root.style.setProperty("--primary-foreground", "0 0% 100%");
  }, [branding.primaryColor]);

  return null;
}
