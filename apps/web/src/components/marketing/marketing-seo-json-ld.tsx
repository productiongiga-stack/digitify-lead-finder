import { MarketingJsonLd } from "@/lib/seo/json-ld";
import { loadPublicSeoConfig } from "@/lib/seo/load-public-seo";

export async function MarketingSeoJsonLd({ path = "/" }: { path?: string }) {
  const config = await loadPublicSeoConfig();
  return <MarketingJsonLd config={config} path={path} />;
}
