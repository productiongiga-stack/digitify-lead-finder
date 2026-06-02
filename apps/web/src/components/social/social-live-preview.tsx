"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@digitify/ui";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Film,
  Heart,
  ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Palette,
  Send,
  ThumbsUp,
} from "lucide-react";
import type { FeedAspectFormat, PlacementAssets, SocialPlacement } from "./social-placement-editor";

type PostFormat = FeedAspectFormat | "STORY";

type PreviewSlide = {
  id: string;
  placement: SocialPlacement;
  label: string;
  description: string;
  format: PostFormat;
  imageUrl: string;
  videoUrl?: string;
  hasMedia: boolean;
};

const FEED_FORMAT_META: Record<FeedAspectFormat, { label: string; description: string; className: string }> = {
  SQUARE: { label: "Square", description: "1:1 · FB + IG feed", className: "aspect-square" },
  PORTRAIT: { label: "Portrait", description: "4:5 · IG feed", className: "aspect-[4/5]" },
  LANDSCAPE: { label: "Landscape", description: "1.91:1 · breed", className: "aspect-[1.91/1]" },
};

export function buildPreviewSlides(input: {
  placements: SocialPlacement[];
  feedFormat: FeedAspectFormat;
  assets: PlacementAssets;
}): PreviewSlide[] {
  const slides: PreviewSlide[] = [];

  if (input.placements.includes("FEED")) {
    const meta = FEED_FORMAT_META[input.feedFormat];
    const imageUrl = input.assets.FEED?.imageUrl?.trim() || "";
    slides.push({
      id: "feed",
      placement: "FEED",
      label: `Feed · ${meta.label}`,
      description: meta.description,
      format: input.feedFormat,
      imageUrl,
      hasMedia: Boolean(imageUrl),
    });
  }

  if (input.placements.includes("STORY")) {
    const imageUrl = input.assets.STORY?.imageUrl?.trim() || "";
    slides.push({
      id: "story",
      placement: "STORY",
      label: "Story",
      description: "9:16 · FB + IG Stories",
      format: "STORY",
      imageUrl,
      hasMedia: Boolean(imageUrl),
    });
  }

  if (input.placements.includes("REEL")) {
    const imageUrl = input.assets.REEL?.imageUrl?.trim() || "";
    const videoUrl = input.assets.REEL?.videoUrl?.trim() || "";
    slides.push({
      id: "reel",
      placement: "REEL",
      label: "Reel",
      description: videoUrl ? "9:16 · IG Reel (video)" : "9:16 · cover of video",
      format: "STORY",
      imageUrl,
      videoUrl: videoUrl || undefined,
      hasMedia: Boolean(imageUrl || videoUrl),
    });
  }

  return slides;
}

function MediaFrame({
  format,
  imageUrl,
  videoUrl,
  alt,
  storyLabel,
}: {
  format: PostFormat;
  imageUrl: string;
  videoUrl?: string;
  alt: string;
  storyLabel: string;
}) {
  const formatClass = format === "STORY" ? "aspect-[9/16]" : FEED_FORMAT_META[format as FeedAspectFormat]?.className || "aspect-square";

  if (format === "STORY") {
    return (
      <div className="relative mx-auto aspect-[9/16] max-h-[560px] bg-zinc-900">
        {videoUrl ? (
          <video src={videoUrl} className="h-full w-full object-cover" muted playsInline controls />
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/70">
            <ImageIcon className="mr-2 h-4 w-4" /> {storyLabel}
          </div>
        )}
        {videoUrl ? (
          <div className="absolute left-4 top-16 rounded-full bg-black/50 p-2 backdrop-blur">
            <Film className="h-4 w-4 text-white" />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("bg-zinc-100", formatClass)}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-zinc-500">
          <ImageIcon className="mr-2 h-4 w-4" /> Feed-afbeelding
        </div>
      )}
    </div>
  );
}

