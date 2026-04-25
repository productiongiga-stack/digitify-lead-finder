import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/marketing-page";

export const metadata: Metadata = {
  title: "Over ons",
  description: "Digitify Lead Finder is gemaakt door Digitify, een Belgisch digitaal groeiteam.",
};

export default function AboutPage() {
  return <MarketingPage page="about" />;
}
