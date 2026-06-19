import {
  normalizeCarousel,
  normalizeFeedFormat,
  normalizePlacementAssets,
  normalizePlatformFeedFormats,
  normalizePlacements,
  normalizeStoryItemsMetadata,
  resolveFeedPublishKind,
  resolvePrimaryImageUrl,
  type FeedAspectFormat,
  type SocialPlacementsMetadata,
  type SocialPlatform,
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
  const platformFeedFormats = normalizePlatformFeedFormats(metadata, input.targetPlatforms);
  const assets = normalizePlacementAssets(metadata);
  const platformAssets = { ...(metadata.platformAssets || {}) };
  const storyItems = normalizeStoryItemsMetadata(metadata);
  const feedImageUrl = assets.FEED?.imageUrl?.trim() || "";
  let changed = false;

  async function preparePlacementImage(
    placement: SocialImageTargetPlacement,
    imageUrl: string,
    options: { forceCrop?: boolean; feedFormat?: FeedAspectFormat; preserveOriginal?: boolean } = {},
  ) {
    const prepared = await prepareSocialImageUrlForPublish({
      imageUrl,
      placement,
      feedFormat: options.feedFormat || feedFormat,
      targetPlatforms: input.targetPlatforms,
      workspaceId: input.workspaceId,
      userId: input.userId,
      forceCrop: options.forceCrop,
      preserveOriginal: options.preserveOriginal,
    });
    if (prepared.cropped || prepared.imageUrl !== imageUrl) changed = true;
    return prepared.imageUrl;
  }

  if (placements.includes("FEED") && resolveFeedPublishKind(metadata) === "IMAGE") {
    const imageUrl = assets.FEED?.imageUrl?.trim();
    if (imageUrl) {
      const facebookFormat = platformFeedFormats.FACEBOOK;
      const instagramFormat = platformFeedFormats.INSTAGRAM;
      const needsSplitCrop =
        input.targetPlatforms.includes("FACEBOOK") &&
        input.targetPlatforms.includes("INSTAGRAM") &&
        facebookFormat &&
        instagramFormat &&
        facebookFormat !== instagramFormat;

      if (needsSplitCrop) {
        if (input.targetPlatforms.includes("FACEBOOK")) {
          platformAssets.FACEBOOK = {
            ...(platformAssets.FACEBOOK || {}),
            FEED: {
              ...(platformAssets.FACEBOOK?.FEED || {}),
              imageUrl: await preparePlacementImage("FEED", imageUrl, { feedFormat: facebookFormat }),
            },
          };
        }
        if (input.targetPlatforms.includes("INSTAGRAM")) {
          platformAssets.INSTAGRAM = {
            ...(platformAssets.INSTAGRAM || {}),
            FEED: {
              ...(platformAssets.INSTAGRAM?.FEED || {}),
              imageUrl: await preparePlacementImage("FEED", imageUrl, { feedFormat: instagramFormat }),
            },
          };
        }
      } else {
        assets.FEED = {
          ...assets.FEED,
          imageUrl: await preparePlacementImage("FEED", imageUrl),
        };
      }
    }
  }

  if (placements.includes("FEED")) {
    for (const platform of ["FACEBOOK", "INSTAGRAM"] as const) {
      const feedAsset = platformAssets[platform]?.FEED;
      const imageUrl = feedAsset?.imageUrl?.trim();
      if (!imageUrl) continue;

      platformAssets[platform] = {
        ...(platformAssets[platform] || {}),
        FEED: {
          ...feedAsset,
          imageUrl: await preparePlacementImage("FEED", imageUrl, {
            feedFormat: platformFeedFormats[platform] || feedFormat,
          }),
        },
      };
    }
  }

  if (placements.includes("STORY")) {
    if (storyItems.length) {
      const preparedStoryItems = await Promise.all(
        storyItems.map(async (item) => {
          if (item.mediaType === "VIDEO") return item;
          const imageUrl = item.imageUrl?.trim();
          if (!imageUrl) return item;
          const preparedUrl = await preparePlacementImage("STORY", imageUrl);
          if (preparedUrl !== imageUrl) changed = true;
          return { ...item, imageUrl: preparedUrl };
        }),
      );
      metadata.storyItems = preparedStoryItems;

      const first = preparedStoryItems[0];
      if (first?.mediaType === "VIDEO") {
        assets.STORY = {
          ...assets.STORY,
          imageUrl: undefined,
          videoUrl: first.videoUrl,
        };
      } else if (first?.imageUrl) {
        assets.STORY = {
          ...assets.STORY,
          imageUrl: first.imageUrl,
          videoUrl: undefined,
        };
      }
      changed = true;
    } else {
      const storyUrl = assets.STORY?.imageUrl?.trim() || "";
      const sourceUrl = storyUrl || feedImageUrl || input.imageUrl.trim();
      if (sourceUrl) {
        const sameAsFeed = Boolean(feedImageUrl && sourceUrl === feedImageUrl);
        assets.STORY = {
          ...assets.STORY,
          imageUrl: await preparePlacementImage("STORY", sourceUrl, { forceCrop: sameAsFeed }),
        };
      }
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
        const nextUrl = await preparePlacementImage("FEED", originalUrl, { preserveOriginal: true });
        if (nextUrl !== originalUrl) changed = true;
        return { ...slide, imageUrl: nextUrl };
      }),
    );
    metadata.carousel = { enabled: true, slides };
  }

  metadata.assets = assets;
  if (Object.keys(platformAssets).length) {
    metadata.platformAssets = platformAssets as Partial<
      Record<SocialPlatform, Partial<Record<"FEED" | "STORY" | "REEL", { imageUrl?: string; videoUrl?: string }>>>
    >;
    changed = true;
  }
  const nextImageUrl = resolvePrimaryImageUrl(metadata, input.imageUrl.trim());

  return {
    imageUrl: nextImageUrl,
    metadata,
    changed,
  };
}
