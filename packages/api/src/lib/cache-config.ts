const DEFAULT_DASHBOARD_TTL_MS = 5 * 60_000;
const DEFAULT_SETTINGS_TTL_MS = 45_000;

const dashboardTtlByWorkspace = new Map<string, number>();
const settingsTtlByWorkspace = new Map<string, number>();

function clampMinutes(value: number) {
  return Math.min(60, Math.max(1, value)) * 60_000;
}

function clampSeconds(value: number) {
  return Math.min(300, Math.max(15, value)) * 1000;
}

export function applyWorkspaceCacheSettings(
  workspaceId: string,
  settings: Record<string, string | null | undefined>,
) {
  const dashboardMinutes = Number.parseInt(String(settings["cache.dashboard_ttl_minutes"] ?? "5"), 10);
  const settingsSeconds = Number.parseInt(String(settings["cache.settings_ttl_seconds"] ?? "45"), 10);

  if (Number.isFinite(dashboardMinutes)) {
    dashboardTtlByWorkspace.set(workspaceId, clampMinutes(dashboardMinutes));
  }
  if (Number.isFinite(settingsSeconds)) {
    settingsTtlByWorkspace.set(workspaceId, clampSeconds(settingsSeconds));
  }
}

export function getDashboardCacheTtlMs(workspaceId?: string) {
  if (!workspaceId) return DEFAULT_DASHBOARD_TTL_MS;
  return dashboardTtlByWorkspace.get(workspaceId) ?? DEFAULT_DASHBOARD_TTL_MS;
}

export function getSettingsCacheTtlMs(workspaceId?: string) {
  if (!workspaceId) return DEFAULT_SETTINGS_TTL_MS;
  return settingsTtlByWorkspace.get(workspaceId) ?? DEFAULT_SETTINGS_TTL_MS;
}

export function getDefaultCacheSettings() {
  return {
    dashboardTtlMinutes: DEFAULT_DASHBOARD_TTL_MS / 60_000,
    settingsTtlSeconds: DEFAULT_SETTINGS_TTL_MS / 1000,
    clientStaleTimeMinutes: 5,
    prefetchEnabled: true,
  };
}
