"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/layout/route-states";

const ChatbotView = dynamic(
  () => import("./chatbot-inner").then((module) => module.ChatbotInner),
  {
    ssr: false,
    loading: () => <RouteLoading label="Chatbot laden..." />,
  },
);

export default function ChatbotInboxPage() {
  return <ChatbotView />;
}
