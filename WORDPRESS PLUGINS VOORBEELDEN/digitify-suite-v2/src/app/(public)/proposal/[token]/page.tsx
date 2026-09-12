import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";

/**
 * Public proposal page — client-facing view of a quote.
 *
 * This is the page clients see when they receive a quote link.
 * No auth required. Tracked by publicToken.
 *
 * Features:
 * - Branded header with workspace logo/colors
 * - Full quote document
 * - Accept/decline actions
 * - Signature capture
 * - Auto-marks as "viewed" on load
 */
export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const quote = await db.quote.findUnique({
    where: { publicToken: token },
    include: {
      workspace: {
        include: { brandProfile: true },
      },
      contact: true,
      organization: true,
      sections: {
        include: { items: { orderBy: { position: "asc" } } },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!quote || quote.status === "DRAFT") {
    notFound();
  }

  // Mark as viewed (first view only)
  if (!quote.viewedAt && quote.status === "SENT") {
    await db.quote.update({
      where: { id: quote.id },
      data: {
        viewedAt: new Date(),
        status: "VIEWED",
      },
    });
  }

  const brand = quote.workspace.brandProfile;
  const brandColor = brand?.primaryColor ?? quote.workspace.brandColor;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Branded header */}
      <header
        className="py-8 text-white"
        style={{ backgroundColor: brandColor }}
      >
        <div className="mx-auto max-w-3xl px-6">
          <div className="flex items-center justify-between">
            <div>
              {brand?.logoUrl ? (
                <img src={brand.logoUrl} alt="" className="h-10" />
              ) : (
                <h1 className="text-2xl font-bold">
                  {brand?.companyName ?? quote.workspace.name}
                </h1>
              )}
              {brand?.email && (
                <p className="mt-1 text-sm opacity-80">{brand.email}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{quote.reference}</p>
              <p className="text-sm opacity-80">
                {quote.issuedAt ? formatDate(quote.issuedAt) : formatDate(quote.createdAt)}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Quote body */}
      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Client info */}
          <div className="border-b border-gray-100 p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Opgesteld voor
            </p>
            <p className="mt-1 text-lg font-medium text-gray-900">
              {quote.contact
                ? `${quote.contact.firstName ?? ""} ${quote.contact.lastName ?? ""}`.trim()
                : "—"}
            </p>
            {quote.organization && (
              <p className="text-sm text-gray-500">{quote.organization.name}</p>
            )}
            {quote.validUntil && (
              <p className="mt-2 text-xs text-gray-400">
                Geldig tot {formatDate(quote.validUntil)}
              </p>
            )}
          </div>

          {/* Intro */}
          {quote.introText && (
            <div className="border-b border-gray-100 p-8">
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                {quote.introText}
              </p>
            </div>
          )}

          {/* Sections + line items */}
          <div className="p-8">
            {quote.sections.map((section) => (
              <div key={section.id} className="mb-8 last:mb-0">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">
                  {section.title}
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      <th className="py-2 text-left">Dienst / Omschrijving</th>
                      <th className="py-2 text-right w-28">Prijs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100 last:border-0">
                        <td className="py-3 text-gray-700">{item.description}</td>
                        <td className="py-3 text-right font-medium text-gray-900">
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
          <div className="border-t border-gray-200 p-8">
            <div className="ml-auto w-64 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotaal</span>
                <span>{formatCurrency(quote.subtotal.toString())}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>BTW ({Number(quote.taxRate)}%)</span>
                <span>{formatCurrency(quote.taxAmount.toString())}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold text-gray-900">
                <span>Totaal</span>
                <span>{formatCurrency(quote.total.toString())}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          {quote.footerText && (
            <div className="border-t border-gray-100 p-8">
              <p className="text-xs text-gray-400 whitespace-pre-wrap">
                {quote.footerText}
              </p>
            </div>
          )}
        </div>

        {/* Accept / Decline actions */}
        {(quote.status === "SENT" || quote.status === "VIEWED") && (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">
              Wat vindt u van deze offerte?
            </h3>
            <p className="text-sm text-gray-500">
              Klik hieronder om de offerte te accepteren of af te wijzen.
            </p>
            <div className="flex gap-3">
              <button
                className="rounded-lg px-8 py-3 text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: brandColor }}
              >
                ✓ Offerte accepteren
              </button>
              <button className="rounded-lg border border-gray-300 px-8 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
                ✕ Afwijzen
              </button>
            </div>
          </div>
        )}

        {/* Already accepted/declined */}
        {quote.status === "ACCEPTED" && (
          <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <p className="text-sm font-medium text-emerald-700">
              ✓ Deze offerte is geaccepteerd op{" "}
              {quote.acceptedAt ? formatDate(quote.acceptedAt) : "—"}
            </p>
          </div>
        )}

        {quote.status === "DECLINED" && (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm font-medium text-red-700">
              ✕ Deze offerte is afgewezen
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-gray-400">
        Powered by{" "}
        <a href="https://digitify.be" className="underline">
          Digitify Suite
        </a>
      </footer>
    </div>
  );
}
