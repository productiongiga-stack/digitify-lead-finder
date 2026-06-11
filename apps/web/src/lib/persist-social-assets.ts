import type { PlacementAssets, SocialPlacement, FeedAspectFormat } from "@/components/social/social-placement-editor";
import type { SocialCarouselState } from "@/components/social/social-carousel-editor";
import { cropImageSourceToPlacement } from "@/lib/social-image-crop";

async function parseUploadResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as { url?: string; error?: string };
  } catch {
    throw new Error(
      text.trim().startsWith("Request")
        ? "Bestand te groot voor de server. Upload kleinere afbeeldingen of stel Vercel Blob in."
        : text.slice(0, 160) || "Upload mislukt",
    );
  }
}

async function dataUrlToFile(dataUrl: string, filename: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
}

export async function uploadSocialAssetFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/upload", { method: "POST", body: form });
  const payload = await parseUploadResponse(response);
  if (!response.ok || !payload.url) {
    throw new Error(payload.error || "Upload mislukt");
  }
  return payload.url;
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
    if (!imageUrl) continue;

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
      if (!videoUrl.startsWith("data:") && !videoUrl.startsWith("blob:")) return slide;
      const file = await dataUrlToFile(
        videoUrl,
        `social-carousel-video-${Date.now()}.${videoUrl.includes("quicktime") ? "mov" : "mp4"}`,
      );
      return { ...slide, videoUrl: await uploadSocialAssetFile(file) };
    }),
  );

  return { ...carousel, slides };
}
