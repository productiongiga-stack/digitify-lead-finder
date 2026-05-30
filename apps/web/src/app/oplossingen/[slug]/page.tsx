import type { Metadata } from "next";
import { getSolutionModuleBySlug } from "@/components/marketing/marketing-page";
import { MarketingSeoJsonLd } from "@/components/marketing/marketing-seo-json-ld";
import { generateSolutionMetadata } from "@/lib/seo/generate-marketing-metadata";
import { SolutionDetailClient } from "./solution-detail-client";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const module = getSolutionModuleBySlug(slug);
  const fallback = module
    ? { title: `${module.label} — ${module.title}`, description: module.description }
    : {
        title: "Oplossing — Digitify Lead Finder",
        description: "Ontdek hoe Digitify Lead Finder jouw commerciële flow versnelt.",
      };
  return generateSolutionMetadata(slug, fallback);
}

export default async function SolutionDetailPage({ params }: PageProps) {
  const { slug } = await params;
  return (
    <>
      <MarketingSeoJsonLd path={`/oplossingen/${slug}`} />
      <SolutionDetailClient slug={slug} />
    </>
  );
}
