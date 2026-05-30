"use client";

import {
  getSolutionModuleBySlug,
  SolutionDetailMarketingPage,
  type SolutionSlug,
} from "@/components/marketing/marketing-page";

export function SolutionDetailClient({ slug }: { slug: string }) {
  const module = getSolutionModuleBySlug(slug);

  if (!module) {
    return <SolutionDetailMarketingPage slug="lead-search" />;
  }

  return <SolutionDetailMarketingPage slug={module.slug as SolutionSlug} />;
}
