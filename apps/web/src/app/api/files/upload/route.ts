import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { recordSecurityAuditEvent } from "@digitify/api/src/lib/security-audit";
import { assertWorkspaceFileRelation } from "@digitify/api/src/lib/file-relations";
import { getCurrentUser } from "@/lib/auth/session";
import { enforceRateLimit, getClientIp } from "@/lib/http-security";
import { storeUploadedImage } from "@/lib/upload-storage";

const ALLOWED_TYPES = new Set([
  "image/png", "image/jpeg", "image/webp", "image/x-icon", "image/vnd.microsoft.icon",
  "video/mp4", "video/quicktime", "application/pdf",
  "text/plain", "text/csv", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
  if (relatedType && !["LEAD", "QUOTE", "CUSTOMER", "PROJECT"].includes(relatedType)) {
    return NextResponse.json({ error: "Ongeldige bestandsrelatie." }, { status: 400 });
  }

  try {
    await assertWorkspaceFileRelation(prisma, user.workspaceId, relatedType as "LEAD" | "QUOTE" | "CUSTOMER" | "PROJECT" | undefined, relatedId || undefined);
    const stored = await storeUploadedImage({
      userId: user.workspaceId,
      file,
      bytes: Buffer.from(await file.arrayBuffer()),
      access: "private",
    });
    const record = await prisma.workspaceFile.create({
      data: {
        createdById: user.workspaceId,
        uploadedById: user.id,
        name: file.name.slice(0, 240),
        storageUrl: stored.url,
        storage: stored.storage,
        contentType: file.type,
        size: file.size,
        relatedType: relatedType || null,
        relatedId: relatedId || null,
      },
      select: { id: true, name: true, contentType: true, size: true, createdAt: true },
    });
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
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload mislukt." }, { status: 503 });
  }
}
