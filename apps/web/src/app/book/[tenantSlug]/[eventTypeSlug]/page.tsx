import { redirect } from "next/navigation";

export default async function PublicBookPage({ params }: { params: Promise<{ tenantSlug: string; eventTypeSlug: string }> }) {
  const { tenantSlug, eventTypeSlug } = await params;
  redirect(`/embed/bookings?tenant=${encodeURIComponent(tenantSlug)}&eventType=${encodeURIComponent(eventTypeSlug)}`);
}
