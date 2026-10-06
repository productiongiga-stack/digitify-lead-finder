import { protectSettingValue, type PrismaClient } from "@digitify/db";
import { getSettingString, settingsRowsToMap } from "./settings";
import { loadGoogleOAuthClientConfig } from "./google-calendar";
import { loadWorkspaceSettingRows, resolveSettingDbKey, type WorkspaceScope } from "./workspace-settings";

export const GOOGLE_DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_KEYS = [
  "files.google_drive_access_token",
  "files.google_drive_refresh_token",
  "files.google_drive_account_email",
  "files.google_drive_folder_id",
  "files.google_drive_token_expires_at",
] as const;

export async function loadGoogleDriveConfig(db: PrismaClient, scope: WorkspaceScope) {
  const [oauth, rows] = await Promise.all([
    loadGoogleOAuthClientConfig(db, { userId: scope.memberId }),
    loadWorkspaceSettingRows(db, scope, [...DRIVE_KEYS]),
  ]);
  const settings = settingsRowsToMap(rows);
  return {
    ...oauth,
    accessToken: getSettingString(settings, DRIVE_KEYS[0]),
    refreshToken: getSettingString(settings, DRIVE_KEYS[1]),
    accountEmail: getSettingString(settings, DRIVE_KEYS[2]),
    folderId: getSettingString(settings, DRIVE_KEYS[3]),
  };
}

export async function upsertGoogleDriveSettings(db: PrismaClient, scope: WorkspaceScope, entries: Array<{ key: string; value: string }>) {
  await db.$transaction(entries.map((entry) => {
    const key = resolveSettingDbKey(scope, entry.key);
    return db.setting.upsert({ where: { key }, update: { value: protectSettingValue(entry.key, entry.value) as any }, create: { key, value: protectSettingValue(entry.key, entry.value) as any } });
  }));
}

export async function refreshGoogleDriveAccessToken(config: { clientId: string; clientSecret: string; refreshToken: string }) {
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, grant_type: "refresh_token", refresh_token: config.refreshToken }) });
  if (!response.ok) throw new Error(`Google Drive OAuth refresh fout (${response.status}).`);
  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Google Drive access token ontbreekt.");
  return data;
}

export async function getGoogleDriveAccessToken(db: PrismaClient, scope: WorkspaceScope) {
  const config = await loadGoogleDriveConfig(db, scope);
  if (!config.clientId || !config.clientSecret || !config.refreshToken) throw new Error("Koppel Google Drive eerst in Instellingen.");
  const token = await refreshGoogleDriveAccessToken({ clientId: config.clientId, clientSecret: config.clientSecret, refreshToken: config.refreshToken });
  return { token: token.access_token!, config };
}

export async function ensureGoogleDriveWorkspaceFolder(db: PrismaClient, scope: WorkspaceScope) {
  const { token, config } = await getGoogleDriveAccessToken(db, scope);
  if (config.folderId) return { token, folderId: config.folderId };
  const response = await fetch("https://www.googleapis.com/drive/v3/files", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: `Digitify Files - ${scope.workspaceId}`, mimeType: "application/vnd.google-apps.folder" }) });
  if (!response.ok) throw new Error("Google Drive-map kon niet worden aangemaakt.");
  const folder = await response.json() as { id?: string };
  if (!folder.id) throw new Error("Google Drive-map heeft geen ID teruggegeven.");
  await upsertGoogleDriveSettings(db, scope, [{ key: "files.google_drive_folder_id", value: folder.id }]);
  return { token, folderId: folder.id };
}

export async function uploadGoogleDriveFile(db: PrismaClient, scope: WorkspaceScope, params: { name: string; contentType: string; bytes: Buffer }) {
  const { token, folderId } = await ensureGoogleDriveWorkspaceFolder(db, scope);
  const boundary = `digitify-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const metadata = JSON.stringify({ name: params.name, parents: [folderId] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${params.contentType || "application/octet-stream"}\r\n\r\n`),
    params.bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,etag", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body });
  if (!response.ok) throw new Error(`Google Drive-upload mislukt (${response.status}).`);
  return await response.json() as { id?: string; name?: string; mimeType?: string; size?: string; webViewLink?: string; etag?: string };
}

export async function getGoogleDriveFileMetadata(db: PrismaClient, scope: WorkspaceScope, fileId: string) {
  const { token } = await getGoogleDriveAccessToken(db, scope);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,webViewLink,etag`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Google Drive-bestand kon niet worden gelezen.");
  return await response.json() as { id?: string; name?: string; mimeType?: string; size?: string; webViewLink?: string; etag?: string };
}
