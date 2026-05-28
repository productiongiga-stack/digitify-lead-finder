import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { getCurrentUser, workspaceIdFor } from "@/lib/auth/session";

export const runtime = "nodejs";

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toLocaleString("nl-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  const userId = typeof (currentUser as any)?.id === "string" ? ((currentUser as any).id as string) : "";
  if (!userId) {
    return NextResponse.json({ error: "Niet geauthenticeerd." }, { status: 401 });
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") || "";
  const daysParam = url.searchParams.get("days");
  const days = daysParam ? Math.min(Math.max(parseInt(daysParam, 10) || 30, 1), 365) : undefined;
  const dateFrom = url.searchParams.get("from") || "";
  const dateTo = url.searchParams.get("to") || "";

  const workspaceId = workspaceIdFor(currentUser as { id: string; workspaceId?: string });
  const where: Record<string, unknown> = { createdById: workspaceId };
  if (statusFilter) where.status = statusFilter.toUpperCase();
  if (days) {
    where.createdAt = { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
  } else if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { date: "asc" },
    take: 5000,
    select: {
      id: true,
      clientName: true,
      clientEmail: true,
      date: true,
      duration: true,
      status: true,
      timezone: true,
      location: true,
      notes: true,
      googleMeetLink: true,
      createdAt: true,
      cancelledAt: true,
      reminder24hSentAt: true,
      reminder1hSentAt: true,
      eventType: { select: { name: true, slug: true } },
      hostUser: { select: { name: true, email: true } },
      lead: { select: { companyName: true } },
    },
  });

  const columns = [
    "ID",
    "Naam",
    "E-mail",
    "Datum",
    "Duur (min)",
    "Status",
    "Tijdzone",
    "Locatie",
    "Google Meet",
    "Boekingstype",
    "Host",
    "Gekoppelde lead",
    "Notities",
    "Herinnering 24u verstuurd",
    "Herinnering 1u verstuurd",
    "Aangemaakt op",
    "Geannuleerd op",
  ];

  const rows = bookings.map((booking) => [
    escapeCsv(booking.id),
    escapeCsv(booking.clientName),
    escapeCsv(booking.clientEmail),
    escapeCsv(formatDate(booking.date)),
    escapeCsv(booking.duration),
    escapeCsv(booking.status),
    escapeCsv(booking.timezone),
    escapeCsv(booking.location),
    escapeCsv(booking.googleMeetLink),
    escapeCsv(booking.eventType?.name),
    escapeCsv(booking.hostUser?.name || booking.hostUser?.email),
    escapeCsv(booking.lead?.companyName),
    escapeCsv(booking.notes),
    escapeCsv(booking.reminder24hSentAt ? formatDate(booking.reminder24hSentAt) : ""),
    escapeCsv(booking.reminder1hSentAt ? formatDate(booking.reminder1hSentAt) : ""),
    escapeCsv(formatDate(booking.createdAt)),
    escapeCsv(booking.cancelledAt ? formatDate(booking.cancelledAt) : ""),
  ]);

  const csv = [columns.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
  const filename = `Boekingen-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
