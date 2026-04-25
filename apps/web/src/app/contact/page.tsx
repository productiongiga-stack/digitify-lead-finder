import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/marketing-page";

export const metadata: Metadata = {
  title: "Contact",
  description: "Plan een demo of bespreek hoe Digitify Lead Finder in jouw groeiproces past.",
};

export default function ContactPage() {
  return <MarketingPage page="contact" />;
}
