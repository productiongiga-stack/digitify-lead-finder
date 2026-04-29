import { NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { resolvePublicTenantUserId } from "@digitify/api/src/lib/public-tenant";
import { log } from "@digitify/api/src/lib/logger";
import { enforceRateLimit, getClientIp } from "@/lib/http-security";

function userSettingKey(userId: string, key: string) {
  return `user:${userId}:${key.trim()}`;
}

export async function GET(request: Request) {
  try {
    const tenantToken = new URL(request.url).searchParams.get("tenant")?.trim() || "";
    const tenantUserId = await resolvePublicTenantUserId(prisma, tenantToken);
    if (!tenantUserId) {
      log.security.warn("Public chatbot settings rejected: invalid tenant token");
      return NextResponse.json({ error: "Ongeldige tenant." }, { status: 400 });
    }
    const ip = getClientIp(request);
    const limiter = enforceRateLimit(request, {
      key: `public-chatbot-settings:${tenantUserId}:${ip}`,
      limit: 240,
      windowMs: 60 * 60 * 1000,
      message: "Te veel aanvragen. Probeer later opnieuw.",
    });
    if (limiter) return limiter;
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

    const scopedKeys = keys.map((key) => userSettingKey(tenantUserId, key));

    const settings = await prisma.setting.findMany({
      where: { key: { in: scopedKeys } },
    });

  const map = Object.fromEntries(
    settings.map((item) => {
      const key = item.key.replace(`user:${tenantUserId}:`, "");
      const raw = item.value;
      if (typeof raw !== "string") return [key, raw];
      try {
        return [key, JSON.parse(raw)];
      } catch {
        return [key, raw.trim()];
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
  } catch (error) {
    log.api.error("Public chatbot settings failed", { route: "/api/public/chatbot/settings" }, error);
    return NextResponse.json({ error: "Instellingen ophalen mislukt." }, { status: 500 });
  }
}
