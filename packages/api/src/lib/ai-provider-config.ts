import type { PrismaClient } from "@digitify/db";
import { getSettingString, settingsRowsToMap } from "./settings";
import { loadWorkspaceSettingRows } from "./workspace-settings";

export type AiProviderId = "anthropic" | "openai" | "deepseek";

const AI_SETTING_KEYS = [
  "api.ai_provider",
  "openclaw.model",
  "api.anthropic_key",
  "api.openai_key",
  "api.deepseek_key",
] as const;

export function normalizeAiProvider(value: string | null | undefined): AiProviderId {
  const raw = (value || "").trim().toLowerCase();
  if (raw === "openai") return "openai";
  if (raw === "deepseek") return "deepseek";
  return "anthropic";
}

export function defaultModelForProvider(provider: AiProviderId) {
  switch (provider) {
    case "openai":
      return "gpt-4o-mini";
    case "deepseek":
      return "deepseek-chat";
    default:
      return "claude-sonnet-4-20250514";
  }
}

export function apiKeySettingForProvider(provider: AiProviderId) {
  switch (provider) {
    case "openai":
      return "api.openai_key";
    case "deepseek":
      return "api.deepseek_key";
    default:
      return "api.anthropic_key";
  }
}

export function envFallbackForProvider(provider: AiProviderId) {
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY || "";
    case "deepseek":
      return process.env.DEEPSEEK_API_KEY || "";
    default:
      return process.env.ANTHROPIC_API_KEY || "";
  }
}

export async function loadAiProviderConfig(db: PrismaClient, workspaceId: string) {
  const rows = await loadWorkspaceSettingRows(db, { workspaceId, memberId: workspaceId }, [...AI_SETTING_KEYS]);
  const settings = settingsRowsToMap(rows);
  const provider = normalizeAiProvider(getSettingString(settings, "api.ai_provider", "anthropic"));
  const model = getSettingString(settings, "openclaw.model", defaultModelForProvider(provider));
  const apiKey = getSettingString(settings, apiKeySettingForProvider(provider), envFallbackForProvider(provider));
  return { provider, model, apiKey: apiKey.trim() };
}
