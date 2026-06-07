"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const ContactsPageView = dynamic(
  () => import("./contacts-page-inner").then((module) => module.ContactsPageInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="Contacten laden..." />,
  },
);

export default function ContactsPage() {
  return <ContactsPageView />;
}
