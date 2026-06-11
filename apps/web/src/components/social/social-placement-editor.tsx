"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { friendlySocialProbeError, probeDataUrlImage } from "@/lib/social-image-client";
import { uploadSocialAssetFile } from "@/lib/persist-social-assets";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Badge, Button, Input, Label } from "@digitify/ui";
import { Film, ImageIcon, LayoutGrid, Loader2, Smartphone, Upload } from "lucide-react";
import { useToast } from "@/components/feedback/toast-provider";
import {
  isCarouselReady,
  SocialCarouselEditor,
  type SocialCarouselState,
} from "./social-carousel-editor";

export type SocialPlacement = "FEED" | "STORY" | "REEL";
export type FeedAspectFormat = "SQUARE" | "PORTRAIT" | "LANDSCAPE";

export type PlacementAssets = Partial<
  Record<SocialPlacement, { imageUrl?: string; videoUrl?: string }>
>;

const PLACEMENT_OPTIONS: Array<{
  id: SocialPlacement;
  label: string;
  description: string;
  platforms: string;
}> = [
  { id: "FEED", label: "Post", description: "Feed op Facebook + Instagram", platforms: "FB · IG" },
  { id: "STORY", label: "Story", description: "9:16 verhaal", platforms: "FB · IG" },
  { id: "REEL", label: "Reel", description: "9:16 video", platforms: "IG" },
];

const FEED_FORMAT_OPTIONS: Array<{
  value: FeedAspectFormat;
  label: string;
  description: string;
  className: string;
}> = [
  { value: "SQUARE", label: "Square", description: "1:1", className: "aspect-square" },
  { value: "PORTRAIT", label: "Portrait", description: "4:5", className: "aspect-[4/5]" },
  { value: "LANDSCAPE", label: "Landscape", description: "1.91:1", className: "aspect-[1.91/1]" },
];

function formatRatio(value: number) {
  return `${value.toFixed(2)}:1`;
}

function probePostFormat(placement: SocialPlacement, feedFormat: FeedAspectFormat) {
  if (placement === "FEED") return feedFormat;
  return "STORY";
}

type AssetProbeState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ok";
      width: number;
      height: number;
      ratio: number;
      validForInstagram: boolean;
      validForStory: boolean;
      publishableUrl: boolean;
      contentType: string;
      byteLength: number;
    }
  | { status: "error"; message: string };

function AssetProbeStatus({ probe }: { probe: AssetProbeState }) {
  if (probe.status === "idle") return null;
  if (probe.status === "loading") {
    return (
      <span className="inline-flex items-center text-xs text-muted-foreground">
        <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Controleren...
      </span>
    );
  }
  if (probe.status === "error") {
    return <p className="text-xs text-destructive">{probe.message}</p>;
  }
  return (
    <p className="text-xs text-muted-foreground">
      {probe.width}×{probe.height} · {formatRatio(probe.ratio)}
      {!probe.publishableUrl ? " · alleen lokaal (geen publieke URL)" : ""}
    </p>
  );
}

