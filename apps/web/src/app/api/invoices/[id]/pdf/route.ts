import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { getCurrentUser, workspaceIdFor } from "@/lib/auth/session";
import { buildInvoicePdfHtml } from "@/lib/invoice-pdf";
import { renderQuotePdfBuffer } from "@/lib/quote-pdf";

export const runtime = "nodejs";

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9-_.]/g, "-");
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || typeof (currentUser as { id?: string }).id !== "string") {
    return NextResponse.json({ error: "Niet geauthenticeerd." }, { status: 401 });
  }

  const workspaceId = workspaceIdFor(currentUser as { id: string; workspaceId?: string });
  const { id } = await params;

  const row = await prisma.workspaceInvoice.findFirst({
    where: { id, createdById: workspaceId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!row) {
    return NextResponse.json({ error: "Factuur niet gevonden." }, { status: 404 });
  }

  const html = buildInvoicePdfHtml({
    invoiceNumber: row.invoiceNumber,
    clientName: row.clientName,
    clientCompany: row.clientCompany,
    clientAddress: row.clientAddress,
    clientVat: row.clientVat,
    issueDate: row.issueDate.toISOString(),
    dueDate: row.dueDate.toISOString(),
    subtotal: row.subtotal,
    vatRate: row.vatRate,
    vatAmount: row.vatAmount,
    total: row.total,
    currency: row.currency,
    paymentReference: row.paymentReference,
    notes: row.notes,
    items: row.items.map((item) => ({
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
  });

  const pdf = await renderQuotePdfBuffer(html);
  const filename = `Factuur-${sanitizeFilename(row.invoiceNumber || id)}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
