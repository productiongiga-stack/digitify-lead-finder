import { put } from "@vercel/blob";
import {
  centerCropRect,
  imageMeetsPlacementTarget,
  targetSpecForPlacement,
  type SocialImageTargetPlacement,
} from "./social-image-targets";
import type { FeedAspectFormat } from "./social-placements";
import { fetchSocialImageInfo, isMetaPublishableImageUrl, parseImageDimensions, type SocialImageInfo } from "./social-image";

function extensionForContentType(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
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

async function storeLocalCroppedAsset(params: {
  workspaceId: string;
  userId: string;
  bytes: Buffer;
  contentType: string;
}) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const ext = extensionForContentType(params.contentType);
  const safeName = `${Date.now()}-social-crop.${ext}`;
  const relativeDir = path.posix.join("uploads", "workspaces", params.workspaceId, "social");
  const relativePath = path.posix.join(relativeDir, safeName);
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, safeName), params.bytes);
  return `${resolvePublicBaseUrl()}/${relativePath}`;
}

async function uploadCroppedImage(params: {
  buffer: Buffer;
  contentType: string;
  workspaceId: string;
  userId: string;
  placement: SocialImageTargetPlacement;
}) {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const ext = extensionForContentType(params.contentType);
  const pathname = `workspaces/${params.workspaceId}/social/${params.userId}/${Date.now()}-${params.placement.toLowerCase()}-crop.${ext}`;

  if (token) {
    const blob = await put(pathname, params.buffer, {
      access: "public",
      contentType: params.contentType,
      token,
    });
    return blob.url;
  }

  if (process.env.NODE_ENV !== "production") {
    return storeLocalCroppedAsset({
      workspaceId: params.workspaceId,
      userId: params.userId,
      bytes: params.buffer,
      contentType: params.contentType,
    });
  }

  throw new Error("Afbeelding bijknippen vereist Vercel Blob in productie. Stel BLOB_READ_WRITE_TOKEN in.");
}

export async function cropImageBufferToPlacement(input: {
  buffer: Buffer;
  contentType: string;
  placement: SocialImageTargetPlacement;
  feedFormat?: FeedAspectFormat;
}) {
  const sharp = (await import("sharp")).default;
  const spec = targetSpecForPlacement(input.placement, input.feedFormat);
  const meta = await sharp(input.buffer).metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  if (!width || !height) {
    throw new Error("Afbeeldingsformaat kon niet gelezen worden voor bijknippen.");
  }

  const crop = centerCropRect(width, height, spec.aspectRatio);
  const outputFormat =
    input.contentType.includes("png") ? "png" : input.contentType.includes("webp") ? "webp" : "jpeg";

  const cropped = await sharp(input.buffer)
    .extract(crop)
    .resize(spec.width, spec.height, { fit: "fill" })
    .toFormat(outputFormat, { quality: outputFormat === "png" ? undefined : 90 })
    .toBuffer();

  const nextContentType =
    outputFormat === "png" ? "image/png" : outputFormat === "webp" ? "image/webp" : "image/jpeg";

  return { buffer: cropped, contentType: nextContentType };
}

async function fetchImageBuffer(imageUrl: string) {
  const trimmed = imageUrl.trim();
  const info = await fetchSocialImageInfo(trimmed);

  if (trimmed.startsWith("data:")) {
    const match = /^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/i.exec(trimmed);
    if (!match) throw new Error("Ongeldige data-URL.");
    return { buffer: Buffer.from(match[2], "base64"), info };
  }

  if (trimmed.startsWith("/uploads/")) {
    const path = await import("node:path");
    const { readFile } = await import("node:fs/promises");
    const relativePath = trimmed.replace(/^\//, "");
    const publicRoot = path.resolve(path.join(process.cwd(), "public"));
    const absolutePath = path.resolve(publicRoot, relativePath);
    if (!absolutePath.startsWith(`${publicRoot}${path.sep}`)) {
      throw new Error("Ongeldig upload-pad.");
    }
    return { buffer: await readFile(absolutePath), info };
  }

  const { assertPublicHttpUrl } = await import("@digitify/connectors");
  const safeUrl = await assertPublicHttpUrl(trimmed);
  const response = await fetch(safeUrl, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    throw new Error(`Afbeelding kon niet opgehaald worden (HTTP ${response.status}).`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return { buffer, info };
}

export async function prepareSocialImageUrlForPublish(input: {
  imageUrl: string;
  placement: SocialImageTargetPlacement;
  feedFormat?: FeedAspectFormat;
  targetPlatforms: string[];
  workspaceId: string;
  userId: string;
  forceCrop?: boolean;
  /** Multi-upload: upload blob/data URLs but never crop to feed aspect ratio. */
  preserveOriginal?: boolean;
}): Promise<{ imageUrl: string; info: SocialImageInfo; cropped: boolean }> {
  const trimmed = input.imageUrl.trim();
  if (!trimmed) {
    throw new Error("Afbeelding ontbreekt.");
  }

  const { buffer, info } = await fetchImageBuffer(trimmed);
  const needsPublicUrl = !isMetaPublishableImageUrl(trimmed);

  if (input.preserveOriginal && !input.forceCrop) {
    if (!needsPublicUrl) {
      return { imageUrl: trimmed, info, cropped: false };
    }
    const uploadedUrl = await uploadCroppedImage({
      buffer,
      contentType: info.contentType,
      workspaceId: input.workspaceId,
      userId: input.userId,
      placement: input.placement,
    });
    return { imageUrl: uploadedUrl, info, cropped: false };
  }

  const meetsTarget = imageMeetsPlacementTarget({
    width: info.width,
    height: info.height,
    aspectRatio: info.aspectRatio,
    placement: input.placement,
    feedFormat: input.feedFormat,
    targetPlatforms: input.targetPlatforms,
  });

  if (meetsTarget && !input.forceCrop && !needsPublicUrl) {
    return { imageUrl: trimmed, info, cropped: false };
  }

  if (meetsTarget && !input.forceCrop && needsPublicUrl) {
    const uploadedUrl = await uploadCroppedImage({
      buffer,
      contentType: info.contentType,
      workspaceId: input.workspaceId,
      userId: input.userId,
      placement: input.placement,
    });
    return { imageUrl: uploadedUrl, info, cropped: false };
  }

  const { buffer: croppedBuffer, contentType } = await cropImageBufferToPlacement({
    buffer,
    contentType: info.contentType,
    placement: input.placement,
    feedFormat: input.feedFormat,
  });

  const dimensions = parseImageDimensions(croppedBuffer);
  if (!dimensions?.width || !dimensions?.height) {
    throw new Error("Bijgeknipte afbeelding kon niet gevalideerd worden.");
  }

  const uploadedUrl = await uploadCroppedImage({
    buffer: croppedBuffer,
    contentType,
    workspaceId: input.workspaceId,
    userId: input.userId,
    placement: input.placement,
  });

  return {
    imageUrl: uploadedUrl,
    cropped: true,
    info: {
      width: dimensions.width,
      height: dimensions.height,
      aspectRatio: dimensions.width / dimensions.height,
      contentType,
      byteLength: croppedBuffer.byteLength,
    },
  };
}
