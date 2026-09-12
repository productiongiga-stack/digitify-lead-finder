"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const AgendaPageView = dynamic(
  () => import("./agenda-page-inner").then((module) => module.AgendaPageInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="Agenda laden..." />,
  },
);

export default function AgendaPage() {
  return <AgendaPageView />;
}
