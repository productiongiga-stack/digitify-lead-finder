"use client";

import dynamic from "next/dynamic";
import { MetaAdsPageFallback } from "@/components/ads/meta-ads-page-fallback";

const MetaAdsPageView = dynamic(
  () => import("./meta-ads-page-inner").then((module) => module.MetaAdsPageInner),
  {
    ssr: false,
    loading: () => <MetaAdsPageFallback />,
  },
);

export default function MetaAdsPage() {
  return <MetaAdsPageView />;
}
