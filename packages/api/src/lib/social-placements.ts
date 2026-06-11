export type SocialPlacement = "FEED" | "STORY" | "REEL";
export type FeedAspectFormat = "SQUARE" | "PORTRAIT" | "LANDSCAPE";
export type SocialCarouselSlideMediaType = "IMAGE" | "VIDEO";
export type FeedPublishKind = "IMAGE" | "VIDEO" | "CAROUSEL";

export type SocialPlacementAsset = {
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
  assets?: Partial<Record<SocialPlacement, SocialPlacementAsset>>;
  carousel?: SocialCarouselSpec;
};

export const CAROUSEL_MIN_SLIDES = 2;
export const CAROUSEL_MAX_SLIDES = 10;

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
