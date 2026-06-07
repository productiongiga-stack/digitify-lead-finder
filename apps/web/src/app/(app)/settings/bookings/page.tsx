"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const BookingsSettingsView = dynamic(
  () => import("./bookings-settings-inner").then((module) => module.BookingsSettingsInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="Boekingsinstellingen laden..." />,
  },
);

export default function BookingSettingsPage() {
  return <BookingsSettingsView />;
}
