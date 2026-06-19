"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { friendlySocialProbeError, probeDataUrlImage } from "@/lib/social-image-client";
import { cropImageSourceToPlacement, describePlacementCrop } from "@/lib/social-image-crop";
import { uploadSocialAssetFile } from "@/lib/persist-social-assets";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Badge, Button, Input } from "@digitify/ui";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Film,
  ImageIcon,
  LayoutGrid,
  Link2,
  Loader2,
  Plus,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import { useToast } from "@/components/feedback/toast-provider";
import {
  isCarouselReady,
  slideHasMedia,
  SocialCarouselEditor,
  type SocialCarouselState,
} from "./social-carousel-editor";
import { SocialComposerSection } from "./social-composer-section";

export type SocialPlacement = "FEED" | "STORY" | "REEL";
export type SocialPlatform = "FACEBOOK" | "INSTAGRAM";
export type FeedAspectFormat = "SQUARE" | "PORTRAIT" | "LANDSCAPE";
export type PlatformFeedFormats = Partial<Record<SocialPlatform, FeedAspectFormat>>;

export type PlacementAssets = Partial<
  Record<SocialPlacement, { imageUrl?: string; videoUrl?: string }>
>;
export type PlatformAssets = Partial<Record<SocialPlatform, PlacementAssets>>;

export type SocialStoryItem = {
  id: string;
  mediaType: "IMAGE" | "VIDEO";
  imageUrl?: string;
  videoUrl?: string;
};

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

const FACEBOOK_FEED_FORMAT_OPTIONS = FEED_FORMAT_OPTIONS.filter((option) => option.value !== "PORTRAIT");
const INSTAGRAM_FEED_FORMAT_OPTIONS = FEED_FORMAT_OPTIONS.filter((option) => option.value !== "LANDSCAPE");

