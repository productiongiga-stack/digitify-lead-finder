"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const ComposeView = dynamic(
  () => import("./compose-inner").then((module) => module.ComposeInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="E-mail opstellen laden..." />,
  },
);

export default function ComposePage() {
  return <ComposeView />;
}
