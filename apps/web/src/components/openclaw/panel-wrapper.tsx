"use client";

import dynamic from "next/dynamic";

const OpenClawPanel = dynamic(
  () => import("./chat-panel").then((mod) => mod.OpenClawPanel),
  { ssr: false },
);

export function OpenClawPanelWrapper() {
  return <OpenClawPanel />;
}
