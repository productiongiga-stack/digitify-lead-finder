import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PublicBookingWidget } from "@/components/modules/scheduling/public-booking-widget";
import { EmbedShell } from "@/components/embed/embed-shell";
import { EmbedAutoResize } from "@/components/embed/embed-auto-resize";

/**
 * Embed booking page — stripped-down booking widget for iframe embedding.
 *
 * Similar to /book/[slug] but:
 * - Minimal chrome
 * - Auto-resize postMessage
 * - No full page header/footer
 */
export default async function EmbedBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Find active booking type by slug
  const bookingType = await db.bookingType.findFirst({
    where: { slug, isActive: true },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          brandColor: true,
          logo: true,
          brandProfile: {
            select: {
              companyName: true,
              logoUrl: true,
              primaryColor: true,
            },
          },
        },
      },
    },
  });

  if (!bookingType) notFound();

  // Load availability rules for this workspace
  const availabilityRules = await db.availabilityRule.findMany({
    where: { workspaceId: bookingType.workspaceId, isActive: true },
  });

  // Load existing bookings (next 60 days) to check conflicts
  const now = new Date();
  const sixtyDaysLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const existingBookings = await db.booking.findMany({
    where: {
      workspaceId: bookingType.workspaceId,
      startAt: { gte: now, lte: sixtyDaysLater },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    select: { startAt: true, endAt: true },
  });

  const brand = bookingType.workspace.brandProfile;
  const brandColor =
    brand?.primaryColor ?? bookingType.workspace.brandColor;
  const brandName =
    brand?.companyName ?? bookingType.workspace.name;

  return (
    <EmbedShell backgroundColor="#ffffff">
      <EmbedAutoResize />

      {/* Minimal header */}
      <div className="border-b border-gray-100 px-4 py-3 text-center">
        <h2 className="text-sm font-semibold text-gray-900">
          {bookingType.title}
        </h2>
        <p className="text-xs text-gray-500">
          {bookingType.duration} min · {bookingType.location ?? "Online"}
        </p>
      </div>

      {/* Booking widget */}
      <div className="p-4">
        <PublicBookingWidget
          bookingTypeId={bookingType.id}
          duration={bookingType.duration}
          bufferBefore={bookingType.bufferBefore}
          bufferAfter={bookingType.bufferAfter}
          availability={availabilityRules.map((r) => ({
            dayOfWeek: r.dayOfWeek,
            startTime: r.startTime,
            endTime: r.endTime,
          }))}
          existingBookings={existingBookings.map((b) => ({
            startAt: b.startAt.toISOString(),
            endAt: b.endAt.toISOString(),
          }))}
          brandColor={brandColor}
        />
      </div>

      {/* Powered by */}
      <div className="border-t border-gray-100 px-4 py-2 text-center text-[10px] text-gray-400">
        Powered by{" "}
        <a
          href="https://digitify.be"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-gray-600"
        >
          Digitify
        </a>
      </div>
    </EmbedShell>
  );
}
