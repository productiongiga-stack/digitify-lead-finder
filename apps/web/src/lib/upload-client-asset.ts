import { upload } from "@vercel/blob/client";
import {
  SERVER_UPLOAD_SAFE_BYTES,
  UPLOAD_ALLOWED_VIDEO_TYPES,
  buildWorkspaceUploadPathname,
} from "@/lib/upload-constants";

const VIDEO_TYPES = new Set<string>(UPLOAD_ALLOWED_VIDEO_TYPES);

let cachedUploadPrefix: { prefix: string; configured: boolean } | null = null;

async function resolveBlobUploadConfig() {
  if (cachedUploadPrefix) return cachedUploadPrefix;

  const response = await fetch("/api/upload/client");
  const payload = (await response.json().catch(() => ({}))) as {
    configured?: boolean;
    prefix?: string | null;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || "Kon uploadconfiguratie niet ophalen.");
  }

  cachedUploadPrefix = {
    configured: Boolean(payload.configured && payload.prefix),
    prefix: payload.prefix || "",
  };
  return cachedUploadPrefix;
}

function shouldPreferClientUpload(file: File) {
  return VIDEO_TYPES.has(file.type) || file.size > SERVER_UPLOAD_SAFE_BYTES;
}

async function uploadViaClientBlob(file: File) {
  const config = await resolveBlobUploadConfig();
  if (!config.configured || !config.prefix) {
    return null;
  }

  const userId = config.prefix.replace(/^workspaces\//, "").replace(/\/$/, "");
  const pathname = buildWorkspaceUploadPathname(userId, file.name);
  const blob = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: "/api/upload/client",
  });

  return blob.url;
}

async function parseUploadResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as { url?: string; error?: string };
  } catch {
    const isPayloadTooLarge =
      text.trim().startsWith("Request") ||
      text.toLowerCase().includes("entity too large") ||
      text.toLowerCase().includes("body exceeded");
    throw new Error(
      isPayloadTooLarge
        ? "Bestand is te groot voor een directe server-upload. Gebruik Vercel Blob (BLOB_READ_WRITE_TOKEN), comprimeer de video, of plak een publieke MP4-URL."
        : text.slice(0, 200) || "Upload mislukt",
    );
  }
}

async function uploadViaServerRoute(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/upload", { method: "POST", body: form });
  const payload = await parseUploadResponse(response);
  if (!response.ok || !payload.url) {
    throw new Error(payload.error || "Upload mislukt");
  }
  return payload.url;
}

export async function uploadClientAsset(file: File) {
  if (shouldPreferClientUpload(file)) {
    try {
      const blobUrl = await uploadViaClientBlob(file);
      if (blobUrl) return blobUrl;
    } catch (error) {
      if (file.size <= SERVER_UPLOAD_SAFE_BYTES && !VIDEO_TYPES.has(file.type)) {
        return uploadViaServerRoute(file);
      }
      throw error instanceof Error
        ? error
        : new Error("Video-upload mislukt. Controleer BLOB_READ_WRITE_TOKEN of gebruik een publieke MP4-URL.");
    }

    if (file.size <= SERVER_UPLOAD_SAFE_BYTES) {
      return uploadViaServerRoute(file);
    }

    throw new Error(
      VIDEO_TYPES.has(file.type)
        ? "Video-upload vereist Vercel Blob voor bestanden groter dan 4MB. Stel BLOB_READ_WRITE_TOKEN in op Vercel, comprimeer de video, of plak een publieke MP4-URL."
        : "Bestand is te groot voor een directe server-upload. Comprimeer het bestand of stel Vercel Blob in.",
    );
  }

  return uploadViaServerRoute(file);
}
