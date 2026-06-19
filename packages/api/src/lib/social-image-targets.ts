import type { FeedAspectFormat } from "./social-placements";

export type SocialImageTargetPlacement = "FEED" | "STORY" | "REEL";

export type SocialImageTargetSpec = {
  width: number;
  height: number;
  aspectRatio: number;
  minWidth: number;
  minHeight: number;
  label: string;
};

const INSTAGRAM_FEED_MIN_ASPECT_RATIO = 0.75; // 3:4
const INSTAGRAM_FEED_MAX_ASPECT_RATIO = 1.91;
const STORY_MIN_ASPECT_RATIO = 0.5;
const STORY_MAX_ASPECT_RATIO = 0.75;

export function targetSpecForPlacement(
  placement: SocialImageTargetPlacement,
  feedFormat: FeedAspectFormat = "SQUARE",
): SocialImageTargetSpec {
  if (placement === "STORY" || placement === "REEL") {
    return {
      width: 1080,
      height: 1920,
      aspectRatio: 9 / 16,
      minWidth: 720,
      minHeight: 1280,
      label: "9:16",
    };
  }

  if (feedFormat === "PORTRAIT") {
    return {
      width: 1080,
      height: 1350,
      aspectRatio: 4 / 5,
      minWidth: 320,
      minHeight: 320,
      label: "4:5",
    };
  }

  if (feedFormat === "PORTRAIT_34") {
    return {
      width: 1080,
      height: 1440,
      aspectRatio: 3 / 4,
      minWidth: 320,
      minHeight: 320,
      label: "3:4",
    };
  }

  if (feedFormat === "LANDSCAPE") {
    return {
      width: 1080,
      height: 566,
      aspectRatio: 1.91,
      minWidth: 320,
      minHeight: 320,
      label: "1.91:1",
    };
  }

  return {
    width: 1080,
    height: 1080,
    aspectRatio: 1,
    minWidth: 320,
    minHeight: 320,
    label: "1:1",
  };
}

export function imageMeetsPlacementTarget(input: {
  width: number;
  height: number;
  aspectRatio: number;
  placement: SocialImageTargetPlacement;
  feedFormat?: FeedAspectFormat;
  targetPlatforms: string[];
  tolerance?: number;
}) {
  const tolerance = input.tolerance ?? 0.02;
  const spec = targetSpecForPlacement(input.placement, input.feedFormat);
  const ratio = input.aspectRatio;

  if (input.placement === "STORY" || input.placement === "REEL") {
    const ratioOk = ratio >= STORY_MIN_ASPECT_RATIO && ratio <= STORY_MAX_ASPECT_RATIO;
    const sizeOk = input.width >= spec.minWidth && input.height >= spec.minHeight;
    return ratioOk && sizeOk;
  }

  if (input.targetPlatforms.includes("INSTAGRAM")) {
    const ratioOk =
      ratio >= INSTAGRAM_FEED_MIN_ASPECT_RATIO - tolerance &&
      ratio <= INSTAGRAM_FEED_MAX_ASPECT_RATIO + tolerance;
    const sizeOk = input.width >= spec.minWidth && input.height >= spec.minHeight;
    return ratioOk && sizeOk;
  }

  const ratioOk = Math.abs(ratio - spec.aspectRatio) <= tolerance;
  const sizeOk = input.width >= spec.minWidth && input.height >= spec.minHeight;
  return ratioOk && sizeOk;
}

export function needsCropForPlacement(input: {
  width: number;
  height: number;
  aspectRatio: number;
  placement: SocialImageTargetPlacement;
  feedFormat?: FeedAspectFormat;
  targetPlatforms: string[];
  sameAsFeedImage?: boolean;
}) {
  if (input.placement === "STORY" && input.sameAsFeedImage) return true;
  return !imageMeetsPlacementTarget(input);
}

export function centerCropRect(
  srcWidth: number,
  srcHeight: number,
  targetAspectRatio: number,
) {
  const srcRatio = srcWidth / srcHeight;
  if (srcRatio > targetAspectRatio) {
    const cropHeight = srcHeight;
    const cropWidth = Math.round(cropHeight * targetAspectRatio);
    return {
      left: Math.round((srcWidth - cropWidth) / 2),
      top: 0,
      width: cropWidth,
      height: cropHeight,
    };
  }

  const cropWidth = srcWidth;
  const cropHeight = Math.round(cropWidth / targetAspectRatio);
  return {
    left: 0,
    top: Math.round((srcHeight - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight,
  };
}
