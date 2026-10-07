export type BlobAccess = "private" | "public";

/**
 * Blob stores are configured per access mode. Private files (documents,
 * presentations and portal uploads) must never use the public store token.
 * Public media keeps a separate token so existing social assets remain
 * compatible after the private store is introduced.
 */
export function getBlobToken(access: BlobAccess): string | undefined {
  const value = access === "private"
    ? process.env.BLOB_READ_WRITE_TOKEN
    : process.env.BLOB_PUBLIC_READ_WRITE_TOKEN;
  return value?.trim() || undefined;
}

export function isBlobConfigured(access: BlobAccess): boolean {
  return Boolean(getBlobToken(access));
}

export function blobConfigurationMessage(access: BlobAccess): string {
  return access === "private"
    ? "Private bestandsopslag is niet geconfigureerd. Koppel een private Vercel Blob-store en publiceer opnieuw."
    : "Publieke media-opslag is niet geconfigureerd. Koppel de publieke Vercel Blob-store opnieuw of gebruik een publieke URL.";
}

export function translateBlobError(error: unknown, access: BlobAccess): Error {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (
    normalized.includes("cannot use private access on a public store") ||
    normalized.includes("private access") && normalized.includes("public store")
  ) {
    return new Error(blobConfigurationMessage("private"));
  }
  if (
    normalized.includes("cannot use public access on a private store") ||
    normalized.includes("public access") && normalized.includes("private store")
  ) {
    return new Error(blobConfigurationMessage("public"));
  }
  if (!getBlobToken(access) && normalized.includes("token")) {
    return new Error(blobConfigurationMessage(access));
  }
  return error instanceof Error ? error : new Error(message || "Blob-opslag mislukt.");
}
