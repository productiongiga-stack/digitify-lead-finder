import { assertPublicHttpUrl } from "@digitify/connectors";

export type SocialImageInfo = {
  width: number;
  height: number;
  aspectRatio: number;
  contentType: string;
  byteLength: number;
};

const INSTAGRAM_FEED_MIN_ASPECT_RATIO = 0.8; // 4:5
const INSTAGRAM_FEED_MAX_ASPECT_RATIO = 1.91; // 1.91:1
const STORY_MIN_ASPECT_RATIO = 0.5; // 1:2, keeps a little tolerance around 9:16
const STORY_MAX_ASPECT_RATIO = 0.75; // 3:4, avoids square/feed assets for stories
const MAX_REMOTE_IMAGE_BYTES = 12 * 1024 * 1024;

function contentTypeFromUploadPath(uploadPath: string) {
  const ext = uploadPath.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "image/jpeg";
}

export function isWorkspaceUploadImagePath(imageUrl: string) {
  const trimmed = imageUrl.trim();
  return trimmed.startsWith("/uploads/") && !trimmed.includes("..");
}

async function readWorkspaceUploadImageBuffer(uploadPath: string) {
  const path = await import("node:path");
  const { readFile } = await import("node:fs/promises");
  const normalized = uploadPath.trim().replace(/\\/g, "/");
  if (!isWorkspaceUploadImagePath(normalized)) {
    throw new Error("Ongeldig upload-pad.");
  }

  const relativePath = normalized.replace(/^\//, "");
  const publicRoot = path.resolve(path.join(process.cwd(), "public"));
  const absolutePath = path.resolve(publicRoot, relativePath);
  if (!absolutePath.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error("Ongeldig upload-pad.");
  }

  const buffer = await readFile(absolutePath);
  if (!buffer.byteLength) {
    throw new Error("Upload-afbeelding kon niet gelezen worden.");
  }
  if (buffer.byteLength > MAX_REMOTE_IMAGE_BYTES) {
    throw new Error("Afbeelding is te groot. Gebruik maximaal 12 MB.");
  }

  return {
    buffer,
    contentType: contentTypeFromUploadPath(normalized),
  };
}

function ratioLabel(value: number) {
  return `${value.toFixed(2)}:1`;
}

function readUInt24LE(buffer: Buffer, offset: number) {
  return buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16);
}

function parsePngDimensions(buffer: Buffer) {
  const pngSignature = "89504e470d0a1a0a";
  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== pngSignature) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function parseJpegDimensions(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > buffer.length) break;

    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;

    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker);

    if (isStartOfFrame && offset + 7 <= buffer.length) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }

    offset += length;
  }

  return null;
}

