import type { PrismaClient } from "@digitify/db";
import type { CreativeBrandContext } from "@digitify/media-studio";
import { getSettingString, settingsRowsToMap } from "./settings";
import { loadCreativeBrandContext } from "./creative-brand";
import {
  invalidateWorkspaceSettingsCache,
  loadWorkspaceSettingRows,
  resolveSettingDbKey,
  workspaceScopeFromUser,
  type WorkspaceScope,
} from "./workspace-settings";

export type SocialBrandKit = {
  id: string;
  name: string;
  isDefault: boolean;
  companyName: string;
  slogan: string;
  primaryColor: string;
  logoUrl: string;
  website: string;
  brandVoice: string;
  brandKeywords: string;
  brandAvoid: string;
  brandSummary: string;
  brandSignature: string;
  defaultHashtags: string;
  defaultTone: string;
  defaultCta: string;
  defaultLinkUrl: string;
  includeLogo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SocialBrandKitInput = Partial<
  Omit<SocialBrandKit, "id" | "isDefault" | "createdAt" | "updatedAt">
> & {
  name: string;
};

const BRAND_KITS_KEY = "social.brand_kits";
const DEFAULT_BRAND_KIT_KEY = "social.default_brand_kit_id";

function workspaceScope(workspaceId: string): WorkspaceScope {
  return workspaceScopeFromUser({ id: workspaceId, workspaceId });
}

function emptyKitFields(): Omit<SocialBrandKit, "id" | "name" | "isDefault" | "createdAt" | "updatedAt"> {
  return {
    companyName: "",
    slogan: "",
    primaryColor: "",
    logoUrl: "",
    website: "",
    brandVoice: "",
    brandKeywords: "",
    brandAvoid: "",
    brandSummary: "",
    brandSignature: "",
    defaultHashtags: "",
    defaultTone: "warm en professioneel",
    defaultCta: "",
    defaultLinkUrl: "",
    includeLogo: true,
  };
}

function parseBrandKits(raw: string | undefined): SocialBrandKit[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is SocialBrandKit => Boolean(item && typeof item === "object" && typeof (item as SocialBrandKit).id === "string"))
      .map((item) => ({
        ...emptyKitFields(),
        ...item,
        name: String(item.name || "Merkkit").trim() || "Merkkit",
        isDefault: Boolean(item.isDefault),
        includeLogo: item.includeLogo !== false,
      }));
  } catch {
    return [];
  }
}

async function readBrandKitSettings(db: PrismaClient, workspaceId: string) {
  const scope = workspaceScope(workspaceId);
  const rows = await loadWorkspaceSettingRows(db, scope, [BRAND_KITS_KEY, DEFAULT_BRAND_KIT_KEY]);
  const settings = settingsRowsToMap(rows);
  const kits = parseBrandKits(getSettingString(settings, BRAND_KITS_KEY));
  const defaultBrandKitId = getSettingString(settings, DEFAULT_BRAND_KIT_KEY) || "";
  return { kits, defaultBrandKitId };
}

