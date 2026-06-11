import {
  normalizeCarousel,
  normalizeFeedFormat,
  normalizePlacementAssets,
  normalizePlacements,
  resolveFeedPublishKind,
  resolvePrimaryImageUrl,
  type SocialPlacementsMetadata,
} from "./social-placements";
import { prepareSocialImageUrlForPublish } from "./social-image-crop";
import type { SocialImageTargetPlacement } from "./social-image-targets";

export async function prepareSocialPostAssetsForPublish(input: {
  imageUrl: string;
  targetPlatforms: string[];
  metadata?: SocialPlacementsMetadata | null;
  workspaceId: string;
  userId: string;
}) {
  const metadata: SocialPlacementsMetadata = { ...(input.metadata || {}) };
  const placements = normalizePlacements(metadata);
  const feedFormat = normalizeFeedFormat(metadata);
  const assets = normalizePlacementAssets(metadata);
  const feedImageUrl = assets.FEED?.imageUrl?.trim() || "";
  let changed = false;

  async function preparePlacementImage(
    placement: SocialImageTargetPlacement,
    imageUrl: string,
    forceCrop = false,
  ) {
    const prepared = await prepareSocialImageUrlForPublish({
      imageUrl,
      placement,
      feedFormat,
      targetPlatforms: input.targetPlatforms,
      workspaceId: input.workspaceId,
      userId: input.userId,
      forceCrop,
    });
    if (prepared.cropped || prepared.imageUrl !== imageUrl) changed = true;
    return prepared.imageUrl;
  }

  if (placements.includes("FEED") && resolveFeedPublishKind(metadata) === "IMAGE") {
    const imageUrl = assets.FEED?.imageUrl?.trim();
    if (imageUrl) {
      assets.FEED = {
        ...assets.FEED,
        imageUrl: await preparePlacementImage("FEED", imageUrl),
      };
    }
  }

  if (placements.includes("STORY")) {
    const storyUrl = assets.STORY?.imageUrl?.trim() || "";
    const sourceUrl = storyUrl || feedImageUrl || input.imageUrl.trim();
    if (sourceUrl) {
      const sameAsFeed = Boolean(feedImageUrl && sourceUrl === feedImageUrl);
      assets.STORY = {
        ...assets.STORY,
        imageUrl: await preparePlacementImage("STORY", sourceUrl, sameAsFeed),
      };
    }
  }

  if (placements.includes("REEL")) {
    const coverUrl = assets.REEL?.imageUrl?.trim();
    if (coverUrl) {
      assets.REEL = {
        ...assets.REEL,
        imageUrl: await preparePlacementImage("REEL", coverUrl),
      };
    }
  }

  const carousel = normalizeCarousel(metadata);
  if (carousel.enabled) {
    const slides = await Promise.all(
      carousel.slides.map(async (slide) => {
        if (slide.mediaType !== "IMAGE" || !slide.imageUrl?.trim()) return slide;
        const originalUrl = slide.imageUrl.trim();
        const nextUrl = await preparePlacementImage("FEED", originalUrl);
        if (nextUrl !== originalUrl) changed = true;
        return { ...slide, imageUrl: nextUrl };
      }),
    );
    metadata.carousel = { enabled: true, slides };
  }

  metadata.assets = assets;
  const nextImageUrl = resolvePrimaryImageUrl(metadata, input.imageUrl.trim());

  return {
    imageUrl: nextImageUrl,
    metadata,
    changed,
  };
}
