import Link from "next/link";
import { Plus, SlidersHorizontal, Eye, FileInput, ExternalLink } from "lucide-react";
import { requireWorkspace } from "@/lib/auth-guard";
import { ConfiguratorService } from "@/lib/services/configurator.service";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { timeAgo } from "@/lib/utils";

/**
 * Configurators list — overview of all offerte builders / configurators.
 *
 * Shows name, status, submission count, last updated, and quick actions.
 */
export default async function ConfiguratorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspaceSlug } = await params;
  const sp = await searchParams;

  const { workspace, user, role, membership } =
    await requireWorkspace(workspaceSlug);

  const service = new ConfiguratorService({
    workspaceId: workspace.id,
    userId: user.id,
    role,
    permissions: membership.permissions,
  });

  const { configurators, pagination } = await service.list({
    status: sp.status as string | undefined,
    page: sp.page ? Number(sp.page) : undefined,
  });

  return (
    <>
      <PageHeader
        title="Configurators"
        description={`${pagination.total} configurator${pagination.total !== 1 ? "s" : ""}`}
        actions={
          <Link
            href={`/${workspaceSlug}/configurators/new`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Nieuwe configurator
          </Link>
        }
      />

      {configurators.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="Nog geen configurators"
          description="Maak je eerste offerte-configurator aan. Klanten kunnen zelf hun project samenstellen en direct een prijsindicatie ontvangen."
          action={
            <Link
              href={`/${workspaceSlug}/configurators/new`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Nieuwe configurator
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {configurators.map((config) => (
            <Link
              key={config.id}
              href={`/${workspaceSlug}/configurators/${config.id}`}
              className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md"
            >
              {/* Header */}
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: `${config.brandColor ?? "#6366f1"}15`,
                      color: config.brandColor ?? "#6366f1",
                    }}
                  >
                    <SlidersHorizontal className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold group-hover:text-primary">
                      {config.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      /{config.slug}
                    </p>
                  </div>
                </div>
                <StatusBadge status={config.status} />
              </div>

              {/* Description */}
              {config.description && (
                <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                  {config.description}
                </p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileInput className="h-3.5 w-3.5" />
                  {config._count.submissions} aanvragen
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {config._count.versions} versie{config._count.versions !== 1 ? "s" : ""}
                </span>
                <span className="ml-auto">
                  {timeAgo(config.updatedAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Pagina {pagination.page} van {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            {pagination.page > 1 && (
              <Link
                href={`/${workspaceSlug}/configurators?page=${pagination.page - 1}`}
                className="rounded-md border border-border px-3 py-1 hover:bg-muted"
              >
                Vorige
              </Link>
            )}
            {pagination.page < pagination.totalPages && (
              <Link
                href={`/${workspaceSlug}/configurators?page=${pagination.page + 1}`}
                className="rounded-md border border-border px-3 py-1 hover:bg-muted"
              >
                Volgende
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
