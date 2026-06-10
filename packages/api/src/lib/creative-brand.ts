import type { PrismaClient } from "@digitify/db";
import {
  applyBrandToGeneration,
  type BrandGenerationInput,
  type BrandGenerationResult,
  type CreativeBrandContext,
} from "@digitify/media-studio";
import { getSettingString, settingsRowsToMap } from "./settings";
import { invalidateWorkspaceSettingsCache, loadWorkspaceSettingRows, resolveSettingDbKey, type WorkspaceScope } from "./workspace-settings";

function workspaceScopeFromWorkspaceId(workspaceId: string): WorkspaceScope {
  return { workspaceId, memberId: workspaceId };
}

const CREATIVE_BRAND_KEYS = [
  "branding.company_name",
  "branding.company_slogan",
  "branding.logo_url",
  "branding.primary_color",
  "company.name",
  "company.niche",
  "company.website",
  "chatbot.training_notes",
  "openclaw.business_context",
  "creative.brand_enabled",
  "creative.include_logo",
  "creative.brand_voice",
  "creative.brand_keywords",
  "creative.brand_avoid",
  "creative.brand_summary",
  "creative.auto_import",
] as const;

function resolvePublicAssetUrl(url: string | undefined): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  if (/^(https?:\/\/|data:)/i.test(trimmed)) return trimmed;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://leads.digitify.be").replace(
    /\/$/,
    "",
  );
  return `${appUrl}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

function parseBooleanSetting(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export async function loadCreativeBrandContext(
  db: PrismaClient,
  workspaceId: string,
): Promise<CreativeBrandContext> {
  const scope = workspaceScopeFromWorkspaceId(workspaceId);
  const rows = await loadWorkspaceSettingRows(db, scope, [...CREATIVE_BRAND_KEYS]);
  const settings = settingsRowsToMap(rows);

  return {
    enabled: parseBooleanSetting(getSettingString(settings, "creative.brand_enabled"), true),
    includeLogo: parseBooleanSetting(getSettingString(settings, "creative.include_logo"), true),
    companyName:
      getSettingString(settings, "branding.company_name") ||
      getSettingString(settings, "company.name") ||
      undefined,
    slogan: getSettingString(settings, "branding.company_slogan") || undefined,
    primaryColor: getSettingString(settings, "branding.primary_color") || undefined,
    niche: getSettingString(settings, "company.niche") || undefined,
    website: getSettingString(settings, "company.website") || undefined,
    brandVoice: getSettingString(settings, "creative.brand_voice") || undefined,
    brandKeywords: getSettingString(settings, "creative.brand_keywords") || undefined,
    brandAvoid: getSettingString(settings, "creative.brand_avoid") || undefined,
    brandSummary: getSettingString(settings, "creative.brand_summary") || undefined,
    trainingNotes: getSettingString(settings, "chatbot.training_notes") || undefined,
    businessContext: getSettingString(settings, "openclaw.business_context") || undefined,
    logoUrl: resolvePublicAssetUrl(getSettingString(settings, "branding.logo_url")) || undefined,
    autoImport: parseBooleanSetting(getSettingString(settings, "creative.auto_import"), false),
  };
}

export async function saveCreativeAutoImport(
  db: PrismaClient,
  workspaceId: string,
  autoImport: boolean,
) {
  const scope = workspaceScopeFromWorkspaceId(workspaceId);
  const scopedKey = resolveSettingDbKey(scope, "creative.auto_import");
  await db.setting.upsert({
    where: { key: scopedKey },
    update: { value: String(autoImport) },
    create: { key: scopedKey, value: String(autoImport) },
  });
  invalidateWorkspaceSettingsCache(scope);
}

export function enrichGenerationWithBrand(
  brand: CreativeBrandContext,
  input: BrandGenerationInput,
): BrandGenerationResult {
  return applyBrandToGeneration(brand, input);
}

export async function saveCreativeBrandKit(
  db: PrismaClient,
  workspaceId: string,
  input: {
    brandEnabled: boolean;
    includeLogo: boolean;
    brandVoice?: string;
    brandKeywords?: string;
    brandAvoid?: string;
    brandSummary?: string;
  },
) {
  const scope = workspaceScopeFromWorkspaceId(workspaceId);
  const entries: Array<{ key: string; value: string }> = [
    { key: "creative.brand_enabled", value: String(input.brandEnabled) },
    { key: "creative.include_logo", value: String(input.includeLogo) },
    { key: "creative.brand_voice", value: input.brandVoice?.trim() ?? "" },
    { key: "creative.brand_keywords", value: input.brandKeywords?.trim() ?? "" },
    { key: "creative.brand_avoid", value: input.brandAvoid?.trim() ?? "" },
    { key: "creative.brand_summary", value: input.brandSummary?.trim() ?? "" },
  ];

  for (const entry of entries) {
    const scopedKey = resolveSettingDbKey(scope, entry.key);
    await db.setting.upsert({
      where: { key: scopedKey },
      update: { value: entry.value },
      create: { key: scopedKey, value: entry.value },
    });
  }

  invalidateWorkspaceSettingsCache(scope);
}
