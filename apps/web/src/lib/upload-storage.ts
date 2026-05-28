import { put } from "@vercel/blob";

const warnedDataUrlFallback = { value: false };

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "upload";
}

export type StoredUpload = {
  url: string;
  storage: "blob" | "data-url";
  name: string;
  size: number;
  type: string;
};

/**
 * Persists uploads to Vercel Blob when BLOB_READ_WRITE_TOKEN is set.
 * Falls back to data URLs in local dev (not suitable for production).
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

  if (process.env.NODE_ENV === "production" && !warnedDataUrlFallback.value) {
    warnedDataUrlFallback.value = true;
    console.warn(
      "[upload] BLOB_READ_WRITE_TOKEN unset — using data URLs. Add Vercel Blob for production.",
    );
  }

  const dataUrl = `data:${params.file.type};base64,${params.bytes.toString("base64")}`;
  return {
    url: dataUrl,
    storage: "data-url",
    name: params.file.name,
    size: params.file.size,
    type: params.file.type,
  };
}
