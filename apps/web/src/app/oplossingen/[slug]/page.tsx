"use client";

import { useParams } from "next/navigation";
import {
  getSolutionModuleBySlug,
  SolutionDetailMarketingPage,
  type SolutionSlug,
} from "@/components/marketing/marketing-page";

export default function SolutionDetailPage() {
  const params = useParams<{ slug: string }>();
  const rawSlug = params?.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  const module = slug ? getSolutionModuleBySlug(slug) : undefined;

  if (!module) {
    return <SolutionDetailMarketingPage slug="lead-search" />;
  }

  return <SolutionDetailMarketingPage slug={module.slug as SolutionSlug} />;
}
