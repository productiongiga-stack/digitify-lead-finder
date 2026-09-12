import { readFile } from "node:fs/promises";
import path from "node:path";
import { get as getBlob } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@digitify/db";
import { recordSecurityAuditEvent } from "@digitify/api/src/lib/security-audit";
import { getCurrentUser } from "@/lib/auth/session";

function safeDownloadName(name: string) {
  return name.replace(/[^a-zA-Z0-9._ -]+/g, "-").slice(0, 180) || "bestand";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Niet geauthenticeerd." }, { status: 401 });
  const { id } = await params;
  const file = await prisma.workspaceFile.findFirst({ where: { id, createdById: user.workspaceId } });
  if (!file) return NextResponse.json({ error: "Bestand niet gevonden." }, { status: 404 });

  const headers = {
    "Content-Type": file.contentType,
    "Content-Disposition": `attachment; filename="${safeDownloadName(file.name)}"`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };

  try {
    const parsed = new URL(file.storageUrl);
    if (parsed.pathname.startsWith(`/uploads/workspaces/${user.workspaceId}/`)) {
      const relative = parsed.pathname.replace(/^\//, "");
      const absolute = path.resolve(process.cwd(), "public", relative);
      const publicRoot = path.resolve(process.cwd(), "public", "uploads", "workspaces", user.workspaceId);
      if (!absolute.startsWith(`${publicRoot}${path.sep}`)) return NextResponse.json({ error: "Ongeldig bestandspad." }, { status: 400 });
      const body = await readFile(absolute);
      await recordSecurityAuditEvent(prisma, { workspaceId: user.workspaceId, actorUserId: user.actorUserId ?? user.id, targetUserId: user.id, action: "FILE_DOWNLOADED", resource: "WorkspaceFile", resourceId: file.id, result: "SUCCESS", requestId: _req.headers.get("x-request-id") ?? undefined });
      return new NextResponse(body, { headers });
    }
    if (file.storage === "blob-private") {
      if (!parsed.pathname.includes(`/workspaces/${user.workspaceId}/`)) {
        return NextResponse.json({ error: "Bestand niet gevonden." }, { status: 404 });
      }
      const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
      if (!token) return NextResponse.json({ error: "Bestand kan niet worden geladen." }, { status: 503 });
      const blob = await getBlob(file.storageUrl, { access: "private", token, useCache: false });
      if (!blob?.stream) return NextResponse.json({ error: "Bestand kan niet worden geladen." }, { status: 404 });
      await recordSecurityAuditEvent(prisma, { workspaceId: user.workspaceId, actorUserId: user.actorUserId ?? user.id, targetUserId: user.id, action: "FILE_DOWNLOADED", resource: "WorkspaceFile", resourceId: file.id, result: "SUCCESS", requestId: _req.headers.get("x-request-id") ?? undefined });
      return new NextResponse(blob.stream, { headers });
    }
    if (file.storage !== "blob") return NextResponse.json({ error: "Bestand niet gevonden." }, { status: 404 });
    if (!parsed.hostname.endsWith(".blob.vercel-storage.com")) {
      return NextResponse.json({ error: "Bestand niet gevonden." }, { status: 404 });
    }
    const response = await fetch(file.storageUrl, { cache: "no-store" });
    if (!response.ok || !response.body) return NextResponse.json({ error: "Bestand kan niet worden geladen." }, { status: 502 });
    await recordSecurityAuditEvent(prisma, { workspaceId: user.workspaceId, actorUserId: user.actorUserId ?? user.id, targetUserId: user.id, action: "FILE_DOWNLOADED", resource: "WorkspaceFile", resourceId: file.id, result: "SUCCESS", requestId: _req.headers.get("x-request-id") ?? undefined });
    return new NextResponse(response.body, { headers });
  } catch {
    return NextResponse.json({ error: "Bestand kan niet worden geladen." }, { status: 502 });
  }
}
