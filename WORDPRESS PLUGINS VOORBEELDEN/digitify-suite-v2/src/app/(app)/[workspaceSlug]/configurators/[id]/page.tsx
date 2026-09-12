import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Eye,
  Copy,
  Settings2,
  Layers,
  FileInput,
  Globe,
  Code2,
} from "lucide-react";
import { requireWorkspace } from "@/lib/auth-guard";
import { ConfiguratorService } from "@/lib/services/configurator.service";
import { generateConfiguratorEmbedCodes } from "@/lib/services/public-embed.service";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { timeAgo } from "@/lib/utils";

/**
 * Configurator detail page — builder hub.
 *
 * Layout:
 * - Header with status, actions (preview, publish, embed)
 * - Tabs: Builder | Submissions | Settings | Embed
 * - Current version overview with steps/blocks
 */
export default async function ConfiguratorDetailPage({
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

  // Get the active version (or latest)
  const activeVersion =
    configurator.versions.find(
      (v) => v.id === configurator.activeVersionId
    ) ?? configurator.versions[0];

  // Generate embed codes
  const embedCodes = generateConfiguratorEmbedCodes(configurator.slug);

  return (
    <>
      <PageHeader
        title={configurator.name}
        description={configurator.description ?? `/${configurator.slug}`}
        breadcrumbs={[
          { label: "Configurators", href: `/${workspaceSlug}/configurators` },
          { label: configurator.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={configurator.status} />

            {configurator.status === "PUBLISHED" && (
              <a
                href={embedCodes.hostedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
                Bekijk live
              </a>
            )}

            <Link
              href={`/${workspaceSlug}/configurators/${id}/builder`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Settings2 className="h-4 w-4" />
              Builder openen
            </Link>
          </div>
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Main content — 2/3 */}
        <div className="space-y-6 lg:col-span-2">
          {/* Version overview */}
          <section className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h2 className="text-sm font-semibold">
                    {activeVersion
                      ? `Versie ${activeVersion.versionNumber} — ${activeVersion.label ?? ""}`
                      : "Geen versie"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {activeVersion?.publishedAt
                      ? `Gepubliceerd ${timeAgo(activeVersion.publishedAt)}`
                      : "Nog niet gepubliceerd"}
                  </p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {configurator.versions.length} versie{configurator.versions.length !== 1 ? "s" : ""}
              </span>
            </div>

            {activeVersion ? (
              <div className="divide-y divide-border">
                {activeVersion.steps.map((step, idx) => (
                  <div key={step.id} className="p-5">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {idx + 1}
                      </span>
                      <h3 className="text-sm font-medium">{step.title}</h3>
                      {step.description && (
                        <span className="text-xs text-muted-foreground">
                          — {step.description}
                        </span>
                      )}
                    </div>
                    <div className="ml-8 flex flex-wrap gap-2">
                      {step.blocks.map((block) => (
                        <span
                          key={block.id}
                          className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-1 text-xs"
                        >
                          <span className="mr-1.5 font-mono text-[10px] text-muted-foreground">
                            {block.blockType.toLowerCase().replace("_", " ")}
                          </span>
                          {block.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Open de builder om stappen en blokken toe te voegen.
              </div>
            )}
          </section>

          {/* Recent submissions */}
          <section className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div className="flex items-center gap-3">
                <FileInput className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-sm font-semibold">
                  Recente aanvragen ({configurator._count.submissions})
                </h2>
              </div>
              <Link
                href={`/${workspaceSlug}/configurators/${id}/submissions`}
                className="text-xs text-primary hover:underline"
              >
                Alles bekijken
              </Link>
            </div>
            <div className="p-5 text-center text-sm text-muted-foreground">
              {configurator._count.submissions === 0
                ? "Nog geen aanvragen ontvangen."
                : "Bekijk alle aanvragen voor een overzicht."}
            </div>
          </section>
        </div>

        {/* Sidebar — 1/3 */}
        <div className="space-y-6">
          {/* Quick stats */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Overzicht
            </h3>
            <dl className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge status={configurator.status} />
                </dd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <dt className="text-muted-foreground">Aanvragen</dt>
                <dd className="font-medium">{configurator._count.submissions}</dd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <dt className="text-muted-foreground">Versies</dt>
                <dd className="font-medium">{configurator.versions.length}</dd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <dt className="text-muted-foreground">Stappen</dt>
                <dd className="font-medium">{activeVersion?.steps.length ?? 0}</dd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <dt className="text-muted-foreground">Prijsregels</dt>
                <dd className="font-medium">
                  {activeVersion?.pricingRules.length ?? 0}
                </dd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <dt className="text-muted-foreground">Aangemaakt</dt>
                <dd className="text-muted-foreground">
                  {timeAgo(configurator.createdAt)}
                </dd>
              </div>
            </dl>
          </section>

          {/* Embed codes */}
          {configurator.status === "PUBLISHED" && (
            <section className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Code2 className="h-3.5 w-3.5" />
                Embed & Delen
              </h3>

              <div className="space-y-3">
                {/* Hosted link */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Gehoste pagina
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs">
                      {embedCodes.hostedUrl}
                    </code>
                    <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* iframe */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    iframe embed
                  </label>
                  <div className="relative">
                    <pre className="max-h-24 overflow-auto rounded-md bg-muted p-2 text-[10px] leading-relaxed">
                      {embedCodes.iframe}
                    </pre>
                    <button className="absolute right-1.5 top-1.5 rounded-md bg-background p-1 text-muted-foreground shadow-sm hover:text-foreground">
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* JS snippet */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    JavaScript widget
                  </label>
                  <div className="relative">
                    <pre className="max-h-24 overflow-auto rounded-md bg-muted p-2 text-[10px] leading-relaxed">
                      {embedCodes.jsSnippet}
                    </pre>
                    <button className="absolute right-1.5 top-1.5 rounded-md bg-background p-1 text-muted-foreground shadow-sm hover:text-foreground">
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
