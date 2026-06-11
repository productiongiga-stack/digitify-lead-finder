"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { friendlySocialProbeError, probeDataUrlImage } from "@/lib/social-image-client";
import { cropImageSourceToPlacement, describePlacementCrop } from "@/lib/social-image-crop";
import { uploadSocialAssetFile } from "@/lib/persist-social-assets";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Badge, Button, Input, Switch } from "@digitify/ui";
import { Check, Film, ImageIcon, LayoutGrid, Link2, Loader2, Smartphone, Upload } from "lucide-react";
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
  hint: string;
  icon: typeof LayoutGrid;
}> = [
  { id: "FEED", label: "Post", hint: "Feed", icon: LayoutGrid },
  { id: "STORY", label: "Story", hint: "9:16", icon: Smartphone },
  { id: "REEL", label: "Reel", hint: "Video", icon: Film },
];

const FEED_FORMAT_OPTIONS: Array<{
  value: FeedAspectFormat;
  label: string;
  ratio: string;
  className: string;
}> = [
  { value: "SQUARE", label: "Vierkant", ratio: "1:1", className: "aspect-square" },
  { value: "PORTRAIT", label: "Staand", ratio: "4:5", className: "aspect-[4/5]" },
  { value: "LANDSCAPE", label: "Liggend", ratio: "1.91:1", className: "aspect-[1.91/1]" },
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
        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Controleren...
      </span>
    );
  }
  if (probe.status === "error") {
    return <p className="text-xs text-destructive">{probe.message}</p>;
  }
  return (
    <p className="text-xs text-muted-foreground">
      {probe.width}×{probe.height} · {formatRatio(probe.ratio)}
      {!probe.publishableUrl ? " · upload of publieke URL nodig" : ""}
    </p>
  );
}

function PlacementTypePill({
  active,
  disabled,
  label,
  hint,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  hint: string;
  icon: typeof LayoutGrid;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition",
        active
          ? "border-amber-500 bg-amber-500 text-white shadow-sm"
          : "border-border bg-background text-foreground hover:bg-muted/40",
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
      <span className={cn("text-[11px]", active ? "text-white/80" : "text-muted-foreground")}>{hint}</span>
      {active ? <Check className="h-3.5 w-3.5" /> : null}
    </button>
  );
}

