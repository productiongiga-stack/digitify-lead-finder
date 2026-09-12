import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { PublicBookingWidget } from "@/components/modules/scheduling/public-booking-widget";

/**
 * Public booking page — client-facing scheduling surface.
 *
 * URL: /book/[slug] where slug = bookingType.slug
 * No auth required. Branded with workspace colors.
 *
 * Renders a calendar with available slots based on AvailabilityRules,
 * then a contact form for the attendee.
 */
export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Find the booking type and its workspace
  const bookingType = await db.bookingType.findFirst({
    where: { slug, isActive: true },
    include: {
      workspace: {
        include: {
          brandProfile: true,
          availability: { where: { isActive: true } },
        },
      },
    },
  });

  if (!bookingType) notFound();

  const brand = bookingType.workspace.brandProfile;
  const brandColor = brand?.primaryColor ?? bookingType.workspace.brandColor;

  // Fetch existing bookings for the next 60 days (to calculate available slots)
  const now = new Date();
  const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const existingBookings = await db.booking.findMany({
    where: {
      workspaceId: bookingType.workspaceId,
      startAt: { gte: now, lte: sixtyDaysFromNow },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    select: { startAt: true, endAt: true },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-2xl px-6 py-6">
          <div className="flex items-center gap-3">
            {brand?.logoUrl ? (
              <img src={brand.logoUrl} alt="" className="h-8" />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: brandColor }}
              >
                {bookingType.workspace.name[0]}
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">
                {brand?.companyName ?? bookingType.workspace.name}
              </p>
              <h1 className="text-xl font-semibold text-gray-900">
                {bookingType.title}
              </h1>
            </div>
          </div>

          {/* Booking type details */}
          <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              🕐 {bookingType.duration} min
            </span>
            {bookingType.location && (
              <span className="flex items-center gap-1">
                📍 {bookingType.location}
              </span>
            )}
          </div>

          {bookingType.description && (
            <p className="mt-3 text-sm text-gray-600">
              {bookingType.description}
            </p>
          )}
        </div>
      </header>

      {/* Booking widget (client component) */}
      <main className="mx-auto max-w-2xl px-6 py-8">
        <PublicBookingWidget
          bookingTypeId={bookingType.id}
          duration={bookingType.duration}
          bufferBefore={bookingType.bufferBefore}
          bufferAfter={bookingType.bufferAfter}
          brandColor={brandColor}
          availability={bookingType.workspace.availability.map((a) => ({
            dayOfWeek: a.dayOfWeek,
            startTime: a.startTime,
            endTime: a.endTime,
          }))}
          existingBookings={existingBookings.map((b) => ({
            startAt: b.startAt.toISOString(),
            endAt: b.endAt.toISOString(),
          }))}
        />
      </main>

      <footer className="py-8 text-center text-xs text-gray-400">
        Powered by{" "}
        <a href="https://digitify.be" className="underline">
          Digitify Suite
        </a>
      </footer>
    </div>
  );
}