function PlacementAssetField({
  placement,
  feedFormat,
  asset,
  disabled,
  onImageChange,
  onVideoChange,
}: {
  placement: SocialPlacement;
  feedFormat: FeedAspectFormat;
  asset?: { imageUrl?: string; videoUrl?: string };
  disabled?: boolean;
  onImageChange: (url: string) => void;
  onVideoChange?: (url: string) => void;
}) {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"image" | "video" | null>(null);
  const [debouncedImageUrl, setDebouncedImageUrl] = useState("");
  const imageUrl = asset?.imageUrl?.trim() || "";

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedImageUrl(imageUrl), 450);
    return () => window.clearTimeout(handle);
  }, [imageUrl]);

  const isDataUrl = debouncedImageUrl.startsWith("data:");
  const [dataUrlProbe, setDataUrlProbe] = useState<AssetProbeState>({ status: "idle" });

  useEffect(() => {
    if (!isDataUrl || !debouncedImageUrl) {
      setDataUrlProbe({ status: "idle" });
      return;
    }

    let cancelled = false;
    setDataUrlProbe({ status: "loading" });
    void probeDataUrlImage(debouncedImageUrl).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setDataUrlProbe({ status: "error", message: result.message });
        return;
      }
      setDataUrlProbe({
        status: "ok",
        width: result.width,
        height: result.height,
        ratio: result.aspectRatio,
        validForInstagram: result.validForInstagram,
        validForStory: result.validForStory,
        publishableUrl: result.publishableUrl,
        contentType: result.contentType,
        byteLength: result.byteLength,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedImageUrl, isDataUrl]);

  const probeQuery = trpc.social.probeImage.useQuery(
    { imageUrl: debouncedImageUrl, postFormat: probePostFormat(placement, feedFormat) },
    {
      enabled: debouncedImageUrl.length > 0 && !isDataUrl,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const probe: AssetProbeState = useMemo(() => {
    if (!debouncedImageUrl) return { status: "idle" };
    if (isDataUrl) return dataUrlProbe;

    if (probeQuery.isFetching && !probeQuery.data) return { status: "loading" };
    const data = probeQuery.data;
    if (!data) {
      return probeQuery.isError
        ? { status: "error", message: friendlySocialProbeError(probeQuery.error.message) }
        : { status: "loading" };
    }
    if (!data.ok) return { status: "error", message: data.message };
    return {
      status: "ok",
      width: data.width,
      height: data.height,
      ratio: data.aspectRatio,
      validForInstagram: data.validForInstagram,
      validForStory: data.validForStory,
      publishableUrl: data.publishableUrl,
      contentType: data.contentType,
      byteLength: data.byteLength,
    };
  }, [
    debouncedImageUrl,
    isDataUrl,
    dataUrlProbe,
    probeQuery.data,
    probeQuery.isFetching,
    probeQuery.isError,
    probeQuery.error,
  ]);

  async function uploadFile(file: File, kind: "image" | "video") {
    setUploading(kind);
    try {
      const url = await uploadSocialAssetFile(file);
      if (kind === "image") onImageChange(url);
      else onVideoChange?.(url);
      showToast({ title: kind === "image" ? "Afbeelding geüpload" : "Video geüpload" });
    } catch (error) {
      showToast({
        title: "Upload mislukt",
        description: error instanceof Error ? error.message : "Onbekende fout",
        variant: "error",
      });
    } finally {
      setUploading(null);
    }
  }

  const aspectClass =
    placement === "FEED"
      ? FEED_FORMAT_OPTIONS.find((item) => item.value === feedFormat)?.className || "aspect-square"
      : "aspect-[9/16]";

  const option = PLACEMENT_OPTIONS.find((item) => item.id === placement)!;

  return (
    <div className="rounded-xl border bg-muted/15 p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{option.label}</p>
          <p className="text-xs text-muted-foreground">{option.description} · {option.platforms}</p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {placement === "FEED" ? feedFormat : "9:16"}
        </Badge>
      </div>

      {placement === "FEED" || placement === "REEL" ? (
        <div className="space-y-2">
          <Label className="text-xs">
            {placement === "REEL" ? "Video (MP4, verplicht voor publicatie)" : "Video (optioneel — feed video post)"}
          </Label>
          <div className="flex gap-2">
            <Input
              disabled={disabled}
              value={asset?.videoUrl || ""}
              onChange={(event) => onVideoChange?.(event.target.value)}
              placeholder="https://...video.mp4"
            />
            <input
              ref={videoRef}
              type="file"
              accept="video/mp4,video/quicktime"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadFile(file, "video");
                event.currentTarget.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={disabled || uploading === "video"}
              onClick={() => videoRef.current?.click()}
            >
              {uploading === "video" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ) : null}

      {placement === "FEED" && asset?.videoUrl?.trim() && !asset?.imageUrl?.trim() ? (
        <p className="text-xs text-muted-foreground">
          Alleen video geselecteerd — dit wordt een feed-videopost (geen carousel).
        </p>
      ) : null}

      <div className="space-y-2">
        <Label className="text-xs">
          {placement === "REEL"
            ? "Cover-afbeelding (optioneel)"
            : placement === "FEED" && asset?.videoUrl?.trim() && !asset?.imageUrl?.trim()
              ? "Cover-afbeelding (optioneel)"
              : "Afbeelding"}
        </Label>
        <div className="flex gap-2">
          <Input
            disabled={disabled}
            value={imageUrl}
            onChange={(event) => onImageChange(event.target.value)}
            placeholder="https://... of upload"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadFile(file, "image");
              event.currentTarget.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={disabled || uploading === "image"}
            onClick={() => fileRef.current?.click()}
          >
            {uploading === "image" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </Button>
        </div>
        <div className="overflow-hidden rounded-lg border bg-background">
          {imageUrl ? (
            <div className={cn("relative max-h-40 bg-muted", aspectClass)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
              <ImageIcon className="h-4 w-4" /> Nog geen afbeelding
            </div>
          )}
        </div>
        <AssetProbeStatus probe={probe} />
      </div>
    </div>
  );
}

export function SocialPlacementEditor({
  placements,
  feedFormat,
  assets,
  carousel,
  disabled,
  targetInstagram,
  onPlacementsChange,
  onFeedFormatChange,
  onAssetsChange,
  onCarouselChange,
}: {
  placements: SocialPlacement[];
  feedFormat: FeedAspectFormat;
  assets: PlacementAssets;
  carousel: SocialCarouselState;
  disabled?: boolean;
  targetInstagram: boolean;
  onPlacementsChange: (placements: SocialPlacement[]) => void;
  onFeedFormatChange: (format: FeedAspectFormat) => void;
  onAssetsChange: (assets: PlacementAssets) => void;
  onCarouselChange: (carousel: SocialCarouselState) => void;
}) {
  function togglePlacement(placement: SocialPlacement) {
    if (placements.includes(placement)) {
      if (placements.length === 1) return;
      onPlacementsChange(placements.filter((item) => item !== placement));
      return;
    }
    onPlacementsChange([...placements, placement]);
  }

  function updateAsset(placement: SocialPlacement, patch: { imageUrl?: string; videoUrl?: string }) {
    onAssetsChange({
      ...assets,
      [placement]: { ...(assets[placement] || {}), ...patch },
    });
  }

  return (
    <div className="space-y-4 md:col-span-2">
      <div className="space-y-2">
        <Label>Publicatietypes</Label>
        <p className="text-xs text-muted-foreground">
          Combineer feed post, story en reel in één draft. Elk type krijgt een eigen upload.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {PLACEMENT_OPTIONS.map((option) => {
            const active = placements.includes(option.id);
            const reelDisabled = option.id === "REEL" && !targetInstagram;
            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled || reelDisabled}
                onClick={() => togglePlacement(option.id)}
                className={cn(
                  "rounded-xl border p-3 text-left text-xs transition",
                  active && "border-amber-500 bg-amber-50 shadow-sm dark:bg-amber-950/30",
                  reelDisabled && "opacity-50",
                )}
              >
                <span className="flex items-center gap-1.5 font-semibold">
                  {option.id === "FEED" ? <LayoutGrid className="h-3.5 w-3.5" /> : null}
                  {option.id === "STORY" ? <Smartphone className="h-3.5 w-3.5" /> : null}
                  {option.id === "REEL" ? <Film className="h-3.5 w-3.5" /> : null}
                  {option.label}
                </span>
                <span className="mt-1 block text-[10px] text-muted-foreground">{option.description}</span>
                <span className="mt-1 block text-[10px] text-muted-foreground">{option.platforms}</span>
              </button>
            );
          })}
        </div>
      </div>

      {placements.includes("FEED") ? (
        <>
          <SocialCarouselEditor
            carousel={carousel}
            feedFormat={feedFormat}
            disabled={disabled}
            onChange={onCarouselChange}
          />
          {!carousel.enabled ? (
            <div className="space-y-2">
              <Label>Feed-beeldverhouding</Label>
              <div className="grid grid-cols-3 gap-2">
                {FEED_FORMAT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => onFeedFormatChange(option.value)}
                    className={cn(
                      "rounded-xl border p-2 text-left text-xs transition",
                      feedFormat === option.value && "border-amber-500 bg-amber-50 dark:bg-amber-950/30",
                    )}
                  >
                    <span className="font-semibold">{option.label}</span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {placements.map((placement) => {
          if (placement === "FEED" && carousel.enabled) return null;
          return (
            <PlacementAssetField
              key={placement}
              placement={placement}
              feedFormat={feedFormat}
              asset={assets[placement]}
              disabled={disabled}
              onImageChange={(url) => updateAsset(placement, { imageUrl: url })}
              onVideoChange={(url) => updateAsset(placement, { videoUrl: url })}
            />
          );
        })}
      </div>
    </div>
  );
}

export function resolvePrimaryImageFromAssets(
  assets: PlacementAssets,
  carousel?: SocialCarouselState,
) {
  if (carousel?.enabled && carousel.slides[0]) {
    const first = carousel.slides[0];
    if (first.mediaType === "IMAGE") return first.imageUrl?.trim() || "";
    return first.videoUrl?.trim() || "";
  }

  return (
    assets.FEED?.imageUrl?.trim() ||
    assets.FEED?.videoUrl?.trim() ||
    assets.STORY?.imageUrl?.trim() ||
    assets.REEL?.imageUrl?.trim() ||
    assets.REEL?.videoUrl?.trim() ||
    ""
  );
}

export function isFeedMediaReady(assets: PlacementAssets, carousel: SocialCarouselState) {
  if (carousel.enabled) return isCarouselReady(carousel);
  const imageUrl = assets.FEED?.imageUrl?.trim();
  const videoUrl = assets.FEED?.videoUrl?.trim();
  return Boolean(imageUrl || videoUrl);
}

