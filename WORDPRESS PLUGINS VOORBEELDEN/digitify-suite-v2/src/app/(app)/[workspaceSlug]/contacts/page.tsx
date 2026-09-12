import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { requireWorkspace } from "@/lib/auth-guard";
import { ContactsService } from "@/lib/services/contacts.service";
import { contactFilterSchema } from "@/lib/validations/contacts";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { initials, timeAgo } from "@/lib/utils";

/**
 * Contacts list page — server component.
 *
 * Pattern: This is the canonical list page pattern used across the app.
 * - Server-side data fetching with service layer
 * - URL-based filtering (searchParams)
 * - Reusable page header, table, pagination
 * - Empty state handling
 */
export default async function ContactsPage({
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

  const service = new ContactsService({
    workspaceId: workspace.id,
    userId: user.id,
    role,
    permissions: membership.permissions,
  });

  // Parse filters from URL search params
  const filter = contactFilterSchema.parse({
    search: sp.search,
    status: sp.status,
    page: sp.page,
    perPage: sp.perPage,
    sortBy: sp.sortBy,
    sortOrder: sp.sortOrder,
  });

  const { contacts, pagination } = await service.list(filter);

  return (
    <>
      <PageHeader
        title="Contacten"
        description={`${pagination.total} contacten`}
        actions={
          <Link
            href={`/${workspaceSlug}/contacts?new=1`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Nieuw contact
          </Link>
        }
      />

      {contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Geen contacten gevonden"
          description="Voeg je eerste contact toe om je CRM te starten."
          action={
            <Link
              href={`/${workspaceSlug}/contacts?new=1`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Nieuw contact
            </Link>
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_120px_140px_120px] gap-4 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Contact</span>
            <span>Organisatie</span>
            <span>Status</span>
            <span>Tags</span>
            <span>Laatst actief</span>
          </div>

          {/* Rows */}
          {contacts.map((contact) => (
            <Link
              key={contact.id}
              href={`/${workspaceSlug}/contacts/${contact.id}`}
              className="grid grid-cols-[1fr_1fr_120px_140px_120px] gap-4 border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-muted/50"
            >
              {/* Name + email */}
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {initials(`${contact.firstName ?? ""} ${contact.lastName ?? ""}`)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {contact.firstName} {contact.lastName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {contact.email}
                  </p>
                </div>
              </div>

              {/* Organization */}
              <div className="flex items-center">
                <span className="truncate text-sm text-muted-foreground">
                  {contact.organization?.name ?? "—"}
                </span>
              </div>

              {/* Status */}
              <div className="flex items-center">
                <StatusBadge status={contact.status} />
              </div>

              {/* Tags */}
              <div className="flex items-center gap-1 overflow-hidden">
                {contact.contactTags.slice(0, 2).map((ct) => (
                  <span
                    key={ct.tagId}
                    className="inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${ct.tag.color}15`,
                      color: ct.tag.color,
                    }}
                  >
                    {ct.tag.name}
                  </span>
                ))}
                {contact.contactTags.length > 2 && (
                  <span className="text-xs text-muted-foreground">
                    +{contact.contactTags.length - 2}
                  </span>
                )}
              </div>

              {/* Last activity */}
              <div className="flex items-center">
                <span className="text-xs text-muted-foreground">
                  {contact.lastActivityAt
                    ? timeAgo(contact.lastActivityAt)
                    : "—"}
                </span>
              </div>
            </Link>
          ))}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
              <span>
                Pagina {pagination.page} van {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                {pagination.page > 1 && (
                  <Link
                    href={`/${workspaceSlug}/contacts?page=${pagination.page - 1}`}
                    className="rounded-md border border-border px-3 py-1 hover:bg-muted"
                  >
                    Vorige
                  </Link>
                )}
                {pagination.page < pagination.totalPages && (
                  <Link
                    href={`/${workspaceSlug}/contacts?page=${pagination.page + 1}`}
                    className="rounded-md border border-border px-3 py-1 hover:bg-muted"
                  >
                    Volgende
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
