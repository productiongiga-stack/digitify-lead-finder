import { NextResponse } from "next/server";
import { prisma, revealSettingValue } from "@digitify/db";
import {
  ensurePublicTenantToken,
  resolveMarketingWorkspaceOwnerId,
} from "@digitify/api/src/lib/public-tenant";
import { log } from "@digitify/api/src/lib/logger";
import { enforceRateLimit, getClientIp } from "@/lib/http-security";

function userSettingKey(userId: string, key: string) {
  return `user:${userId}:${key.trim()}`;
}

function readSetting(settings: Record<string, unknown>, key: string, fallback = "") {
  const value = settings[key];
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return fallback;
}

function readBool(settings: Record<string, unknown>, key: string, fallback: boolean) {
  const raw = readSetting(settings, key, "");
  if (!raw) return fallback;
  const normalized = raw.toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function normalizeHexColor(value: string, fallback = "#f9ae5a") {
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}

function normalizePosition(value: string) {
  return value === "bottom-left" ? "bottom-left" : "bottom-right";
}

function normalizeAutoOpen(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(120, Math.round(parsed)));
}

export async function GET(request: Request) {
  try {
    const ownerId = await resolveMarketingWorkspaceOwnerId(prisma);
    if (!ownerId) {
      return NextResponse.json({ error: "Geen publieke chatbot workspace gevonden." }, { status: 404 });
    }

    const ip = getClientIp(request);
    const limiter = await enforceRateLimit(request, {
      key: `public-chatbot-embed-config:${ownerId}:${ip}`,
      limit: 240,
      windowMs: 60 * 60 * 1000,
      message: "Te veel aanvragen. Probeer later opnieuw.",
    });
    if (limiter) return limiter;

    const tenant = await ensurePublicTenantToken(prisma, ownerId);
    const keys = [
      "chatbot.enabled",
      "chatbot.company_name",
      "chatbot.welcome_message",
      "chatbot.primary_color",
      "chatbot.avatar_url",
      "chatbot.position",
      "chatbot.auto_open_delay",
      "chatbot.ask_name_before_chat",
      "branding.company_name",
      "branding.logo_url",
      "branding.primary_color",
    ];

    const rows = await prisma.setting.findMany({
      where: { key: { in: keys.map((key) => userSettingKey(ownerId, key)) } },
    });
    const settings = Object.fromEntries(
      rows.map((row) => {
        const key = row.key.replace(`user:${ownerId}:`, "");
        return [key, revealSettingValue(key, row.value)];
      }),
    ) as Record<string, unknown>;

    return NextResponse.json({
      chatbot: {
        enabled: readBool(settings, "chatbot.enabled", true),
        tenant,
        company: readSetting(settings, "chatbot.company_name") || readSetting(settings, "branding.company_name", "Digitify Contact"),
        color: normalizeHexColor(readSetting(settings, "chatbot.primary_color") || readSetting(settings, "branding.primary_color"), "#f9ae5a"),
        position: normalizePosition(readSetting(settings, "chatbot.position", "bottom-right")),
        welcome: readSetting(settings, "chatbot.welcome_message", "Hallo! Hoe kan ik u helpen?"),
        askName: readBool(settings, "chatbot.ask_name_before_chat", false),
        autoOpen: normalizeAutoOpen(readSetting(settings, "chatbot.auto_open_delay", "0")),
        avatar: readSetting(settings, "chatbot.avatar_url") || readSetting(settings, "branding.logo_url"),
      },
    });
  } catch (error) {
    log.api.error("Public chatbot embed-config failed", { route: "/api/public/chatbot/embed-config" }, error);
    return NextResponse.json({ error: "Chatbotconfiguratie ophalen mislukt." }, { status: 500 });
  }
}
