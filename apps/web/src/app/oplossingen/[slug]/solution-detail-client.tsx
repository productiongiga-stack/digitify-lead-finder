"use client";

import { notFound } from "next/navigation";
import {
  getSolutionModuleBySlug,
  SolutionDetailMarketingPage,
  type SolutionSlug,
} from "@/components/marketing/marketing-page";

export function SolutionDetailClient({ slug }: { slug: string }) {
  const module = getSolutionModuleBySlug(slug);

  if (!module) {
    notFound();
  }

  return <SolutionDetailMarketingPage slug={module.slug as SolutionSlug} />;
}
