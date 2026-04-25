import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/marketing-page";

export const metadata: Metadata = {
  title: "Product",
  description: "Ontdek hoe Digitify Lead Finder leads, outreach, offertes, afspraken en reviews samenbrengt.",
};

export default function ProductPage() {
  return <MarketingPage page="product" />;
}
