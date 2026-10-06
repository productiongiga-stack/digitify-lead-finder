import { createHash } from "node:crypto";
import type { PrismaClient } from "@digitify/db";
import { getSettingString, settingsRowsToMap } from "./settings";
import { loadWorkspaceSettingRows } from "./workspace-settings";

export const AI_BUSINESS_PROFILE_KEY = "ai.business_profile";

export type AiBusinessProfile = {
  companyName: string;
  companyDescription: string;
  idealCustomer: string;
  primaryOffer: string;
  differentiators: string[];
  salesGoal: string;
  tone: string;
  focusRegions: string[];
  services: string[];
  website: string;
  contactEmail: string;
  contactPhone: string;
  niche: string;
  knowledgePages: string[];
  version: number;
  hash: string;
};

function list(value: unknown, max = 30) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n|,/) : [];
  return source.map((item) => String(item).trim()).filter(Boolean).slice(0, max);
}

function profileJson(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export async function loadAiBusinessProfile(db: PrismaClient, workspaceId: string): Promise<AiBusinessProfile> {
  const rows = await loadWorkspaceSettingRows(db, { workspaceId, memberId: workspaceId }, [
    "branding.company_name",
    "company.name",
    "company.niche",
    "company.website",
    "company.email",
    "company.phone",
    "chatbot.training_notes",
    "chatbot.knowledge_pages",
    "chatbot.response_style",
    "openclaw.business_context",
    AI_BUSINESS_PROFILE_KEY,
  ]);
  const settings = settingsRowsToMap(rows);
  const custom = profileJson(settings[AI_BUSINESS_PROFILE_KEY]);
  const companyName = getSettingString(settings, "branding.company_name") || getSettingString(settings, "company.name") || "Digitify";
  const services = list(getSettingString(settings, "openclaw.business_context", ""));
  const knowledgePages = list(getSettingString(settings, "chatbot.knowledge_pages", ""), 20);
  const profile = {
    companyName,
    companyDescription: String(custom.companyDescription || getSettingString(settings, "chatbot.training_notes", "")).trim().slice(0, 4000),
    idealCustomer: String(custom.idealCustomer || "").trim().slice(0, 2000),
    primaryOffer: String(custom.primaryOffer || "").trim().slice(0, 2000),
    differentiators: list(custom.differentiators, 20),
    salesGoal: String(custom.salesGoal || "").trim().slice(0, 1000),
    tone: String(custom.tone || getSettingString(settings, "chatbot.response_style", "professioneel")).trim().slice(0, 500),
    focusRegions: list(custom.focusRegions, 20),
    services,
    website: getSettingString(settings, "company.website", "").slice(0, 300),
    contactEmail: getSettingString(settings, "company.email", "").slice(0, 254),
    contactPhone: getSettingString(settings, "company.phone", "").slice(0, 80),
    niche: getSettingString(settings, "company.niche", "").slice(0, 300),
    knowledgePages,
    version: Number(custom.version) > 0 ? Number(custom.version) : 1,
  };
  const hash = createHash("sha256").update(JSON.stringify(profile)).digest("hex").slice(0, 32);
  return { ...profile, hash };
}

export function businessProfileToContext(profile: AiBusinessProfile) {
  return {
    companyDescription: profile.companyDescription,
    services: profile.services,
    website: profile.website,
    contactEmail: profile.contactEmail,
    contactPhone: profile.contactPhone,
    niche: profile.niche,
    responseStyle: profile.tone,
    knowledgePages: profile.knowledgePages,
    idealCustomer: profile.idealCustomer,
    primaryOffer: profile.primaryOffer,
    differentiators: profile.differentiators,
    salesGoal: profile.salesGoal,
    focusRegions: profile.focusRegions,
    profileVersion: profile.version,
  };
}
