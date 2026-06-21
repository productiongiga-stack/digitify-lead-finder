"use client";

import { MarketingPage } from "@/components/marketing/marketing-page";

type MarketingSubpage = "product" | "solutions" | "about" | "contact";

export function MarketingSubpageClient({ page }: { page: MarketingSubpage }) {
  return <MarketingPage page={page} />;
}
