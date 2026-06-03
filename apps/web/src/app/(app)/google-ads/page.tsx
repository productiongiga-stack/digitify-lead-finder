"use client";

import dynamic from "next/dynamic";
import { GoogleAdsPageFallback } from "@/components/ads/google-ads-page-fallback";

const GoogleAdsPageView = dynamic(
  () => import("./google-ads-page-inner").then((module) => module.GoogleAdsPageInner),
  {
    ssr: false,
    loading: () => <GoogleAdsPageFallback />,
  },
);

export default function GoogleAdsPage() {
  return <GoogleAdsPageView />;
}
