import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { recordSecurityAuditEvent } from "@digitify/api/src/lib/security-audit";
import { assertWorkspaceFileRelation } from "@digitify/api/src/lib/file-relations";
import { getCurrentUser } from "@/lib/auth/session";
import { enforceRateLimit, getClientIp } from "@/lib/http-security";
import { storeUploadedImage } from "@/lib/upload-storage";
import { commitFileQuota, releaseFileQuota, reserveFileQuota } from "@digitify/api/src/lib/file-quota";
import { localStorageIsPersistent, removeLocalWorkspaceFile, sha256, writeLocalWorkspaceFile } from "@digitify/api/src/lib/file-storage";
import { uploadGoogleDriveFile } from "@digitify/api/src/lib/google-drive";
import { workspaceScopeFromUser } from "@digitify/api/src/lib/workspace-settings";
import { resolveLeadOwnerId } from "@digitify/api/src/lib/tenant";

const ALLOWED_TYPES = new Set([
  "image/png", "image/jpeg", "image/webp", "image/x-icon", "image/vnd.microsoft.icon",
  "video/mp4", "video/quicktime", "application/pdf",
  "text/plain", "text/csv", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.ms-powerpoint",
  "application/zip", "application/x-zip-compressed",
]);
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Niet geauthenticeerd." }, { status: 401 });

  const limited = await enforceRateLimit(req, {
    key: `files-upload:${user.id}:${getClientIp(req)}`,
    limit: 40,
    windowMs: 60 * 60 * 1000,
    message: "Te veel uploads. Probeer later opnieuw.",
  });
  if (limited) return limited;

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Geen bestand ontvangen." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Dit bestandstype wordt niet ondersteund." }, { status: 400 });
  const maxBytes = file.type.startsWith("video/") ? MAX_VIDEO_BYTES : MAX_FILE_BYTES;
  if (file.size > maxBytes) return NextResponse.json({ error: `Bestand is te groot (maximaal ${file.type.startsWith("video/") ? "100 MB" : "10 MB"}).` }, { status: 400 });

  const relatedTypeValue = formData.get("relatedType");
  const relatedIdValue = formData.get("relatedId");
  const relatedType = typeof relatedTypeValue === "string" ? relatedTypeValue.trim() : "";
  const relatedId = typeof relatedIdValue === "string" ? relatedIdValue.trim() : "";
  const requestedProviderValue = formData.get("storageProvider");
  const requestedProvider = typeof requestedProviderValue === "string" ? requestedProviderValue.trim().toUpperCase() : "";
  const idempotencyValue = formData.get("idempotencyKey");
  const idempotencyKey = typeof idempotencyValue === "string" && idempotencyValue.trim()
    ? idempotencyValue.trim().slice(0, 180)
    : `${user.id}:${file.name}:${file.size}:${file.lastModified}`;
  if (relatedType && !["LEAD", "QUOTE", "CUSTOMER", "PROJECT"].includes(relatedType)) {
    return NextResponse.json({ error: "Ongeldige bestandsrelatie." }, { status: 400 });
  }

  try {
    const ownerUserId = await resolveLeadOwnerId(prisma, user.workspaceId);
    await assertWorkspaceFileRelation(prisma, user.workspaceId, relatedType as "LEAD" | "QUOTE" | "CUSTOMER" | "PROJECT" | undefined, relatedId || undefined);
    const bytes = Buffer.from(await file.arrayBuffer());
    const checksum = sha256(bytes);
    const existingFile = await prisma.workspaceFile.findFirst({ where: { createdById: ownerUserId, uploadedById: user.id, name: file.name.slice(0, 240), checksumSha256: checksum, deletedAt: null }, select: { id: true, name: true, contentType: true, size: true, createdAt: true } });
    if (existingFile) return NextResponse.json({ ...existingFile, outcome: "reused" }, { status: 200 });
    const requestedRemote = requestedProvider === "DRIVE";
    const provider = requestedProvider === "BOTH" ? (process.env.NODE_ENV === "production" && !localStorageIsPersistent() ? "BLOB" : "LOCAL") : requestedProvider || (process.env.NODE_ENV === "production" && !localStorageIsPersistent() ? "BLOB" : "LOCAL");
    if (provider === "LOCAL" && process.env.NODE_ENV === "production" && !localStorageIsPersistent()) {
      return NextResponse.json({ error: "Lokale opslag is niet persistent op deze server. Configureer FILES_LOCAL_ROOT of kies Google Drive." }, { status: 503 });
    }
    if (!requestedRemote && !["LOCAL", "BLOB"].includes(provider)) return NextResponse.json({ error: "Ongeldige opslagkeuze." }, { status: 400 });
    const reservation = requestedRemote ? null : await reserveFileQuota(prisma, { userId: user.id, workspaceId: user.workspaceId, bytes: file.size, idempotencyKey });
    if (reservation?.status === "COMMITTED" && reservation.fileId) {
      const reused = await prisma.workspaceFile.findFirst({ where: { id: reservation.fileId, createdById: ownerUserId }, select: { id: true, name: true, contentType: true, size: true, createdAt: true } });
      if (reused) return NextResponse.json({ ...reused, outcome: "reused" }, { status: 200 });
    }
    let stored: { url: string; storage: "blob" | "blob-private" | "local" | "data-url" | "google-drive"; storageKey?: string; driveFileId?: string; driveWebUrl?: string; driveEtag?: string; driveSyncStatus?: string };
    let localStorageKey: string | undefined;
    try {
      if (requestedRemote) {
        const driveFile = await uploadGoogleDriveFile(prisma, workspaceScopeFromUser({ id: user.id, workspaceId: user.workspaceId }), { name: file.name, contentType: file.type, bytes });
        if (!driveFile.id) throw new Error("Google Drive gaf geen bestands-ID terug.");
        stored = { url: driveFile.webViewLink || `drive://${driveFile.id}`, storage: "google-drive", driveFileId: driveFile.id, driveWebUrl: driveFile.webViewLink, driveEtag: driveFile.etag, driveSyncStatus: "SYNCED" };
      } else if (provider === "LOCAL") {
        const local = await writeLocalWorkspaceFile({ workspaceId: user.workspaceId, userId: user.id, name: file.name, bytes });
        localStorageKey = local.storageKey;
        stored = { url: local.storageUrl, storageKey: local.storageKey, storage: "local" };
      } else {
        const blob = await storeUploadedImage({ userId: user.workspaceId, file, bytes, access: "private" });
        stored = { url: blob.url, storage: blob.storage };
      }
      if (requestedProvider === "BOTH") {
        const driveFile = await uploadGoogleDriveFile(prisma, workspaceScopeFromUser({ id: user.id, workspaceId: user.workspaceId }), { name: file.name, contentType: file.type, bytes });
        stored = { ...stored, driveFileId: driveFile.id, driveWebUrl: driveFile.webViewLink, driveEtag: driveFile.etag, driveSyncStatus: driveFile.id ? "SYNCED" : "FAILED" };
      }
    } catch (error) {
      if (reservation) await releaseFileQuota(prisma, reservation.id);
      if (localStorageKey) {
        await removeLocalWorkspaceFile(localStorageKey, user.workspaceId);
      }
      throw error;
    }
    let record;
    try {
      record = await prisma.workspaceFile.create({
        data: {
        createdById: ownerUserId,
        uploadedById: user.id,
        name: file.name.slice(0, 240),
        storageUrl: stored.url,
        storage: stored.storage,
        storageProvider: requestedRemote ? "GOOGLE_DRIVE" : provider,
        storageKey: stored.storageKey ?? null,
        checksumSha256: checksum,
        contentType: file.type,
        size: file.size,
        relatedType: relatedType || null,
        relatedId: relatedId || null,
        driveFileId: stored.driveFileId ?? null,
        driveWebUrl: stored.driveWebUrl ?? null,
        driveEtag: stored.driveEtag ?? null,
        driveSyncStatus: stored.driveSyncStatus ?? null,
        },
        select: { id: true, name: true, contentType: true, size: true, createdAt: true },
      });
    } catch (error) {
      if (reservation) await releaseFileQuota(prisma, reservation.id);
      if (localStorageKey) await removeLocalWorkspaceFile(localStorageKey, user.workspaceId);
      throw error;
    }
    if (reservation) await commitFileQuota(prisma, reservation.id, record.id);
    await recordSecurityAuditEvent(prisma, {
      workspaceId: user.workspaceId,
      actorUserId: user.actorUserId ?? user.id,
      targetUserId: user.id,
      action: "FILE_UPLOADED",
      resource: "WorkspaceFile",
      resourceId: record.id,
      result: "SUCCESS",
      requestId: req.headers.get("x-request-id") ?? undefined,
      metadata: { name: record.name, contentType: record.contentType, size: record.size, storage: stored.storage },
    });
    return NextResponse.json({ ...record, outcome: "created" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload mislukt." }, { status: 503 });
  }
}
