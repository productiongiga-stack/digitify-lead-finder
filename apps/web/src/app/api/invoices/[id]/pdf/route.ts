import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { getCurrentUser } from "@/lib/auth/session";
import { buildInvoicePdfHtml } from "@/lib/invoice-pdf";
import { renderQuotePdfBuffer } from "@/lib/quote-pdf";

export const runtime = "nodejs";

function parseJson(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  const userId = typeof (currentUser as any)?.id === "string" ? ((currentUser as any).id as string) : "";
  if (!userId) {
    return NextResponse.json({ error: "Niet geauthenticeerd." }, { status: 401 });
  }

  const { id } = await params;
  const row = await prisma.setting.findUnique({
    where: { key: `user:${userId}:invoices.items_json` },
    select: { value: true },
  });
  const parsed = parseJson(row?.value);
  const list = Array.isArray(parsed) ? parsed : [];
  const invoice = list.find((item) => item && typeof item === "object" && item.id === id);
  if (!invoice) {
    return NextResponse.json({ error: "Factuur niet gevonden." }, { status: 404 });
  }

  const html = buildInvoicePdfHtml({
    invoiceNumber: String(invoice.invoiceNumber || id),
    clientName: String(invoice.clientName || "Klant"),
    clientCompany: invoice.clientCompany ? String(invoice.clientCompany) : null,
    clientAddress: invoice.clientAddress ? String(invoice.clientAddress) : null,
    clientVat: invoice.clientVat ? String(invoice.clientVat) : null,
    issueDate: String(invoice.issueDate || new Date().toISOString()),
    dueDate: String(invoice.dueDate || new Date().toISOString()),
    subtotal: Number(invoice.subtotal || 0),
    vatRate: Number(invoice.vatRate || 0),
    vatAmount: Number(invoice.vatAmount || 0),
    total: Number(invoice.total || 0),
    currency: String(invoice.currency || "EUR"),
    paymentReference: String(invoice.paymentReference || "-"),
    notes: invoice.notes ? String(invoice.notes) : null,
    items: Array.isArray(invoice.items)
      ? invoice.items.map((item: any) => ({
          name: String(item?.name || "Item"),
          description: item?.description ? String(item.description) : null,
          quantity: Number(item?.quantity || 0),
          unitPrice: Number(item?.unitPrice || 0),
          total: Number(item?.total || 0),
        }))
      : [],
  });
  const pdf = await renderQuotePdfBuffer(html);
  const filename = `Factuur-${String(invoice.invoiceNumber || id)}.pdf`.replace(/[^a-zA-Z0-9-_.]/g, "-");

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
