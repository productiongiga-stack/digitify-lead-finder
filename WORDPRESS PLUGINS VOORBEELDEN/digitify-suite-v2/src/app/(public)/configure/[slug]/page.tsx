import { notFound } from "next/navigation";
import { ConfiguratorService } from "@/lib/services/configurator.service";
import { PublicConfiguratorWizard } from "@/components/modules/configurator/public-configurator-wizard";
import type { Metadata } from "next";

/**
 * Public configurator page — hosted version at /configure/[slug].
 *
 * Full-page branded configurator wizard. No authentication required.
 * Renders the active version's steps with live pricing.
 *
 * This is the "hosted page" option in the Distribution Layer.
 * For embed versions, see /embed/configurator/[slug].
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await ConfiguratorService.getPublicBySlug(slug);

  if (!data) return { title: "Niet gevonden" };

  const brandName =
    data.workspace.brandProfile?.companyName ?? data.workspace.name;

  return {
    title: `${data.name} — ${brandName}`,
    description: data.description ?? `Configureer uw project bij ${brandName}`,
  };
}

export default async function PublicConfiguratorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await ConfiguratorService.getPublicBySlug(slug);

  if (!data || !data.activeVersion) {
    notFound();
  }

  const brand = data.workspace.brandProfile;
  const brandColor =
    data.brandColor ?? brand?.primaryColor ?? data.workspace.brandColor;
  const brandLogo =
    data.brandLogoUrl ?? brand?.logoUrl ?? data.workspace.logo;
  const brandName = brand?.companyName ?? data.workspace.name;

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: data.backgroundColor ?? "#f8fafc",
        fontFamily: data.fontFamily ?? "inherit",
      }}
    >
      {/* Brand header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {brandLogo ? (
            <img
              src={brandLogo}
              alt={brandName}
              className="h-8 w-auto"
            />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: brandColor }}
            >
              {brandName.charAt(0)}
            </div>
          )}
          <span className="text-sm font-semibold text-gray-900">
            {brandName}
          </span>
        </div>
      </header>

      {/* Configurator wizard */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
          {data.description && (
            <p className="mt-2 text-gray-600">{data.description}</p>
          )}
        </div>

        <PublicConfiguratorWizard
          configuratorId={data.id}
          steps={data.activeVersion.steps.map((step) => ({
            id: step.id,
            title: step.title,
            description: step.description,
            icon: step.icon,
            condition: step.condition as Record<string, any> | null,
            blocks: step.blocks.map((block) => ({
              id: block.id,
              blockType: block.blockType,
              fieldKey: block.fieldKey,
              label: block.label,
              helpText: block.helpText,
              config: block.config as Record<string, any>,
              isRequired: block.isRequired,
              condition: block.condition as Record<string, any> | null,
              pricingKeys: block.pricingKeys,
            })),
          }))}
          pricingRules={data.activeVersion.pricingRules.map((rule) => ({
            key: rule.key,
            label: rule.label,
            ruleType: rule.ruleType,
            config: rule.config as Record<string, any>,
            isOptional: rule.isOptional,
            position: rule.position,
          }))}
          brandColor={brandColor}
          source="hosted"
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-6 py-4 text-center text-xs text-gray-400">
        Powered by{" "}
        <a
          href="https://digitify.be"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-gray-500 hover:text-gray-700"
        >
          Digitify Suite
        </a>
      </footer>
    </div>
  );
}