function FacebookPreview({
  caption,
  slide,
}: {
  caption: string;
  slide: PreviewSlide;
}) {
  const isStory = slide.format === "STORY";

  if (isStory) {
    return (
      <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-slate-950 text-white shadow-[0_22px_55px_rgba(15,23,42,0.18)]">
        <div className="relative">
          <MediaFrame
            format="STORY"
            imageUrl={slide.imageUrl}
            videoUrl={slide.videoUrl}
            alt="Facebook preview"
            storyLabel={slide.placement === "REEL" ? "Facebook Reel preview" : "Facebook Story"}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/75 to-transparent p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1877f2] text-base font-black">f</div>
              <div>
                <p className="text-sm font-semibold">Digitify</p>
                <p className="text-xs text-white/70">{slide.placement === "REEL" ? "Reel preview" : "Story · 24 uur"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white text-slate-950 shadow-[0_22px_55px_rgba(15,23,42,0.12)]">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1877f2] text-lg font-black text-white">f</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Digitify</p>
          <p className="text-xs text-slate-500">Gesponsord · openbaar</p>
        </div>
        <MoreHorizontal className="h-5 w-5 text-slate-500" />
      </div>
      <p className="whitespace-pre-line px-4 pb-3 text-sm leading-relaxed">{caption}</p>
      <MediaFrame format={slide.format} imageUrl={slide.imageUrl} alt="Facebook preview" storyLabel="Story" />
      <div className="flex items-center justify-between px-4 py-3 text-xs text-slate-500">
        <span>12 vind-ik-leuks</span>
        <span>3 reacties · 1 keer gedeeld</span>
      </div>
      <div className="grid grid-cols-3 border-t border-slate-100 px-2 py-1 text-sm font-semibold text-slate-600">
        <span className="flex items-center justify-center gap-2 rounded-lg py-2"><ThumbsUp className="h-4 w-4" /> Vind ik leuk</span>
        <span className="flex items-center justify-center gap-2 rounded-lg py-2"><MessageCircle className="h-4 w-4" /> Reageren</span>
        <span className="flex items-center justify-center gap-2 rounded-lg py-2">Delen</span>
      </div>
    </div>
  );
}

function InstagramPreview({
  caption,
  firstComment,
  slide,
}: {
  caption: string;
  firstComment: string;
  slide: PreviewSlide;
}) {
  const isStory = slide.format === "STORY";
  const showCaption = slide.placement !== "STORY";

  if (isStory) {
    return (
      <div className="overflow-hidden rounded-[1.6rem] border border-zinc-200 bg-zinc-950 text-white shadow-[0_22px_55px_rgba(24,24,27,0.18)]">
        <div className="relative">
          <MediaFrame
            format="STORY"
            imageUrl={slide.imageUrl}
            videoUrl={slide.videoUrl}
            alt="Instagram preview"
            storyLabel={slide.placement === "REEL" ? "Instagram Reel" : "Instagram Story"}
          />
          <div className="absolute inset-x-0 top-0 space-y-3 bg-gradient-to-b from-black/75 to-transparent p-4">
            <div className="grid grid-cols-5 gap-1">
              {Array.from({ length: 5 }).map((_, index) => (
                <span key={index} className="h-0.5 rounded-full bg-white/80" />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-tr from-[#f58529] via-[#dd2a7b] to-[#515bd4] p-[2px]">
                <div className="h-full w-full rounded-full bg-white" />
              </div>
              <div>
                <p className="text-sm font-semibold">digitify.be</p>
                <p className="text-xs text-white/70">{slide.placement === "REEL" ? "Reel" : "Story"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-zinc-200 bg-white text-zinc-950 shadow-[0_22px_55px_rgba(24,24,27,0.12)]">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-tr from-[#f58529] via-[#dd2a7b] to-[#515bd4] p-[2px]">
          <div className="h-full w-full rounded-full bg-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">digitify.be</p>
          <p className="text-xs text-zinc-500">België</p>
        </div>
        <MoreHorizontal className="h-5 w-5 text-zinc-500" />
      </div>
      <MediaFrame format={slide.format} imageUrl={slide.imageUrl} alt="Instagram preview" storyLabel="Story" />
      <div className="space-y-2 px-4 py-3">
        <div className="flex gap-3"><Heart className="h-5 w-5" /><MessageCircle className="h-5 w-5" /><Send className="h-5 w-5" /></div>
        {showCaption ? (
          <p className="text-sm">
            <span className="font-semibold">digitify.be</span> <span className="whitespace-pre-line">{caption}</span>
          </p>
        ) : null}
        {firstComment.trim() ? (
          <p className="rounded-xl bg-zinc-50 p-2 text-xs text-zinc-600">Eerste reactie preview: {firstComment.trim()}</p>
        ) : null}
      </div>
    </div>
  );
}

export function SocialLivePreview({
  caption,
  firstComment,
  placements,
  feedFormat,
  assets,
  placementCount,
}: {
  caption: string;
  firstComment: string;
  placements: SocialPlacement[];
  feedFormat: FeedAspectFormat;
  assets: PlacementAssets;
  placementCount: number;
}) {
  const slides = useMemo(
    () => buildPreviewSlides({ placements, feedFormat, assets }),
    [placements, feedFormat, assets],
  );

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex((current) => {
      if (slides.length === 0) return 0;
      if (current >= slides.length) return 0;
      return current;
    });
  }, [slides.length, placements.join(","), feedFormat]);

  const activeSlide = slides[activeIndex] ?? slides[0];
  const slidesWithMedia = slides.filter((slide) => slide.hasMedia).length;

  function go(delta: number) {
    if (!slides.length) return;
    setActiveIndex((current) => (current + delta + slides.length) % slides.length);
  }

  return (
    <Card className="overflow-hidden border-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-amber-50/60 dark:from-slate-950 dark:via-slate-900 dark:to-amber-950/20">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4" /> Live preview
            </CardTitle>
            <CardDescription>
              {activeSlide
                ? `${activeSlide.label} · ${activeSlide.description}`
                : "Selecteer publicatietypes en upload media"}
            </CardDescription>
          </div>
          {slides.length > 1 ? (
            <Badge variant="outline" className="tabular-nums">
              {activeIndex + 1} / {slides.length}
            </Badge>
          ) : null}
        </div>

        {slides.length > 0 ? (
          <div className="flex items-center gap-2">
            <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" disabled={slides.length < 2} onClick={() => go(-1)} aria-label="Vorige preview">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    "shrink-0 rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition",
                    index === activeIndex
                      ? "border-amber-500 bg-amber-50 shadow-sm dark:bg-amber-950/40"
                      : "border-transparent bg-muted/50 hover:border-amber-300/60",
                  )}
                >
                  <span className="font-semibold">{slide.label}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    {slide.hasMedia ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> : <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                    {slide.hasMedia ? "Media klaar" : "Nog uploaden"}
                  </span>
                </button>
              ))}
            </div>
            <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" disabled={slides.length < 2} onClick={() => go(1)} aria-label="Volgende preview">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-5">
        {activeSlide ? (
          <>
            {!activeSlide.hasMedia ? (
              <p className="rounded-xl border border-dashed border-amber-300/70 bg-amber-50/60 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
                Upload nog media voor <strong>{activeSlide.label}</strong> links in de composer om de echte preview te zien.
              </p>
            ) : null}
            <div className="grid gap-4 2xl:grid-cols-2">
              <FacebookPreview caption={caption} slide={activeSlide} />
              <InstagramPreview caption={caption} firstComment={firstComment} slide={activeSlide} />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Kies minstens één publicatietype (Post, Story of Reel).</p>
        )}

        <div className="rounded-2xl border bg-white/70 p-3 text-xs leading-5 text-muted-foreground dark:bg-white/5">
          <p className="font-semibold text-foreground">
            <Palette className="mr-1 inline h-3.5 w-3.5" /> Publicatie-regels
          </p>
          <p>
            Feed: 4:5 tot 1.91:1 · Story/Reel: 9:16 (1080×1920). Reels vereisen een publieke MP4-video.
            {placementCount > 1 ? ` Je plant ${placementCount} varianten; ${slidesWithMedia} met media klaar voor preview.` : ""}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
