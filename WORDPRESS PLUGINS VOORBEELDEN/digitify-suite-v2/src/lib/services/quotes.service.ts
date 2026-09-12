import { BaseService } from "./base.service";
import { Permission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { NotFoundError } from "@/lib/errors";
import { generateReference } from "@/lib/utils";
import type { CreateQuoteInput, UpdateQuoteInput } from "@/lib/validations/quotes";
import { Prisma } from "@prisma/client";

/**
 * Quotes (Offertes) Service
 *
 * Manages the full quote lifecycle:
 * DRAFT → SENT → VIEWED → ACCEPTED/DECLINED → INVOICED
 */
export class QuotesService extends BaseService {

  async list(filter?: { status?: string; contactId?: string; page?: number; perPage?: number }) {
    this.assertPermission(Permission.QUOTES_VIEW);

    const page = filter?.page ?? 1;
    const perPage = filter?.perPage ?? 25;

    const where: Prisma.QuoteWhereInput = {
      ...this.where,
      ...(filter?.status ? { status: filter.status as any } : {}),
      ...(filter?.contactId ? { contactId: filter.contactId } : {}),
    };

    const [quotes, total] = await Promise.all([
      this.db.quote.findMany({
        where,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
          organization: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.db.quote.count({ where }),
    ]);

    return { quotes, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } };
  }

  async getById(id: string) {
    this.assertPermission(Permission.QUOTES_VIEW);

    const quote = await this.db.quote.findFirst({
      where: { id, ...this.where },
      include: {
        contact: true,
        organization: true,
        sections: {
          include: { items: { orderBy: { position: "asc" } } },
          orderBy: { position: "asc" },
        },
      },
    });

    if (!quote) throw new NotFoundError("Quote", id);
    return quote;
  }

  /**
   * Create a new quote with sections and line items.
   * Auto-generates reference number and calculates totals.
   */
  async create(input: CreateQuoteInput) {
    this.assertPermission(Permission.QUOTES_CREATE);

    // Generate reference: OFF-2025-XXX
    const count = await this.db.quote.count({ where: this.where });
    const reference = generateReference("OFF", count + 1);

    // Calculate totals from sections
    let subtotal = 0;
    const sectionsData = input.sections.map((section, sIdx) => ({
      title: section.title,
      position: sIdx,
      items: {
        create: section.items.map((item, iIdx) => {
          const itemTotal = item.quantity * item.unitPrice;
          subtotal += itemTotal;
          return {
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: itemTotal,
            position: iIdx,
          };
        }),
      },
    }));

    const taxAmount = subtotal * (Number(input.taxRate) / 100);
    const total = subtotal + taxAmount - Number(input.discount ?? 0);

    const quote = await this.db.quote.create({
      data: {
        workspaceId: this.ctx.workspaceId,
        reference,
        title: input.title,
        contactId: input.contactId,
        organizationId: input.organizationId,
        dealId: input.dealId,
        taxRate: input.taxRate,
        discount: input.discount ?? 0,
        currency: input.currency ?? "EUR",
        introText: input.introText,
        footerText: input.footerText,
        notes: input.notes,
        validUntil: input.validUntil,
        subtotal,
        taxAmount,
        total,
        sections: { create: sectionsData },
      },
      include: {
        contact: true,
        sections: { include: { items: true } },
      },
    });

    await logActivity({
      workspaceId: this.ctx.workspaceId,
      userId: this.ctx.userId,
      type: "quote.created",
      summary: `Offerte ${reference} aangemaakt`,
      entityType: "quote",
      entityId: quote.id,
      contactId: input.contactId ?? undefined,
      metadata: { reference, total },
    });

    return quote;
  }

  /**
   * Mark a quote as sent. Updates status and logs activity.
   */
  async markAsSent(id: string) {
    this.assertPermission(Permission.QUOTES_SEND);

    const quote = await this.db.quote.findFirst({ where: { id, ...this.where } });
    if (!quote) throw new NotFoundError("Quote", id);

    const updated = await this.db.quote.update({
      where: { id },
      data: { status: "SENT", issuedAt: new Date() },
    });

    await logActivity({
      workspaceId: this.ctx.workspaceId,
      userId: this.ctx.userId,
      type: "quote.sent",
      summary: `Offerte ${quote.reference} verzonden`,
      entityType: "quote",
      entityId: id,
      contactId: quote.contactId ?? undefined,
    });

    return updated;
  }

  /**
   * Accept a quote (called from public proposal page).
   */
  async accept(id: string, signatureName?: string, signatureData?: string) {
    const quote = await this.db.quote.findFirst({ where: { id, ...this.where } });
    if (!quote) throw new NotFoundError("Quote", id);

    const updated = await this.db.quote.update({
      where: { id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        signatureName,
        signatureData,
      },
    });

    await logActivity({
      workspaceId: this.ctx.workspaceId,
      userId: this.ctx.userId,
      type: "quote.accepted",
      summary: `Offerte ${quote.reference} geaccepteerd`,
      entityType: "quote",
      entityId: id,
      contactId: quote.contactId ?? undefined,
    });

    // TODO: Trigger automation (e.g., auto-create invoice, send notification)

    return updated;
  }

  /**
   * Decline a quote (called from public proposal page).
   */
  async decline(id: string) {
    const quote = await this.db.quote.findFirst({ where: { id, ...this.where } });
    if (!quote) throw new NotFoundError("Quote", id);

    const updated = await this.db.quote.update({
      where: { id },
      data: { status: "DECLINED", declinedAt: new Date() },
    });

    await logActivity({
      workspaceId: this.ctx.workspaceId,
      userId: this.ctx.userId,
      type: "quote.declined",
      summary: `Offerte ${quote.reference} afgewezen`,
      entityType: "quote",
      entityId: id,
      contactId: quote.contactId ?? undefined,
    });

    return updated;
  }
}
