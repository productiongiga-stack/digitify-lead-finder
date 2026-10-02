import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { DigitifyMarketingHead } from "@/components/marketing/digitify-marketing-head";
import { BundleDetailMarketingPage } from "@/components/marketing/marketing-page";
import {
  MARKETING_BUNDLE_SLUGS,
  getMarketingBundle,
  getMarketingBundleForLegacySolution,
} from "@/lib/marketing/marketing-bundles";
import { MARKETING_SOLUTION_SLUGS, type MarketingSolutionSlug } from "@/lib/marketing/solution-modules";
import { generateSolutionMetadata } from "@/lib/seo/generate-marketing-metadata";
import { MarketingSeoJsonLd } from "@/components/marketing/marketing-seo-json-ld";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return [...MARKETING_BUNDLE_SLUGS, ...MARKETING_SOLUTION_SLUGS].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const bundle = getMarketingBundle(slug);
  const legacyBundle = MARKETING_SOLUTION_SLUGS.includes(slug as MarketingSolutionSlug)
    ? getMarketingBundleForLegacySolution(slug as MarketingSolutionSlug)
    : undefined;
  const selected = bundle ?? legacyBundle;
  return generateSolutionMetadata(slug, selected
    ? { title: `${selected.label} — Digitify Lead Finder`, description: selected.description }
    : { title: "Oplossing — Digitify Lead Finder", description: "Ontdek de Lead Finder-bundels voor je commerciële flow." });
}

export default async function SolutionDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const bundle = getMarketingBundle(slug);
  if (bundle) {
    return <><DigitifyMarketingHead /><MarketingSeoJsonLd path={`/oplossingen/${slug}`} /><BundleDetailMarketingPage slug={bundle.slug} /></>;
  }

  if (MARKETING_SOLUTION_SLUGS.includes(slug as MarketingSolutionSlug)) {
    const legacyBundle = getMarketingBundleForLegacySolution(slug as MarketingSolutionSlug);
    if (legacyBundle) permanentRedirect(`/oplossingen/${legacyBundle.slug}`);
  }

  notFound();
}
