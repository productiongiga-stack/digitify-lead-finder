import type { Metadata } from "next";
import { MarketingHomeClient } from "@/components/marketing/marketing-home-client";
import { DigitifyMarketingHead } from "@/components/marketing/digitify-marketing-head";
import { MarketingSeoJsonLd } from "@/components/marketing/marketing-seo-json-ld";
import { generateMarketingMetadata } from "@/lib/seo/generate-marketing-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return generateMarketingMetadata("home");
}

export default function Home() {
  return (
    <>
      <DigitifyMarketingHead />
      <MarketingSeoJsonLd path="/" />
      <MarketingHomeClient />
    </>
  );
}
