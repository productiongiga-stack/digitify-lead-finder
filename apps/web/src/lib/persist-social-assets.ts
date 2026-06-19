import type {
  FeedAspectFormat,
  PlacementAssets,
  PlatformAssets,
  SocialPlacement,
  SocialPlatform,
  SocialStoryItem,
} from "@/components/social/social-placement-editor";
import type { SocialCarouselState } from "@/components/social/social-carousel-editor";
import { cropImageSourceToPlacement } from "@/lib/social-image-crop";
import { uploadClientAsset } from "@/lib/upload-client-asset";

async function dataUrlToFile(dataUrl: string, filename: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
}

function isLocalBrowserAsset(url: string) {
  return url.startsWith("data:") || url.startsWith("blob:");
}

function videoFilename(url: string, placement: SocialPlacement) {
  const lower = url.toLowerCase();
  const extension = lower.includes("quicktime") || lower.includes("video/quicktime") || lower.includes(".mov")
    ? "mov"
    : "mp4";
  return `social-${placement.toLowerCase()}-video-${Date.now()}.${extension}`;
}

export async function uploadSocialAssetFile(file: File) {
  return uploadClientAsset(file);
}

async function persistDataUrl(dataUrl: string) {
  const file = await dataUrlToFile(dataUrl, `social-asset-${Date.now()}.png`);
  return uploadSocialAssetFile(file);
}

async function preparePlacementImageUrl(input: {
  imageUrl: string;
  placement: SocialPlacement;
  feedFormat: FeedAspectFormat;
  targetPlatforms: string[];
  forceCrop?: boolean;
}) {
  const trimmed = input.imageUrl.trim();
  if (!trimmed) return { url: "", cropped: false };

  let source: string | File = trimmed;
  if (trimmed.startsWith("data:")) {
    source = await dataUrlToFile(trimmed, `social-${input.placement.toLowerCase()}.png`);
  }

  try {
    const prepared = await cropImageSourceToPlacement({
      source,
      placement: input.placement,
      feedFormat: input.feedFormat,
      targetPlatforms: input.targetPlatforms,
      forceCrop: input.forceCrop,
    });

    if (!prepared.cropped && !prepared.file && trimmed.startsWith("data:")) {
      return { url: await persistDataUrl(trimmed), cropped: false };
    }

    if (!prepared.cropped && typeof source === "string" && !trimmed.startsWith("data:")) {
      return { url: trimmed, cropped: false };
    }

    if (!prepared.file) {
      return { url: trimmed, cropped: false };
    }

    return { url: await uploadSocialAssetFile(prepared.file), cropped: prepared.cropped };
  } catch {
    if (trimmed.startsWith("data:")) {
      return { url: await persistDataUrl(trimmed), cropped: false };
    }
    return { url: trimmed, cropped: false };
  }
}

export type PersistPlacementAssetsOptions = {
  placements: SocialPlacement[];
  feedFormat: FeedAspectFormat;
  targetPlatforms: string[];
  storyUsesFeedImage?: boolean;
};

export async function persistPlacementAssets(
  assets: PlacementAssets,
  options?: PersistPlacementAssetsOptions,
): Promise<PlacementAssets> {
  const next: PlacementAssets = { ...assets };
  const placements = options?.placements || (["FEED", "STORY", "REEL"] as const);
  const feedFormat = options?.feedFormat || "SQUARE";
  const targetPlatforms = options?.targetPlatforms || ["FACEBOOK", "INSTAGRAM"];
  const feedImageUrl = next.FEED?.imageUrl?.trim() || "";

  for (const placement of placements) {
    const asset = next[placement];
    if (!asset) continue;

    let imageUrl = asset.imageUrl?.trim();
    if (!imageUrl && placement === "STORY" && options?.storyUsesFeedImage && feedImageUrl) {
      imageUrl = feedImageUrl;
    }
    if (imageUrl) {
      const sameAsFeed = Boolean(placement === "STORY" && feedImageUrl && imageUrl === feedImageUrl);
      const prepared = await preparePlacementImageUrl({
        imageUrl,
        placement,
        feedFormat,
        targetPlatforms,
        forceCrop: sameAsFeed || Boolean(options?.storyUsesFeedImage && placement === "STORY"),
      });

      next[placement] = {
        ...asset,
        imageUrl: prepared.url,
      };
    }

    const videoUrl = next[placement]?.videoUrl?.trim();
    if (videoUrl && isLocalBrowserAsset(videoUrl)) {
      const file = await dataUrlToFile(videoUrl, videoFilename(videoUrl, placement));
      next[placement] = {
        ...next[placement],
        videoUrl: await uploadSocialAssetFile(file),
      };
    }
  }

  return next;
}

