import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { getPublicOwnerKeyFromUrl, resolvePublicOwner } from "@digitify/api/src/lib/tenant";

export async function GET(request: Request) {
  const owner = await resolvePublicOwner(prisma, getPublicOwnerKeyFromUrl(request.url));
  if (!owner) {
    return NextResponse.json({
      enabled: false,
      companyName: "",
      companySlogan: "",
      welcomeMessage: "Deze chatbot is niet gekoppeld aan een account.",
      offlineMessage: "Deze chatbot is niet beschikbaar.",
      primaryColor: "#6366f1",
      avatarUrl: "",
      trainingNotes: "",
      knowledgePages: "",
      responseStyle: "Professioneel, kort en duidelijk",
      language: "Nederlands",
      autoMessagesEnabled: false,
      aiResponsesEnabled: false,
      askNameBeforeChat: false,
    });
  }

  const keys = [
    "chatbot.enabled",
    "chatbot.company_name",
    "chatbot.welcome_message",
    "chatbot.offline_message",
    "chatbot.primary_color",
    "chatbot.avatar_url",
    "chatbot.training_notes",
    "chatbot.knowledge_pages",
    "chatbot.response_style",
    "chatbot.language",
    "chatbot.auto_messages_enabled",
    "chatbot.ai_responses_enabled",
    "chatbot.ask_name_before_chat",
    "branding.company_name",
    "branding.company_slogan",
    "branding.primary_color",
    "branding.logo_url",
  ];

  const settings = await prisma.setting.findMany({
    where: { userId: owner.id, key: { in: keys } },
  });

  const map = Object.fromEntries(
    settings.map((item) => {
      const raw = item.value;
      if (typeof raw !== "string") return [item.key, raw];
      try {
        return [item.key, JSON.parse(raw)];
      } catch {
        return [item.key, raw.trim()];
      }
    })
  ) as Record<string, unknown>;
  const getString = (key: string, fallback = "") => {
    const value = map[key];
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string") return value;
    if (typeof value === "boolean" || typeof value === "number") return String(value);
    return fallback;
  };
  const getBool = (key: string, fallback: boolean) => {
    const value = map[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "on"].includes(normalized)) return true;
      if (["false", "0", "no", "off"].includes(normalized)) return false;
    }
    return fallback;
  };

  return NextResponse.json({
    enabled: getBool("chatbot.enabled", true),
    companyName: getString("chatbot.company_name") || getString("branding.company_name") || "Digitify",
    companySlogan: getString("branding.company_slogan"),
    welcomeMessage: getString("chatbot.welcome_message") || "Hallo! Hoe kan ik u helpen?",
    offlineMessage: getString("chatbot.offline_message") ||
      "We zijn momenteel offline. Laat een bericht achter en we nemen zo snel mogelijk contact met u op.",
    primaryColor: getString("chatbot.primary_color") || getString("branding.primary_color") || "#6366f1",
    avatarUrl: getString("chatbot.avatar_url") || getString("branding.logo_url"),
    trainingNotes: getString("chatbot.training_notes"),
    knowledgePages: getString("chatbot.knowledge_pages"),
    responseStyle: getString("chatbot.response_style", "Professioneel, kort en duidelijk"),
    language: getString("chatbot.language", "Nederlands"),
    autoMessagesEnabled: getBool("chatbot.auto_messages_enabled", true),
    aiResponsesEnabled: getBool("chatbot.ai_responses_enabled", true),
    askNameBeforeChat: getBool("chatbot.ask_name_before_chat", false),
  });
}
