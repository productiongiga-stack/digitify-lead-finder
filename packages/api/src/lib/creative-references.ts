import type { PrismaClient } from "@digitify/db";
import { getSettingString, settingsRowsToMap } from "./settings";
import { invalidateWorkspaceSettingsCache, loadWorkspaceSettingRows, resolveSettingDbKey, type WorkspaceScope } from "./workspace-settings";

const REFERENCE_SETTING_KEY = "creative.reference_library";
const MAX_REFERENCE_ITEMS = 48;

export type ReferenceUpload = {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  createdAt: string;
};

function workspaceScopeFromWorkspaceId(workspaceId: string): WorkspaceScope {
  return { workspaceId, memberId: workspaceId };
}

function parseReferenceLibrary(raw: string | undefined): ReferenceUpload[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is ReferenceUpload => {
        if (!item || typeof item !== "object") return false;
        const record = item as Record<string, unknown>;
        return (
          typeof record.id === "string" &&
          typeof record.url === "string" &&
          typeof record.filename === "string" &&
          typeof record.contentType === "string" &&
          typeof record.createdAt === "string"
        );
      })
      .slice(0, MAX_REFERENCE_ITEMS);
  } catch {
    return [];
  }
}

export async function loadReferenceLibrary(db: PrismaClient, workspaceId: string): Promise<ReferenceUpload[]> {
  const scope = workspaceScopeFromWorkspaceId(workspaceId);
  const rows = await loadWorkspaceSettingRows(db, scope, [REFERENCE_SETTING_KEY]);
  const settings = settingsRowsToMap(rows);
  return parseReferenceLibrary(getSettingString(settings, REFERENCE_SETTING_KEY));
}

async function saveReferenceLibrary(db: PrismaClient, workspaceId: string, items: ReferenceUpload[]) {
  const scope = workspaceScopeFromWorkspaceId(workspaceId);
  const scopedKey = resolveSettingDbKey(scope, REFERENCE_SETTING_KEY);
  const payload = JSON.stringify(items.slice(0, MAX_REFERENCE_ITEMS));
  await db.setting.upsert({
    where: { key: scopedKey },
    update: { value: payload },
    create: { key: scopedKey, value: payload },
  });
  invalidateWorkspaceSettingsCache(scope);
}

export async function addReferenceUpload(
  db: PrismaClient,
  workspaceId: string,
  input: { url: string; filename: string; contentType: string },
): Promise<ReferenceUpload[]> {
  const current = await loadReferenceLibrary(db, workspaceId);
  const entry: ReferenceUpload = {
    id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    url: input.url,
    filename: input.filename,
    contentType: input.contentType,
    createdAt: new Date().toISOString(),
  };
  const next = [entry, ...current.filter((item) => item.url !== input.url)].slice(0, MAX_REFERENCE_ITEMS);
  await saveReferenceLibrary(db, workspaceId, next);
  return next;
}

export async function removeReferenceUpload(
  db: PrismaClient,
  workspaceId: string,
  referenceId: string,
): Promise<ReferenceUpload[]> {
  const current = await loadReferenceLibrary(db, workspaceId);
  const next = current.filter((item) => item.id !== referenceId);
  await saveReferenceLibrary(db, workspaceId, next);
  return next;
}
