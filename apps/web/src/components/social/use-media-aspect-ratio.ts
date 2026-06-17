"use client";

import { useEffect, useState } from "react";

export const FEED_ASPECT_MIN = 4 / 5;
export const FEED_ASPECT_MAX = 1.91;

export function clampFeedAspectRatio(ratio: number) {
  return Math.min(FEED_ASPECT_MAX, Math.max(FEED_ASPECT_MIN, ratio));
}

export const VERTICAL_PREVIEW_MAX_HEIGHT_PX = 560;
export const VERTICAL_PREVIEW_MAX_WIDTH_PX = (VERTICAL_PREVIEW_MAX_HEIGHT_PX * 9) / 16;

export const verticalPreviewFrameClassName =
  "relative mx-auto aspect-[9/16] w-full max-h-[560px] max-w-[min(100%,315px)]";

export function useMediaAspectRatio(imageUrl?: string, videoUrl?: string) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    setAspectRatio(null);
    if (!videoUrl?.trim() && !imageUrl?.trim()) return;

    if (videoUrl?.trim()) {
      const video = document.createElement("video");
      video.preload = "metadata";
      const handleLoaded = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          setAspectRatio(clampFeedAspectRatio(video.videoWidth / video.videoHeight));
        }
      };
      video.addEventListener("loadedmetadata", handleLoaded);
      video.src = videoUrl;
      return () => {
        video.removeEventListener("loadedmetadata", handleLoaded);
        video.removeAttribute("src");
        video.load();
      };
    }

    const image = new Image();
    const handleLoad = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        setAspectRatio(clampFeedAspectRatio(image.naturalWidth / image.naturalHeight));
      }
    };
    image.addEventListener("load", handleLoad);
    image.src = imageUrl!;
    return () => image.removeEventListener("load", handleLoad);
  }, [imageUrl, videoUrl]);

  return aspectRatio;
}