function createStoryItem(mediaType: SocialStoryItem["mediaType"] = "IMAGE"): SocialStoryItem {
  return {
    id: `story_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    mediaType,
    imageUrl: undefined,
    videoUrl: undefined,
  };
}

export function storyItemHasMedia(item: SocialStoryItem) {
  return item.mediaType === "VIDEO" ? Boolean(item.videoUrl?.trim()) : Boolean(item.imageUrl?.trim());
}

function PlatformFormatPanel({
  platform,
  placements,
  feedFormat,
  disabled,
  onFeedFormatChange,
}: {
  platform: SocialPlatform;
  placements: SocialPlacement[];
  feedFormat: FeedAspectFormat;
  disabled?: boolean;
  onFeedFormatChange: (format: FeedAspectFormat) => void;
}) {
  const isFacebook = platform === "FACEBOOK";
  const options = isFacebook ? FACEBOOK_FEED_FORMAT_OPTIONS : INSTAGRAM_FEED_FORMAT_OPTIONS;
  const placementLabels = [
    placements.includes("FEED") ? "Feed-post" : null,
    placements.includes("STORY") ? "Story (9:16)" : null,
    placements.includes("REEL") && !isFacebook ? "Reel (9:16)" : null,
  ].filter(Boolean);

  if (!placementLabels.length) return null;

  return (
    <div
      className={cn(
        "space-y-3 rounded-2xl border p-4",
        isFacebook
          ? "border-blue-200/70 bg-blue-50/40 dark:border-blue-900/50 dark:bg-blue-950/20"
          : "border-fuchsia-200/70 bg-fuchsia-50/40 dark:border-fuchsia-900/50 dark:bg-fuchsia-950/20",
      )}
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold">{isFacebook ? "Facebook" : "Instagram"}</p>
        <p className="text-xs text-muted-foreground">
          {placementLabels.join(" · ")}
          {isFacebook ? " · feed werkt het best in 1:1 of liggend" : " · feed werkt het best in 4:5 of vierkant"}
        </p>
      </div>

      {placements.includes("FEED") ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Feed-formaat</p>
          <div className="inline-flex flex-wrap gap-1.5 rounded-lg border bg-background/70 p-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                onClick={() => onFeedFormatChange(option.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition",
                  feedFormat === option.value
                    ? isFacebook
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-fuchsia-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label} <span className="opacity-70">({option.ratio})</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

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

function AssetProbeStatus({
  probe,
  placement,
  feedFormat,
  targetPlatforms,
}: {
  probe: AssetProbeState;
  placement: SocialPlacement;
  feedFormat: FeedAspectFormat;
  targetPlatforms: string[];
}) {
  if (probe.status === "idle") return null;
  if (probe.status === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Afbeelding controleren...
      </div>
    );
  }
  if (probe.status === "error") {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        {probe.message}
      </div>
    );
  }

  const needsInstagram = targetPlatforms.includes("INSTAGRAM");
  const valid =
    placement === "STORY" || placement === "REEL"
      ? probe.validForStory
      : needsInstagram
        ? probe.validForInstagram
        : true;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs",
        valid
          ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200"
          : "border-amber-500/25 bg-amber-500/5 text-amber-900 dark:text-amber-100",
      )}
    >
      <div className="flex items-center gap-2">
        {valid ? <Check className="h-3.5 w-3.5 shrink-0" /> : <ImageIcon className="h-3.5 w-3.5 shrink-0" />}
        <span>
          {probe.width}×{probe.height} · {formatRatio(probe.ratio)}
        </span>
      </div>
      <span className="text-[11px] opacity-80">
        {valid
          ? "Geschikt voor publicatie"
          : `Wordt bij upload bijgeknipt naar ${describePlacementCrop(placement, feedFormat)}`}
        {!probe.publishableUrl ? " · upload of publieke URL" : ""}
      </span>
    </div>
  );
}

type FeedMediaMode = "photo" | "video";

function FeedMediaModeToggle({
  mode,
  disabled,
  onChange,
}: {
  mode: FeedMediaMode;
  disabled?: boolean;
  onChange: (mode: FeedMediaMode) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border bg-muted/20 p-1">
      {(
        [
          { id: "photo" as const, label: "Foto", icon: ImageIcon },
          { id: "video" as const, label: "Video", icon: Film },
        ] as const
      ).map((option) => {
        const Icon = option.icon;
        const active = mode === option.id;
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
              active
                ? "bg-amber-500 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {option.label}
          </button>
        );
      })}
    </div>
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

function MediaDropZone({
  mediaUrl,
  mediaKind,
  aspectClass,
  disabled,
  uploading,
  emptyTitle,
  emptyHint,
  onPickFile,
  onClear,
  onDropFile,
}: {
  mediaUrl: string;
  mediaKind: "image" | "video";
  aspectClass: string;
  disabled?: boolean;
  uploading: boolean;
  emptyTitle: string;
  emptyHint: string;
  onPickFile: () => void;
  onClear?: () => void;
  onDropFile?: (file: File) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const EmptyIcon = mediaKind === "image" ? ImageIcon : Film;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border-2 border-dashed bg-background transition",
        dragOver ? "border-amber-500 bg-amber-50/40 dark:bg-amber-950/20" : "border-border/70",
        !mediaUrl && !disabled && "hover:border-amber-300",
      )}
      onDragOver={(event) => {
        if (disabled || !onDropFile) return;
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        if (disabled || !onDropFile) return;
        event.preventDefault();
        setDragOver(false);
        const file = event.dataTransfer.files?.[0];
        if (file) onDropFile(file);
      }}
    >
      {mediaUrl ? (
        <div className="group relative">
          <div className={cn("max-h-56 bg-muted", aspectClass)}>
            {mediaKind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <video src={mediaUrl} className="h-full w-full object-cover" muted playsInline controls />
            )}
          </div>
          {!disabled ? (
            <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/75 to-transparent p-3 pt-10 opacity-0 transition group-hover:opacity-100">
              <Button type="button" size="sm" variant="secondary" disabled={uploading} onClick={onPickFile}>
                {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
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
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 px-4 py-10 text-center",
            aspectClass,
            "max-h-56 min-h-[10rem]",
          )}
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          ) : (
            <EmptyIcon className="h-8 w-8 text-muted-foreground/45" />
          )}
          <span className="text-sm font-medium text-foreground">{uploading ? "Uploaden..." : emptyTitle}</span>
          <span className="max-w-xs text-xs text-muted-foreground">{emptyHint}</span>
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
  const [debouncedImageUrl, setDebouncedImageUrl] = useState("");
  const imageUrl = asset?.imageUrl?.trim() || "";
  const videoUrl = asset?.videoUrl?.trim() || "";
  const [feedMode, setFeedMode] = useState<FeedMediaMode>(() => {
    if (placement === "REEL" || ((placement === "FEED" || placement === "STORY") && videoUrl && !imageUrl)) {
      return "video";
    }
    return "photo";
  });

  useEffect(() => {
    if (placement !== "FEED" && placement !== "STORY") return;
    if (videoUrl && !imageUrl) setFeedMode("video");
    else if (imageUrl && !videoUrl) setFeedMode("photo");
  }, [imageUrl, placement, videoUrl]);

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

  function handleDroppedFile(file: File, kind: "image" | "video") {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (kind === "image" && !isImage) {
      showToast({ title: "Ongeldig bestand", description: "Gebruik JPG, PNG of WebP.", variant: "error" });
      return;
    }
    if (kind === "video" && !isVideo) {
      showToast({ title: "Ongeldig bestand", description: "Gebruik MP4 of MOV.", variant: "error" });
      return;
    }
    void uploadFile(file, kind);
  }

  const aspectClass =
    placement === "FEED"
      ? FEED_FORMAT_OPTIONS.find((item) => item.value === feedFormat)?.className || "aspect-square"
      : "aspect-[9/16]";

  const cropLabel = describePlacementCrop(placement, feedFormat);
  const showModeToggle = placement === "FEED" || placement === "STORY";
  const showReelVideo = placement === "REEL";
  const showImageUpload =
    placement === "REEL" || ((placement === "FEED" || placement === "STORY") && feedMode === "photo");
  const showVideoUpload =
    showReelVideo || ((placement === "FEED" || placement === "STORY") && feedMode === "video");

  const imageEmptyTitle =
    placement === "REEL"
      ? "Cover toevoegen"
      : placement === "STORY"
        ? "Story-foto toevoegen"
        : "Feed-foto toevoegen";
  const imageEmptyHint = `Sleep een bestand of klik · ${cropLabel} · JPG, PNG, WebP`;
  const videoEmptyTitle =
    placement === "REEL" ? "Reel-video toevoegen" : placement === "STORY" ? "Story-video toevoegen" : "Feed-video toevoegen";
  const videoEmptyHint =
    placement === "STORY"
      ? "Verticale 9:16 MP4/MOV · sleep of klik om te uploaden"
      : "Sleep een MP4/MOV of klik om te uploaden";

  return (
    <div className="space-y-4 rounded-xl border bg-muted/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {placement === "FEED" ? "Feed-media" : placement === "STORY" ? "Story-media" : "Reel-media"}
          </p>
          {!compactHeader ? (
            <p className="text-xs text-muted-foreground">
              {placement === "FEED"
                ? "Kies foto of video. Verkeerde verhouding? Wij knippen automatisch bij."
                : placement === "STORY"
                  ? "Kies een verticale foto of video (9:16). Vierkante uploads worden automatisch bijgeknipt."
                  : "Upload je reel-video. Cover is optioneel."}
            </p>
          ) : null}
        </div>
        {showModeToggle ? (
          <FeedMediaModeToggle
            mode={feedMode}
            disabled={disabled}
            onChange={(mode) => {
              setFeedMode(mode);
              if (mode === "video") onImageChange("");
              else onVideoChange?.("");
            }}
          />
        ) : null}
        {placement === "STORY" || (placement === "FEED" && feedMode === "photo") ? (
          <Badge variant="outline" className="text-[10px] font-normal">
            {cropLabel}
          </Badge>
        ) : null}
      </div>

      {showVideoUpload ? (
        <div className="space-y-2">
          {showReelVideo ? (
            <p className="text-xs font-medium text-foreground">
              Video <span className="text-destructive">*</span>
            </p>
          ) : null}

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

          <MediaDropZone
            mediaUrl={videoUrl}
            mediaKind="video"
            aspectClass={placement === "REEL" || placement === "STORY" ? "aspect-[9/16]" : "aspect-video"}
            disabled={disabled}
            uploading={uploading === "video"}
            emptyTitle={videoEmptyTitle}
            emptyHint={videoEmptyHint}
            onPickFile={() => videoRef.current?.click()}
            onClear={videoUrl ? () => onVideoChange?.("") : undefined}
            onDropFile={(file) => handleDroppedFile(file, "video")}
          />

          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                disabled={disabled}
                value={videoUrl}
                onChange={(event) => onVideoChange?.(event.target.value)}
                placeholder="Of plak een publieke video-URL (https://...mp4)"
                className="h-9 pl-9"
              />
            </div>
          </div>
          {videoUrl && !/^https:\/\//i.test(videoUrl) ? (
            <p className="text-xs text-destructive">Video-URL moet publiek bereikbaar zijn via https.</p>
          ) : null}
        </div>
      ) : null}

      {showImageUpload ? (
        <div className="space-y-2">
          {showReelVideo ? <p className="text-xs font-medium text-foreground">Cover (optioneel)</p> : null}

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

          <MediaDropZone
            mediaUrl={imageUrl}
            mediaKind="image"
            aspectClass={aspectClass}
            disabled={disabled}
            uploading={uploading === "image"}
            emptyTitle={imageEmptyTitle}
            emptyHint={imageEmptyHint}
            onPickFile={() => fileRef.current?.click()}
            onClear={imageUrl ? () => onImageChange("") : undefined}
            onDropFile={(file) => handleDroppedFile(file, "image")}
          />

          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                disabled={disabled}
                value={imageUrl}
                onChange={(event) => onImageChange(event.target.value)}
                placeholder="Of plak een publieke afbeeldings-URL"
                className="h-9 pl-9"
              />
            </div>
            {!imageUrl ? (
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={disabled || uploading === "image"}
                onClick={() => fileRef.current?.click()}
              >
                {uploading === "image" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </Button>
            ) : null}
          </div>

          <AssetProbeStatus
            probe={probe}
            placement={placement}
            feedFormat={feedFormat}
            targetPlatforms={targetPlatforms}
          />
        </div>
      ) : null}
    </div>
  );
}

function StoryItemsEditor({
  items,
  feedFormat,
  disabled,
  targetPlatforms,
  onChange,
}: {
  items: SocialStoryItem[];
  feedFormat: FeedAspectFormat;
  disabled?: boolean;
  targetPlatforms: string[];
  onChange: (items: SocialStoryItem[]) => void;
}) {
  const { showToast } = useToast();
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [uploading, setUploading] = useState<"image" | "video" | null>(null);
  const activeItem = items[activeIndex] || items[0] || null;

  useEffect(() => {
    if (activeIndex >= items.length) {
      setActiveIndex(Math.max(0, items.length - 1));
    }
  }, [activeIndex, items.length]);

  function addItem(mediaType: SocialStoryItem["mediaType"]) {
    const next = [...items, createStoryItem(mediaType)];
    onChange(next);
    setActiveIndex(next.length - 1);
  }

  function updateActive(patch: Partial<SocialStoryItem>) {
    if (!activeItem) return;
    const next = [...items];
    next[activeIndex] = { ...activeItem, ...patch };
    onChange(next);
  }

  function removeActive() {
    if (!activeItem) return;
    const next = items.filter((_, index) => index !== activeIndex);
    onChange(next);
    setActiveIndex((current) => Math.max(0, Math.min(current, next.length - 1)));
  }

  function moveActive(direction: -1 | 1) {
    if (!activeItem) return;
    const target = activeIndex + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [item] = next.splice(activeIndex, 1);
    next.splice(target, 0, item);
    onChange(next);
    setActiveIndex(target);
  }

  async function uploadFile(file: File, kind: "image" | "video") {
    setUploading(kind);
    try {
      let uploadFile = file;
      let cropped = false;
      if (kind === "image") {
        const prepared = await cropImageSourceToPlacement({
          source: file,
          placement: "STORY",
          feedFormat,
          targetPlatforms,
          forceCrop: true,
        });
        if (prepared.file) {
          uploadFile = prepared.file;
          cropped = prepared.cropped;
        }
      }

      const url = await uploadSocialAssetFile(uploadFile);
      updateActive(
        kind === "image"
          ? { mediaType: "IMAGE", imageUrl: url, videoUrl: undefined }
          : { mediaType: "VIDEO", videoUrl: url, imageUrl: undefined },
      );
      showToast({
        title: kind === "image" ? "Story-foto toegevoegd" : "Story-video toegevoegd",
        description: kind === "image" && cropped ? "Automatisch bijgeknipt naar 9:16." : undefined,
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

  function handleDroppedFile(file: File) {
    if (file.type.startsWith("image/")) {
      void uploadFile(file, "image");
      return;
    }
    if (file.type.startsWith("video/")) {
      void uploadFile(file, "video");
      return;
    }
    showToast({ title: "Ongeldig bestand", description: "Gebruik JPG, PNG, WebP, MP4 of MOV.", variant: "error" });
  }

  const mediaUrl =
    activeItem?.mediaType === "VIDEO"
      ? activeItem.videoUrl?.trim() || ""
      : activeItem?.imageUrl?.trim() || "";
  const mediaKind = activeItem?.mediaType === "VIDEO" ? "video" : "image";

  return (
    <div className="space-y-4 rounded-xl border bg-muted/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Story-reeks</p>
          <p className="text-xs text-muted-foreground">
            Sleep de volgorde goed: 1 wordt als eerste gezien. Bij publicatie plaatsen we de reeks veilig omgekeerd.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={disabled || items.length >= 10} onClick={() => addItem("IMAGE")}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Foto
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={disabled || items.length >= 10} onClick={() => addItem("VIDEO")}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Video
          </Button>
        </div>
      </div>

      {items.length ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {items.map((item, index) => {
            const itemUrl = item.mediaType === "VIDEO" ? item.videoUrl?.trim() : item.imageUrl?.trim();
            const active = index === activeIndex;
            const ready = storyItemHasMedia(item);
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "relative h-[4.5rem] w-12 shrink-0 overflow-hidden rounded-lg border-2 transition",
                  active ? "border-amber-500 ring-2 ring-amber-500/20" : "border-border/80 hover:border-amber-300",
                )}
              >
                {itemUrl ? (
                  item.mediaType === "VIDEO" ? (
                    <video src={itemUrl} className="h-full w-full object-cover" muted playsInline />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={itemUrl} alt="" className="h-full w-full object-cover" />
                  )
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted/30 text-muted-foreground">
                    {item.mediaType === "VIDEO" ? <Film className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                  </div>
                )}
                <span
                  className={cn(
                    "absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold",
                    ready ? "bg-emerald-500 text-white" : "bg-background/90 text-muted-foreground ring-1 ring-border",
                  )}
                >
                  {index + 1}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-background/70 px-4 py-6 text-center">
          <p className="text-sm font-medium">Nog geen story-items</p>
          <p className="mt-1 text-xs text-muted-foreground">Voeg minstens één foto of video toe.</p>
        </div>
      )}

      {activeItem ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">Story {activeIndex + 1}</p>
              <FeedMediaModeToggle
                mode={activeItem.mediaType === "VIDEO" ? "video" : "photo"}
                disabled={disabled}
                onChange={(mode) =>
                  updateActive(
                    mode === "video"
                      ? { mediaType: "VIDEO", imageUrl: undefined, videoUrl: "" }
                      : { mediaType: "IMAGE", imageUrl: "", videoUrl: undefined },
                  )
                }
              />
            </div>
            <div className="flex items-center gap-0.5">
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={disabled || activeIndex === 0} onClick={() => moveActive(-1)}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={disabled || activeIndex >= items.length - 1} onClick={() => moveActive(1)}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" disabled={disabled} onClick={removeActive}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <input
            ref={imageRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadFile(file, "image");
              event.currentTarget.value = "";
            }}
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

          <MediaDropZone
            mediaUrl={mediaUrl}
            mediaKind={mediaKind}
            aspectClass="aspect-[9/16]"
            disabled={disabled}
            uploading={uploading !== null}
            emptyTitle={activeItem.mediaType === "VIDEO" ? "Story-video toevoegen" : "Story-foto toevoegen"}
            emptyHint="Verticale 9:16 media · sleep of klik om te uploaden"
            onPickFile={() => (activeItem.mediaType === "VIDEO" ? videoRef.current?.click() : imageRef.current?.click())}
            onClear={mediaUrl ? () => updateActive(activeItem.mediaType === "VIDEO" ? { videoUrl: "" } : { imageUrl: "" }) : undefined}
            onDropFile={handleDroppedFile}
          />

          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              disabled={disabled}
              value={mediaUrl}
              onChange={(event) =>
                updateActive(
                  activeItem.mediaType === "VIDEO"
                    ? { videoUrl: event.target.value, imageUrl: undefined }
                    : { imageUrl: event.target.value, videoUrl: undefined },
                )
              }
              placeholder={activeItem.mediaType === "VIDEO" ? "Of plak een publieke video-URL" : "Of plak een publieke afbeeldings-URL"}
              className="h-9 pl-9"
            />
          </div>
          {activeItem.mediaType === "VIDEO" && mediaUrl && !/^https:\/\//i.test(mediaUrl) ? (
            <p className="text-xs text-destructive">Video-URL moet publiek bereikbaar zijn via https.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function primaryPlacementForOpen(placements: SocialPlacement[]) {
  const order: SocialPlacement[] = ["FEED", "STORY", "REEL"];
  return order.find((placement) => placements.includes(placement));
}

function feedSectionDescription(carousel: SocialCarouselState, assets: PlacementAssets) {
  if (carousel.enabled) {
    const count = carousel.slides.filter((slide) =>
      slide.mediaType === "IMAGE" ? Boolean(slide.imageUrl?.trim()) : Boolean(slide.videoUrl?.trim()),
    ).length;
    return `Multi-upload · ${count} item${count === 1 ? "" : "s"}`;
  }
  const hasImage = Boolean(assets.FEED?.imageUrl?.trim());
  const hasVideo = Boolean(assets.FEED?.videoUrl?.trim());
  if (hasVideo && !hasImage) return "Videopost";
  if (hasImage && hasVideo) return "Foto en video";
  if (hasImage) return "Feed-foto toegevoegd";
  if (hasVideo) return "Feed-video toegevoegd";
  return "Foto, video of multi-upload instellen";
}

export function SocialPlacementEditor({
  placements,
  feedFormat,
  feedFormats,
  assets,
  platformAssets,
  carousel,
  storyItems,
  disabled,
  targetFacebook,
  targetInstagram,
  onPlacementsChange,
  onFeedFormatChange,
  onFeedFormatsChange,
  onAssetsChange,
  onPlatformAssetsChange,
  onCarouselChange,
  onStoryItemsChange,
}: {
  placements: SocialPlacement[];
  feedFormat: FeedAspectFormat;
  feedFormats?: PlatformFeedFormats;
  assets: PlacementAssets;
  platformAssets: PlatformAssets;
  carousel: SocialCarouselState;
  storyItems: SocialStoryItem[];
  disabled?: boolean;
  targetFacebook: boolean;
  targetInstagram: boolean;
  onPlacementsChange: (placements: SocialPlacement[]) => void;
  onFeedFormatChange: (format: FeedAspectFormat) => void;
  onFeedFormatsChange?: (formats: PlatformFeedFormats) => void;
  onAssetsChange: (assets: PlacementAssets) => void;
  onPlatformAssetsChange: (assets: PlatformAssets) => void;
  onCarouselChange: (carousel: SocialCarouselState) => void;
  onStoryItemsChange: (items: SocialStoryItem[]) => void;
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

  const targetPlatforms = [
    targetFacebook && (placements.includes("FEED") || placements.includes("STORY")) ? "FACEBOOK" : null,
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

  const openPlacement = primaryPlacementForOpen(placements);
  const feedBadge = carousel.enabled ? "Multi" : FEED_FORMAT_OPTIONS.find((f) => f.value === feedFormat)?.ratio;
  const reelVideo = assets.REEL?.videoUrl?.trim();
  const resolvedFeedFormats: PlatformFeedFormats = {
    FACEBOOK: feedFormats?.FACEBOOK || feedFormat,
    INSTAGRAM: feedFormats?.INSTAGRAM || feedFormat,
  };
  const showPlatformPanels = (targetFacebook || targetInstagram) && placements.includes("FEED");

  function updatePlatformFeedFormat(platform: SocialPlatform, format: FeedAspectFormat) {
    if (onFeedFormatsChange) {
      onFeedFormatsChange({ ...resolvedFeedFormats, [platform]: format });
      return;
    }
    onFeedFormatChange(format);
  }

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

      {showPlatformPanels ? (
        <div className={cn("grid gap-4", targetFacebook && targetInstagram ? "lg:grid-cols-2" : "grid-cols-1")}>
          {targetFacebook ? (
            <PlatformFormatPanel
              platform="FACEBOOK"
              placements={placements}
              feedFormat={resolvedFeedFormats.FACEBOOK || feedFormat}
              disabled={disabled}
              onFeedFormatChange={(format) => updatePlatformFeedFormat("FACEBOOK", format)}
            />
          ) : null}
          {targetInstagram ? (
            <PlatformFormatPanel
              platform="INSTAGRAM"
              placements={placements}
              feedFormat={resolvedFeedFormats.INSTAGRAM || feedFormat}
              disabled={disabled}
              onFeedFormatChange={(format) => updatePlatformFeedFormat("INSTAGRAM", format)}
            />
          ) : null}
        </div>
      ) : null}

      {placements.includes("FEED") ? (
        <SocialComposerSection
          title="Post"
          description={feedSectionDescription(carousel, assets)}
          icon={LayoutGrid}
          badge={feedBadge}
          defaultOpen={openPlacement === "FEED"}
        >
          <div className="space-y-4">
            {targetFacebook || targetInstagram ? (
              <SocialCarouselEditor
                carousel={carousel}
                feedFormat={feedFormat}
                disabled={disabled}
                onChange={onCarouselChange}
                title="Multi-upload"
                description={
                  targetFacebook && targetInstagram
                    ? "Minstens 2 items, maximaal 10. Instagram wordt een carousel; Facebook een post met meerdere foto's of video's."
                    : targetInstagram
                      ? "Minstens 2 slides, maximaal 10. Eerste slide bepaalt de verhouding op Instagram."
                      : "Minstens 2 items, maximaal 10. Facebook publiceert als post met meerdere foto's of video's."
                }
                actionLabel={carousel.enabled ? "Enkel bestand" : "Multi-upload aan"}
              />
            ) : null}

            {!carousel.enabled ? (
              <>
                {!showPlatformPanels ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">Beeldverhouding feed</p>
                      <p className="text-[11px] text-muted-foreground">Verkeerde verhouding? Automatisch bijgeknipt.</p>
                    </div>
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
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Eén media-upload voor alle kanalen. Facebook en Instagram krijgen elk het juiste formaat bij publicatie.
                  </p>
                )}

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
        </SocialComposerSection>
      ) : null}

      {placements.includes("STORY") ? (
        <SocialComposerSection
          title="Story"
          description={
            storyItems.length
              ? `${storyItems.filter(storyItemHasMedia).length} van ${storyItems.length} story-items klaar`
              : "Meerdere 9:16 foto's of video's"
          }
          icon={Smartphone}
          badge="9:16"
          defaultOpen={openPlacement === "STORY"}
        >
          <StoryItemsEditor
            items={storyItems}
            feedFormat={feedFormat}
            disabled={disabled}
            targetPlatforms={targetPlatforms}
            onChange={onStoryItemsChange}
          />
        </SocialComposerSection>
      ) : null}

      {placements.includes("REEL") ? (
        <SocialComposerSection
          title="Reel"
          description={reelVideo ? "Reel-video toegevoegd" : "Instagram reel-video uploaden"}
          icon={Film}
          badge="Instagram"
          defaultOpen={openPlacement === "REEL"}
        >
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
        </SocialComposerSection>
      ) : null}
    </div>
  );
}

export function isStoryMediaReady(assets: PlacementAssets, storyItems: SocialStoryItem[] = []) {
  if (storyItems.length > 0) return storyItems.every(storyItemHasMedia);
  return Boolean(assets.STORY?.imageUrl?.trim() || assets.STORY?.videoUrl?.trim());
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
    assets.STORY?.videoUrl?.trim() ||
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
