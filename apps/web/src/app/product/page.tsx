import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/marketing-page";
import { MarketingSeoJsonLd } from "@/components/marketing/marketing-seo-json-ld";
import { generateMarketingMetadata } from "@/lib/seo/generate-marketing-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return generateMarketingMetadata("product");
}

export default function ProductPage() {
  return (
    <>
      <MarketingSeoJsonLd path="/product" />
      <MarketingPage page="product" />
    </>
  );
}
