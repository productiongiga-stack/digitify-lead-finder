import { notFound } from "next/navigation";
import { ConfiguratorService } from "@/lib/services/configurator.service";
import { PublicConfiguratorWizard } from "@/components/modules/configurator/public-configurator-wizard";
import { EmbedShell } from "@/components/embed/embed-shell";
import { EmbedAutoResize } from "@/components/embed/embed-auto-resize";

/**
 * Embed configurator page — stripped-down version for iframe/widget embedding.
 *
 * Differences from hosted page (/configure/[slug]):
 * - No full header/footer (optional via query params)
 * - Includes auto-resize postMessage script
 * - Sets frame-ancestors CSP header
 * - Minimal chrome, maximum content area
 */
export default async function EmbedConfiguratorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const data = await ConfiguratorService.getPublicBySlug(slug);
  if (!data || !data.activeVersion) {
    notFound();
  }

  const hideHeader = sp.hideHeader === "1";
  const hideFooter = sp.hideFooter === "1";

  const brand = data.workspace.brandProfile;
  const brandColor =
    data.brandColor ?? brand?.primaryColor ?? data.workspace.brandColor;
  const brandName = brand?.companyName ?? data.workspace.name;
  const brandLogo =
    data.brandLogoUrl ?? brand?.logoUrl ?? data.workspace.logo;

  return (
    <EmbedShell
      backgroundColor={data.backgroundColor ?? "#ffffff"}
      fontFamily={data.fontFamily}
    >
      {/* Auto-resize for parent iframe */}
      <EmbedAutoResize />

      {/* Optional minimal header */}
      {!hideHeader && (
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
          {brandLogo ? (
            <img src={brandLogo} alt={brandName} className="h-6 w-auto" />
          ) : (
            <div
              className="flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white"
              style={{ backgroundColor: brandColor }}
            >
              {brandName.charAt(0)}
            </div>
          )}
          <span className="text-xs font-medium text-gray-700">
            {data.name}
          </span>
        </div>
      )}

      {/* Wizard content */}
      <div className="p-4 sm:p-6">
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
          source="embed-iframe"
          compact
        />
      </div>

      {/* Optional powered-by footer */}
      {!hideFooter && (
        <div className="border-t border-gray-100 px-4 py-2 text-center text-[10px] text-gray-400">
          Powered by{" "}
          <a
            href="https://digitify.be"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-600"
          >
            Digitify
          </a>
        </div>
      )}
    </EmbedShell>
  );
}
