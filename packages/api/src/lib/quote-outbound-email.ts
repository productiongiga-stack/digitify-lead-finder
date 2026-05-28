import { createHmac } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@digitify/db";
import { sendBrandedEmail } from "./email-sender";

export const QUOTE_ID_MARKER_RE = /\[\[QUOTE_ID=([^\]]+)\]\]/;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

function getQuotePdfTokenSecret() {
  const secret = process.env.QUOTE_PDF_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("QUOTE_PDF_TOKEN_SECRET or NEXTAUTH_SECRET must be set");
  return secret;
}

export function createQuotePdfToken(quoteId: string, validUntil?: Date | string | null) {
  const requestedExpiry = validUntil ? new Date(validUntil).getTime() : NaN;
  const fallbackExpiry = Date.now() + 1000 * 60 * 60 * 24 * 90;
  const expiresAt =
    Number.isFinite(requestedExpiry) && requestedExpiry > Date.now()
      ? requestedExpiry
      : fallbackExpiry;
  const payload = `${quoteId}.${expiresAt}`;
  const signature = createHmac("sha256", getQuotePdfTokenSecret())
    .update(payload)
    .digest("base64url");
  return `${expiresAt}.${signature}`;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "").trim();
}

export function appendQuoteIdMarker(body: string, quoteId: string) {
  return `${stripQuoteIdMarker(body)}\n\n[[QUOTE_ID=${quoteId}]]`;
}

export function stripQuoteIdMarker(body: string) {
  return body.replace(/\n?\[\[QUOTE_ID=[^\]]+\]\]\s*/g, "").trimEnd();
}

export function extractQuoteIdFromBody(body: string) {
  return body.match(QUOTE_ID_MARKER_RE)?.[1] ?? null;
}

type QuoteWithItems = {
  id: string;
  quoteNumber: string;
  clientName: string;
  clientCompany: string | null;
  clientEmail: string | null;
  total: number;
  validUntil: Date | null;
  notes: string | null;
  status: string;
  sentAt: Date | null;
  items: Array<{
    name: string;
    category: string | null;
    quantity: number;
    unitPrice: number;
  }>;
};

export function buildQuoteOutboundEmailBody(quote: QuoteWithItems) {
  const pdfToken = createQuotePdfToken(quote.id, quote.validUntil);
  const quoteUrl = `${getAppUrl()}/api/public/quotes/${quote.id}/pdf?token=${encodeURIComponent(pdfToken)}&download=0`;
  const summaryLines = quote.items.slice(0, 5).map(
    (item) => `- ${item.name}: ${item.category || "dienst"} · ${formatCurrency(item.quantity * item.unitPrice)}`,
  );
  const validUntilLabel = quote.validUntil
    ? new Date(quote.validUntil).toLocaleDateString("nl-BE")
    : "30 dagen na verzending";
  const attachmentName = `Offerte-${quote.quoteNumber}.pdf`;
  const body = [
    `Beste ${quote.clientName},`,
    ``,
    `Hierbij vindt u uw persoonlijke offerte op maat.`,
    ``,
    `Bijlage toegevoegd: ${attachmentName}`,
    `Offertenummer: ${quote.quoteNumber}`,
    `Totaalprijs: ${formatCurrency(quote.total)}`,
    `Geldig tot: ${validUntilLabel}`,
    ``,
    `Samenvatting van de voorgestelde diensten:`,
    ...summaryLines,
    ``,
    quote.notes
      ? `Opmerkingen: ${stripHtml(quote.notes)}`
      : "Klik op de knop hieronder om de volledige offerte te bekijken of te printen.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    body: `${body}\n\n[[CTA_TEXT=Bekijk offerte]]\n[[CTA_URL=${quoteUrl}]]`,
    attachmentName,
    quoteDownloadUrl: `${getAppUrl()}/api/public/quotes/${quote.id}/pdf?token=${encodeURIComponent(pdfToken)}&download=1`,
  };
}

export async function syncQuoteOutboundDrafts(
  db: PrismaClient,
  quoteId: string,
  workspaceId: string,
) {
  const quote = await db.quote.findFirst({
    where: { id: quoteId, createdById: workspaceId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!quote || !quote.clientEmail) return { updated: 0 };

  const { body } = buildQuoteOutboundEmailBody(quote);
  const subject = `Offerte ${quote.quoteNumber} voor ${quote.clientCompany || quote.clientName}`;
  const result = await db.emailDraft.updateMany({
    where: {
      type: "QUOTE",
      status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "FAILED"] },
      body: { contains: `[[QUOTE_ID=${quoteId}]]` },
      lead: { createdById: workspaceId },
    },
    data: {
      body: appendQuoteIdMarker(body, quoteId),
      subject,
      toEmail: quote.clientEmail,
    },
  });

  return { updated: result.count };
}

export async function sendApprovedQuoteDraft(
  db: PrismaClient,
  draft: {
    id: string;
    body: string;
    subject: string;
    toEmail: string;
    leadId: string;
    type: string;
  },
  userId: string,
  workspaceId: string,
) {
  if (draft.type !== "QUOTE") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Geen offerte-e-mail." });
  }

  const quoteId = extractQuoteIdFromBody(draft.body);
  if (!quoteId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Offerte-referentie ontbreekt in de outbound draft.",
    });
  }

  const quote = await db.quote.findFirst({
    where: { id: quoteId, createdById: workspaceId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!quote) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Gekoppelde offerte niet gevonden." });
  }

  await syncQuoteOutboundDrafts(db, quote.id, workspaceId);

  const freshQuote = await db.quote.findFirst({
    where: { id: quoteId, createdById: workspaceId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!freshQuote) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Gekoppelde offerte niet gevonden." });
  }

  const { body: composedBody } = buildQuoteOutboundEmailBody(freshQuote);
  const subject = `Offerte ${freshQuote.quoteNumber} voor ${freshQuote.clientCompany || freshQuote.clientName}`;
  const pdfToken = createQuotePdfToken(freshQuote.id, freshQuote.validUntil);
  const attachmentName = `Offerte-${freshQuote.quoteNumber}.pdf`;
  const quoteDownloadUrl = `${getAppUrl()}/api/public/quotes/${freshQuote.id}/pdf?token=${encodeURIComponent(pdfToken)}&download=1`;

  const result = await sendBrandedEmail(db, {
    toEmail: draft.toEmail,
    subject,
    body: composedBody,
    recipientCompany: freshQuote.clientCompany || freshQuote.clientName,
    leadId: draft.leadId,
    layout: "proposal",
    userId,
    trackingDraftId: draft.id,
    placeholderContext: {
      quoteNumber: freshQuote.quoteNumber,
      offerTitle: `Offerte ${freshQuote.quoteNumber}`,
      offerPrice: formatCurrency(freshQuote.total),
    },
    attachments: [
      {
        filename: attachmentName,
        path: quoteDownloadUrl,
        contentType: "application/pdf",
      },
    ],
  });

  if (result.success) {
    await db.quote.update({
      where: { id: freshQuote.id },
      data: {
        status: freshQuote.status === "DRAFT" ? "SENT" : freshQuote.status,
        sentAt: freshQuote.sentAt || new Date(),
      },
    });
    await db.emailDraft.update({
      where: { id: draft.id },
      data: {
        subject,
        body: appendQuoteIdMarker(composedBody, freshQuote.id),
      },
    });
  }

  return result;
}
