import { put } from "@vercel/blob";
import { fetchRemoteAsset } from "@digitify/media-studio";
import { blobConfigurationMessage, getBlobToken, translateBlobError } from "./blob-storage";

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "generated";
}

function extensionForContentType(contentType: string, fallback = "bin") {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("webm")) return "webm";
  return fallback;
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

async function storeLocalGeneratedAsset(params: {
  workspaceId: string;
  userId: string;
  bytes: Buffer;
  contentType: string;
  filename: string;
}) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const ext = extensionForContentType(params.contentType, "bin");
  const safeName = `${Date.now()}-${sanitizeFilename(params.filename)}.${ext}`;
  const relativeDir = path.posix.join("uploads", "workspaces", params.workspaceId, "media");
  const relativePath = path.posix.join(relativeDir, safeName);
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, safeName), params.bytes);
  return `${resolvePublicBaseUrl()}/${relativePath}`;
}

export async function importRemoteMediaToBlob(params: {
  sourceUrl: string;
  workspaceId: string;
  userId: string;
  filename?: string;
}): Promise<{ url: string; storage: "blob" | "local" }> {
  const { bytes, contentType } = await fetchRemoteAsset(params.sourceUrl);
  return storeGeneratedAssetBytes({...params,bytes,contentType});
}

export async function storeGeneratedAssetBytes(params: { workspaceId:string; userId:string; filename?:string; bytes:Buffer; contentType:string }): Promise<{url:string;storage:"blob"|"local"}> {
  const {bytes,contentType} = params;
  const token = getBlobToken("public");
  const ext = extensionForContentType(contentType, "bin");
  const pathname = `workspaces/${params.workspaceId}/media/${params.userId}/${Date.now()}-${sanitizeFilename(params.filename || "generated")}.${ext}`;

  if (token) {
    try {
      const blob = await put(pathname, bytes, {
        access: "public",
        contentType,
        token,
      });
      return { url: blob.url, storage: "blob" };
    } catch (error) {
      throw translateBlobError(error, "public");
    }
  }

  if (process.env.NODE_ENV !== "production") {
    const url = await storeLocalGeneratedAsset({
      workspaceId: params.workspaceId,
      userId: params.userId,
      bytes,
      contentType,
      filename: params.filename || "generated",
    });
    return { url, storage: "local" };
  }

  throw new Error(
    blobConfigurationMessage("public"),
  );
}