export async function persistPlatformAssets(
  assets: PlatformAssets,
  options: {
    feedFormats: Partial<Record<SocialPlatform, FeedAspectFormat>>;
  },
): Promise<PlatformAssets> {
  const next: PlatformAssets = { ...assets };

  for (const platform of ["FACEBOOK", "INSTAGRAM"] as const) {
    const feedAsset = next[platform]?.FEED;
    if (!feedAsset) continue;
    const platformTarget = [platform];
    const feedFormat = options.feedFormats[platform] || "SQUARE";

    let imageUrl = feedAsset.imageUrl?.trim();
    if (imageUrl) {
      const prepared = await preparePlacementImageUrl({
        imageUrl,
        placement: "FEED",
        feedFormat,
        targetPlatforms: platformTarget,
      });
      imageUrl = prepared.url;
    }

    let videoUrl = feedAsset.videoUrl?.trim();
    if (videoUrl && isLocalBrowserAsset(videoUrl)) {
      const file = await dataUrlToFile(videoUrl, videoFilename(videoUrl, "FEED"));
      videoUrl = await uploadSocialAssetFile(file);
    }

    next[platform] = {
      ...(next[platform] || {}),
      FEED: {
        ...feedAsset,
        imageUrl: imageUrl || undefined,
        videoUrl: videoUrl || undefined,
      },
    };
  }

  return next;
}

export async function persistCarouselAssets(carousel: SocialCarouselState): Promise<SocialCarouselState> {
  if (!carousel.enabled) return { enabled: false, slides: [] };

  const slides = await Promise.all(
    carousel.slides.map(async (slide) => {
      if (slide.mediaType === "IMAGE") {
        const imageUrl = slide.imageUrl?.trim();
        if (!imageUrl?.startsWith("data:")) return slide;
        return { ...slide, imageUrl: await persistDataUrl(imageUrl) };
      }

      const videoUrl = slide.videoUrl?.trim();
      if (!videoUrl) return slide;
      if (!isLocalBrowserAsset(videoUrl)) return slide;
      const file = await dataUrlToFile(
        videoUrl,
        `social-carousel-video-${Date.now()}.${videoUrl.includes("quicktime") ? "mov" : "mp4"}`,
      );
      return { ...slide, videoUrl: await uploadSocialAssetFile(file) };
    }),
  );

  return { ...carousel, slides };
}

export async function persistStoryItems(
  items: SocialStoryItem[],
  options?: {
    feedFormat?: FeedAspectFormat;
    targetPlatforms?: string[];
  },
): Promise<SocialStoryItem[]> {
  const feedFormat = options?.feedFormat || "SQUARE";
  const targetPlatforms = options?.targetPlatforms || ["FACEBOOK", "INSTAGRAM"];

  return Promise.all(
    items.map(async (item) => {
      if (item.mediaType === "VIDEO") {
        const videoUrl = item.videoUrl?.trim();
        if (!videoUrl) return item;
        if (!isLocalBrowserAsset(videoUrl)) return { ...item, videoUrl };
        const file = await dataUrlToFile(videoUrl, videoFilename(videoUrl, "STORY"));
        return { ...item, videoUrl: await uploadSocialAssetFile(file), imageUrl: undefined };
      }

      const imageUrl = item.imageUrl?.trim();
      if (!imageUrl) return item;
      const prepared = await preparePlacementImageUrl({
        imageUrl,
        placement: "STORY",
        feedFormat,
        targetPlatforms,
        forceCrop: true,
      });
      return { ...item, imageUrl: prepared.url, videoUrl: undefined };
    }),
  );
}
