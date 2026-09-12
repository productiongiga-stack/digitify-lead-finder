import { requireWorkspace } from "@/lib/auth-guard";
import { ConfiguratorService } from "@/lib/services/configurator.service";
import { ConfiguratorBuilder } from "@/components/modules/configurator/configurator-builder";

/**
 * Configurator Builder page — the premium 3-panel editor.
 *
 * Full-screen builder with:
 * - Left panel: step/block structure tree
 * - Center: live preview of the configurator
 * - Right panel: settings for selected block/step/pricing
 *
 * This is a thin server-component wrapper that loads data
 * and delegates to the client-side builder shell.
 */
export default async function ConfiguratorBuilderPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;

  const { workspace, user, role, membership } =
    await requireWorkspace(workspaceSlug);

  const service = new ConfiguratorService({
    workspaceId: workspace.id,
    userId: user.id,
    role,
    permissions: membership.permissions,
  });

  const configurator = await service.getById(id);

  // Get latest version or empty state
  const latestVersion = configurator.versions[0] ?? null;

  return (
    <ConfiguratorBuilder
      configurator={{
        id: configurator.id,
        name: configurator.name,
        slug: configurator.slug,
        status: configurator.status,
        brandColor: configurator.brandColor,
        brandLogoUrl: configurator.brandLogoUrl,
        backgroundColor: configurator.backgroundColor,
        accentColor: configurator.accentColor,
        fontFamily: configurator.fontFamily,
      }}
      version={
        latestVersion
          ? {
              id: latestVersion.id,
              versionNumber: latestVersion.versionNumber,
              label: latestVersion.label,
              steps: latestVersion.steps.map((step) => ({
                id: step.id,
                title: step.title,
                description: step.description,
                position: step.position,
                icon: step.icon,
                condition: step.condition as Record<string, any> | null,
                blocks: step.blocks.map((block) => ({
                  id: block.id,
                  blockType: block.blockType,
                  fieldKey: block.fieldKey,
                  label: block.label,
                  helpText: block.helpText,
                  position: block.position,
                  config: block.config as Record<string, any>,
                  isRequired: block.isRequired,
                  validation: block.validation as Record<string, any> | null,
                  condition: block.condition as Record<string, any> | null,
                  pricingKeys: block.pricingKeys,
                })),
              })),
              pricingRules: latestVersion.pricingRules.map((rule) => ({
                id: rule.id,
                key: rule.key,
                label: rule.label,
                ruleType: rule.ruleType,
                position: rule.position,
                config: rule.config as Record<string, any>,
                isOptional: rule.isOptional,
              })),
            }
          : null
      }
      workspaceSlug={workspaceSlug}
    />
  );
}
