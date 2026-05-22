import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { getCurrentUser, workspaceIdFor } from "@/lib/auth/session";
import { log } from "@digitify/api/src/lib/logger";

async function resolveLeadId(params: {
  workspaceId: string;
  memberId: string;
  leadId?: string;
  chatSessionId?: string;
  clientEmail: string;
  clientCompany: string;
  clientName: string;
  clientPhone: string;
}) {
  if (params.leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: params.leadId, createdById: params.workspaceId },
      select: { id: true },
    });
    if (lead) return lead.id;
  }

  if (params.chatSessionId) {
    const session = await prisma.chatSession.findFirst({
      where: {
        id: params.chatSessionId,
        OR: [
          { lead: { createdById: params.workspaceId } },
          { assignedToId: params.memberId },
          { tags: { has: `tenant:${params.workspaceId}` } },
        ],
      },
      select: {
        id: true,
        leadId: true,
        visitorCompany: true,
        visitorName: true,
        visitorEmail: true,
        visitorPhone: true,
        intent: true,
      },
    });
    if (session?.leadId) return session.leadId;
    if (session) {
      const lead = await prisma.lead.create({
        data: {
          companyName:
            params.clientCompany ||
            session.visitorCompany ||
            session.visitorName ||
            params.clientName ||
            "Chatbot Lead",
          email: params.clientEmail || session.visitorEmail,
          phone: params.clientPhone || session.visitorPhone,
          source: "chatbot",
          industry: session.intent || undefined,
          createdById: params.workspaceId,
        },
        select: { id: true },
      });
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { leadId: lead.id },
      });
      return lead.id;
    }
  }

  const companyCandidate = (params.clientCompany || params.clientName).trim();
  if (!params.clientEmail && !companyCandidate) return null;

  const existingLead = await prisma.lead.findFirst({
    where: {
      createdById: params.workspaceId,
      OR: [
        ...(params.clientEmail ? [{ email: params.clientEmail.toLowerCase() }] : []),
        ...(companyCandidate ? [{ companyName: companyCandidate }] : []),
      ],
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });
  return existingLead?.id ?? null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const clientName = String(body.clientName || "").trim().slice(0, 200);
    const clientAddress = String(body.clientAddress || "").trim().slice(0, 500);
    const clientVat = String(body.clientVat || "").trim().slice(0, 50);
    const clientEmail = String(body.clientEmail || "").trim().slice(0, 254);
    const clientCompany = String(body.clientCompany || "").trim().slice(0, 200);
    const clientPhone = String(body.clientPhone || "").trim().slice(0, 50);
    const notes = String(body.notes || "").trim().slice(0, 3000);
    const leadId = String(body.leadId || "").trim();
    const chatSessionId = String(body.chatSessionId || "").trim();
    const quoteId = String(body.quoteId || "").trim();
    const discountRaw = Number(body.discount || 0);
    const vatRateRaw = Number(body.vatRate || 21);
    const items = Array.isArray(body.items) ? body.items.slice(0, 50) : [];

    if (!clientName || !items.length) {
      return NextResponse.json(
        { error: "Klantnaam en minstens één dienst zijn verplicht." },
        { status: 400 },
      );
    }

    if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      return NextResponse.json({ error: "Geldig e-mailadres is verplicht." }, { status: 400 });
    }

    const normalizedItems = items
      .map((item: any, index: number) => {
        const quantity = Math.max(1, Number(item.quantity || 1));
        const unitPrice = Math.max(0, Number(item.unitPrice || 0));
        return {
          category: String(item.category || "extras").slice(0, 120),
          name: String(item.name || "").trim().slice(0, 240),
          description: String(item.description || "").trim().slice(0, 1000) || null,
          quantity,
          unitPrice,
          total: quantity * unitPrice,
          sortOrder: index,
        };
      })
      .filter((item: { name: string }) => item.name);

    if (!normalizedItems.length) {
      return NextResponse.json(
        { error: "Minstens één geldige dienst is verplicht." },
        { status: 400 },
      );
    }

    const subtotal = normalizedItems.reduce(
      (sum: number, item: { total: number }) => sum + item.total,
      0,
    );
    const discount = Math.max(0, Math.min(subtotal, Number.isFinite(discountRaw) ? discountRaw : 0));
    const vatRate = Math.max(0, Number.isFinite(vatRateRaw) ? vatRateRaw : 21);
    const discountedSubtotal = subtotal - discount;
    const vatAmount = Math.round(discountedSubtotal * (vatRate / 100) * 100) / 100;
    const total = discountedSubtotal + vatAmount;

    const workspaceId = workspaceIdFor(user);
    const resolvedLeadId = await resolveLeadId({
      workspaceId,
      memberId: user.id,
      leadId,
      chatSessionId,
      clientEmail,
      clientCompany,
      clientName,
      clientPhone,
    });

    if (quoteId) {
      const existingQuote = await prisma.quote.findFirst({
        where: { id: quoteId, createdById: workspaceId },
        select: { id: true, quoteNumber: true, leadId: true },
      });

      if (!existingQuote) {
        return NextResponse.json({ error: "Offerte niet gevonden." }, { status: 404 });
      }

      const quote = await prisma.$transaction(async (tx) => {
        await tx.quoteItem.deleteMany({ where: { quoteId: existingQuote.id } });
        await tx.quoteItem.createMany({
          data: normalizedItems.map((item: any) => ({
            ...item,
            quoteId: existingQuote.id,
          })),
        });

        const updated = await tx.quote.update({
          where: { id: existingQuote.id },
          data: {
            leadId: resolvedLeadId || existingQuote.leadId,
            clientName,
            clientEmail,
            clientCompany: clientCompany || null,
            clientPhone: clientPhone || null,
            clientAddress: clientAddress || null,
            clientVat: clientVat || null,
            notes: notes || "Bijgewerkt via interne offerte-configurator.",
            subtotal,
            vatRate,
            discount,
            vatAmount,
            total,
          },
          select: { id: true, quoteNumber: true, leadId: true },
        });

        await tx.activity.create({
          data: {
            leadId: updated.leadId,
            userId: user.id,
            type: "LEAD_UPDATED",
            title: `Offerte ${updated.quoteNumber} bijgewerkt via configurator`,
            metadata: {
              quoteId: updated.id,
              total,
              itemCount: normalizedItems.length,
              source: "configurator.update",
            },
          },
        });

        return updated;
      });

      if (chatSessionId) {
        await prisma.chatMessage.create({
          data: {
            sessionId: chatSessionId,
            role: "AGENT",
            content: `Offerte ${quote.quoteNumber} bijgewerkt via configurator.`,
          },
        }).catch(() => null);
      }

      return NextResponse.json({
        success: true,
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        message: "De offerte is bijgewerkt.",
      });
    }

    const year = new Date().getFullYear();
    const numberPrefix = `OFF-${year}-${workspaceId.slice(-4).toUpperCase()}-`;
    const count = await prisma.quote.count({
      where: { createdById: workspaceId, quoteNumber: { startsWith: numberPrefix } },
    });
    const quoteNumber = `${numberPrefix}${String(count + 1).padStart(4, "0")}`;

    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        leadId: resolvedLeadId,
        clientName,
        clientEmail,
        clientCompany: clientCompany || null,
        clientPhone: clientPhone || null,
        clientAddress: clientAddress || null,
        clientVat: clientVat || null,
        status: "DRAFT",
        notes: notes || "Aangemaakt via interne offerte-configurator.",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal,
        vatRate,
        discount,
        vatAmount,
        total,
        createdById: workspaceId,
        items: { create: normalizedItems },
      },
      select: { id: true, quoteNumber: true },
    });

    await prisma.activity.create({
      data: {
        leadId: resolvedLeadId,
        userId: user.id,
        type: "QUOTE_CREATED",
        title: `Offerte ${quoteNumber} aangemaakt via configurator`,
        metadata: { quoteId: quote.id, total, source: "configurator" },
      },
    });

    if (chatSessionId) {
      await prisma.chatMessage.create({
        data: {
          sessionId: chatSessionId,
          role: "AGENT",
          content: `Offerte ${quoteNumber} aangemaakt via configurator.`,
        },
      }).catch(() => null);
    }

    return NextResponse.json({
      success: true,
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      message: "De offerte is aangemaakt.",
    });
  } catch (error) {
    log.api.error("Internal quote configurator request failed", {
      route: "/api/quotes/configurator/request",
      userId: user.id,
    }, error);
    return NextResponse.json({ error: "Offerte aanmaken mislukt." }, { status: 500 });
  }
}
