const INVOICE_ID_MARKER_RE = /\[\[INVOICE_ID=([^\]]+)\]\]/;

export function extractInvoiceIdFromDraftBody(body: string) {
  return body.match(INVOICE_ID_MARKER_RE)?.[1] ?? null;
}

export function buildInvoiceOutboundBody(invoice: {
  invoiceNumber: string;
  clientName: string;
  total: number;
  currency?: string;
  dueDate: string | Date;
  paymentReference: string;
  id: string;
}) {
  const due = new Date(invoice.dueDate).toLocaleDateString("nl-BE");
  const amount = new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: invoice.currency || "EUR",
  }).format(invoice.total);

  return [
    `Beste ${invoice.clientName},`,
    "",
    `In bijlage vindt u factuur ${invoice.invoiceNumber}.`,
    `Totaalbedrag: ${amount}`,
    `Vervaldatum: ${due}`,
    `Betalingsreferentie: ${invoice.paymentReference}`,
    "",
    "Met vriendelijke groeten,",
    "",
    `[[INVOICE_ID=${invoice.id}]]`,
  ].join("\n");
}

export function getInvoicePdfPath(invoiceId: string) {
  return `/api/invoices/${invoiceId}/pdf`;
}
