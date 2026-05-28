/**
 * Public booking flows under /bookings/manage/* (no app shell).
 * Keeps route segment distinct from authenticated (app)/bookings.
 */
export default function PublicBookingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