async function writeBrandKits(db: PrismaClient, workspaceId: string, kits: SocialBrandKit[], defaultBrandKitId: string) {
  const scope = workspaceScope(workspaceId);
  const entries = [
    { key: BRAND_KITS_KEY, value: JSON.stringify(kits) },
    { key: DEFAULT_BRAND_KIT_KEY, value: defaultBrandKitId },
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

async function seedWorkspaceBrandKit(db: PrismaClient, workspaceId: string): Promise<SocialBrandKit[]> {
  const workspaceBrand = await loadCreativeBrandContext(db, workspaceId);
  const now = new Date().toISOString();
  const kit: SocialBrandKit = {
    id: `kit_${Date.now()}`,
    name: workspaceBrand.companyName?.trim() || "Hoofdmerk",
    isDefault: true,
    companyName: workspaceBrand.companyName?.trim() || "",
    slogan: workspaceBrand.slogan?.trim() || "",
    primaryColor: workspaceBrand.primaryColor?.trim() || "#f9ae5a",
    logoUrl: workspaceBrand.logoUrl?.trim() || "",
    website: workspaceBrand.website?.trim() || "",
    brandVoice: workspaceBrand.brandVoice?.trim() || "",
    brandKeywords: workspaceBrand.brandKeywords?.trim() || "",
    brandAvoid: workspaceBrand.brandAvoid?.trim() || "",
    brandSummary: workspaceBrand.brandSummary?.trim() || "",
    brandSignature: workspaceBrand.companyName
      ? `${workspaceBrand.companyName}${workspaceBrand.slogan ? ` · ${workspaceBrand.slogan}` : ""}`
      : "",
    defaultHashtags: "",
    defaultTone: "warm en professioneel",
    defaultCta: "",
    defaultLinkUrl: workspaceBrand.website?.trim() || "",
    includeLogo: workspaceBrand.includeLogo,
    createdAt: now,
    updatedAt: now,
  };

  await writeBrandKits(db, workspaceId, [kit], kit.id);
  return [kit];
}

export async function listSocialBrandKits(db: PrismaClient, workspaceId: string) {
  const { kits, defaultBrandKitId } = await readBrandKitSettings(db, workspaceId);
  const resolved = kits.length ? kits : await seedWorkspaceBrandKit(db, workspaceId);
  const activeDefaultId =
    defaultBrandKitId && resolved.some((kit) => kit.id === defaultBrandKitId)
      ? defaultBrandKitId
      : resolved.find((kit) => kit.isDefault)?.id || resolved[0]?.id || "";

  return {
    kits: resolved.map((kit) => ({ ...kit, isDefault: kit.id === activeDefaultId })),
    defaultBrandKitId: activeDefaultId,
  };
}

export async function getSocialBrandKitById(db: PrismaClient, workspaceId: string, kitId?: string | null) {
  if (!kitId?.trim()) return null;
  const { kits } = await listSocialBrandKits(db, workspaceId);
  return kits.find((kit) => kit.id === kitId.trim()) || null;
}

export async function upsertSocialBrandKit(
  db: PrismaClient,
  workspaceId: string,
  input: SocialBrandKitInput & { id?: string },
) {
  const { kits, defaultBrandKitId } = await listSocialBrandKits(db, workspaceId);
  const now = new Date().toISOString();
  const fields = emptyKitFields();

  const nextKit: SocialBrandKit = {
    id: input.id?.trim() || `kit_${Date.now()}`,
    name: input.name.trim() || "Merkkit",
    isDefault: false,
    companyName: input.companyName?.trim() ?? fields.companyName,
    slogan: input.slogan?.trim() ?? fields.slogan,
    primaryColor: input.primaryColor?.trim() ?? fields.primaryColor,
    logoUrl: input.logoUrl?.trim() ?? fields.logoUrl,
    website: input.website?.trim() ?? fields.website,
    brandVoice: input.brandVoice?.trim() ?? fields.brandVoice,
    brandKeywords: input.brandKeywords?.trim() ?? fields.brandKeywords,
    brandAvoid: input.brandAvoid?.trim() ?? fields.brandAvoid,
    brandSummary: input.brandSummary?.trim() ?? fields.brandSummary,
    brandSignature: input.brandSignature?.trim() ?? fields.brandSignature,
    defaultHashtags: input.defaultHashtags?.trim() ?? fields.defaultHashtags,
    defaultTone: input.defaultTone?.trim() || fields.defaultTone,
    defaultCta: input.defaultCta?.trim() ?? fields.defaultCta,
    defaultLinkUrl: input.defaultLinkUrl?.trim() ?? fields.defaultLinkUrl,
    includeLogo: input.includeLogo ?? fields.includeLogo,
    createdAt: now,
    updatedAt: now,
  };

  const existingIndex = kits.findIndex((kit) => kit.id === nextKit.id);
  if (existingIndex >= 0) {
    nextKit.createdAt = kits[existingIndex]!.createdAt;
    kits[existingIndex] = { ...kits[existingIndex]!, ...nextKit, updatedAt: now };
  } else {
    kits.push(nextKit);
  }

  const activeDefaultId = defaultBrandKitId || nextKit.id;
  await writeBrandKits(db, workspaceId, kits, activeDefaultId);
  return nextKit;
}

export async function deleteSocialBrandKit(db: PrismaClient, workspaceId: string, kitId: string) {
  const { kits, defaultBrandKitId } = await listSocialBrandKits(db, workspaceId);
  const nextKits = kits.filter((kit) => kit.id !== kitId);
  if (nextKits.length === kits.length) {
    throw new Error("Merkkit niet gevonden.");
  }
  if (!nextKits.length) {
    throw new Error("Je moet minstens één merkkit behouden.");
  }

  const nextDefaultId =
    defaultBrandKitId === kitId ? nextKits[0]!.id : defaultBrandKitId || nextKits[0]!.id;
  await writeBrandKits(db, workspaceId, nextKits, nextDefaultId);
  return { deletedId: kitId, defaultBrandKitId: nextDefaultId };
}

export async function setDefaultSocialBrandKit(db: PrismaClient, workspaceId: string, kitId: string) {
  const { kits } = await listSocialBrandKits(db, workspaceId);
  if (!kits.some((kit) => kit.id === kitId)) {
    throw new Error("Merkkit niet gevonden.");
  }
  await writeBrandKits(
    db,
    workspaceId,
    kits.map((kit) => ({ ...kit, isDefault: kit.id === kitId })),
    kitId,
  );
  return { defaultBrandKitId: kitId };
}

export function mergeBrandKitWithWorkspace(
  workspaceBrand: CreativeBrandContext,
  kit: SocialBrandKit | null | undefined,
): CreativeBrandContext {
  if (!kit) return workspaceBrand;
  return {
    ...workspaceBrand,
    enabled: true,
    includeLogo: kit.includeLogo,
    companyName: kit.companyName || workspaceBrand.companyName,
    slogan: kit.slogan || workspaceBrand.slogan,
    primaryColor: kit.primaryColor || workspaceBrand.primaryColor,
    logoUrl: kit.logoUrl || workspaceBrand.logoUrl,
    website: kit.website || workspaceBrand.website,
    brandVoice: kit.brandVoice || workspaceBrand.brandVoice,
    brandKeywords: kit.brandKeywords || workspaceBrand.brandKeywords,
    brandAvoid: kit.brandAvoid || workspaceBrand.brandAvoid,
    brandSummary: kit.brandSummary || workspaceBrand.brandSummary,
  };
}

export async function loadCreativeBrandContextForKit(
  db: PrismaClient,
  workspaceId: string,
  brandKitId?: string | null,
): Promise<CreativeBrandContext> {
  const workspaceBrand = await loadCreativeBrandContext(db, workspaceId);
  const kit = await getSocialBrandKitById(db, workspaceId, brandKitId);
  return mergeBrandKitWithWorkspace(workspaceBrand, kit);
}
