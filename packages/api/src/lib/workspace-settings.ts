import { type PrismaClient } from "@digitify/db";
import { type SettingRow } from "./settings";
import {
  invalidateUserSettingsCache,
  loadUserSettingRows,
  stripUserSettingKey,
  userSettingKey,
} from "./user-settings";

/** Shared workspace config (owner + team). */
export type WorkspaceScope = {
  workspaceId: string;
  memberId: string;
};

export function workspaceScopeFromUser(user: { id: string; workspaceId?: string }): WorkspaceScope {
  const workspaceId = user.workspaceId?.trim() || user.id;
  return { workspaceId, memberId: user.id };
}

export function workspaceSettingKey(workspaceId: string, key: string) {
  return `workspace:${workspaceId}:${key.trim()}`;
}

/** Per-member preferences; not shared across the workspace. */
export function isMemberScopedSettingKey(key: string) {
  const normalized = key.trim();
  if (normalized === "modules.disabled") return true;
  return normalized.startsWith("ui.") || normalized.startsWith("display.");
}

export function resolveSettingDbKey(scope: WorkspaceScope, key: string) {
  if (isMemberScopedSettingKey(key)) return userSettingKey(scope.memberId, key);
  return workspaceSettingKey(scope.workspaceId, key);
}

function stripWorkspaceSettingKey(workspaceId: string, key: string) {
  const prefix = `workspace:${workspaceId}:`;
  return key.startsWith(prefix) ? key.slice(prefix.length) : key;
}

function mergeSharedSettingRows(workspaceId: string, rows: SettingRow[]): SettingRow[] {
  const merged = new Map<string, SettingRow>();
  for (const row of rows) {
    const logical =
      row.key.startsWith(`workspace:${workspaceId}:`)
        ? stripWorkspaceSettingKey(workspaceId, row.key)
        : stripUserSettingKey(workspaceId, row.key);
    const existing = merged.get(logical);
    if (!existing || row.key.startsWith(`workspace:${workspaceId}:`)) {
      merged.set(logical, { key: logical, value: row.value });
    }
  }
  return Array.from(merged.values());
}

async function loadWorkspaceSharedRows(
  db: PrismaClient,
  workspaceId: string,
  keys?: string[],
): Promise<SettingRow[]> {
  const normalizedKeys = keys?.map((key) => key.trim()).filter(Boolean);

  if (normalizedKeys?.length) {
    const dbKeys = normalizedKeys.flatMap((key) => [
      workspaceSettingKey(workspaceId, key),
      userSettingKey(workspaceId, key),
    ]);
    const rows = await db.setting.findMany({ where: { key: { in: dbKeys } } });
    return mergeSharedSettingRows(workspaceId, rows);
  }

  const [workspaceRows, legacyRows] = await Promise.all([
    db.setting.findMany({ where: { key: { startsWith: `workspace:${workspaceId}:` } } }),
    db.setting.findMany({ where: { key: { startsWith: `user:${workspaceId}:` } } }),
  ]);
  return mergeSharedSettingRows(workspaceId, [...workspaceRows, ...legacyRows]);
}

/**
 * Loads settings for a workspace. Shared keys use workspace storage with legacy
 * fallback to `user:{workspaceOwnerId}:*`. Member-only keys stay on `user:{memberId}:*`.
 */
export async function loadWorkspaceSettingRows(
  db: PrismaClient,
  scope: WorkspaceScope,
  keys?: string[],
): Promise<SettingRow[]> {
  const normalizedKeys = keys?.map((key) => key.trim()).filter(Boolean);

  if (normalizedKeys?.length) {
    const memberKeys = normalizedKeys.filter(isMemberScopedSettingKey);
    const sharedKeys = normalizedKeys.filter((key) => !isMemberScopedSettingKey(key));
    const [memberRows, sharedRows] = await Promise.all([
      memberKeys.length ? loadUserSettingRows(db, scope.memberId, memberKeys) : Promise.resolve([]),
      sharedKeys.length ? loadWorkspaceSharedRows(db, scope.workspaceId, sharedKeys) : Promise.resolve([]),
    ]);
    return [...memberRows, ...sharedRows];
  }

  const [memberRows, sharedRows] = await Promise.all([
    loadUserSettingRows(db, scope.memberId),
    loadWorkspaceSharedRows(db, scope.workspaceId),
  ]);
  const memberOnly = memberRows.filter((row) => isMemberScopedSettingKey(row.key));
  return [...memberOnly, ...sharedRows];
}

export function invalidateWorkspaceSettingsCache(scope: WorkspaceScope) {
  invalidateUserSettingsCache(scope.workspaceId);
  invalidateUserSettingsCache(scope.memberId);
}
