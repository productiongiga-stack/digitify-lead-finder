import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/marketing-page";

export const metadata: Metadata = {
  title: "Oplossingen",
  description: "Praktische groeiflows voor agencies, sales teams en lokale dienstverleners.",
};

export default function SolutionsPage() {
  return <MarketingPage page="solutions" />;
}
