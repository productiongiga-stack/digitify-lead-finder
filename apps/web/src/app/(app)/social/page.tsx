"use client";

import dynamic from "next/dynamic";
import { SocialPageFallback } from "@/components/social/social-page-fallback";

const SocialPageView = dynamic(
  () => import("./social-page-inner").then((module) => module.SocialPageInner),
  {
    ssr: false,
    loading: () => <SocialPageFallback />,
  },
);

export default function SocialPage() {
  return <SocialPageView />;
}
