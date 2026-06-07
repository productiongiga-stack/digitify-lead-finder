import type { Metadata } from "next";
import { MarketingSubpageClient } from "@/components/marketing/marketing-subpage-client";
import { MarketingSeoJsonLd } from "@/components/marketing/marketing-seo-json-ld";
import { generateMarketingMetadata } from "@/lib/seo/generate-marketing-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return generateMarketingMetadata("contact");
}

export default function ContactPage() {
  return (
    <>
      <MarketingSeoJsonLd path="/contact" />
      <MarketingSubpageClient page="contact" />
    </>
  );
}
