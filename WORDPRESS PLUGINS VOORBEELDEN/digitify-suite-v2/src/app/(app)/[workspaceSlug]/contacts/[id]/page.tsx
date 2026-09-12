import Link from "next/link";
import { ArrowLeft, Mail, Phone, Building2, Edit, Archive } from "lucide-react";
import { requireWorkspace } from "@/lib/auth-guard";
import { ContactsService } from "@/lib/services/contacts.service";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ActivityFeed } from "@/components/shared/activity-feed";
import { initials, formatCurrency, formatDate } from "@/lib/utils";

/**
 * Contact detail page — the canonical record detail pattern.
 *
 * Layout:
 * ┌──────────────────────────────┬──────────────┐
 * │ Contact header + info        │ Activity     │
 * │ Pipeline stage               │ Timeline     │
 * │ Tags                         │              │
 * │ Notes                        │              │
 * ├──────────────────────────────┤              │
 * │ Deals  | Quotes | Bookings  │              │
 * └──────────────────────────────┴──────────────┘
 */
export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;

  const { workspace, user, role, membership } =
    await requireWorkspace(workspaceSlug);

  const service = new ContactsService({
    workspaceId: workspace.id,
    userId: user.id,
    role,
    permissions: membership.permissions,
  });

  const contact = await service.getById(id);

  return (
    <>
      {/* Back link + breadcrumb */}
      <PageHeader
        title={`${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || contact.email}
        breadcrumbs={[
          { label: "Contacten", href: `/${workspaceSlug}/contacts` },
          { label: contact.firstName ?? contact.email },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted">
              <Edit className="h-4 w-4" />
              Bewerken
            </button>
            <button className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10">
              <Archive className="h-4 w-4" />
              Archiveren
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content — 2/3 */}
        <div className="space-y-6 lg:col-span-2">
          {/* Contact card */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {initials(`${contact.firstName ?? ""} ${contact.lastName ?? ""}`)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">
                    {contact.firstName} {contact.lastName}
                  </h2>
                  <StatusBadge status={contact.status} />
                </div>
                {contact.jobTitle && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {contact.jobTitle}
                  </p>
                )}

                {/* Contact info */}
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {contact.email}
                  </span>
                  {contact.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      {contact.phone}
                    </span>
                  )}
                  {contact.organization && (
                    <Link
                      href={`/${workspaceSlug}/organizations/${contact.organization.id}`}
                      className="flex items-center gap-1.5 hover:text-foreground"
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      {contact.organization.name}
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Tags */}
            {contact.contactTags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {contact.contactTags.map((ct) => (
                  <span
                    key={ct.tagId}
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: `${ct.tag.color}15`,
                      color: ct.tag.color,
                    }}
                  >
                    {ct.tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-3 text-sm font-semibold">Notities</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {contact.notes || "Geen notities."}
            </p>
          </div>

          {/* Related deals */}
          {contact.deals.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-3 text-sm font-semibold">
                Deals ({contact.deals.length})
              </h3>
              <div className="space-y-2">
                {contact.deals.map((deal) => (
                  <Link
                    key={deal.id}
                    href={`/${workspaceSlug}/deals/${deal.id}`}
                    className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div>
                      <p className="text-sm font-medium">{deal.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {deal.stage.name}
                      </p>
                    </div>
                    {deal.value && (
                      <span className="text-sm font-medium">
                        {formatCurrency(deal.value.toString())}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Related quotes */}
          {contact.quotes.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-3 text-sm font-semibold">
                Offertes ({contact.quotes.length})
              </h3>
              <div className="space-y-2">
                {contact.quotes.map((quote) => (
                  <Link
                    key={quote.id}
                    href={`/${workspaceSlug}/quotes/${quote.id}`}
                    className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {quote.reference}
                      </span>
                      <StatusBadge status={quote.status} />
                    </div>
                    <span className="text-sm font-medium">
                      {formatCurrency(quote.total.toString())}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar — Activity timeline — 1/3 */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-semibold">Activiteit</h3>
          <ActivityFeed activities={contact.activities} />
        </div>
      </div>
    </>
  );
}
