export const UPLOAD_ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/webp",
] as const;

export const UPLOAD_ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime"] as const;

export const UPLOAD_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const UPLOAD_MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/** Vercel serverless functions reject bodies above ~4.5MB. */
export const SERVER_UPLOAD_SAFE_BYTES = 4 * 1024 * 1024;

export function sanitizeUploadFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "upload";
}

export function buildWorkspaceUploadPathname(userId: string, filename: string) {
  return `workspaces/${userId}/${Date.now()}-${sanitizeUploadFilename(filename)}`;
}

export function maxUploadBytesForPathname(pathname: string) {
  const lower = pathname.toLowerCase();
  if (lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.includes("/video-")) {
    return UPLOAD_MAX_VIDEO_BYTES;
  }
  return UPLOAD_MAX_IMAGE_BYTES;
}
