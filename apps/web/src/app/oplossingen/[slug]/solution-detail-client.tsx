"use client";

import { BundleDetailMarketingPage, type BundleSlug } from "@/components/marketing/marketing-page";

export function BundleDetailClient({ slug }: { slug: BundleSlug }) {
  return <BundleDetailMarketingPage slug={slug} />;
}
