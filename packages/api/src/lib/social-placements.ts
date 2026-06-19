export type SocialPlacement = "FEED" | "STORY" | "REEL";
export type SocialPlatform = "FACEBOOK" | "INSTAGRAM";
export type FeedAspectFormat = "SQUARE" | "PORTRAIT" | "LANDSCAPE";
export type PlatformFeedFormats = Partial<Record<SocialPlatform, FeedAspectFormat>>;
export type StoryPublishKind = "IMAGE" | "VIDEO";
export type SocialCarouselSlideMediaType = "IMAGE" | "VIDEO";
export type FeedPublishKind = "IMAGE" | "VIDEO" | "CAROUSEL";

export type SocialPlacementAsset = {
  imageUrl?: string;
  videoUrl?: string;
};

export type SocialStoryItem = {
  id?: string;
  mediaType: "IMAGE" | "VIDEO";
  imageUrl?: string;
  videoUrl?: string;
};

export type SocialCarouselSlide = {
  id?: string;
  mediaType: SocialCarouselSlideMediaType;
  imageUrl?: string;
  videoUrl?: string;
};

export type SocialCarouselSpec = {
  enabled: boolean;
  slides: SocialCarouselSlide[];
};

export type SocialPlacementsMetadata = {
  headline?: string;
  cta?: string;
  hashtags?: string;
  linkUrl?: string;
  firstComment?: string;
  altText?: string;
  brandSignature?: string;
  /** @deprecated Use placements + feedFormat */
  postFormat?: string;
  placements?: SocialPlacement[];
  feedFormat?: FeedAspectFormat;
  feedFormats?: PlatformFeedFormats;
  assets?: Partial<Record<SocialPlacement, SocialPlacementAsset>>;
  platformAssets?: Partial<Record<SocialPlatform, Partial<Record<SocialPlacement, SocialPlacementAsset>>>>;
  storyItems?: SocialStoryItem[];
  carousel?: SocialCarouselSpec;
};

export const CAROUSEL_MIN_SLIDES = 2;
export const CAROUSEL_MAX_SLIDES = 10;
export const STORY_MAX_ITEMS = 10;

const PLACEMENT_ORDER: SocialPlacement[] = ["FEED", "STORY", "REEL"];

export function normalizePlacements(metadata?: SocialPlacementsMetadata | null): SocialPlacement[] {
  const requested = metadata?.placements?.filter((item): item is SocialPlacement =>
    PLACEMENT_ORDER.includes(item as SocialPlacement),
  );
  if (requested?.length) {
    return PLACEMENT_ORDER.filter((placement) => requested.includes(placement));
  }
  if (metadata?.postFormat === "STORY") return ["STORY"];
  return ["FEED"];
}

export function normalizeFeedFormat(metadata?: SocialPlacementsMetadata | null): FeedAspectFormat {
  const format = metadata?.feedFormat || metadata?.postFormat;
  if (format === "PORTRAIT" || format === "LANDSCAPE" || format === "SQUARE") return format;
  return "SQUARE";
}

export function normalizePlatformFeedFormats(
  metadata?: SocialPlacementsMetadata | null,
  targetPlatforms?: string[],
): PlatformFeedFormats {
  const fallback = normalizeFeedFormat(metadata);
  const stored = metadata?.feedFormats || {};
  const formats: PlatformFeedFormats = {
    FACEBOOK: stored.FACEBOOK || fallback,
    INSTAGRAM: stored.INSTAGRAM || fallback,
  };
  if (!targetPlatforms?.length) return formats;
  const result: PlatformFeedFormats = {};
  if (targetPlatforms.includes("FACEBOOK")) result.FACEBOOK = formats.FACEBOOK;
  if (targetPlatforms.includes("INSTAGRAM")) result.INSTAGRAM = formats.INSTAGRAM;
  return result;
}

