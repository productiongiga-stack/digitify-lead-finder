import type { Metadata } from "next";
import { NOINDEX_METADATA } from "@/lib/seo/build-metadata";

export const metadata: Metadata = NOINDEX_METADATA;

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
