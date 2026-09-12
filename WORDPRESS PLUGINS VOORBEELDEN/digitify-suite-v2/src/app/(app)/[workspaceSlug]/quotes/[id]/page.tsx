import Link from "next/link";
import { Send, Download, Copy, ExternalLink } from "lucide-react";
import { requireWorkspace } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";

/**
 * Quote detail page — shows full quote document with line items,
 * status actions, and public link sharing.
 *
 * Mirrors the offerte detail from the v1 prototype but with proper
 * data fetching, service layer, and component separation.
 */
export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;
  const { workspace } = await requireWorkspace(workspaceSlug);

  const quote = await db.quote.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      contact: true,
      organization: true,
      sections: {
        include: { items: { orderBy: { position: "asc" } } },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!quote) notFound();

  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL}/proposal/${quote.publicToken}`;

  return (
    <>
      <PageHeader
        title={quote.reference}
        breadcrumbs={[
          { label: "Offertes", href: `/${workspaceSlug}/quotes` },
          { label: quote.reference },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {/* Copy public link */}
            <button className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted">
              <Copy className="h-4 w-4" />
              Link kopiëren
            </button>

            {/* View public page */}
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              <ExternalLink className="h-4 w-4" />
              Bekijken als klant
            </a>

            {/* Download PDF */}
            <button className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted">
              <Download className="h-4 w-4" />
              PDF
            </button>

            {/* Send */}
            {quote.status === "DRAFT" && (
              <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                <Send className="h-4 w-4" />
                Verzenden
              </button>
            )}
          </div>
        }
      />

      {/* Quote document */}
      <div className="rounded-xl border border-border bg-card">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border p-8">
          <div>
            <h2 className="text-2xl font-bold text-primary">
              {workspace.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {quote.title || "Offerte"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{quote.reference}</p>
            <StatusBadge status={quote.status} className="mt-2" />
          </div>
        </div>

        {/* Client + dates */}
        <div className="grid grid-cols-2 gap-8 border-b border-border p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Klant
            </p>
            <p className="mt-1 text-sm font-medium">
              {quote.contact
                ? `${quote.contact.firstName ?? ""} ${quote.contact.lastName ?? ""}`.trim()
                : "—"}
            </p>
            {quote.contact?.email && (
              <p className="text-sm text-muted-foreground">
                {quote.contact.email}
              </p>
            )}
            {quote.organization && (
              <p className="text-sm text-muted-foreground">
                {quote.organization.name}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Datum
              </p>
              <p className="mt-1 text-sm">
                {quote.issuedAt ? formatDate(quote.issuedAt) : formatDate(quote.createdAt)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Geldig tot
              </p>
              <p className="mt-1 text-sm">
                {quote.validUntil ? formatDate(quote.validUntil) : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Intro text */}
        {quote.introText && (
          <div className="border-b border-border p-8">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {quote.introText}
            </p>
          </div>
        )}

        {/* Line items by section */}
        <div className="p-8">
          {quote.sections.map((section) => (
            <div key={section.id} className="mb-8 last:mb-0">
              <h3 className="mb-3 text-sm font-semibold">{section.title}</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 text-left">Omschrijving</th>
                    <th className="py-2 text-right w-20">Aantal</th>
                    <th className="py-2 text-right w-28">Prijs</th>
                    <th className="py-2 text-right w-28">Totaal</th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="py-3">{item.description}</td>
                      <td className="py-3 text-right text-muted-foreground">
                        {Number(item.quantity)}
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        {formatCurrency(item.unitPrice.toString())}
                      </td>
                      <td className="py-3 text-right font-medium">
                        {formatCurrency(item.total.toString())}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-border p-8">
          <div className="ml-auto w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotaal</span>
              <span>{formatCurrency(quote.subtotal.toString())}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                BTW ({Number(quote.taxRate)}%)
              </span>
              <span>{formatCurrency(quote.taxAmount.toString())}</span>
            </div>
            {Number(quote.discount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Korting</span>
                <span>-{formatCurrency(quote.discount.toString())}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <span>Totaal</span>
              <span>{formatCurrency(quote.total.toString())}</span>
            </div>
          </div>
        </div>

        {/* Footer text / terms */}
        {quote.footerText && (
          <div className="border-t border-border p-8">
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
              {quote.footerText}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