export function normalizePlatformAssets(metadata?: SocialPlacementsMetadata | null) {
  const platformAssets = metadata?.platformAssets || {};
  const normalizeAsset = (asset?: SocialPlacementAsset) => ({
    imageUrl: asset?.imageUrl?.trim() || undefined,
    videoUrl: asset?.videoUrl?.trim() || undefined,
  });

  return {
    FACEBOOK: platformAssets.FACEBOOK
      ? {
          FEED: normalizeAsset(platformAssets.FACEBOOK.FEED),
          STORY: normalizeAsset(platformAssets.FACEBOOK.STORY),
          REEL: normalizeAsset(platformAssets.FACEBOOK.REEL),
        }
      : undefined,
    INSTAGRAM: platformAssets.INSTAGRAM
      ? {
          FEED: normalizeAsset(platformAssets.INSTAGRAM.FEED),
          STORY: normalizeAsset(platformAssets.INSTAGRAM.STORY),
          REEL: normalizeAsset(platformAssets.INSTAGRAM.REEL),
        }
      : undefined,
  };
}

export function normalizePlacementAssets(metadata?: SocialPlacementsMetadata | null) {
  const assets = metadata?.assets || {};
  return {
    FEED: assets.FEED || {},
    STORY: assets.STORY || {},
    REEL: assets.REEL || {},
  };
}

export function resolvePlacementImageUrl(
  placement: SocialPlacement,
  metadata?: SocialPlacementsMetadata | null,
  fallbackImageUrl?: string,
) {
  const assets = normalizePlacementAssets(metadata);
  const fromAsset = assets[placement]?.imageUrl?.trim();
  if (fromAsset) return fromAsset;
  if (fallbackImageUrl?.trim()) return fallbackImageUrl.trim();
  return "";
}

export function resolvePlacementVideoUrl(
  placement: SocialPlacement,
  metadata?: SocialPlacementsMetadata | null,
) {
  const assets = normalizePlacementAssets(metadata);
  return assets[placement]?.videoUrl?.trim() || "";
}

export function resolvePlatformFeedImageUrl(
  platform: SocialPlatform,
  metadata?: SocialPlacementsMetadata | null,
  fallbackImageUrl?: string,
) {
  const fromPlatform = metadata?.platformAssets?.[platform]?.FEED?.imageUrl?.trim();
  if (fromPlatform) return fromPlatform;
  return resolvePlacementImageUrl("FEED", metadata, fallbackImageUrl);
}

export function resolvePlatformFeedAsset(
  platform: SocialPlatform,
  metadata?: SocialPlacementsMetadata | null,
  fallbackImageUrl?: string,
): SocialPlacementAsset {
  const platformAsset = metadata?.platformAssets?.[platform]?.FEED;
  const imageUrl = platformAsset?.imageUrl?.trim() || "";
  const videoUrl = platformAsset?.videoUrl?.trim() || "";
  if (imageUrl || videoUrl) {
    return {
      imageUrl: imageUrl || undefined,
      videoUrl: videoUrl || undefined,
    };
  }

  const sharedAssets = normalizePlacementAssets(metadata);
  const sharedImageUrl = sharedAssets.FEED?.imageUrl?.trim() || "";
  const sharedVideoUrl = sharedAssets.FEED?.videoUrl?.trim() || "";
  return {
    imageUrl: sharedImageUrl || fallbackImageUrl?.trim() || undefined,
    videoUrl: sharedVideoUrl || undefined,
  };
}

export function resolveStoryPublishKind(metadata?: SocialPlacementsMetadata | null): StoryPublishKind {
  const videoUrl = resolvePlacementVideoUrl("STORY", metadata);
  if (videoUrl) return "VIDEO";
  return "IMAGE";
}

export function normalizeStoryItemsMetadata(metadata?: SocialPlacementsMetadata | null): SocialStoryItem[] {
  const items = metadata?.storyItems;
  if (!Array.isArray(items) || items.length === 0) return [];

  return items.slice(0, STORY_MAX_ITEMS).map((item, index) => ({
    id: item.id?.trim() || `story_${index + 1}`,
    mediaType: item.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
    imageUrl: item.imageUrl?.trim() || undefined,
    videoUrl: item.videoUrl?.trim() || undefined,
  }));
}

