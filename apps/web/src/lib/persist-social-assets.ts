import type { PlacementAssets } from "@/components/social/social-placement-editor";
import type { SocialCarouselState } from "@/components/social/social-carousel-editor";

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

export async function persistPlacementAssets(assets: PlacementAssets): Promise<PlacementAssets> {
  const next: PlacementAssets = { ...assets };

  for (const placement of ["FEED", "STORY", "REEL"] as const) {
    const asset = next[placement];
    if (!asset) continue;

    const imageUrl = asset.imageUrl?.trim();
    if (imageUrl?.startsWith("data:")) {
      next[placement] = {
        ...asset,
        imageUrl: await persistDataUrl(imageUrl),
      };
    }
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
