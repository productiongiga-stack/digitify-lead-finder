import type { Metadata } from "next";
import { MarketingSubpageClient } from "@/components/marketing/marketing-subpage-client";
import { MarketingSeoJsonLd } from "@/components/marketing/marketing-seo-json-ld";
import { generateMarketingMetadata } from "@/lib/seo/generate-marketing-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return generateMarketingMetadata("solutions");
}

export default function SolutionsPage() {
  return (
    <>
      <MarketingSeoJsonLd path="/oplossingen" />
      <MarketingSubpageClient page="solutions" />
    </>
  );
}
