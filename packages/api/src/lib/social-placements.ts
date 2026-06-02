export type SocialPlacement = "FEED" | "STORY" | "REEL";
export type FeedAspectFormat = "SQUARE" | "PORTRAIT" | "LANDSCAPE";

export type SocialPlacementAsset = {
  imageUrl?: string;
  videoUrl?: string;
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
};

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

export function resolvePrimaryImageUrl(metadata?: SocialPlacementsMetadata | null, fallbackImageUrl?: string) {
  for (const placement of PLACEMENT_ORDER) {
    const url = resolvePlacementImageUrl(placement, metadata, fallbackImageUrl);
    if (url) return url;
  }
  const reelVideo = metadata?.assets?.REEL?.videoUrl?.trim();
  if (reelVideo) return reelVideo;
  return fallbackImageUrl?.trim() || "";
}

export function probeFormatForPlacement(placement: SocialPlacement): "FEED" | "STORY" {
  return placement === "FEED" ? "FEED" : "STORY";
}
