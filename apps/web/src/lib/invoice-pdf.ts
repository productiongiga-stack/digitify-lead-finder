export type InvoicePdfItem = {
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type InvoicePdfData = {
  invoiceNumber: string;
  clientName: string;
  clientCompany?: string | null;
  clientAddress?: string | null;
  clientVat?: string | null;
  issueDate: string | Date;
  dueDate: string | Date;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  currency: string;
  paymentReference: string;
  notes?: string | null;
  items: InvoicePdfItem[];
};

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: currency || "EUR",
  }).format(amount || 0);
}

function dateLabel(value: string | Date) {
  return new Date(value).toLocaleDateString("nl-BE");
}

export function buildInvoicePdfHtml(invoice: InvoicePdfData) {
  const rows = invoice.items
    .map(
      (item) => `
      <tr>
        <td>
          <div>${esc(item.name)}</div>
          ${item.description ? `<div style="font-size:11px;color:#64748b">${esc(item.description)}</div>` : ""}
        </td>
        <td style="text-align:right">${item.quantity}</td>
        <td style="text-align:right">${esc(money(item.unitPrice, invoice.currency))}</td>
        <td style="text-align:right;font-weight:600">${esc(money(item.total, invoice.currency))}</td>
      </tr>
    `,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, Arial, sans-serif; color: #0f172a; background: #f8fafc; }
    .page { padding: 28px; }
    .head { display: flex; justify-content: space-between; align-items: start; }
    .title { font-size: 26px; font-weight: 700; margin: 0; }
    .meta { margin-top: 8px; color: #475569; font-size: 12px; line-height: 1.5; }
    .card { margin-top: 16px; border: 1px solid #e2e8f0; background: #fff; border-radius: 12px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; background: #0f172a; color: #fff; padding: 10px 12px; font-weight: 600; }
    td { padding: 10px 12px; border-top: 1px solid #e2e8f0; vertical-align: top; }
    .totals { margin-top: 14px; margin-left: auto; width: 300px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; padding: 10px 12px; }
    .line { display: flex; justify-content: space-between; margin: 6px 0; font-size: 13px; }
    .line strong { font-size: 15px; }
    .footer { margin-top: 14px; color: #475569; font-size: 12px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="page">
    <div class="head">
      <div>
        <h1 class="title">Factuur ${esc(invoice.invoiceNumber)}</h1>
        <div class="meta">
          Uitgiftedatum: ${esc(dateLabel(invoice.issueDate))}<br />
          Vervaldatum: ${esc(dateLabel(invoice.dueDate))}<br />
          Referentie: ${esc(invoice.paymentReference)}
        </div>
      </div>
      <div class="meta">
        <strong>${esc(invoice.clientCompany || invoice.clientName)}</strong><br />
        ${esc(invoice.clientName)}<br />
        ${esc(invoice.clientAddress || "-")}<br />
        BTW: ${esc(invoice.clientVat || "-")}
      </div>
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Omschrijving</th>
            <th style="text-align:right">Aantal</th>
            <th style="text-align:right">Eenheidsprijs</th>
            <th style="text-align:right">Totaal</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>

    <div class="totals">
      <div class="line"><span>Subtotaal</span><span>${esc(money(invoice.subtotal, invoice.currency))}</span></div>
      <div class="line"><span>BTW (${invoice.vatRate}%)</span><span>${esc(money(invoice.vatAmount, invoice.currency))}</span></div>
      <div class="line"><strong>Totaal</strong><strong>${esc(money(invoice.total, invoice.currency))}</strong></div>
    </div>

    <div class="footer">
      ${invoice.notes ? esc(invoice.notes) + "<br />" : ""}
      Gelieve te betalen met referentie <strong>${esc(invoice.paymentReference)}</strong>.
    </div>
  </div>
</body>
</html>`;
}