function MediaUploadZone({
  imageUrl,
  aspectClass,
  disabled,
  uploading,
  emptyLabel,
  onPickFile,
  onClear,
}: {
  imageUrl: string;
  aspectClass: string;
  disabled?: boolean;
  uploading: boolean;
  emptyLabel: string;
  onPickFile: () => void;
  onClear?: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      {imageUrl ? (
        <div className="group relative">
          <div className={cn("max-h-44 bg-muted", aspectClass)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          </div>
          {!disabled ? (
            <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6 opacity-0 transition group-hover:opacity-100">
              <Button type="button" size="sm" variant="secondary" disabled={uploading} onClick={onPickFile}>
                {uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
                Vervangen
              </Button>
              {onClear ? (
                <Button type="button" size="sm" variant="secondary" onClick={onClear}>
                  Verwijderen
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={onPickFile}
          className={cn("flex w-full flex-col items-center justify-center gap-1.5 p-8 text-center", aspectClass, "max-h-44")}
        >
          {uploading ? (
            <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
          ) : (
            <ImageIcon className="h-7 w-7 text-muted-foreground/40" />
          )}
          <span className="text-xs font-medium">{uploading ? "Uploaden..." : emptyLabel}</span>
        </button>
      )}
    </div>
  );
}

function PlacementMediaEditor({
  placement,
  feedFormat,
  asset,
  disabled,
  targetPlatforms,
  onImageChange,
  onVideoChange,
  compactHeader,
}: {
  placement: SocialPlacement;
  feedFormat: FeedAspectFormat;
  asset?: { imageUrl?: string; videoUrl?: string };
  disabled?: boolean;
  targetPlatforms: string[];
  onImageChange: (url: string) => void;
  onVideoChange?: (url: string) => void;
  compactHeader?: boolean;
}) {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"image" | "video" | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [debouncedImageUrl, setDebouncedImageUrl] = useState("");
  const imageUrl = asset?.imageUrl?.trim() || "";
  const videoUrl = asset?.videoUrl?.trim() || "";

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
      let uploadFile = file;
      let cropped = false;
      if (kind === "image") {
        const prepared = await cropImageSourceToPlacement({
          source: file,
          placement,
          feedFormat,
          targetPlatforms,
        });
        if (prepared.file) {
          uploadFile = prepared.file;
          cropped = prepared.cropped;
        }
      }

      const url = await uploadSocialAssetFile(uploadFile);
      if (kind === "image") onImageChange(url);
      else onVideoChange?.(url);
      showToast({
        title: kind === "image" ? "Afbeelding geüpload" : "Video geüpload",
        description:
          kind === "image" && cropped
            ? `Automatisch bijgeknipt naar ${describePlacementCrop(placement, feedFormat)}.`
            : undefined,
      });
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

  const showVideo = placement === "FEED" || placement === "REEL";
  const feedVideoOnly = placement === "FEED" && videoUrl && !imageUrl;

  return (
    <div className="space-y-3">
      {!compactHeader ? (
        <p className="text-xs text-muted-foreground">
          {placement === "FEED"
            ? feedVideoOnly
              ? "Feed wordt een videopost."
              : "Upload een afbeelding of video voor je feed."
            : placement === "STORY"
              ? "Verticale afbeelding (9:16) werkt het best."
              : "Upload je reel-video. Cover is optioneel."}
        </p>
      ) : null}

      {showVideo ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">
            {placement === "REEL" ? "Video *" : "Video (optioneel)"}
          </p>
          <div className="flex gap-2">
            <Input
              disabled={disabled}
              value={videoUrl}
              onChange={(event) => onVideoChange?.(event.target.value)}
              placeholder="https://...video.mp4"
              className="h-9"
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
              className="shrink-0"
              disabled={disabled || uploading === "video"}
              onClick={() => videoRef.current?.click()}
            >
              {uploading === "video" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ) : null}

      {!feedVideoOnly ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">
            {placement === "REEL" ? "Cover (optioneel)" : "Afbeelding"}
          </p>

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

          <MediaUploadZone
            imageUrl={imageUrl}
            aspectClass={aspectClass}
            disabled={disabled}
            uploading={uploading === "image"}
            emptyLabel="Klik om afbeelding te uploaden"
            onPickFile={() => fileRef.current?.click()}
            onClear={imageUrl ? () => onImageChange("") : undefined}
          />

          {showUrlInput ? (
            <Input
              disabled={disabled}
              value={imageUrl}
              onChange={(event) => onImageChange(event.target.value)}
              placeholder="https://...afbeelding.jpg"
              className="h-9"
            />
          ) : (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowUrlInput(true)}
            >
              <Link2 className="h-3 w-3" />
              Of plak een URL
            </button>
          )}

          <AssetProbeStatus probe={probe} />
        </div>
      ) : null}
    </div>
  );
}

function PlacementSection({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-background/90 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {badge ? (
          <Badge variant="outline" className="text-[10px] font-normal">
            {badge}
          </Badge>
        ) : null}
      </div>
      {children}
    </section>
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
  const feedImage = assets.FEED?.imageUrl?.trim() || "";
  const hasFeedAndStory = placements.includes("FEED") && placements.includes("STORY");
  const storyMatchesFeed = hasFeedAndStory && feedImage && assets.STORY?.imageUrl?.trim() === feedImage;

  const [storyUsesFeedImage, setStoryUsesFeedImage] = useState(
    () => !assets.STORY?.imageUrl?.trim() || storyMatchesFeed,
  );

  useEffect(() => {
    if (!hasFeedAndStory || !feedImage) return;
    if (storyUsesFeedImage && assets.STORY?.imageUrl?.trim() !== feedImage) {
      onAssetsChange({
        ...assets,
        STORY: { ...(assets.STORY || {}), imageUrl: feedImage },
      });
    }
  }, [assets, feedImage, hasFeedAndStory, onAssetsChange, storyUsesFeedImage]);

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
    if (placement === "STORY" && patch.imageUrl && patch.imageUrl !== feedImage) {
      setStoryUsesFeedImage(false);
    }
  }

  const targetPlatforms = [
    placements.includes("FEED") || placements.includes("STORY") ? "FACEBOOK" : null,
    targetInstagram && (placements.includes("FEED") || placements.includes("STORY") || placements.includes("REEL"))
      ? "INSTAGRAM"
      : null,
  ].filter((value): value is string => Boolean(value));

  const platformSummary = [
    targetPlatforms.includes("FACEBOOK") ? "Facebook" : null,
    targetPlatforms.includes("INSTAGRAM") ? "Instagram" : null,
  ]
    .filter(Boolean)
    .join(" + ");

  return (
    <div className="space-y-4 md:col-span-2">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold">Wat publiceer je?</p>
          <p className="text-xs text-muted-foreground">Kies één of meerdere formaten voor deze post.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {PLACEMENT_OPTIONS.map((option) => {
            const active = placements.includes(option.id);
            const reelDisabled = option.id === "REEL" && !targetInstagram;
            return (
              <PlacementTypePill
                key={option.id}
                active={active}
                disabled={disabled || reelDisabled}
                label={option.label}
                hint={option.hint}
                icon={option.icon}
                onClick={() => togglePlacement(option.id)}
              />
            );
          })}
        </div>

        {platformSummary ? (
          <p className="text-xs text-muted-foreground">
            Publiceert naar <span className="font-medium text-foreground">{platformSummary}</span>
          </p>
        ) : null}
      </div>

      {placements.includes("FEED") ? (
        <PlacementSection title="Post" badge={carousel.enabled ? "Carousel" : FEED_FORMAT_OPTIONS.find((f) => f.value === feedFormat)?.ratio}>
          <div className="space-y-4">
            <SocialCarouselEditor
              carousel={carousel}
              feedFormat={feedFormat}
              disabled={disabled}
              onChange={onCarouselChange}
            />

            {!carousel.enabled ? (
              <>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Beeldverhouding feed</p>
                  <div className="inline-flex flex-wrap gap-1.5 rounded-lg border bg-muted/20 p-1">
                    {FEED_FORMAT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        disabled={disabled}
                        onClick={() => onFeedFormatChange(option.value)}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-medium transition",
                          feedFormat === option.value
                            ? "bg-amber-500 text-white shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {option.label} <span className="opacity-70">({option.ratio})</span>
                      </button>
                    ))}
                  </div>
                </div>

                <PlacementMediaEditor
                  placement="FEED"
                  feedFormat={feedFormat}
                  asset={assets.FEED}
                  disabled={disabled}
                  targetPlatforms={targetPlatforms}
                  compactHeader
                  onImageChange={(url) => updateAsset("FEED", { imageUrl: url })}
                  onVideoChange={(url) => updateAsset("FEED", { videoUrl: url })}
                />
              </>
            ) : null}
          </div>
        </PlacementSection>
      ) : null}

      {placements.includes("STORY") ? (
        <PlacementSection title="Story" badge="9:16">
          {hasFeedAndStory && feedImage && !carousel.enabled ? (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border bg-muted/15 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-medium">Zelfde afbeelding als feed</p>
                <p className="text-[11px] text-muted-foreground">Geen aparte upload nodig</p>
              </div>
              <Switch
                checked={storyUsesFeedImage}
                disabled={disabled}
                onCheckedChange={(checked) => {
                  setStoryUsesFeedImage(checked);
                  if (checked && feedImage) {
                    updateAsset("STORY", { imageUrl: feedImage });
                  }
                }}
              />
            </div>
          ) : null}

          {storyUsesFeedImage && feedImage && !carousel.enabled ? (
            <div className="space-y-2">
              <MediaUploadZone
                imageUrl={feedImage}
                aspectClass="aspect-[9/16] max-h-48"
                disabled
                uploading={false}
                emptyLabel=""
                onPickFile={() => undefined}
              />
              <p className="text-xs text-muted-foreground">
                Story gebruikt je feed-afbeelding en knipt die automatisch bij naar 9:16 bij opslaan of publiceren.
              </p>
            </div>
          ) : (
            <PlacementMediaEditor
              placement="STORY"
              feedFormat={feedFormat}
              asset={assets.STORY}
              disabled={disabled}
              targetPlatforms={targetPlatforms}
              compactHeader
              onImageChange={(url) => updateAsset("STORY", { imageUrl: url })}
            />
          )}
        </PlacementSection>
      ) : null}

      {placements.includes("REEL") ? (
        <PlacementSection title="Reel" badge="Instagram">
          <PlacementMediaEditor
            placement="REEL"
            feedFormat={feedFormat}
            asset={assets.REEL}
            disabled={disabled}
            targetPlatforms={targetPlatforms}
            compactHeader
            onImageChange={(url) => updateAsset("REEL", { imageUrl: url })}
            onVideoChange={(url) => updateAsset("REEL", { videoUrl: url })}
          />
        </PlacementSection>
      ) : null}
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
