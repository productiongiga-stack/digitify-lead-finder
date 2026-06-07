"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const BookingsPageView = dynamic(
  () => import("./bookings-page-inner").then((module) => module.BookingsPageInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="Afspraken laden..." />,
  },
);

export default function BookingsPage() {
  return <BookingsPageView />;
}