export function normalizeStoryItems(
  metadata?: SocialPlacementsMetadata | null,
  fallbackImageUrl?: string,
): SocialStoryItem[] {
  const items = normalizeStoryItemsMetadata(metadata).filter((item) =>
    item.mediaType === "VIDEO" ? Boolean(item.videoUrl) : Boolean(item.imageUrl),
  );
  if (items.length) return items;

  const videoUrl = resolvePlacementVideoUrl("STORY", metadata);
  if (videoUrl) {
    return [{ id: "story_1", mediaType: "VIDEO", videoUrl }];
  }

  const imageUrl = resolvePlacementImageUrl("STORY", metadata, fallbackImageUrl);
  if (imageUrl) {
    return [{ id: "story_1", mediaType: "IMAGE", imageUrl }];
  }

  return [];
}

export function normalizeCarouselMetadata(metadata?: SocialPlacementsMetadata | null): SocialCarouselSpec {
  const carousel = metadata?.carousel;
  if (!carousel?.enabled) {
    return { enabled: false, slides: [] };
  }

  return {
    enabled: true,
    slides: (carousel.slides || []).slice(0, CAROUSEL_MAX_SLIDES).map((slide, index) => ({
      id: slide.id?.trim() || `slide_${index + 1}`,
      mediaType: slide.mediaType,
      imageUrl: slide.imageUrl?.trim() || undefined,
      videoUrl: slide.videoUrl?.trim() || undefined,
    })),
  };
}

export function normalizeCarousel(metadata?: SocialPlacementsMetadata | null): SocialCarouselSpec {
  const carousel = normalizeCarouselMetadata(metadata);
  if (!carousel.enabled) return carousel;

  const slides = carousel.slides.filter((slide) =>
    slide.mediaType === "IMAGE" ? Boolean(slide.imageUrl) : Boolean(slide.videoUrl),
  );

  return {
    enabled: slides.length >= CAROUSEL_MIN_SLIDES,
    slides,
  };
}

export function isCarouselFeed(metadata?: SocialPlacementsMetadata | null) {
  const carousel = normalizeCarousel(metadata);
  return carousel.enabled && carousel.slides.length >= CAROUSEL_MIN_SLIDES;
}

export function resolveFeedPublishKind(metadata?: SocialPlacementsMetadata | null): FeedPublishKind {
  if (metadata?.carousel?.enabled) return "CAROUSEL";
  if (isCarouselFeed(metadata)) return "CAROUSEL";

  const assets = normalizePlacementAssets(metadata);
  const feedVideo = assets.FEED?.videoUrl?.trim();
  const feedImage = assets.FEED?.imageUrl?.trim();
  if (feedVideo && !feedImage) return "VIDEO";
  return "IMAGE";
}

export function resolvePrimaryImageUrl(metadata?: SocialPlacementsMetadata | null, fallbackImageUrl?: string) {
  const carousel = normalizeCarousel(metadata);
  if (carousel.enabled && carousel.slides[0]) {
    const first = carousel.slides[0];
    if (first.mediaType === "IMAGE") return first.imageUrl || "";
    return first.videoUrl || "";
  }

  for (const placement of PLACEMENT_ORDER) {
    const url = resolvePlacementImageUrl(placement, metadata, fallbackImageUrl);
    if (url) return url;
  }
  const feedVideo = metadata?.assets?.FEED?.videoUrl?.trim();
  if (feedVideo) return feedVideo;
  const reelVideo = metadata?.assets?.REEL?.videoUrl?.trim();
  if (reelVideo) return reelVideo;
  return fallbackImageUrl?.trim() || "";
}

export function probeFormatForPlacement(placement: SocialPlacement): "FEED" | "STORY" {
  return placement === "FEED" ? "FEED" : "STORY";
}
