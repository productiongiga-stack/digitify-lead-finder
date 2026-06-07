"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const InboxPageView = dynamic(
  () => import("./inbox-page-inner").then((module) => module.InboxPageInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="Inbox laden..." />,
  },
);

export default function InboxPage() {
  return <InboxPageView />;
}
