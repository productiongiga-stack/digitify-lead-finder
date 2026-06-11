"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { friendlySocialProbeError, probeDataUrlImage } from "@/lib/social-image-client";
import { uploadSocialAssetFile } from "@/lib/persist-social-assets";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Button, Input, Label } from "@digitify/ui";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Film,
  ImageIcon,
  Layers,
  Link2,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useToast } from "@/components/feedback/toast-provider";
import type { FeedAspectFormat } from "./social-placement-editor";

export type SocialCarouselSlide = {
  id: string;
  mediaType: "IMAGE" | "VIDEO";
  imageUrl?: string;
  videoUrl?: string;
};

export type SocialCarouselState = {
  enabled: boolean;
  slides: SocialCarouselSlide[];
};

export const CAROUSEL_MIN_SLIDES = 2;
export const CAROUSEL_MAX_SLIDES = 10;

function createSlide(mediaType: SocialCarouselSlide["mediaType"] = "IMAGE"): SocialCarouselSlide {
  return {
    id: `slide_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    mediaType,
    imageUrl: undefined,
    videoUrl: undefined,
  };
}

export function slideHasMedia(slide: SocialCarouselSlide) {
  return slide.mediaType === "IMAGE" ? Boolean(slide.imageUrl?.trim()) : Boolean(slide.videoUrl?.trim());
}

export function appendCarouselSlide(
  carousel: SocialCarouselState,
  mediaType: SocialCarouselSlide["mediaType"],
): SocialCarouselState {
  if (!carousel.enabled || carousel.slides.length >= CAROUSEL_MAX_SLIDES) return carousel;
  return { ...carousel, slides: [...carousel.slides, createSlide(mediaType)] };
}

export function applyCarouselImage(
  carousel: SocialCarouselState,
  imageUrl: string,
  targetSlideId?: string,
): SocialCarouselState {
  if (!carousel.enabled) {
    return {
      enabled: true,
      slides: [
        { ...createSlide("IMAGE"), imageUrl },
        createSlide("VIDEO"),
      ],
    };
  }

  const slides = [...carousel.slides];
  const targetIndex = targetSlideId
    ? slides.findIndex((slide) => slide.id === targetSlideId)
    : slides.findIndex((slide) => slide.mediaType === "IMAGE" && !slide.imageUrl?.trim());

  if (targetIndex >= 0) {
    slides[targetIndex] = { ...slides[targetIndex], mediaType: "IMAGE", imageUrl, videoUrl: undefined };
  } else if (slides.length < CAROUSEL_MAX_SLIDES) {
    slides.push({ ...createSlide("IMAGE"), imageUrl });
  } else {
    return carousel;
  }

  return { ...carousel, enabled: true, slides };
}

export function applyCarouselVideo(
  carousel: SocialCarouselState,
  videoUrl: string,
  targetSlideId?: string,
): SocialCarouselState {
  if (!carousel.enabled) {
    return {
      enabled: true,
      slides: [
        createSlide("IMAGE"),
        { ...createSlide("VIDEO"), videoUrl },
      ],
    };
  }

  const slides = [...carousel.slides];
  const targetIndex = targetSlideId
    ? slides.findIndex((slide) => slide.id === targetSlideId)
    : slides.findIndex((slide) => slide.mediaType === "VIDEO" && !slide.videoUrl?.trim());

  if (targetIndex >= 0) {
    slides[targetIndex] = { ...slides[targetIndex], mediaType: "VIDEO", videoUrl, imageUrl: undefined };
  } else if (slides.length < CAROUSEL_MAX_SLIDES) {
    slides.push({ ...createSlide("VIDEO"), videoUrl });
  } else {
    return carousel;
  }

  return { ...carousel, enabled: true, slides };
}

type SlideProbeState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; publishableUrl: boolean; width: number; height: number }
  | { status: "error"; message: string };

function CarouselSlideProbe({ imageUrl, feedFormat }: { imageUrl: string; feedFormat: FeedAspectFormat }) {
  const [debouncedUrl, setDebouncedUrl] = useState("");
  const isDataUrl = debouncedUrl.startsWith("data:");

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedUrl(imageUrl.trim()), 450);
    return () => window.clearTimeout(handle);
  }, [imageUrl]);

  const [dataUrlProbe, setDataUrlProbe] = useState<SlideProbeState>({ status: "idle" });

  useEffect(() => {
    if (!isDataUrl || !debouncedUrl) {
      setDataUrlProbe({ status: "idle" });
      return;
    }

    let cancelled = false;
    setDataUrlProbe({ status: "loading" });
    void probeDataUrlImage(debouncedUrl).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setDataUrlProbe({ status: "error", message: result.message });
        return;
      }
      setDataUrlProbe({
        status: "ok",
        publishableUrl: result.publishableUrl,
        width: result.width,
        height: result.height,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedUrl, isDataUrl]);

  const probeQuery = trpc.social.probeImage.useQuery(
    { imageUrl: debouncedUrl, postFormat: feedFormat },
    {
      enabled: debouncedUrl.length > 0 && !isDataUrl,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const probe: SlideProbeState = useMemo(() => {
    if (!debouncedUrl) return { status: "idle" };
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
      publishableUrl: data.publishableUrl,
      width: data.width,
      height: data.height,
    };
  }, [debouncedUrl, isDataUrl, dataUrlProbe, probeQuery.data, probeQuery.isFetching, probeQuery.isError, probeQuery.error]);

  if (probe.status === "idle") return null;
  if (probe.status === "loading") {
    return (
      <p className="text-xs text-muted-foreground">
        <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
        Afbeelding controleren...
      </p>
    );
  }
  if (probe.status === "error") {
    return <p className="text-xs text-destructive">{probe.message}</p>;
  }
  return (
    <p className="text-xs text-muted-foreground">
      {probe.width}×{probe.height}
      {!probe.publishableUrl ? " · upload of publieke URL nodig voor Meta" : ""}
    </p>
  );
}

function MediaTypeToggle({
  value,
  disabled,
  onChange,
}: {
  value: SocialCarouselSlide["mediaType"];
  disabled?: boolean;
  onChange: (mediaType: SocialCarouselSlide["mediaType"]) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border bg-background p-0.5">
      {(["IMAGE", "VIDEO"] as const).map((type) => {
        const active = value === type;
        const Icon = type === "IMAGE" ? ImageIcon : Film;
        const label = type === "IMAGE" ? "Foto" : "Video";
        return (
          <button
            key={type}
            type="button"
            disabled={disabled}
            onClick={() => onChange(type)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition",
              active ? "bg-amber-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function CarouselSlideField({
  slide,
  index,
  total,
  feedFormat,
  disabled,
  onChange,
  onRemove,
  onMove,
}: {
  slide: SocialCarouselSlide;
  index: number;
  total: number;
  feedFormat: FeedAspectFormat;
  disabled?: boolean;
  onChange: (slide: SocialCarouselSlide) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const url = await uploadSocialAssetFile(file);
      if (slide.mediaType === "IMAGE") {
        onChange({ ...slide, imageUrl: url, videoUrl: undefined });
      } else {
        onChange({ ...slide, videoUrl: url, imageUrl: undefined });
      }
      showToast({ title: slide.mediaType === "IMAGE" ? "Foto toegevoegd" : "Video toegevoegd" });
    } catch (error) {
      showToast({
        title: "Upload mislukt",
        description: error instanceof Error ? error.message : "Onbekende fout",
        variant: "error",
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleDrop(file: File) {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      showToast({ title: "Ongeldig bestand", description: "Gebruik JPG, PNG, WebP of MP4.", variant: "error" });
      return;
    }
    const nextType: SocialCarouselSlide["mediaType"] = isVideo ? "VIDEO" : "IMAGE";
    if (nextType !== slide.mediaType) {
      onChange({ ...slide, mediaType: nextType, imageUrl: undefined, videoUrl: undefined });
    }
    await uploadFile(file);
  }

  function setMediaType(mediaType: SocialCarouselSlide["mediaType"]) {
    if (mediaType === slide.mediaType) return;
    onChange({ ...slide, mediaType, imageUrl: undefined, videoUrl: undefined });
    setShowUrlInput(false);
  }

  const mediaUrl = slide.mediaType === "IMAGE" ? slide.imageUrl?.trim() || "" : slide.videoUrl?.trim() || "";
  const ready = slideHasMedia(slide);
  const isImage = slide.mediaType === "IMAGE";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">Slide {index + 1}</p>
          <MediaTypeToggle value={slide.mediaType} disabled={disabled} onChange={setMediaType} />
          {ready ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              <Check className="h-3 w-3" /> Klaar
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-0.5">
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={disabled || index === 0} onClick={() => onMove(-1)}>
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={disabled || index >= total - 1} onClick={() => onMove(1)}>
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive"
            disabled={disabled || total <= CAROUSEL_MIN_SLIDES}
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={isImage ? "image/png,image/jpeg,image/webp" : "video/mp4,video/quicktime"}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadFile(file);
          event.currentTarget.value = "";
        }}
      />

      <div
        className={cn(
          "relative overflow-hidden rounded-xl border-2 border-dashed bg-background transition",
          dragOver ? "border-amber-500 bg-amber-50/40 dark:bg-amber-950/20" : "border-border/70",
          !mediaUrl && "hover:border-amber-300",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void handleDrop(file);
        }}
      >
        {mediaUrl ? (
          <div className="group relative">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl} alt="" className="aspect-[4/5] max-h-52 w-full object-cover" />
            ) : (
              <video src={mediaUrl} className="aspect-[4/5] max-h-52 w-full object-cover" muted playsInline controls />
            )}
            <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8 opacity-0 transition group-hover:opacity-100">
              <Button type="button" size="sm" variant="secondary" disabled={disabled || uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                Vervangen
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => fileRef.current?.click()}
            className="flex aspect-[4/5] max-h-52 w-full flex-col items-center justify-center gap-2 px-4 text-center"
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            ) : isImage ? (
              <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
            ) : (
              <Film className="h-8 w-8 text-muted-foreground/50" />
            )}
            <span className="text-sm font-medium text-foreground">
              {uploading ? "Uploaden..." : `${isImage ? "Foto" : "Video"} toevoegen`}
            </span>
            <span className="text-xs text-muted-foreground">Sleep een bestand hierheen of klik om te uploaden</span>
          </button>
        )}
      </div>

      {showUrlInput ? (
        <div className="flex gap-2">
          <Input
            disabled={disabled}
            value={mediaUrl}
            onChange={(event) => {
              const value = event.target.value;
              if (isImage) onChange({ ...slide, imageUrl: value || undefined });
              else onChange({ ...slide, videoUrl: value || undefined });
            }}
            placeholder={isImage ? "https://...foto.jpg" : "https://...video.mp4"}
          />
        </div>
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

      {isImage && mediaUrl ? <CarouselSlideProbe imageUrl={mediaUrl} feedFormat={feedFormat} /> : null}
      {!isImage && mediaUrl && !/^https:\/\//i.test(mediaUrl) ? (
        <p className="text-xs text-destructive">Video-URL moet publiek bereikbaar zijn via https.</p>
      ) : null}
    </div>
  );
}

function CarouselFilmstrip({
  slides,
  activeIndex,
  disabled,
  canAdd,
  onSelect,
  onAdd,
}: {
  slides: SocialCarouselSlide[];
  activeIndex: number;
  disabled?: boolean;
  canAdd: boolean;
  onSelect: (index: number) => void;
  onAdd: (mediaType: SocialCarouselSlide["mediaType"]) => void;
}) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {slides.map((slide, index) => {
        const mediaUrl = slide.mediaType === "IMAGE" ? slide.imageUrl?.trim() : slide.videoUrl?.trim();
        const active = index === activeIndex;
        const ready = slideHasMedia(slide);
        return (
          <button
            key={slide.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(index)}
            className={cn(
              "relative h-[4.5rem] w-12 shrink-0 overflow-hidden rounded-lg border-2 transition",
              active ? "border-amber-500 ring-2 ring-amber-500/20" : "border-border/80 hover:border-amber-300",
            )}
          >
            {mediaUrl ? (
              slide.mediaType === "VIDEO" ? (
                <video src={mediaUrl} className="h-full w-full object-cover" muted playsInline />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
              )
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-muted/30 text-muted-foreground">
                {slide.mediaType === "VIDEO" ? <Film className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
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

      {canAdd ? (
        <div className="relative shrink-0">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setAddMenuOpen((open) => !open)}
            className="flex h-[4.5rem] w-12 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/80 text-muted-foreground transition hover:border-amber-400 hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            <span className="mt-0.5 text-[9px] font-medium">Slide</span>
          </button>
          {addMenuOpen ? (
            <>
              <button type="button" className="fixed inset-0 z-10" aria-label="Menu sluiten" onClick={() => setAddMenuOpen(false)} />
              <div className="absolute bottom-full left-0 z-20 mb-1 flex min-w-[7rem] flex-col overflow-hidden rounded-lg border bg-popover shadow-md">
                <button
                  type="button"
                  className="flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                  onClick={() => {
                    onAdd("IMAGE");
                    setAddMenuOpen(false);
                  }}
                >
                  <ImageIcon className="h-3.5 w-3.5" /> Foto-slide
                </button>
                <button
                  type="button"
                  className="flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                  onClick={() => {
                    onAdd("VIDEO");
                    setAddMenuOpen(false);
                  }}
                >
                  <Film className="h-3.5 w-3.5" /> Video-slide
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CarouselProgress({ readyCount, total }: { readyCount: number; total: number }) {
  const minMet = readyCount >= CAROUSEL_MIN_SLIDES;
  const percent = total > 0 ? Math.round((readyCount / Math.max(total, CAROUSEL_MIN_SLIDES)) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={cn("font-medium", minMet ? "text-emerald-700 dark:text-emerald-300" : "text-foreground")}>
          {readyCount} van {total} slides klaar
          {!minMet ? ` · nog ${CAROUSEL_MIN_SLIDES - readyCount} nodig` : ""}
        </span>
        <span className="text-muted-foreground">{total}/{CAROUSEL_MAX_SLIDES}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", minMet ? "bg-emerald-500" : "bg-amber-500")}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
}

export function SocialCarouselEditor({
  carousel,
  feedFormat,
  disabled,
  onChange,
}: {
  carousel: SocialCarouselState;
  feedFormat: FeedAspectFormat;
  disabled?: boolean;
  onChange: (carousel: SocialCarouselState) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (activeIndex >= carousel.slides.length) {
      setActiveIndex(Math.max(0, carousel.slides.length - 1));
    }
  }, [activeIndex, carousel.slides.length]);

  function updateSlide(index: number, slide: SocialCarouselSlide) {
    const slides = [...carousel.slides];
    slides[index] = slide;
    onChange({ ...carousel, slides });
  }

  function removeSlide(index: number) {
    if (carousel.slides.length <= CAROUSEL_MIN_SLIDES) return;
    onChange({ ...carousel, slides: carousel.slides.filter((_, itemIndex) => itemIndex !== index) });
    setActiveIndex((current) => Math.max(0, Math.min(current, carousel.slides.length - 2)));
  }

  function moveSlide(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= carousel.slides.length) return;
    const slides = [...carousel.slides];
    const [item] = slides.splice(index, 1);
    slides.splice(target, 0, item);
    onChange({ ...carousel, slides });
    if (activeIndex === index) setActiveIndex(target);
  }

  function addSlide(mediaType: SocialCarouselSlide["mediaType"]) {
    const next = appendCarouselSlide(carousel, mediaType);
    onChange(next);
    setActiveIndex(next.slides.length - 1);
  }

  function enableCarousel() {
    onChange({
      enabled: true,
      slides: [createSlide("IMAGE"), createSlide("IMAGE")],
    });
    setActiveIndex(0);
  }

  function disableCarousel() {
    onChange({ enabled: false, slides: [] });
    setActiveIndex(0);
  }

  const readyCount = carousel.slides.filter(slideHasMedia).length;
  const activeSlide = carousel.slides[activeIndex];
  const canAddSlide = carousel.slides.length < CAROUSEL_MAX_SLIDES;

  return (
    <div className="space-y-4 rounded-xl border border-amber-200/60 bg-amber-50/20 p-4 dark:border-amber-900/40 dark:bg-amber-950/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Label className="flex items-center gap-1.5 text-sm font-semibold">
            <Layers className="h-4 w-4 text-amber-600" />
            Carousel
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Minstens 2 slides, maximaal 10. Eerste slide bepaalt de verhouding op Instagram.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="shrink-0 text-xs"
          disabled={disabled}
          onClick={() => (carousel.enabled ? disableCarousel() : enableCarousel())}
        >
          {carousel.enabled ? "Enkel bestand" : "Carousel aan"}
        </Button>
      </div>

      {carousel.enabled ? (
        <div className="space-y-4 rounded-lg border bg-background/80 p-3">
          <CarouselProgress readyCount={readyCount} total={carousel.slides.length} />

          <CarouselFilmstrip
            slides={carousel.slides}
            activeIndex={activeIndex}
            disabled={disabled}
            canAdd={canAddSlide}
            onSelect={setActiveIndex}
            onAdd={addSlide}
          />

          {activeSlide ? (
            <CarouselSlideField
              key={activeSlide.id}
              slide={activeSlide}
              index={activeIndex}
              total={carousel.slides.length}
              feedFormat={feedFormat}
              disabled={disabled}
              onChange={(next) => updateSlide(activeIndex, next)}
              onRemove={() => removeSlide(activeIndex)}
              onMove={(direction) => moveSlide(activeIndex, direction)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function isCarouselReady(carousel: SocialCarouselState) {
  if (!carousel.enabled) return true;
  if (carousel.slides.length < CAROUSEL_MIN_SLIDES) return false;
  return carousel.slides.every(slideHasMedia);
}

export function normalizeCarouselState(carousel?: SocialCarouselState | null): SocialCarouselState {
  if (!carousel?.enabled) return { enabled: false, slides: [] };
  const slides = (carousel.slides || []).map((slide, index) => ({
    id: slide.id || `slide_${index + 1}`,
    mediaType: slide.mediaType,
    imageUrl: slide.imageUrl?.trim() || undefined,
    videoUrl: slide.videoUrl?.trim() || undefined,
  }));
  return {
    enabled: carousel.enabled,
    slides: slides.slice(0, CAROUSEL_MAX_SLIDES),
  };
}
