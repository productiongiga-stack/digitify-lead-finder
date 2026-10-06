import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const LOCAL_FILE_MAX_BYTES = 100 * 1024 * 1024;
export const DEFAULT_USER_FILE_QUOTA_BYTES = 1024 * 1024 * 1024;

function localRoot() {
  return path.resolve(process.env.FILES_LOCAL_ROOT?.trim() || path.join(process.cwd(), "storage", "files"));
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "bestand";
}

export function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function localStorageIsPersistent() {
  return process.env.NODE_ENV !== "production" || Boolean(process.env.FILES_LOCAL_ROOT?.trim());
}

export async function writeLocalWorkspaceFile(params: {
  workspaceId: string;
  userId: string;
  name: string;
  bytes: Buffer;
}) {
  const workspace = safeSegment(params.workspaceId);
  const user = safeSegment(params.userId);
  const filename = `${randomUUID()}-${safeSegment(params.name)}`;
  const relativeKey = path.posix.join(workspace, user, filename);
  const absoluteRoot = localRoot();
  const absolutePath = path.join(absoluteRoot, ...relativeKey.split("/"));
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, params.bytes, { flag: "wx" });
  return { storageKey: relativeKey, storageUrl: `local://${relativeKey}` };
}

export async function readLocalWorkspaceFile(storageKey: string, workspaceId: string) {
  const normalized = storageKey.replaceAll("\\", "/").replace(/^\/+/, "");
  const workspacePrefix = `${safeSegment(workspaceId)}/`;
  if (!normalized.startsWith(workspacePrefix) || normalized.includes("..")) {
    throw new Error("Ongeldig lokaal bestandspad.");
  }
  const root = localRoot();
  const absolute = path.resolve(root, ...normalized.split("/"));
  if (!absolute.startsWith(`${root}${path.sep}`)) throw new Error("Ongeldig lokaal bestandspad.");
  return readFile(absolute);
}

export async function removeLocalWorkspaceFile(storageKey: string, workspaceId: string) {
  const normalized = storageKey.replaceAll("\\", "/").replace(/^\/+/, "");
  const workspacePrefix = `${safeSegment(workspaceId)}/`;
  if (!normalized.startsWith(workspacePrefix) || normalized.includes("..")) return;
  const root = localRoot();
  const absolute = path.resolve(root, ...normalized.split("/"));
  if (!absolute.startsWith(`${root}${path.sep}`)) return;
  await unlink(absolute).catch(() => undefined);
}
