/**
 * Pure helpers for copying legacy `user:{workspaceOwnerId}:*` settings to `workspace:{id}:*`.
 * Used by packages/db/prisma/migrate-workspace-settings.ts and unit tests.
 */

export function userSettingKey(userId: string, key: string) {
  return `user:${userId}:${key.trim()}`;
}

export function workspaceSettingKey(workspaceId: string, key: string) {
  return `workspace:${workspaceId}:${key.trim()}`;
}

export function isMemberScopedSettingKey(key: string) {
  const normalized = key.trim();
  if (normalized === "modules.disabled") return true;
  return normalized.startsWith("ui.") || normalized.startsWith("display.");
}

export function parseLegacyUserSettingKey(dbKey: string, workspaceId: string): string | null {
  const prefix = `user:${workspaceId}:`;
  if (!dbKey.startsWith(prefix)) return null;
  return dbKey.slice(prefix.length);
}

export type SettingRowLike = { key: string; value: unknown };

export type MigrationPlanItem = {
  logicalKey: string;
  legacyKey: string;
  workspaceKey: string;
  action: "copy" | "skip_exists" | "skip_member";
};

export function planWorkspaceSettingsMigration(
  workspaceId: string,
  legacyRows: SettingRowLike[],
  existingWorkspaceKeys: Set<string>,
): MigrationPlanItem[] {
  const plan: MigrationPlanItem[] = [];

  for (const row of legacyRows) {
    const logicalKey = parseLegacyUserSettingKey(row.key, workspaceId);
    if (!logicalKey) continue;

    const workspaceKey = workspaceSettingKey(workspaceId, logicalKey);

    if (isMemberScopedSettingKey(logicalKey)) {
      plan.push({
        logicalKey,
        legacyKey: row.key,
        workspaceKey,
        action: "skip_member",
      });
      continue;
    }

    if (existingWorkspaceKeys.has(workspaceKey)) {
      plan.push({
        logicalKey,
        legacyKey: row.key,
        workspaceKey,
        action: "skip_exists",
      });
      continue;
    }

    plan.push({
      logicalKey,
      legacyKey: row.key,
      workspaceKey,
      action: "copy",
    });
  }

  return plan;
}

export async function resolveWorkspaceOwnerIds(
  users: Array<{ id: string; role: string; workspaceOwnerId: string | null }>,
): Promise<string[]> {
  const ids = new Set<string>();
  for (const user of users) {
    if (user.role === "OWNER") ids.add(user.id);
    if (user.workspaceOwnerId) ids.add(user.workspaceOwnerId);
  }
  return Array.from(ids);
}
