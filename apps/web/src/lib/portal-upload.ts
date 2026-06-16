import { put } from "@vercel/blob";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_PORTAL_FILE_BYTES = 3 * 1024 * 1024;
const ALLOWED_PORTAL_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "upload";
}

function resolvePublicBaseUrl() {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  const port = process.env.PORT?.trim() || "3000";
  return `http://localhost:${port}`;
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const type = match[1].toLowerCase();
  const bytes = Buffer.from(match[2], "base64");
  return { type, bytes };
}

export type StoredPortalFile = {
  id: string;
  quoteId: string;
  name: string;
  type: string;
  url: string;
  storage: "blob" | "local";
  uploadedAt: string;
};

export async function storePortalUpload(params: {
  workspaceId: string;
  quoteId: string;
  name: string;
  type: string;
  dataUrl: string;
}): Promise<StoredPortalFile> {
  const parsed = parseDataUrl(params.dataUrl);
  if (!parsed) throw new Error("Ongeldig bestand.");
  if (parsed.bytes.length > MAX_PORTAL_FILE_BYTES) {
    throw new Error("Bestand is te groot.");
  }
  const mime = (params.type || parsed.type).toLowerCase();
  if (!ALLOWED_PORTAL_TYPES.has(mime)) {
    throw new Error("Bestandstype niet toegestaan.");
  }

  const filename = `${Date.now()}-${sanitizeFilename(params.name)}`;
  const blobPath = `portal/${params.workspaceId}/${params.quoteId}/${filename}`;
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (token) {
    const blob = await put(blobPath, parsed.bytes, {
      access: "public",
      contentType: mime,
      token,
    });
    return {
      id: `file_${Math.random().toString(36).slice(2, 10)}`,
      quoteId: params.quoteId,
      name: params.name,
      type: mime,
      url: blob.url,
      storage: "blob",
      uploadedAt: new Date().toISOString(),
    };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Portal-uploads vereisen Vercel Blob in productie.");
  }

  const relativeDir = path.posix.join("uploads", "portal", params.workspaceId, params.quoteId);
  const relativePath = path.posix.join(relativeDir, filename);
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, filename), parsed.bytes);

  return {
    id: `file_${Math.random().toString(36).slice(2, 10)}`,
    quoteId: params.quoteId,
    name: params.name,
    type: mime,
    url: `${resolvePublicBaseUrl()}/${relativePath}`,
    storage: "local",
    uploadedAt: new Date().toISOString(),
  };
}