function parseWebpDimensions(buffer: Buffer) {
  if (
    buffer.length < 30 ||
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    return null;
  }

  const chunk = buffer.subarray(12, 16).toString("ascii");
  if (chunk === "VP8X" && buffer.length >= 30) {
    return {
      width: readUInt24LE(buffer, 24) + 1,
      height: readUInt24LE(buffer, 27) + 1,
    };
  }

  if (chunk === "VP8L" && buffer.length >= 25 && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  if (chunk === "VP8 " && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  return null;
}

export function parseImageDimensions(buffer: Buffer) {
  return parsePngDimensions(buffer) || parseJpegDimensions(buffer) || parseWebpDimensions(buffer);
}

export function isMetaPublishableImageUrl(imageUrl: string) {
  if (imageUrl.startsWith("data:")) return false;
  try {
    const parsed = new URL(imageUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isMetaPublishableVideoUrl(videoUrl: string) {
  const trimmed = videoUrl.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function validateSocialVideoForPublish(videoUrl: string) {
  if (!isMetaPublishableVideoUrl(videoUrl)) {
    throw new Error("Reel-video moet een publieke https-URL zijn (MP4).");
  }

  const safeUrl = await assertPublicHttpUrl(videoUrl.trim());

  let response: Response;
  try {
    response = await fetch(safeUrl, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      response = await fetch(safeUrl, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        signal: AbortSignal.timeout(10_000),
      });
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "onbekende netwerkfout";
    throw new Error(`Reel-video kon niet opgehaald worden via de publieke URL. (${detail})`);
  }

  if (!response.ok) {
    throw new Error(`Reel-video kon niet opgehaald worden via de publieke URL (HTTP ${response.status}).`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "";
  const parsedUrl = new URL(safeUrl);
  const looksLikeVideo =
    contentType.startsWith("video/") ||
    /\.(mp4|mov)(\?|$)/i.test(parsedUrl.pathname + parsedUrl.search);
  if (!looksLikeVideo) {
    throw new Error("Reel-video moet een publiek bereikbare MP4 of MOV zijn.");
  }
}

export function computeSocialImageValidity(dimensions: { width: number; height: number; aspectRatio: number }) {
  const { width, height, aspectRatio: ratio } = dimensions;
  return {
    validForInstagram: ratio >= INSTAGRAM_FEED_MIN_ASPECT_RATIO && ratio <= INSTAGRAM_FEED_MAX_ASPECT_RATIO && width >= 320 && height >= 320,
    validForStory:
      ratio >= STORY_MIN_ASPECT_RATIO && ratio <= STORY_MAX_ASPECT_RATIO && width >= 720 && height >= 1280,
  };
}

function parseDataImageUrl(imageUrl: string): SocialImageInfo {
  const match = /^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/i.exec(imageUrl.trim());
  if (!match) {
    throw new Error("Ongeldige data-URL. Upload opnieuw als JPG, PNG of WebP.");
  }

  const contentType = match[1].trim().toLowerCase();
  if (!contentType.startsWith("image/") || contentType.includes("svg")) {
    throw new Error("SVG-afbeeldingen kunnen niet betrouwbaar naar Meta gepubliceerd worden. Gebruik JPG, PNG of WebP.");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.byteLength) {
    throw new Error("Afbeelding kon niet gelezen worden uit de upload.");
  }
  if (buffer.byteLength > MAX_REMOTE_IMAGE_BYTES) {
    throw new Error("Afbeelding is te groot. Gebruik maximaal 12 MB.");
  }

  const dimensions = parseImageDimensions(buffer);
  if (!dimensions?.width || !dimensions?.height) {
    throw new Error("Afbeeldingsformaat kon niet gelezen worden. Gebruik JPG, PNG of WebP met vaste breedte en hoogte.");
  }

  return {
    ...dimensions,
    aspectRatio: dimensions.width / dimensions.height,
    contentType,
    byteLength: buffer.byteLength,
  };
}

export type SocialImageProbe = {
  ok: true;
  width: number;
  height: number;
  aspectRatio: number;
  contentType: string;
  byteLength: number;
  validForInstagram: boolean;
  validForStory: boolean;
  publishableUrl: boolean;
  storageHint?: "data-url" | "remote";
} | {
  ok: false;
  message: string;
};

export async function probeSocialImage(imageUrl: string): Promise<SocialImageProbe> {
  try {
    const info = await fetchSocialImageInfo(imageUrl);
    const validity = computeSocialImageValidity(info);
    return {
      ok: true,
      width: info.width,
      height: info.height,
      aspectRatio: info.aspectRatio,
      contentType: info.contentType,
      byteLength: info.byteLength,
      ...validity,
      publishableUrl: isMetaPublishableImageUrl(imageUrl),
      storageHint: imageUrl.startsWith("data:") ? "data-url" : "remote",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Afbeelding kon niet gecontroleerd worden.",
    };
  }
}

export async function fetchSocialImageInfo(imageUrl: string): Promise<SocialImageInfo> {
  const trimmed = imageUrl.trim();
  if (trimmed.startsWith("data:")) {
    return parseDataImageUrl(trimmed);
  }

  if (isWorkspaceUploadImagePath(trimmed)) {
    const { buffer, contentType } = await readWorkspaceUploadImageBuffer(trimmed);
    const dimensions = parseImageDimensions(buffer);
    if (!dimensions?.width || !dimensions?.height) {
      throw new Error("Upload-afbeelding kon niet gelezen worden. Gebruik JPG, PNG of WebP.");
    }
    return {
      ...dimensions,
      aspectRatio: dimensions.width / dimensions.height,
      contentType,
      byteLength: buffer.byteLength,
    };
  }

  const safeUrl = await assertPublicHttpUrl(trimmed);

  let response: Response;
  try {
    response = await fetch(safeUrl, { signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "onbekende netwerkfout";
    throw new Error(`Afbeelding kon niet opgehaald worden via de publieke URL. Controleer of de URL publiek bereikbaar is. (${detail})`);
  }

  if (!response.ok) {
    throw new Error(`Afbeelding kon niet opgehaald worden via de publieke URL (HTTP ${response.status}).`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "unknown";
  if (contentType.includes("svg")) {
    throw new Error("SVG-afbeeldingen kunnen niet betrouwbaar naar Meta gepubliceerd worden. Gebruik JPG, PNG of WebP.");
  }

  const lengthHeader = Number(response.headers.get("content-length") || 0);
  if (lengthHeader > MAX_REMOTE_IMAGE_BYTES) {
    throw new Error("Afbeelding is te groot voor een veilige social publish-check. Gebruik maximaal 12 MB.");
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_REMOTE_IMAGE_BYTES) {
    throw new Error("Afbeelding is te groot voor een veilige social publish-check. Gebruik maximaal 12 MB.");
  }

  const buffer = Buffer.from(arrayBuffer);
  const dimensions = parseImageDimensions(buffer);
  if (!dimensions || !dimensions.width || !dimensions.height) {
    throw new Error("Afbeeldingsformaat kon niet gelezen worden. Gebruik een publieke JPG, PNG of WebP met vaste breedte en hoogte.");
  }

  const aspectRatio = dimensions.width / dimensions.height;
  return {
    ...dimensions,
    aspectRatio,
    contentType,
    byteLength: buffer.byteLength,
  };
}

export async function validateSocialImageForPublish(input: {
  imageUrl: string;
  targetPlatforms: string[];
  placement?: "FEED" | "STORY" | "REEL";
}) {
  if (!isMetaPublishableImageUrl(input.imageUrl)) {
    throw new Error(
      "Meta kan alleen publieke https-URL's ophalen. Upload via Vercel Blob of plak een publiek bereikbare afbeeldings-URL.",
    );
  }

  const info = await fetchSocialImageInfo(input.imageUrl);
  const placement = input.placement || "FEED";

  if (placement === "STORY" || placement === "REEL") {
    if (info.aspectRatio < STORY_MIN_ASPECT_RATIO || info.aspectRatio > STORY_MAX_ASPECT_RATIO) {
      throw new Error(
        `Afbeeldingsverhouding ongeldig voor Stories: ${info.width}x${info.height} (${ratioLabel(info.aspectRatio)}). Gebruik een verticale 9:16-afbeelding, bijvoorbeeld 1080x1920.`,
      );
    }

    if (info.width < 720 || info.height < 1280) {
      throw new Error(
        `Story-afbeelding is te klein: ${info.width}x${info.height}. Gebruik liefst 1080x1920 of minstens 720x1280.`,
      );
    }

    return info;
  }

  if (input.targetPlatforms.includes("INSTAGRAM")) {
    if (info.aspectRatio < INSTAGRAM_FEED_MIN_ASPECT_RATIO || info.aspectRatio > INSTAGRAM_FEED_MAX_ASPECT_RATIO) {
      throw new Error(
        `Afbeeldingsverhouding ongeldig voor Instagram feed: ${info.width}x${info.height} (${ratioLabel(info.aspectRatio)}). Gebruik bijvoorbeeld 1080x1080, 1080x1350 of een verhouding tussen 4:5 en 1.91:1.`,
      );
    }

    if (info.width < 320 || info.height < 320) {
      throw new Error(
        `Afbeelding is te klein voor Instagram: ${info.width}x${info.height}. Gebruik minstens 320px breed/hoog, liefst 1080x1080 of 1080x1350.`,
      );
    }
  }

  return info;
}
