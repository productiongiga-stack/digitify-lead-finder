import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

const warnedDataUrlFallback = { value: false };

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

export type StoredUpload = {
  url: string;
  storage: "blob" | "data-url" | "local";
  name: string;
  size: number;
  type: string;
};

async function storeLocalUpload(params: {
  userId: string;
  file: File;
  bytes: Buffer;
}): Promise<StoredUpload> {
  const filename = `${Date.now()}-${sanitizeFilename(params.file.name)}`;
  const relativeDir = path.posix.join("uploads", "workspaces", params.userId);
  const relativePath = path.posix.join(relativeDir, filename);
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, filename), params.bytes);

  return {
    url: `${resolvePublicBaseUrl()}/${relativePath}`,
    storage: "local",
    name: params.file.name,
    size: params.file.size,
    type: params.file.type,
  };
}

/**
 * Persists uploads to Vercel Blob when BLOB_READ_WRITE_TOKEN is set.
 * Falls back to public/uploads locally in development.
 */
export async function storeUploadedImage(params: {
  userId: string;
  file: File;
  bytes: Buffer;
}): Promise<StoredUpload> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const pathname = `workspaces/${params.userId}/${Date.now()}-${sanitizeFilename(params.file.name)}`;

  if (token) {
    const blob = await put(pathname, params.bytes, {
      access: "public",
      contentType: params.file.type,
      token,
    });
    return {
      url: blob.url,
      storage: "blob",
      name: params.file.name,
      size: params.file.size,
      type: params.file.type,
    };
  }

  if (process.env.NODE_ENV !== "production") {
    return storeLocalUpload(params);
  }

  if (!warnedDataUrlFallback.value) {
    warnedDataUrlFallback.value = true;
    console.warn(
      "[upload] BLOB_READ_WRITE_TOKEN unset in production — refusing data URL fallback.",
    );
  }

  throw new Error(
    "Uploads vereisen Vercel Blob in productie. Stel BLOB_READ_WRITE_TOKEN in.",
  );
}
