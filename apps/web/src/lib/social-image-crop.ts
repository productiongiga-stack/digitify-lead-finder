import {
  centerCropRect,
  imageMeetsPlacementTarget,
  needsCropForPlacement,
  targetSpecForPlacement,
  type SocialImageTargetPlacement,
} from "@digitify/api/src/lib/social-image-targets";
import type { FeedAspectFormat } from "@/components/social/social-placement-editor";

function loadImageElement(source: string | File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl =
      typeof source === "string" ? source : URL.createObjectURL(source instanceof File ? source : source);

    img.onload = () => {
      if (typeof source !== "string") URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      if (typeof source !== "string") URL.revokeObjectURL(objectUrl);
      reject(new Error("Afbeelding kon niet geladen worden."));
    };

    if (typeof source !== "string") {
      img.src = objectUrl;
      return;
    }

    if (source.startsWith("http://") || source.startsWith("https://")) {
      img.crossOrigin = "anonymous";
    }
    img.src = source;
  });
}

function canvasToFile(canvas: HTMLCanvasElement, filename: string, type = "image/jpeg") {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Afbeelding kon niet geëxporteerd worden."));
          return;
        }
        resolve(new File([blob], filename, { type: blob.type || type }));
      },
      type,
      0.92,
    );
  });
}

export async function cropImageSourceToPlacement(input: {
  source: string | File | Blob;
  placement: SocialImageTargetPlacement;
  feedFormat?: FeedAspectFormat;
  targetPlatforms: string[];
  forceCrop?: boolean;
}) {
  const img = await loadImageElement(input.source);
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (!width || !height) {
    throw new Error("Afbeelding heeft geen geldige afmetingen.");
  }

  const aspectRatio = width / height;
  const shouldCrop =
    input.forceCrop ||
    needsCropForPlacement({
      width,
      height,
      aspectRatio,
      placement: input.placement,
      feedFormat: input.feedFormat,
      targetPlatforms: input.targetPlatforms,
    });

  if (!shouldCrop) {
    if (input.source instanceof File) {
      return { file: input.source, cropped: false, width, height };
    }
    if (input.source instanceof Blob) {
      return {
        file: new File([input.source], `social-${input.placement.toLowerCase()}.jpg`, {
          type: input.source.type || "image/jpeg",
        }),
        cropped: false,
        width,
        height,
      };
    }
    return { file: null as File | null, cropped: false, width, height, dataUrl: input.source };
  }

  const spec = targetSpecForPlacement(input.placement, input.feedFormat);
  const crop = centerCropRect(width, height, spec.aspectRatio);
  const canvas = document.createElement("canvas");
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas niet beschikbaar.");

  ctx.drawImage(img, crop.left, crop.top, crop.width, crop.height, 0, 0, spec.width, spec.height);
  const file = await canvasToFile(canvas, `social-${input.placement.toLowerCase()}-crop.jpg`);
  return { file, cropped: true, width: spec.width, height: spec.height };
}

export function describePlacementCrop(placement: SocialImageTargetPlacement, feedFormat?: FeedAspectFormat) {
  return targetSpecForPlacement(placement, feedFormat).label;
}

export function probeMeetsPlacementTarget(input: {
  width: number;
  height: number;
  placement: SocialImageTargetPlacement;
  feedFormat?: FeedAspectFormat;
  targetPlatforms: string[];
}) {
  return imageMeetsPlacementTarget({
    width: input.width,
    height: input.height,
    aspectRatio: input.width / input.height,
    placement: input.placement,
    feedFormat: input.feedFormat,
    targetPlatforms: input.targetPlatforms,
  });
}
