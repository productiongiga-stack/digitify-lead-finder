"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { friendlySocialProbeError, probeDataUrlImage } from "@/lib/social-image-client";
import { uploadSocialAssetFile } from "@/lib/persist-social-assets";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Badge, Button, Input, Label } from "@digitify/ui";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Circle,
  Film,
  ImageIcon,
  Layers,
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
    imageUrl: mediaType === "IMAGE" ? undefined : undefined,
    videoUrl: mediaType === "VIDEO" ? undefined : undefined,
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
    if (isImage && slide.mediaType !== "IMAGE") {
      onChange({ ...slide, mediaType: "IMAGE", imageUrl: undefined, videoUrl: undefined });
    }
    if (isVideo && slide.mediaType !== "VIDEO") {
      onChange({ ...slide, mediaType: "VIDEO", imageUrl: undefined, videoUrl: undefined });
    }
    await uploadFile(file);
  }

  const mediaUrl = slide.mediaType === "IMAGE" ? slide.imageUrl?.trim() || "" : slide.videoUrl?.trim() || "";
  const ready = slideHasMedia(slide);

  return (
    <div className="rounded-xl border bg-muted/15 p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            Slide {index + 1}
          </Badge>
          {ready ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Klaar
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Circle className="h-3 w-3" /> Media nodig
            </span>
          )}
          <div className="flex rounded-lg border p-0.5">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...slide, mediaType: "IMAGE", videoUrl: undefined })}
              className={cn(
                "rounded-md px-2 py-1 text-[10px] font-medium transition",
                slide.mediaType === "IMAGE" && "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
              )}
            >
              <ImageIcon className="mr-1 inline h-3 w-3" />
              Foto
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...slide, mediaType: "VIDEO", imageUrl: undefined })}
              className={cn(
                "rounded-md px-2 py-1 text-[10px] font-medium transition",
                slide.mediaType === "VIDEO" && "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
              )}
            >
              <Film className="mr-1 inline h-3 w-3" />
              Video
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={disabled || index === 0} onClick={() => onMove(-1)}>
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            disabled={disabled || index >= total - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive"
            disabled={disabled || total <= CAROUSEL_MIN_SLIDES}
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          disabled={disabled}
          value={mediaUrl}
          onChange={(event) => {
            const value = event.target.value;
            if (slide.mediaType === "IMAGE") onChange({ ...slide, imageUrl: value || undefined });
            else onChange({ ...slide, videoUrl: value || undefined });
          }}
          placeholder={slide.mediaType === "IMAGE" ? "https://...foto.jpg" : "https://...video.mp4"}
        />
        <input
          ref={fileRef}
          type="file"
          accept={slide.mediaType === "IMAGE" ? "image/png,image/jpeg,image/webp" : "video/mp4,video/quicktime"}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadFile(file);
            event.currentTarget.value = "";
          }}
        />
        <Button type="button" variant="outline" disabled={disabled || uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        </Button>
      </div>

      <div
        className={cn(
          "overflow-hidden rounded-lg border bg-background transition",
          dragOver && "border-amber-500 ring-2 ring-amber-200",
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
          slide.mediaType === "VIDEO" ? (
            <video src={mediaUrl} className="aspect-[4/5] max-h-48 w-full object-cover" muted playsInline controls />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="" className="aspect-[4/5] max-h-48 w-full object-cover" />
          )
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
            className="flex aspect-[4/5] max-h-48 w-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground hover:bg-muted/30"
          >
            {slide.mediaType === "VIDEO" ? <Film className="h-6 w-6 opacity-50" /> : <ImageIcon className="h-6 w-6 opacity-50" />}
            <span>Sleep {slide.mediaType === "VIDEO" ? "video" : "foto"} hierheen of klik om te uploaden</span>
          </button>
        )}
      </div>

      {slide.mediaType === "IMAGE" && mediaUrl ? <CarouselSlideProbe imageUrl={mediaUrl} feedFormat={feedFormat} /> : null}
      {slide.mediaType === "VIDEO" && mediaUrl && !/^https:\/\//i.test(mediaUrl) ? (
        <p className="text-xs text-destructive">Video-URL moet publiek bereikbaar zijn via https.</p>
      ) : null}
    </div>
  );
}

function CarouselFilmstrip({
  slides,
  activeIndex,
  disabled,
  onSelect,
}: {
  slides: SocialCarouselSlide[];
  activeIndex: number;
  disabled?: boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {slides.map((slide, index) => {
        const mediaUrl = slide.mediaType === "IMAGE" ? slide.imageUrl?.trim() : slide.videoUrl?.trim();
        const active = index === activeIndex;
        return (
          <button
            key={slide.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(index)}
            className={cn(
              "relative h-16 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition",
              active ? "border-amber-500 shadow-sm" : "border-border hover:border-amber-300",
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
              <div className="flex h-full w-full flex-col items-center justify-center bg-muted/40 text-[9px] text-muted-foreground">
                {slide.mediaType === "VIDEO" ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                <span className="mt-0.5">{index + 1}</span>
              </div>
            )}
            <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-1 text-[8px] text-white">
              {slide.mediaType === "VIDEO" ? "VID" : "IMG"}
            </span>
          </button>
        );
      })}
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

  function enableCarousel() {
    onChange({
      enabled: true,
      slides: [createSlide("IMAGE"), createSlide("VIDEO")],
    });
    setActiveIndex(0);
  }

  function disableCarousel() {
    onChange({ enabled: false, slides: [] });
    setActiveIndex(0);
  }

  const readyCount = carousel.slides.filter(slideHasMedia).length;
  const activeSlide = carousel.slides[activeIndex];

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-amber-300/70 bg-amber-50/30 p-3 dark:bg-amber-950/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Carousel
          </Label>
          <p className="text-xs text-muted-foreground">
            Voeg foto&apos;s en video&apos;s toe als aparte slides (2–10). Eerste slide bepaalt de verhouding op Instagram.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={carousel.enabled ? "outline" : "default"}
          disabled={disabled}
          onClick={() => (carousel.enabled ? disableCarousel() : enableCarousel())}
        >
          {carousel.enabled ? "Terug naar enkel bestand" : "Carousel inschakelen"}
        </Button>
      </div>

      {carousel.enabled ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {readyCount}/{carousel.slides.length} slides klaar
              {readyCount < CAROUSEL_MIN_SLIDES ? ` · minstens ${CAROUSEL_MIN_SLIDES} nodig` : ""}
            </span>
            <span>{carousel.slides.length}/{CAROUSEL_MAX_SLIDES} slides</span>
          </div>

          <CarouselFilmstrip
            slides={carousel.slides}
            activeIndex={activeIndex}
            disabled={disabled}
            onSelect={setActiveIndex}
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

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || carousel.slides.length >= CAROUSEL_MAX_SLIDES}
              onClick={() => {
                onChange(appendCarouselSlide(carousel, "IMAGE"));
                setActiveIndex(carousel.slides.length);
              }}
            >
              <ImageIcon className="mr-2 h-3.5 w-3.5" />
              Foto toevoegen
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || carousel.slides.length >= CAROUSEL_MAX_SLIDES}
              onClick={() => {
                onChange(appendCarouselSlide(carousel, "VIDEO"));
                setActiveIndex(carousel.slides.length);
              }}
            >
              <Film className="mr-2 h-3.5 w-3.5" />
              Video toevoegen
            </Button>
          </div>
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
