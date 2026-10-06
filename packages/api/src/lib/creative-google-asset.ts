import sharp from "sharp";
import { fetchRemoteAsset } from "@digitify/media-studio";
import { storeGeneratedAssetBytes } from "./import-media-to-blob";
// Google Performance Max marketing images: square or 1.91:1, minimum dimensions.
export async function prepareGoogleCreativeAsset(params: {
  sourceUrl: string;
  workspaceId: string;
  userId: string;
  slot: "square" | "landscape";
  jobId: string;
}) {
  let bytes: Buffer;
  const url = new URL(params.sourceUrl);
  if (
    process.env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1"].includes(url.hostname)
  ) {
    const path = await import("node:path");
    const fs = await import("node:fs/promises");
    const root = path.resolve(
      process.cwd(),
      "public",
      "uploads",
      "workspaces",
      params.workspaceId,
    );
    const file = path.resolve(
      process.cwd(),
      "public",
      `.${decodeURIComponent(url.pathname)}`,
    );
    if (!file.startsWith(`${root}${path.sep}`))
      throw new Error("Lokaal bestand hoort niet bij deze workspace.");
    bytes = await fs.readFile(file);
  } else bytes = (await fetchRemoteAsset(params.sourceUrl)).bytes;
  const metadata = await sharp(bytes).metadata();
  const width = params.slot === "square" ? 1200 : 1200;
  const height = params.slot === "square" ? 1200 : 628;
  const minWidth = params.slot === "square" ? 300 : 600;
  const minHeight = params.slot === "square" ? 300 : 314;
  if ((metadata.width || 0) < minWidth || (metadata.height || 0) < minHeight)
    throw new Error(
      `Afbeelding te klein voor Google Ads. Gebruik minstens ${minWidth} × ${minHeight} pixels.`,
    );
  const image = await sharp(bytes)
    .rotate()
    .resize(width, height, { fit: "cover", position: "attention" })
    .jpeg({ quality: 90 })
    .toBuffer();
  return storeGeneratedAssetBytes({
    workspaceId: params.workspaceId,
    userId: params.userId,
    filename: `google-${params.jobId}-${params.slot}`,
    bytes: image,
    contentType: "image/jpeg",
  });
}
