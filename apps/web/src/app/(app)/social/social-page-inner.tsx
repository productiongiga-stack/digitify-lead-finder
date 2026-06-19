"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffectiveAppRole } from "@/lib/use-effective-app-role";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@digitify/ui";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Film,
  Hash,
  Heart,
  ImageIcon,
  LinkIcon,
  Loader2,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  RefreshCcw,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  Wand2,
  X,
} from "lucide-react";
import { useToast } from "@/components/feedback/toast-provider";
import {
  isFeedMediaReady,
  isStoryMediaReady,
  resolvePrimaryImageFromAssets,
  storyItemHasMedia,
  type FeedAspectFormat,
  type PlacementAssets,
  type PlatformAssets,
  type PlatformFeedFormats,
  type SocialPlacement,
  type SocialStoryItem,
} from "@/components/social/social-placement-editor";
import {
  applyCarouselImage,
  applyCarouselVideo,
  isCarouselReady,
  type SocialCarouselState,
} from "@/components/social/social-carousel-editor";
import {
  persistCarouselAssets,
  persistPlacementAssets,
  persistPlatformAssets,
  persistStoryItems,
} from "@/lib/persist-social-assets";
import { FacebookPageAvatar, InstagramPageAvatar } from "@/components/social/social-platform-avatars";
import { useMediaAspectRatio, verticalPreviewFrameClassName } from "@/components/social/use-media-aspect-ratio";
import {
  SocialBrandKitPickerProvider,
  type SocialBrandKitApplyPayload,
} from "@/components/social/social-brand-kit-picker";
import { DEFAULT_SOCIAL_TONE, SOCIAL_TONE_OPTIONS, type SocialTone } from "@/lib/social-tone-options";
import { SocialComposerSection } from "@/components/social/social-composer-section";
import { SocialComposerWizard, SOCIAL_WIZARD_STEPS } from "@/components/social/social-composer-wizard";
import { SocialPublishAccountPicker } from "@/components/social/social-publish-account-picker";
import type { SocialAgendaPost } from "@/components/social/social-agenda";

const SocialImageGenerator = dynamic(
  () =>
    import("@/components/social/social-image-generator").then((module) => module.SocialImageGenerator),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full rounded-xl" /> },
);

const SocialAgenda = dynamic(
  () => import("@/components/social/social-agenda").then((module) => module.SocialAgenda),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full rounded-xl" /> },
);

const SocialQueuePanel = dynamic(
  () => import("./social-queue-panel").then((module) => module.SocialQueuePanel),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full rounded-xl" /> },
);

const SocialPlacementEditor = dynamic(
  () => import("@/components/social/social-placement-editor").then((module) => module.SocialPlacementEditor),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full rounded-xl" /> },
);

const SocialBrandKitPicker = dynamic(
  () => import("@/components/social/social-brand-kit-picker").then((module) => module.SocialBrandKitPicker),
  { ssr: false, loading: () => <Skeleton className="h-40 w-full rounded-xl" /> },
);

type Platform = "FACEBOOK" | "INSTAGRAM";
type PostFormat = "SQUARE" | "PORTRAIT" | "LANDSCAPE" | "STORY";

type SocialMetadata = {
  headline?: string;
  cta?: string;
  hashtags?: string;
  linkUrl?: string;
  firstComment?: string;
  altText?: string;
  brandSignature?: string;
  brandKitId?: string;
  postFormat?: PostFormat;
  placements?: SocialPlacement[];
  feedFormat?: FeedAspectFormat;
  feedFormats?: PlatformFeedFormats;
  publisherPageId?: string;
  publisherPageName?: string;
  publisherInstagramUsername?: string;
  assets?: PlacementAssets;
  platformAssets?: PlatformAssets;
  storyItems?: SocialStoryItem[];
  carousel?: SocialCarouselState;
};

type ManagedMetaPage = {
  id: string;
  name: string;
  accessToken: string;
  instagramBusinessId: string;
  instagramUsername: string;
  tasks?: string[];
};

const FORMAT_OPTIONS: Array<{ value: PostFormat; label: string; description: string; className: string; ratio: number }> = [
  { value: "SQUARE", label: "Square", description: "1:1 · veilig voor FB + IG", className: "aspect-square", ratio: 1 },
  { value: "PORTRAIT", label: "Portrait", description: "4:5 · sterk voor IG feed", className: "aspect-[4/5]", ratio: 4 / 5 },
  { value: "LANDSCAPE", label: "Landscape", description: "1.91:1 · breed beeld", className: "aspect-[1.91/1]", ratio: 1.91 },
  { value: "STORY", label: "Story", description: "9:16 · FB + IG Stories", className: "aspect-[9/16]", ratio: 9 / 16 },
];

function toDateTimeLocal(value?: string | Date | null) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

const HASHTAG_MAX_TAGS = 30;
const HASHTAG_SUGGESTIONS = ["digitalegroei", "marketing", "belgie", "socialmedia", "ondernemen", "kmo"];

function parseHashtagTokens(value: string) {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of value.split(/[\s,#]+/)) {
    const token = raw.trim().replace(/^#+/, "").replace(/[^\w\u00C0-\u024F-]/gi, "");
    if (!token) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(token);
    if (tags.length >= HASHTAG_MAX_TAGS) break;
  }
  return tags;
}

function serializeHashtagTokens(tags: string[]) {
  return tags.join(" ");
}

function normalizeHashtags(value: string) {
  return parseHashtagTokens(value)
    .map((tag) => `#${tag}`)
    .join(" ");
}

function HashtagField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const tags = useMemo(() => parseHashtagTokens(value), [value]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setDraft("");
  }, [value]);

  function commitDraft(raw?: string) {
    const source = (raw ?? draft).trim();
    if (!source) return;
    const merged = [...tags];
    for (const token of parseHashtagTokens(source)) {
      if (merged.some((tag) => tag.toLowerCase() === token.toLowerCase())) continue;
      merged.push(token);
      if (merged.length >= HASHTAG_MAX_TAGS) break;
    }
    onChange(serializeHashtagTokens(merged));
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(serializeHashtagTokens(tags.filter((entry) => entry !== tag)));
  }

  const suggestions = HASHTAG_SUGGESTIONS.filter(
    (suggestion) => !tags.some((tag) => tag.toLowerCase() === suggestion.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-input bg-background px-2 py-2 shadow-sm transition focus-within:border-amber-400/70 focus-within:ring-2 focus-within:ring-amber-500/20",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <Hash className="ml-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="h-7 gap-1 rounded-lg pr-1 font-normal">
            <span>#{tag}</span>
            <button
              type="button"
              className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`Verwijder ${tag}`}
              onClick={() => removeTag(tag)}
              disabled={disabled}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          id={id}
          value={draft}
          disabled={disabled || tags.length >= HASHTAG_MAX_TAGS}
          onChange={(event) => setDraft(event.target.value.replace(/^#+/, ""))}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "," || event.key === " ") {
              event.preventDefault();
              commitDraft();
              return;
            }
            if (event.key === "Backspace" && !draft && tags.length > 0) {
              event.preventDefault();
              removeTag(tags[tags.length - 1]!);
            }
          }}
          onBlur={() => commitDraft()}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData("text");
            if (!/[\s,#]/.test(pasted)) return;
            event.preventDefault();
            commitDraft(pasted);
          }}
          placeholder={tags.length ? "Nog een tag..." : "Typ en druk Enter"}
          className="min-w-[7rem] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          {tags.length}/{HASHTAG_MAX_TAGS} tags
        </span>
        {tags.length > 0 ? <span className="truncate">Preview: {normalizeHashtags(serializeHashtagTokens(tags))}</span> : null}
      </div>
      {suggestions.length > 0 && !disabled ? (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.slice(0, 5).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="rounded-full border border-dashed border-amber-300/80 bg-amber-50/50 px-2.5 py-0.5 text-xs text-amber-900 transition hover:border-amber-400 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
              onClick={() => onChange(serializeHashtagTokens([...tags, suggestion]))}
            >
              + #{suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildPreviewCaption(input: {
  caption: string;
  headline: string;
  cta: string;
  hashtags: string;
  linkUrl: string;
  brandSignature: string;
}) {
  return [
    input.headline.trim(),
    input.caption.trim() || "Schrijf hier je caption. De preview toont exact hoe je post zal aanvoelen.",
    input.cta.trim(),
    input.linkUrl.trim(),
    input.brandSignature.trim(),
    normalizeHashtags(input.hashtags),
  ]
    .filter(Boolean)
    .join("\n\n");
}

type PreviewSlide = {
  id: string;
  label: string;
  subtitle: string;
  format: PostFormat;
  imageUrl: string;
  videoUrl?: string;
  platform?: Platform;
};

function isPublicOrLocalVideoUrl(url?: string) {
  const trimmed = url?.trim();
  return Boolean(trimmed && (/^https:\/\//i.test(trimmed) || /^(data:|blob:)/i.test(trimmed)));
}

function normalizeStoryItemsForEditor(metadata: SocialMetadata): SocialStoryItem[] {
  if (metadata.storyItems?.length) {
    return metadata.storyItems.map((item, index) => ({
      id: item.id || `story_${index + 1}`,
      mediaType: item.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
      imageUrl: item.imageUrl?.trim() || undefined,
      videoUrl: item.videoUrl?.trim() || undefined,
    }));
  }

  const storyAsset = metadata.assets?.STORY;
  const videoUrl = storyAsset?.videoUrl?.trim();
  if (videoUrl) {
    return [{ id: "story_1", mediaType: "VIDEO", videoUrl }];
  }
  const imageUrl = storyAsset?.imageUrl?.trim();
  if (imageUrl) {
    return [{ id: "story_1", mediaType: "IMAGE", imageUrl }];
  }
  return [];
}

function buildPreviewSlides(
  placements: SocialPlacement[],
  feedFormat: FeedAspectFormat,
  assets: PlacementAssets,
  platformAssets: PlatformAssets,
  carousel: SocialCarouselState,
  storyItems: SocialStoryItem[],
): PreviewSlide[] {
  const slides: PreviewSlide[] = [];

  if (placements.includes("FEED")) {
    if (carousel.enabled && carousel.slides.length > 0) {
      carousel.slides.forEach((slide, index) => {
        const imageUrl = slide.mediaType === "IMAGE" ? slide.imageUrl?.trim() || "" : "";
        const videoUrl = slide.mediaType === "VIDEO" ? slide.videoUrl?.trim() || "" : "";
        slides.push({
          id: `carousel_${slide.id}`,
          label: `Item ${index + 1}`,
          subtitle: slide.mediaType === "VIDEO" ? "Video" : "Foto",
          format: feedFormat,
          imageUrl,
          videoUrl: videoUrl || undefined,
        });
      });
    } else {
      const imageUrl = assets.FEED?.imageUrl?.trim() || "";
      const videoUrl = assets.FEED?.videoUrl?.trim() || "";
      if (imageUrl || videoUrl) {
        const feedOption = FORMAT_OPTIONS.find((item) => item.value === feedFormat);
        slides.push({
          id: "FEED",
          label: videoUrl && !imageUrl ? "Feed video" : "Feed post",
          subtitle: feedOption?.description || "Feed",
          format: feedFormat,
          imageUrl,
          videoUrl: videoUrl && !imageUrl ? videoUrl : undefined,
        });
      }
    }
  }

  if (placements.includes("STORY")) {
    const activeStoryItems = storyItems.length
      ? storyItems
      : assets.STORY?.videoUrl?.trim() || assets.STORY?.imageUrl?.trim()
        ? [
            {
              id: "story_1",
              mediaType: assets.STORY?.videoUrl?.trim() ? "VIDEO" : "IMAGE",
              imageUrl: assets.STORY?.imageUrl,
              videoUrl: assets.STORY?.videoUrl,
            } satisfies SocialStoryItem,
          ]
        : [];
    activeStoryItems.forEach((item, index) => {
      const imageUrl = item.mediaType === "IMAGE" ? item.imageUrl?.trim() || "" : "";
      const videoUrl = item.mediaType === "VIDEO" ? item.videoUrl?.trim() || "" : "";
      if (!imageUrl && !videoUrl) return;
      slides.push({
        id: `story_${item.id}`,
        label: `Story ${index + 1}`,
        subtitle: videoUrl ? "9:16 video · FB + IG Stories" : "9:16 · FB + IG Stories",
        format: "STORY",
        imageUrl,
        videoUrl: videoUrl || undefined,
      });
    });
  }

  if (placements.includes("REEL")) {
    const videoUrl = assets.REEL?.videoUrl?.trim() || "";
    const imageUrl = assets.REEL?.imageUrl?.trim() || "";
    if (videoUrl || imageUrl) {
      slides.push({
        id: "reel",
        label: "Reel",
        subtitle: videoUrl ? "9:16 video · Instagram" : "9:16 cover · Instagram",
        format: "STORY",
        imageUrl,
        videoUrl: videoUrl || undefined,
      });
    }
  }

  return slides;
}

function InstagramReelPreview({
  caption,
  imageUrl,
  videoUrl,
  username = "digitify.be",
}: {
  caption: string;
  imageUrl: string;
  videoUrl?: string;
  username?: string;
}) {
  const displayUsername = username.replace(/^@/, "");
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.6rem] border border-zinc-200 bg-zinc-950 text-white shadow-[0_22px_55px_rgba(24,24,27,0.18)]",
        verticalPreviewFrameClassName,
      )}
    >
      {videoUrl ? (
        <video src={videoUrl} className="h-full w-full object-cover" controls playsInline muted />
      ) : imageUrl ? (
        <img src={imageUrl} alt="Instagram Reel cover" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-white/70">
          <Film className="mr-2 h-4 w-4" /> Instagram Reel
        </div>
      )}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/75 to-transparent p-4">
          <div className="flex items-center gap-2">
            <InstagramPageAvatar size="sm" label="D" />
            <div>
              <p className="text-sm font-semibold">{displayUsername}</p>
              <p className="text-xs text-white/70">Reel</p>
            </div>
          </div>
        </div>
        <div className="absolute inset-x-4 bottom-4 space-y-2">
          {caption.trim() ? (
            <p className="line-clamp-3 rounded-2xl bg-black/45 p-3 text-xs text-white/90 backdrop-blur">{caption}</p>
          ) : null}
          <p className="rounded-2xl bg-black/45 p-2 text-[10px] text-white/75 backdrop-blur">
            {videoUrl ? "Video preview in browser. Publicatie gebruikt je MP4-URL." : "Upload een MP4 voor publicatie."}
          </p>
        </div>
    </div>
  );
}

function FacebookPreview({
  caption,
  imageUrl,
  videoUrl,
  format,
  pageName = "Digitify",
}: {
  caption: string;
  imageUrl: string;
  videoUrl?: string;
  format: PostFormat;
  pageName?: string;
}) {
  const formatMeta = FORMAT_OPTIONS.find((item) => item.value === format);
  const formatClass = formatMeta?.className || "aspect-square";
  const naturalAspectRatio = useMediaAspectRatio(imageUrl, videoUrl);
  const feedAspectRatio =
    format !== "STORY" ? naturalAspectRatio ?? formatMeta?.ratio ?? 1 : null;

  if (format === "STORY") {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-[1.6rem] border border-slate-200 bg-slate-950 text-white shadow-[0_22px_55px_rgba(15,23,42,0.18)]",
          verticalPreviewFrameClassName,
        )}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="Facebook Story preview" className="h-full w-full object-cover" />
        ) : videoUrl ? (
          <video src={videoUrl} className="h-full w-full object-cover" muted playsInline controls />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/70">
            <ImageIcon className="mr-2 h-4 w-4" /> Facebook Story
          </div>
        )}
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/75 to-transparent p-4">
          <div className="flex items-center gap-2">
            <FacebookPageAvatar size="sm" />
            <div>
              <p className="text-sm font-semibold">{pageName}</p>
              <p className="text-xs text-white/70">Story · 24 uur zichtbaar</p>
            </div>
          </div>
        </div>
        <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/45 p-3 text-xs text-white/85 backdrop-blur">
          {videoUrl
            ? "Story-video preview. Caption wordt niet meegepubliceerd naar Stories."
            : "Tekst/CTA uit de composer blijft intern als reviewtekst. Meta Stories publiceren zonder feed-caption."}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white text-slate-950 shadow-[0_22px_55px_rgba(15,23,42,0.12)]">
      <div className="flex items-center gap-3 px-4 py-3">
        <FacebookPageAvatar />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{pageName}</p>
          <p className="text-xs text-slate-500">Gesponsord · openbaar</p>
        </div>
        <MoreHorizontal className="h-5 w-5 text-slate-500" />
      </div>
      <p className="whitespace-pre-line px-4 pb-3 text-sm leading-relaxed">{caption}</p>
      <div
        className={cn("w-full bg-slate-100", feedAspectRatio ? "max-h-[560px]" : formatClass)}
        style={feedAspectRatio ? { aspectRatio: feedAspectRatio } : undefined}
      >
        {videoUrl ? (
          <video src={videoUrl} className="block h-full w-full object-contain" muted playsInline controls />
        ) : imageUrl ? (
          <img src={imageUrl} alt="Facebook preview" className="block h-full w-full object-contain" />
        ) : (
          <div className="flex h-full min-h-[180px] items-center justify-center text-sm text-slate-500">
            <ImageIcon className="mr-2 h-4 w-4" /> Afbeelding preview
          </div>
        )}
      </div>
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
  imageUrl,
  videoUrl,
  firstComment,
  format,
  username = "digitify.be",
}: {
  caption: string;
  imageUrl: string;
  videoUrl?: string;
  firstComment: string;
  format: PostFormat;
  username?: string;
}) {
  const displayUsername = username.replace(/^@/, "");
  const formatMeta = FORMAT_OPTIONS.find((item) => item.value === format);
  const formatClass = formatMeta?.className || "aspect-square";
  const naturalAspectRatio = useMediaAspectRatio(imageUrl, videoUrl);
  const feedAspectRatio =
    format !== "STORY" ? naturalAspectRatio ?? formatMeta?.ratio ?? 1 : null;
  if (format === "STORY") {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-[1.6rem] border border-zinc-200 bg-zinc-950 text-white shadow-[0_22px_55px_rgba(24,24,27,0.18)]",
          verticalPreviewFrameClassName,
        )}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="Instagram Story preview" className="h-full w-full object-cover" />
        ) : videoUrl ? (
          <video src={videoUrl} className="h-full w-full object-cover" muted playsInline controls />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/70">
            <ImageIcon className="mr-2 h-4 w-4" /> Instagram Story
          </div>
        )}
        <div className="absolute inset-x-0 top-0 space-y-3 bg-gradient-to-b from-black/75 to-transparent p-4">
          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: 5 }).map((_, index) => (
              <span key={index} className="h-0.5 rounded-full bg-white/80" />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <InstagramPageAvatar size="sm" label="D" />
            <div>
              <p className="text-sm font-semibold">{displayUsername}</p>
              <p className="text-xs text-white/70">Instagram Story</p>
            </div>
          </div>
        </div>
        <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/45 p-3 text-xs text-white/85 backdrop-blur">
          {videoUrl
            ? "Story-video preview. Caption wordt niet meegepubliceerd naar Stories."
            : "Stories ondersteunen geen gewone feed-caption. Voeg tekst visueel toe in de afbeelding zelf."}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-zinc-200 bg-white text-zinc-950 shadow-[0_22px_55px_rgba(24,24,27,0.12)]">
      <div className="flex items-center gap-3 px-4 py-3">
        <InstagramPageAvatar />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{displayUsername}</p>
          <p className="text-xs text-zinc-500">België</p>
        </div>
        <MoreHorizontal className="h-5 w-5 text-zinc-500" />
      </div>
      <div
        className={cn("w-full bg-zinc-100", feedAspectRatio ? "max-h-[560px]" : formatClass)}
        style={feedAspectRatio ? { aspectRatio: feedAspectRatio } : undefined}
      >
        {videoUrl ? (
          <video src={videoUrl} className="block h-full w-full object-contain" muted playsInline controls />
        ) : imageUrl ? (
          <img src={imageUrl} alt="Instagram preview" className="block h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            <ImageIcon className="mr-2 h-4 w-4" /> Feed afbeelding
          </div>
        )}
      </div>
      <div className="space-y-2 px-4 py-3">
        <div className="flex gap-3"><Heart className="h-5 w-5" /><MessageCircle className="h-5 w-5" /><Send className="h-5 w-5" /></div>
        <p className="text-sm"><span className="font-semibold">{displayUsername}</span> <span className="whitespace-pre-line">{caption}</span></p>
        {firstComment.trim() ? (
          <p className="rounded-xl bg-zinc-50 p-2 text-xs text-zinc-600">
            Eerste reactie preview: {firstComment.trim()}
          </p>
        ) : null}
      </div>
    </div>
  );
}

const SOCIAL_TABS = ["composer", "agenda", "queue"] as const;
type SocialTab = (typeof SOCIAL_TABS)[number];

export function SocialPageInner() {
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = useEffectiveAppRole();
  const canSchedule = role === "OWNER" || role === "ADMIN";

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [template, setTemplate] = useState("");
  const [tone, setTone] = useState<SocialTone>(DEFAULT_SOCIAL_TONE);
  const [scheduledFor, setScheduledFor] = useState("");
  const [targetFacebook, setTargetFacebook] = useState(true);
  const [targetInstagram, setTargetInstagram] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<SocialTab>("composer");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && SOCIAL_TABS.includes(tab as SocialTab)) {
      setActiveTab(tab as SocialTab);
    }
  }, [searchParams]);

  const handleTabChange = useCallback(
    (tab: string) => {
      if (!SOCIAL_TABS.includes(tab as SocialTab)) return;
      setActiveTab(tab as SocialTab);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`/social?${params.toString()}`);
    },
    [router, searchParams],
  );
  const [headline, setHeadline] = useState("");
  const [cta, setCta] = useState("");
  const [hashtags, setHashtags] = useState("digitalegroei marketing belgie");
  const [linkUrl, setLinkUrl] = useState("");
  const [firstComment, setFirstComment] = useState("");
  const [altText, setAltText] = useState("");
  const [brandSignature, setBrandSignature] = useState("");
  const [selectedBrandKitId, setSelectedBrandKitId] = useState("");
  const [wizardStep, setWizardStep] = useState(0);
  const [placements, setPlacements] = useState<SocialPlacement[]>(["FEED"]);
  const [feedFormat, setFeedFormat] = useState<FeedAspectFormat>("SQUARE");
  const [feedFormats, setFeedFormats] = useState<PlatformFeedFormats>({
    FACEBOOK: "LANDSCAPE",
    INSTAGRAM: "PORTRAIT",
  });
  const [placementAssets, setPlacementAssets] = useState<PlacementAssets>({});
  const [platformAssets, setPlatformAssets] = useState<PlatformAssets>({});
  const [storyItems, setStoryItems] = useState<SocialStoryItem[]>([]);
  const [carousel, setCarousel] = useState<SocialCarouselState>({ enabled: false, slides: [] });
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);
  const [selectedPageId, setSelectedPageId] = useState("");

  const listQuery = trpc.social.list.useQuery(statusFilter === "ALL" ? undefined : { status: statusFilter as any }, {
    staleTime: 30_000,
    refetchInterval: activeTab === "queue" ? 60_000 : false,
  });
  const connectionStatus = trpc.social.connectionStatus.useQuery(undefined, {
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
  const metaPublishIssue = useMemo(() => {
    const status = connectionStatus.data;
    if (!status?.connected) return null;
    if (!status.hasAppCredentials) {
      return {
        title: "Meta app-gegevens ontbreken",
        description: "Vul App ID + Secret in bij Integraties en koppel Meta opnieuw.",
      };
    }
    if (status.tokenValid === false) {
      return {
        title: "Meta token ongeldig",
        description: status.tokenDebugError || "Koppel Meta opnieuw via Integraties.",
      };
    }
    if (status.missingPublishScopes?.length) {
      return {
        title: "Meta publishing-rechten ontbreken",
        description: `Ontbrekend: ${status.missingPublishScopes.join(", ")}. Koppel Meta opnieuw nadat deze rechten op de Meta-app staan.`,
      };
    }
    if (status.missingGranularPublishScopes?.length) {
      return {
        title: "Meta rechten niet actief op dit account",
        description: `Ontbrekend voor de gekozen Page/Instagram: ${status.missingGranularPublishScopes.join(", ")}. Koppel Meta opnieuw en vink de juiste accounts aan.`,
      };
    }
    const pageTasks = new Set((status.selectedPageTasks || []).map((task) => task.toUpperCase()));
    if (pageTasks.size > 0 && !pageTasks.has("CREATE_CONTENT") && !pageTasks.has("MANAGE")) {
      return {
        title: "Facebook Page mist contentrechten",
        description: "De gekoppelde Meta-gebruiker heeft geen CREATE_CONTENT taak op deze Page.",
      };
    }
    if (status.oauthUsesLegacyEnvOverride || status.oauthHasDeprecatedScopes) {
      return {
        title: "Meta OAuth scopes verouderd",
        description: "Gebruik Facebook Login scopes zoals pages_manage_posts, instagram_basic en instagram_content_publish.",
      };
    }
    return null;
  }, [connectionStatus.data]);
  const managedPages = useMemo(
    () => (connectionStatus.data?.pages ?? []) as ManagedMetaPage[],
    [connectionStatus.data?.pages],
  );
  const selectedManagedPage = useMemo(
    () => managedPages.find((page) => page.id === selectedPageId) || null,
    [managedPages, selectedPageId],
  );

  const rows = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);
  const selected = rows.find((row: any) => row.id === selectedId) || null;
  const canEditSelected =
    !selected || ["DRAFT", "FAILED", "CANCELLED", "SCHEDULED", "PENDING_APPROVAL"].includes(selected.status);
  const isPublishedLocked = selected?.status === "PUBLISHED";

  const stats = useMemo(() => {
    const pending = rows.filter((row: any) => row.status === "PENDING_APPROVAL").length;
    const scheduled = rows.filter((row: any) => row.status === "SCHEDULED").length;
    const failed = rows.filter((row: any) => row.status === "FAILED").length;
    return { pending, scheduled, failed };
  }, [rows]);

  const resolvedFeedFormats = useMemo(
    () => ({
      FACEBOOK: feedFormats.FACEBOOK || feedFormat,
      INSTAGRAM: feedFormats.INSTAGRAM || feedFormat,
    }),
    [feedFormat, feedFormats.FACEBOOK, feedFormats.INSTAGRAM],
  );

  const previewFormat: PostFormat = useMemo(() => {
    if (placements.includes("FEED")) return feedFormat;
    if (placements.includes("STORY") || placements.includes("REEL")) return "STORY";
    return "SQUARE";
  }, [feedFormat, placements]);

  const metadataPayload: SocialMetadata = useMemo(
    () => ({
      headline,
      cta,
      hashtags,
      linkUrl,
      firstComment,
      altText,
      brandSignature,
      brandKitId: selectedBrandKitId || undefined,
      postFormat: previewFormat,
      placements,
      feedFormat,
      feedFormats: resolvedFeedFormats,
      publisherPageId: selectedPageId || undefined,
      publisherPageName: selectedManagedPage?.name || undefined,
      publisherInstagramUsername: selectedManagedPage?.instagramUsername || undefined,
      assets: placementAssets,
      platformAssets,
      storyItems,
      carousel: carousel.enabled ? carousel : undefined,
    }),
    [
      altText,
      brandSignature,
      carousel,
      selectedBrandKitId,
      cta,
      firstComment,
      feedFormat,
      hashtags,
      headline,
      linkUrl,
      placementAssets,
      platformAssets,
      placements,
      previewFormat,
      resolvedFeedFormats,
      selectedManagedPage?.instagramUsername,
      selectedManagedPage?.name,
      selectedPageId,
      storyItems,
    ],
  );

  const previewPageName = selectedManagedPage?.name || connectionStatus.data?.pageName || "Digitify";
  const previewInstagramUsername =
    selectedManagedPage?.instagramUsername || connectionStatus.data?.instagramUsername || "digitify.be";

  useEffect(() => {
    if (selectedPageId || !managedPages.length) return;
    const defaultPageId =
      connectionStatus.data?.selectedPageId ||
      connectionStatus.data?.pageId ||
      managedPages[0]?.id ||
      "";
    if (defaultPageId) setSelectedPageId(defaultPageId);
  }, [
    connectionStatus.data?.pageId,
    connectionStatus.data?.selectedPageId,
    managedPages,
    selectedPageId,
  ]);

  useEffect(() => {
    if (targetInstagram && selectedManagedPage && !selectedManagedPage.instagramBusinessId) {
      setTargetInstagram(false);
    }
  }, [selectedManagedPage, targetInstagram]);

  const previewCaption = useMemo(
    () => buildPreviewCaption({ caption, headline, cta, hashtags, linkUrl, brandSignature }),
    [brandSignature, caption, cta, hashtags, headline, linkUrl],
  );

  const previewSlides = useMemo(
    () => buildPreviewSlides(placements, feedFormat, placementAssets, platformAssets, carousel, storyItems),
    [carousel, feedFormat, placementAssets, platformAssets, placements, storyItems],
  );

  const activePreviewSlide = previewSlides[previewSlideIndex] ?? previewSlides[0] ?? null;

  useEffect(() => {
    if (previewSlideIndex >= previewSlides.length) {
      setPreviewSlideIndex(Math.max(0, previewSlides.length - 1));
    }
  }, [previewSlideIndex, previewSlides.length]);

  function goToPreviewSlide(nextIndex: number) {
    if (!previewSlides.length) return;
    const wrapped = ((nextIndex % previewSlides.length) + previewSlides.length) % previewSlides.length;
    setPreviewSlideIndex(wrapped);
  }

  const createDraft = trpc.social.createDraft.useMutation({
    onSuccess: async (row: any) => {
      setSelectedId(row.id);
      await listQuery.refetch();
      showToast({ title: "Draft aangemaakt" });
    },
    onError: (error) => {
      const raw = error.message;
      const message = raw.includes("social_posts")
        ? "Database mist de tabel social_posts. Voer packages/db/prisma/manual/social-posts-and-meta-ads.sql uit in Supabase SQL Editor (zie docs/VERCEL.md)."
        : raw.includes("Unexpected token") || raw.includes("Request En")
          ? "De draft bevat te grote afbeeldingen. Gebruik de upload-knop zodat bestanden apart worden opgeslagen."
          : raw;
      showToast({ title: "Aanmaken mislukt", description: message, variant: "error" });
    },
  });

  const updateDraft = trpc.social.updateDraft.useMutation({
    onSuccess: async () => {
      await listQuery.refetch();
      showToast({ title: "Draft bijgewerkt" });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const updateQueuedPost = trpc.social.updateQueuedPost.useMutation({
    onSuccess: async () => {
      await listQuery.refetch();
      showToast({ title: "Post bijgewerkt", description: "Wijzigingen opgeslagen in de wachtrij." });
    },
    onError: (error) => showToast({ title: "Opslaan mislukt", description: error.message, variant: "error" }),
  });

  const submitApproval = trpc.social.submitForApproval.useMutation({
    onSuccess: async () => {
      await listQuery.refetch();
      showToast({ title: "Ter goedkeuring ingediend" });
    },
    onError: (error) => showToast({ title: "Indienen mislukt", description: error.message, variant: "error" }),
  });

  const approveAndSchedule = trpc.social.approveAndSchedule.useMutation({
    onSuccess: async () => {
      await listQuery.refetch();
      const wasScheduled = selected?.status === "SCHEDULED";
      showToast({ title: wasScheduled ? "Planning bijgewerkt" : "Post ingepland" });
    },
    onError: (error) => showToast({ title: "Inplannen mislukt", description: error.message, variant: "error" }),
  });

  const rejectPost = trpc.social.reject.useMutation({
    onSuccess: async () => {
      await listQuery.refetch();
      showToast({ title: "Post afgekeurd" });
    },
    onError: (error) => showToast({ title: "Afkeuren mislukt", description: error.message, variant: "error" }),
  });

  const retryFailed = trpc.social.retryFailed.useMutation({
    onSuccess: async () => {
      await listQuery.refetch();
      showToast({ title: "Retry ingepland" });
    },
    onError: (error) => showToast({ title: "Retry mislukt", description: error.message, variant: "error" }),
  });

  const cancelScheduled = trpc.social.cancelScheduled.useMutation({
    onSuccess: async () => {
      await listQuery.refetch();
      showToast({ title: "Planning geannuleerd" });
    },
    onError: (error) => showToast({ title: "Annuleren mislukt", description: error.message, variant: "error" }),
  });

  const deletePosts = trpc.social.deletePosts.useMutation({
    onSuccess: async (result, variables) => {
      await listQuery.refetch();
      if (
        selectedId &&
        (variables.all || variables.ids?.includes(selectedId) || (variables.status && selected?.status === variables.status))
      ) {
        setSelectedId(null);
      }

      const details = [
        result.publishedLocalOnly
          ? `${result.publishedLocalOnly} live post${result.publishedLocalOnly === 1 ? "" : "s"} enkel uit Planner verwijderd`
          : null,
        result.skippedPublishing
          ? `${result.skippedPublishing} lopende publicatie${result.skippedPublishing === 1 ? "" : "s"} overgeslagen`
          : null,
        result.missing ? `${result.missing} niet gevonden` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      showToast({
        title: result.deleted ? `${result.deleted} post${result.deleted === 1 ? "" : "s"} verwijderd` : "Geen posts verwijderd",
        description: details || undefined,
        variant: result.deleted ? "success" : "info",
      });
    },
    onError: (error) => showToast({ title: "Verwijderen mislukt", description: error.message, variant: "error" }),
  });

  const generateSuggestion = trpc.social.generateSuggestion.useMutation({
    onSuccess: (payload) => {
      setCaption(payload.caption);
      showToast({ title: "Suggestie gegenereerd" });
    },
    onError: (error) => showToast({ title: "Generatie mislukt", description: error.message, variant: "error" }),
  });

  function applyBrandKitDefaults(payload: SocialBrandKitApplyPayload) {
    setBrandSignature(payload.brandSignature);
    if (payload.hashtags.trim()) setHashtags(payload.hashtags);
    if (payload.tone) setTone(payload.tone as SocialTone);
    setCta(payload.cta);
    setLinkUrl(payload.linkUrl);
    if (payload.template.trim()) setTemplate(payload.template);
  }

  const brandKitsQuery = trpc.social.listBrandKits.useQuery(undefined, {
    enabled: activeTab === "composer",
    staleTime: 5 * 60_000,
  });
  const selectedBrandKitName = useMemo(() => {
    const kits = brandKitsQuery.data?.kits ?? [];
    const match = kits.find((kit) => kit.id === selectedBrandKitId);
    return match?.name || (selectedBrandKitId ? "Merkkit" : "Geen merkkit gekozen");
  }, [brandKitsQuery.data?.kits, selectedBrandKitId]);

  const publishingPostsCount = useMemo(
    () => rows.filter((row: { status: string }) => row.status === "PUBLISHING").length,
    [rows],
  );

  const dueSoonScheduledCount = useMemo(
    () =>
      rows.filter((row: { status: string; scheduledFor?: string | Date | null }) => {
        if (row.status !== "SCHEDULED" || !row.scheduledFor) return false;
        const dueAt = new Date(row.scheduledFor).getTime();
        return dueAt <= Date.now() + 2 * 60 * 1000;
      }).length,
    [rows],
  );

  const overdueScheduledCount = useMemo(
    () =>
      rows.filter(
        (row: { status: string; scheduledFor?: string | Date | null }) =>
          row.status === "SCHEDULED" &&
          row.scheduledFor &&
          new Date(row.scheduledFor).getTime() <= Date.now(),
      ).length,
    [rows],
  );

  const publishDuePosts = trpc.social.publishDuePosts.useMutation({
    onSuccess: async (summary) => {
      await listQuery.refetch();
      if (summary.published > 0 || summary.failed > 0) {
        showToast({
          title: "Publicatiewachtrij verwerkt",
          description: `${summary.published} gepubliceerd · ${summary.failed} mislukt · ${summary.skipped} overgeslagen`,
        });
      }
    },
    onError: (error) =>
      showToast({ title: "Publiceren mislukt", description: error.message, variant: "error" }),
  });

  const [publishingPostId, setPublishingPostId] = useState<string | null>(null);

  const publishPostNow = trpc.social.publishPostNow.useMutation({
    onMutate: () => {
      showToast({
        title: "Publiceren gestart",
        description: "Meta kan enkele minuten nodig hebben, vooral bij Instagram en video.",
      });
    },
    onSuccess: async () => {
      setPublishingPostId(null);
      await listQuery.refetch();
      showToast({ title: "Post live op Meta", description: "Publicatie bevestigd." });
    },
    onError: (error) => {
      setPublishingPostId(null);
      const message = error.message;
      const alreadyLive = /al live|al gepubliceerd|wordt al gepubliceerd/i.test(message);
      showToast({
        title: alreadyLive ? "Post al live" : "Publiceren mislukt",
        description: message,
        variant: alreadyLive ? "info" : "error",
      });
      void listQuery.refetch();
    },
    onSettled: () => {
      setPublishingPostId(null);
    },
  });

  useEffect(() => {
    if (!canSchedule || !connectionStatus.data?.connected || dueSoonScheduledCount === 0) return;
    if (publishDuePosts.isPending || publishingPostsCount > 0) return;

    const timer = window.setInterval(() => {
      if (!publishDuePosts.isPending && publishingPostsCount === 0) publishDuePosts.mutate();
    }, 45_000);

    if (overdueScheduledCount > 0) publishDuePosts.mutate();

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll when due queue changes
  }, [canSchedule, connectionStatus.data?.connected, dueSoonScheduledCount, overdueScheduledCount, publishingPostsCount]);

  function canProceedWizardStep(step: number) {
    if (step === 0) {
      return Boolean(selectedPageId) && (targetFacebook || targetInstagram);
    }
    if (step === 1) {
      return true;
    }
    if (step === 2) {
      return Boolean(caption.trim());
    }
    if (step === 3) {
      if (!placements.length) return false;
      if (placements.includes("FEED")) {
        if (carousel.enabled) {
          if ((targetFacebook || targetInstagram) && !isCarouselReady(carousel)) return false;
        } else if (!isFeedMediaReady(placementAssets, carousel)) {
          return false;
        }
      }
      if (placements.includes("STORY") && !isStoryMediaReady(placementAssets, storyItems)) return false;
      if (placements.includes("REEL") && !placementAssets.REEL?.videoUrl?.trim()) return false;
      return true;
    }
    return true;
  }

  function goToNextWizardStep() {
    if (!canProceedWizardStep(wizardStep)) {
      if (wizardStep === 0) {
        showToast({
          title: "Kies publicatie-account",
          description: "Selecteer een pagina en minstens Facebook of Instagram.",
          variant: "error",
        });
      } else if (wizardStep === 2) {
        showToast({ title: "Caption verplicht", description: "Schrijf eerst je posttekst.", variant: "error" });
      } else if (wizardStep === 3) {
        showToast({ title: "Media ontbreekt", description: "Voeg de benodigde afbeelding of video toe.", variant: "error" });
      }
      return;
    }
    setWizardStep((current) => Math.min(current + 1, SOCIAL_WIZARD_STEPS.length - 1));
  }

  const importCreativeImage = trpc.media.importToBlob.useMutation();
  const pendingImageJobId = searchParams.get("imageJob");
  const pendingVideoJobId = searchParams.get("videoJob");
  const [appliedImageJobId, setAppliedImageJobId] = useState<string | null>(null);
  const [appliedVideoJobId, setAppliedVideoJobId] = useState<string | null>(null);
  const creativeImageJob = trpc.media.getJobStatus.useQuery(
    { jobId: pendingImageJobId || "" },
    { enabled: Boolean(pendingImageJobId) && appliedImageJobId !== pendingImageJobId },
  );
  const creativeVideoJob = trpc.media.getJobStatus.useQuery(
    { jobId: pendingVideoJobId || "" },
    { enabled: Boolean(pendingVideoJobId) && appliedVideoJobId !== pendingVideoJobId },
  );

  useEffect(() => {
    if (!pendingImageJobId || appliedImageJobId === pendingImageJobId || !creativeImageJob.data) return;
    const status = creativeImageJob.data;
    if (status.status !== "COMPLETED" || (!status.outputUrl && !status.blobUrl)) return;

    let cancelled = false;

    async function applyCreativeImageJob() {
      try {
        let imageUrl = status.blobUrl || status.outputUrl;
        if (!imageUrl) return;

        if (!status.blobUrl) {
          const imported = await importCreativeImage.mutateAsync({ jobId: pendingImageJobId! });
          imageUrl = imported.blobUrl || imageUrl;
        }

        if (cancelled) return;
        if (carousel.enabled && placements.includes("FEED")) {
          setCarousel((current) => applyCarouselImage(current, imageUrl));
        } else {
          setPlacementAssets((current) => {
            const next = { ...current };
            if (placements.includes("FEED")) next.FEED = { imageUrl };
            if (placements.includes("STORY")) next.STORY = { imageUrl };
            if (placements.includes("REEL") && !next.REEL?.videoUrl) next.REEL = { imageUrl };
            return next;
          });
          if (placements.includes("STORY")) {
            setStoryItems((current) => [
              ...current,
              { id: `story_${Date.now()}`, mediaType: "IMAGE", imageUrl },
            ]);
          }
        }
        setAppliedImageJobId(pendingImageJobId);
        setActiveTab("composer");
        showToast({ title: "Creative Studio-afbeelding toegevoegd" });
      } catch (error) {
        if (!cancelled) {
          showToast({
            title: "Afbeelding laden mislukt",
            description: error instanceof Error ? error.message : "Onbekende fout",
            variant: "error",
          });
        }
      }
    }

    void applyCreativeImageJob();
    return () => {
      cancelled = true;
    };
  }, [
    appliedImageJobId,
    creativeImageJob.data,
    importCreativeImage,
    carousel.enabled,
    pendingImageJobId,
    placements,
    showToast,
  ]);

  useEffect(() => {
    if (!pendingVideoJobId || appliedVideoJobId === pendingVideoJobId || !creativeVideoJob.data) return;
    const status = creativeVideoJob.data;
    if (status.status !== "COMPLETED" || (!status.outputUrl && !status.blobUrl)) return;

    let cancelled = false;

    async function applyCreativeVideoJob() {
      try {
        let videoUrl = status.blobUrl || status.outputUrl;
        if (!videoUrl) return;

        if (!status.blobUrl) {
          const imported = await importCreativeImage.mutateAsync({ jobId: pendingVideoJobId! });
          videoUrl = imported.blobUrl || videoUrl;
        }

        if (cancelled) return;
        if (carousel.enabled && placements.includes("FEED")) {
          setCarousel((current) => applyCarouselVideo(current, videoUrl));
        } else {
          setPlacementAssets((current) => {
            const next = { ...current };
            if (placements.includes("REEL")) next.REEL = { videoUrl };
            if (placements.includes("STORY") && !next.STORY?.imageUrl) {
              next.STORY = { videoUrl };
            }
            if (placements.includes("FEED") && !next.FEED?.imageUrl) {
              next.FEED = { videoUrl };
            }
            return next;
          });
          if (placements.includes("STORY")) {
            setStoryItems((current) => [
              ...current,
              { id: `story_${Date.now()}`, mediaType: "VIDEO", videoUrl },
            ]);
          }
          if (!placements.includes("REEL") && !carousel.enabled) {
            setPlacements((current) => (current.includes("REEL") ? current : [...current, "REEL"]));
          }
        }
        setAppliedVideoJobId(pendingVideoJobId);
        setActiveTab("composer");
        showToast({ title: "Creative Studio-video toegevoegd" });
      } catch (error) {
        if (!cancelled) {
          showToast({
            title: "Video laden mislukt",
            description: error instanceof Error ? error.message : "Onbekende fout",
            variant: "error",
          });
        }
      }
    }

    void applyCreativeVideoJob();
    return () => {
      cancelled = true;
    };
  }, [
    appliedVideoJobId,
    carousel.enabled,
    creativeVideoJob.data,
    importCreativeImage,
    pendingVideoJobId,
    placements,
    showToast,
  ]);

  function selectedTargets(): Platform[] {
    const targets: Platform[] = [];
    if (targetFacebook) targets.push("FACEBOOK");
    if (targetInstagram) targets.push("INSTAGRAM");
    return targets;
  }

  function ensureEditorReady({ requireInstagramSafe }: { requireInstagramSafe: boolean }) {
    const targets = selectedTargets();
    if (!caption.trim() || targets.length === 0) {
      showToast({
        title: "Onvolledig",
        description: "Caption en minstens één platform zijn verplicht.",
        variant: "error",
      });
      return false;
    }

    if (!selectedPageId) {
      showToast({
        title: "Account ontbreekt",
        description: "Kies een Facebook-pagina om op te posten.",
        variant: "error",
      });
      return false;
    }

    if (targets.includes("INSTAGRAM") && !selectedManagedPage?.instagramBusinessId) {
      showToast({
        title: "Instagram ontbreekt",
        description: "Het geselecteerde account heeft geen gekoppeld Instagram Business-profiel.",
        variant: "error",
      });
      return false;
    }

    if (!placements.length) {
      showToast({ title: "Onvolledig", description: "Kies minstens één publicatietype.", variant: "error" });
      return false;
    }

    if (placements.includes("REEL") && !targetInstagram) {
      showToast({
        title: "Reel vereist Instagram",
        description: "Schakel Instagram in of verwijder Reel uit je selectie.",
        variant: "error",
      });
      return false;
    }

    if (placements.includes("FEED")) {
      if (carousel.enabled) {
        if ((targetFacebook || targetInstagram) && !isCarouselReady(carousel)) {
          showToast({
            title: "Multi-upload onvolledig",
            description: "Voeg minstens 2 items toe met foto of video.",
            variant: "error",
          });
          return false;
        }
      } else if (!isFeedMediaReady(placementAssets, carousel)) {
        showToast({
          title: "Feed-media ontbreekt",
          description: "Voeg een feed-foto of -video toe, of schakel multi-upload in.",
          variant: "error",
        });
        return false;
      }
    }
    if (placements.includes("STORY") && !isStoryMediaReady(placementAssets, storyItems)) {
      showToast({
        title: "Story-media ontbreekt",
        description: "Voeg minstens één verticale 9:16 foto of video toe.",
        variant: "error",
      });
      return false;
    }
    if (placements.includes("REEL") && !placementAssets.REEL?.videoUrl?.trim()) {
      showToast({
        title: "Reel-video ontbreekt",
        description: "Upload een MP4 of plak een publieke video-URL.",
        variant: "error",
      });
      return false;
    }

    if (
      requireInstagramSafe &&
      carousel.enabled &&
      carousel.slides.some((slide) => slide.mediaType === "VIDEO" && slide.videoUrl && !isPublicOrLocalVideoUrl(slide.videoUrl))
    ) {
      showToast({
        title: "Multi-upload video moet publiek zijn",
        description: "Gebruik publieke https-URL's of upload via Vercel Blob.",
        variant: "error",
      });
      return false;
    }

    if (
      requireInstagramSafe &&
      placements.includes("FEED") &&
      !carousel.enabled &&
      placementAssets.FEED?.videoUrl?.trim() &&
      !placementAssets.FEED?.imageUrl?.trim() &&
      !isPublicOrLocalVideoUrl(placementAssets.FEED.videoUrl)
    ) {
      showToast({
        title: "Feed-video moet publiek zijn",
        description: "Gebruik een publieke https-MP4-URL of upload via Vercel Blob.",
        variant: "error",
      });
      return false;
    }

    if (
      requireInstagramSafe &&
      placements.includes("STORY") &&
      storyItems.some((item) => item.mediaType === "VIDEO" && item.videoUrl && !isPublicOrLocalVideoUrl(item.videoUrl))
    ) {
      showToast({
        title: "Story-video moet publiek zijn",
        description: "Gebruik publieke https-MP4-URL's of upload via Vercel Blob.",
        variant: "error",
      });
      return false;
    }

    if (requireInstagramSafe && placements.includes("REEL") && !isPublicOrLocalVideoUrl(placementAssets.REEL?.videoUrl)) {
      showToast({
        title: "Reel-video moet publiek zijn",
        description: "Gebruik een publieke https-MP4-URL of upload via Vercel Blob.",
        variant: "error",
      });
      return false;
    }

    return true;
  }

  async function saveDraft() {
    const targets = selectedTargets();
    if (!ensureEditorReady({ requireInstagramSafe: false })) return null;

    try {
      const persistedAssets = await persistPlacementAssets(placementAssets, {
        placements,
        feedFormat,
        targetPlatforms: targets,
      });
      const persistedPlatformAssets = await persistPlatformAssets(platformAssets, {
        feedFormats: resolvedFeedFormats,
      });
      const persistedCarousel = await persistCarouselAssets(carousel);
      const persistedStoryItems = await persistStoryItems(storyItems, {
        feedFormat,
        targetPlatforms: targets,
      });
      const assetsWithStoryMirror = { ...persistedAssets };
      const firstStoryItem = persistedStoryItems.find(storyItemHasMedia);
      if (firstStoryItem) {
        assetsWithStoryMirror.STORY =
          firstStoryItem.mediaType === "VIDEO"
            ? { videoUrl: firstStoryItem.videoUrl, imageUrl: undefined }
            : { imageUrl: firstStoryItem.imageUrl, videoUrl: undefined };
      }
      if (JSON.stringify(assetsWithStoryMirror) !== JSON.stringify(placementAssets)) {
        setPlacementAssets(assetsWithStoryMirror);
      }
      if (JSON.stringify(persistedPlatformAssets) !== JSON.stringify(platformAssets)) {
        setPlatformAssets(persistedPlatformAssets);
      }
      if (JSON.stringify(persistedStoryItems) !== JSON.stringify(storyItems)) {
        setStoryItems(persistedStoryItems);
      }
      if (JSON.stringify(persistedCarousel) !== JSON.stringify(carousel)) {
        setCarousel(persistedCarousel);
      }

      const persistedImageUrl = resolvePrimaryImageFromAssets(assetsWithStoryMirror, persistedCarousel);
      const persistedMetadata: SocialMetadata = {
        ...metadataPayload,
        assets: assetsWithStoryMirror,
        platformAssets: persistedPlatformAssets,
        storyItems: persistedStoryItems,
        carousel: persistedCarousel.enabled ? persistedCarousel : undefined,
      };

      if (!selected) {
        return createDraft.mutateAsync({
          caption: caption.trim(),
          imageUrl: persistedImageUrl.trim(),
          targetPlatforms: targets,
          metadata: persistedMetadata,
        });
      }

      if (isPublishedLocked) {
        showToast({
          title: "Post vergrendeld",
          description: "Deze post is al live op Meta en kan niet meer bewerkt worden.",
          variant: "error",
        });
        return selected;
      }

      if (selected.status === "SCHEDULED" || selected.status === "PENDING_APPROVAL") {
        return updateQueuedPost.mutateAsync({
          id: selected.id,
          caption: caption.trim(),
          imageUrl: persistedImageUrl.trim(),
          targetPlatforms: targets,
          metadata: persistedMetadata,
        });
      }

      if (!canEditSelected) {
        showToast({
          title: "Niet bewerkbaar",
          description: "Deze post kan niet meer bewerkt worden.",
          variant: "error",
        });
        return selected;
      }

      return updateDraft.mutateAsync({
        id: selected.id,
        caption: caption.trim(),
        imageUrl: persistedImageUrl.trim(),
        targetPlatforms: targets,
        metadata: persistedMetadata,
      });
    } catch (error) {
      showToast({
        title: "Opslaan mislukt",
        description: error instanceof Error ? error.message : "Onbekende fout",
        variant: "error",
      });
      return null;
    }
  }

  async function handleCreateOrUpdate() {
    await saveDraft();
  }

  async function handleSubmitForApproval() {
    if (!selected) return;
    const saved = canEditSelected ? await saveDraft() : selected;
    if (canEditSelected && !saved) return;
    const postId = saved && typeof saved === "object" && "id" in saved ? String((saved as { id: string }).id) : selected.id;
    await submitApproval.mutateAsync({ id: postId });
  }

  async function handleCreateAndSubmit() {
    const saved = await saveDraft();
    if (!saved) return;
    const postId = saved && typeof saved === "object" && "id" in saved ? String((saved as { id: string }).id) : selected?.id;
    if (!postId) return;
    await submitApproval.mutateAsync({ id: postId });
  }

  async function handleApproveAndSchedule() {
    if (!selected || !scheduledFor) return;
    const saved = canEditSelected ? await saveDraft() : selected;
    if (canEditSelected && !saved) return;
    const postId = saved && typeof saved === "object" && "id" in saved ? String((saved as { id: string }).id) : selected.id;
    await approveAndSchedule.mutateAsync({ id: postId, scheduledFor: new Date(scheduledFor) });
  }

  function planPostForDate(date: Date) {
    resetEditor();
    setScheduledFor(toDateTimeLocal(date.toISOString()));
    setActiveTab("composer");
    router.replace("/social?tab=composer");
    showToast({
      title: "Nieuwe planning",
      description: `Stel je post in voor ${date.toLocaleString("nl-BE")}.`,
    });
  }

  function openAgendaPost(post: SocialAgendaPost) {
    void loadRow(post);
  }

  async function loadRow(row: { id: string; caption?: string | null; metadata?: unknown; targetPlatforms?: string[]; scheduledFor?: string | Date | null }) {
    let source = row;
    if (!row.metadata) {
      try {
        source = await utils.social.getById.fetch({ id: row.id });
      } catch {
        // Keep partial list row when full fetch fails.
      }
    }
    const metadata = (source.metadata || {}) as SocialMetadata;
    setActiveTab("composer");
    router.replace("/social?tab=composer");
    setSelectedId(row.id);
    setCaption(source.caption || "");
    setPlacements(metadata.placements?.length ? metadata.placements : metadata.postFormat === "STORY" ? ["STORY"] : ["FEED"]);
    const legacyFormat = metadata.postFormat;
    setFeedFormat(
      metadata.feedFormat ||
        (legacyFormat === "PORTRAIT" || legacyFormat === "LANDSCAPE" || legacyFormat === "SQUARE" ? legacyFormat : "SQUARE"),
    );
    setFeedFormats({
      FACEBOOK: metadata.feedFormats?.FACEBOOK || metadata.feedFormat || "LANDSCAPE",
      INSTAGRAM: metadata.feedFormats?.INSTAGRAM || metadata.feedFormat || "PORTRAIT",
    });
    setPlacementAssets(metadata.assets || {});
    setPlatformAssets(metadata.platformAssets || {});
    setStoryItems(normalizeStoryItemsForEditor(metadata));
    setCarousel(metadata.carousel || { enabled: false, slides: [] });
    setTargetFacebook((source.targetPlatforms || []).includes("FACEBOOK"));
    setTargetInstagram((source.targetPlatforms || []).includes("INSTAGRAM"));
    setSelectedPageId(metadata.publisherPageId || connectionStatus.data?.selectedPageId || connectionStatus.data?.pageId || "");
    setScheduledFor(toDateTimeLocal(source.scheduledFor));
    setHeadline(metadata.headline || "");
    setCta(metadata.cta || "");
    setHashtags(metadata.hashtags || "");
    setLinkUrl(metadata.linkUrl || "");
    setFirstComment(metadata.firstComment || "");
    setAltText(metadata.altText || "");
    setBrandSignature(metadata.brandSignature || "");
    setSelectedBrandKitId(metadata.brandKitId || "");
    setWizardStep(0);
  }

  function resetEditor() {
    setActiveTab("composer");
    setSelectedId(null);
    setCaption("");
    setTemplate("");
    setTone(DEFAULT_SOCIAL_TONE);
    setScheduledFor("");
    setTargetFacebook(true);
    setTargetInstagram(true);
    setSelectedPageId(connectionStatus.data?.selectedPageId || connectionStatus.data?.pageId || managedPages[0]?.id || "");
    setHeadline("");
    setCta("");
    setHashtags("");
    setLinkUrl("");
    setFirstComment("");
    setAltText("");
    setBrandSignature("");
    setSelectedBrandKitId("");
    setWizardStep(0);
    setPlacements(["FEED"]);
    setFeedFormat("SQUARE");
    setFeedFormats({ FACEBOOK: "LANDSCAPE", INSTAGRAM: "PORTRAIT" });
    setPlacementAssets({});
    setPlatformAssets({});
    setStoryItems([]);
    setCarousel({ enabled: false, slides: [] });
  }

  const isBusy =
    createDraft.isPending ||
    updateDraft.isPending ||
    updateQueuedPost.isPending ||
    submitApproval.isPending ||
    approveAndSchedule.isPending ||
    rejectPost.isPending ||
    retryFailed.isPending ||
    cancelScheduled.isPending ||
    deletePosts.isPending ||
    publishDuePosts.isPending ||
    publishPostNow.isPending;

  const showPreviewPanel = wizardStep >= 3;

  return (
    <div className="app-page space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Social Planner</h1>
          <p className="text-sm text-muted-foreground">Maak en plan posts voor Facebook & Instagram.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stats.pending > 0 ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => {
                setStatusFilter("PENDING_APPROVAL");
                handleTabChange("queue");
              }}
            >
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              {stats.pending} approval
            </Button>
          ) : null}
          {stats.scheduled > 0 ? (
            <Button size="sm" variant="outline" className="h-8" onClick={() => handleTabChange("agenda")}>
              <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
              {stats.scheduled} gepland
            </Button>
          ) : null}
          {stats.failed > 0 ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-rose-200 text-rose-700"
              onClick={() => {
                setStatusFilter("FAILED");
                handleTabChange("queue");
              }}
            >
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
              {stats.failed} fout
            </Button>
          ) : null}
          <Button size="sm" variant="outline" className="h-8" onClick={resetEditor}>
            Nieuw
          </Button>
          <Badge variant={connectionStatus.data?.connected && !metaPublishIssue ? "success" : "warning"}>
            {!connectionStatus.data?.connected ? "Meta uit" : metaPublishIssue ? "Meta actie nodig" : "Meta OK"}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList
          aria-label="Social Planner secties"
          className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl border bg-muted/40 p-1"
        >
          <TabsTrigger
            value="composer"
            className="gap-2 rounded-lg px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Wand2 className="h-4 w-4 opacity-70" />
            Composer
          </TabsTrigger>
          <TabsTrigger
            value="agenda"
            className="gap-2 rounded-lg px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <CalendarDays className="h-4 w-4 opacity-70" />
            Agenda
            {stats.scheduled > 0 ? (
              <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5 text-[10px]">
                {stats.scheduled}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger
            value="queue"
            className="gap-2 rounded-lg px-3 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Megaphone className="h-4 w-4 opacity-70" />
            Queue
            {rows.length > 0 ? (
              <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5 text-[10px]">
                {rows.length}
              </Badge>
            ) : null}
            {stats.failed > 0 ? <Badge variant="warning" className="h-5 px-1.5 text-[10px]">{stats.failed} fout</Badge> : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="composer" className="mt-0 space-y-3">
      {!connectionStatus.isLoading && !connectionStatus.data?.connected ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-sm dark:bg-amber-950/25">
          <span className="text-amber-950/90 dark:text-amber-100">Meta niet gekoppeld.</span>
          <Button size="sm" variant="outline" asChild>
            <Link href="/settings/integrations">Koppelen</Link>
          </Button>
        </div>
      ) : metaPublishIssue ? (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-950/90 dark:bg-amber-950/25 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
          <span>
            <strong>{metaPublishIssue.title}.</strong> {metaPublishIssue.description}
          </span>
          <Button size="sm" variant="outline" asChild>
            <Link href="/settings/integrations?tab=meta">Integraties</Link>
          </Button>
        </div>
      ) : canSchedule && overdueScheduledCount > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-violet-200/70 bg-violet-50/80 px-3 py-2 text-sm dark:bg-violet-950/25">
          <span>{overdueScheduledCount} post{overdueScheduledCount === 1 ? "" : "s"} wacht op publicatie</span>
          <Button size="sm" variant="outline" disabled={publishDuePosts.isPending} onClick={() => publishDuePosts.mutate()}>
            {publishDuePosts.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />}
            Nu publiceren
          </Button>
        </div>
      ) : null}
      <div
        className={cn(
          "grid gap-4",
          showPreviewPanel && "xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]",
        )}
      >
        <div className="space-y-3">
          <Card className="border-border/70 shadow-sm">
            <CardContent className="space-y-3 pt-5">
              <SocialBrandKitPickerProvider
                selectedKitId={selectedBrandKitId}
                onSelectedKitIdChange={setSelectedBrandKitId}
                onApplyKit={applyBrandKitDefaults}
                kits={(brandKitsQuery.data?.kits ?? []) as any}
                kitsLoading={brandKitsQuery.isLoading}
                autoApplyDefaults={!selectedId}
              >
              <SocialComposerWizard
                steps={SOCIAL_WIZARD_STEPS}
                currentStep={wizardStep}
                onStepChange={setWizardStep}
                canProceed={canProceedWizardStep(wizardStep)}
                onNext={goToNextWizardStep}
                onBack={() => setWizardStep((current) => Math.max(current - 1, 0))}
                disabled={!canEditSelected}
                footer={
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button onClick={handleCreateOrUpdate} disabled={isBusy || !canEditSelected}>
                      {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {selected ? "Draft opslaan" : "Draft aanmaken"}
                    </Button>
                    {selected ? (
                      <Button variant="outline" disabled={isBusy || selected.status === "PENDING_APPROVAL"} onClick={handleSubmitForApproval}>
                        <Send className="mr-2 h-4 w-4" /> Ter goedkeuring
                      </Button>
                    ) : (
                      <Button variant="outline" disabled={isBusy || !canEditSelected} onClick={handleCreateAndSubmit}>
                        <Send className="mr-2 h-4 w-4" /> Opslaan & ter goedkeuring
                      </Button>
                    )}
                  </div>
                }
              >
                <div className={cn(wizardStep !== 0 && "hidden")}>
                  <SocialPublishAccountPicker
                    pages={managedPages}
                    selectedPageId={selectedPageId}
                    onSelectedPageIdChange={setSelectedPageId}
                    selectedPage={selectedManagedPage}
                    targetFacebook={targetFacebook}
                    onTargetFacebookChange={setTargetFacebook}
                    targetInstagram={targetInstagram}
                    onTargetInstagramChange={setTargetInstagram}
                    disabled={!canEditSelected}
                    isLoading={connectionStatus.isLoading}
                  />
                </div>

                <div className={cn(wizardStep !== 1 && "hidden")}>
                  <SocialBrandKitPicker disabled={!canEditSelected} />
                </div>

                <div className={cn(wizardStep !== 2 && "hidden")}>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="social-caption">Caption</Label>
                      <Textarea
                        id="social-caption"
                        disabled={!canEditSelected}
                        value={caption}
                        onChange={(event) => setCaption(event.target.value)}
                        rows={5}
                        placeholder="Schrijf je posttekst..."
                      />
                      <p className="text-xs text-muted-foreground">{caption.length}/6000</p>
                    </div>
                    <SocialComposerSection
                      title="AI-caption"
                      description="Optioneel — beschrijf het onderwerp en genereer een tekst."
                      icon={Sparkles}
                      defaultOpen={false}
                    >
                      <Textarea
                        id="social-template"
                        value={template}
                        onChange={(event) => setTemplate(event.target.value)}
                        placeholder="Bijv. gratis intake voor KMO's in juni..."
                        rows={2}
                        disabled={!canEditSelected}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Select value={tone} onValueChange={(value) => setTone(value as SocialTone)} disabled={!canEditSelected}>
                          <SelectTrigger className="h-9 w-full sm:w-[200px]">
                            <SelectValue placeholder="Tone" />
                          </SelectTrigger>
                          <SelectContent>
                            {SOCIAL_TONE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={generateSuggestion.isPending || !template.trim() || !canEditSelected}
                          onClick={() =>
                            generateSuggestion.mutate({
                              template: template.trim(),
                              tone,
                              brandKitId: selectedBrandKitId || undefined,
                            })
                          }
                        >
                          {generateSuggestion.isPending ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 h-3 w-3" />
                          )}
                          Genereren
                        </Button>
                      </div>
                    </SocialComposerSection>
                  </div>
                </div>

                <div className={cn(wizardStep !== 3 && "hidden")}>
                  <div className="space-y-4">
                    <SocialPlacementEditor
                      placements={placements}
                      feedFormat={feedFormat}
                      feedFormats={resolvedFeedFormats}
                      assets={placementAssets}
                      platformAssets={platformAssets}
                      carousel={carousel}
                      storyItems={storyItems}
                      disabled={!canEditSelected}
                      targetFacebook={targetFacebook}
                      targetInstagram={targetInstagram}
                      onPlacementsChange={setPlacements}
                      onFeedFormatChange={setFeedFormat}
                      onFeedFormatsChange={setFeedFormats}
                      onAssetsChange={setPlacementAssets}
                      onPlatformAssetsChange={setPlatformAssets}
                      onCarouselChange={setCarousel}
                      onStoryItemsChange={setStoryItems}
                    />
                    <SocialImageGenerator
                      disabled={!canEditSelected}
                      caption={caption}
                      template={template}
                      feedFormat={feedFormat}
                      placements={placements}
                      carouselEnabled={carousel.enabled}
                      socialPostId={selectedId ?? undefined}
                      brandKitId={selectedBrandKitId || undefined}
                      onImageReady={(assets) => {
                        const feedImage = assets.FEED?.imageUrl?.trim();
                        if (carousel.enabled && feedImage) {
                          setCarousel((current) => applyCarouselImage(current, feedImage));
                          return;
                        }
                        setPlacementAssets((current) => ({ ...current, ...assets }));
                      }}
                    />
                  </div>
                </div>

                <div className={cn(wizardStep !== 4 && "hidden")}>
                  <div className="space-y-3">
                    <div className="rounded-lg border bg-muted/10 px-3 py-2.5 text-sm">
                      <p className="font-medium">{selectedManagedPage?.name || "Geen pagina"}</p>
                      <p className="text-xs text-muted-foreground">
                        {[targetFacebook ? "Facebook" : null, targetInstagram ? "Instagram" : null].filter(Boolean).join(" + ") || "—"}
                        {" · "}
                        {selectedBrandKitName}
                        {" · "}
                        {carousel.enabled
                          ? `Multi-upload (${carousel.slides.length} items)`
                          : placements.join(", ") || "geen formaat"}
                      </p>
                      <p className="mt-2 line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">{caption || "Geen caption"}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="social-hashtags">Hashtags</Label>
                      <HashtagField id="social-hashtags" disabled={!canEditSelected} value={hashtags} onChange={setHashtags} />
                    </div>
                    <SocialComposerSection
                      title="Extra velden"
                      description="Link, CTA, headline — alleen als je ze nodig hebt."
                      icon={Settings2}
                      defaultOpen={Boolean(linkUrl.trim() || headline.trim() || cta.trim())}
                    >
                      <div className="space-y-2">
                        <Label htmlFor="social-link">Link</Label>
                        <div className="relative">
                          <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="social-link"
                            disabled={!canEditSelected}
                            className="pl-9"
                            value={linkUrl}
                            onChange={(event) => setLinkUrl(event.target.value)}
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="social-headline">Headline / hook</Label>
                        <Input
                          id="social-headline"
                          disabled={!canEditSelected}
                          value={headline}
                          onChange={(event) => setHeadline(event.target.value)}
                          placeholder="Optioneel"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="social-cta">CTA</Label>
                          <Input id="social-cta" disabled={!canEditSelected} value={cta} onChange={(event) => setCta(event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="social-brand-signature">Brand signature</Label>
                          <Input
                            id="social-brand-signature"
                            disabled={!canEditSelected}
                            value={brandSignature}
                            onChange={(event) => setBrandSignature(event.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="social-alt-text">Interne notitie</Label>
                        <Textarea
                          id="social-alt-text"
                          disabled={!canEditSelected}
                          value={altText}
                          onChange={(event) => setAltText(event.target.value)}
                          rows={2}
                        />
                      </div>
                    </SocialComposerSection>

                    {selected && canSchedule ? (
                      <div className="space-y-2 rounded-lg border border-emerald-200/60 bg-emerald-500/5 p-3">
                        <Label htmlFor="social-scheduled-for" className="text-xs">Publicatiedatum</Label>
                        <Input id="social-scheduled-for" type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} />
                        <div className="flex flex-wrap gap-2">
                          {selected.status === "SCHEDULED" ? (
                            <>
                              <Button size="sm" disabled={isBusy || !scheduledFor} onClick={handleApproveAndSchedule}>
                                <Clock3 className="mr-2 h-3.5 w-3.5" /> Datum wijzigen
                              </Button>
                              <Button size="sm" variant="outline" disabled={isBusy} onClick={() => cancelScheduled.mutate({ id: selected.id })}>
                                Annuleren
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" disabled={isBusy || !scheduledFor} onClick={handleApproveAndSchedule}>
                                <Clock3 className="mr-2 h-3.5 w-3.5" /> Goedkeuren & plannen
                              </Button>
                              {selected.status === "PENDING_APPROVAL" ? (
                                <Button size="sm" variant="outline" disabled={isBusy} onClick={() => rejectPost.mutate({ id: selected.id })}>
                                  Afkeuren
                                </Button>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                    ) : selected && !canSchedule ? (
                      <p className="text-xs text-muted-foreground">Status: {selected.status}. Een beheerder plant deze post in.</p>
                    ) : null}
                  </div>
                </div>
              </SocialComposerWizard>
              </SocialBrandKitPickerProvider>
            </CardContent>
          </Card>
        </div>

        {showPreviewPanel ? (
        <div className="xl:sticky xl:top-5 xl:self-start">
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-sm"><Eye className="h-3.5 w-3.5" /> Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              {previewSlides.length > 0 ? (
                <>
                  {previewSlides.length > 1 ? (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => goToPreviewSlide(previewSlideIndex - 1)}
                        aria-label="Vorige preview"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5">
                        {previewSlides.map((slide, index) => (
                          <button
                            key={slide.id}
                            type="button"
                            onClick={() => setPreviewSlideIndex(index)}
                            className={cn(
                              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition",
                              index === previewSlideIndex
                                ? "border-amber-500 bg-amber-500 text-white shadow-sm"
                                : "border-border bg-background hover:border-amber-300",
                            )}
                          >
                            {slide.label}
                          </button>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => goToPreviewSlide(previewSlideIndex + 1)}
                        aria-label="Volgende preview"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}

                  {activePreviewSlide ? (
                    <div className="space-y-2">
                      {activePreviewSlide.id === "reel" ? (
                        <InstagramReelPreview
                          caption={previewCaption}
                          imageUrl={activePreviewSlide.imageUrl}
                          videoUrl={activePreviewSlide.videoUrl}
                          username={previewInstagramUsername}
                        />
                      ) : (() => {
                        const showFacebookPreview = targetFacebook && activePreviewSlide.platform !== "INSTAGRAM";
                        const showInstagramPreview = targetInstagram && activePreviewSlide.platform !== "FACEBOOK";
                        const showBoth = showFacebookPreview && showInstagramPreview;
                        const isStorySlide = activePreviewSlide.format === "STORY";
                        return (
                          <div
                            className={cn(
                              "grid gap-4 grid-cols-1",
                              showBoth && isStorySlide && "xl:grid-cols-2",
                              showBoth && !isStorySlide && "2xl:grid-cols-2",
                            )}
                          >
                          {showFacebookPreview ? (
                            <FacebookPreview
                              caption={activePreviewSlide.id.startsWith("story_") ? "" : previewCaption}
                              imageUrl={activePreviewSlide.imageUrl}
                              videoUrl={activePreviewSlide.videoUrl}
                              format={
                                activePreviewSlide.id === "FEED" || activePreviewSlide.id.startsWith("carousel_")
                                  ? resolvedFeedFormats.FACEBOOK
                                  : activePreviewSlide.format
                              }
                              pageName={previewPageName}
                            />
                          ) : null}
                          {showInstagramPreview ? (
                            activePreviewSlide.id.startsWith("story_") ? (
                              <InstagramPreview
                                caption=""
                                imageUrl={activePreviewSlide.imageUrl}
                                videoUrl={activePreviewSlide.videoUrl}
                                firstComment={firstComment}
                                format="STORY"
                                username={previewInstagramUsername}
                              />
                            ) : (
                              <InstagramPreview
                                caption={previewCaption}
                                imageUrl={activePreviewSlide.imageUrl}
                                videoUrl={activePreviewSlide.videoUrl}
                                firstComment={firstComment}
                                format={
                                  activePreviewSlide.id === "FEED" || activePreviewSlide.id.startsWith("carousel_")
                                    ? resolvedFeedFormats.INSTAGRAM
                                    : activePreviewSlide.format
                                }
                                username={previewInstagramUsername}
                              />
                            )
                          ) : null}
                          </div>
                        );
                      })()}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-xs text-muted-foreground">
                  <ImageIcon className="mx-auto mb-2 h-6 w-6 opacity-40" />
                  Voeg media toe om de preview te zien.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        ) : null}
      </div>
        </TabsContent>

        <TabsContent value="agenda" className="mt-0">
          {activeTab === "agenda" ? (
            <SocialAgenda
              canReschedule={canSchedule}
              autopostEnabled={connectionStatus.data?.autopostEnabled ?? false}
              onProcessQueue={canSchedule ? () => publishDuePosts.mutate() : undefined}
              processQueuePending={publishDuePosts.isPending}
              onSelectPost={openAgendaPost}
              onPlanNew={planPostForDate}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="queue" className="mt-0">
          {activeTab === "queue" ? (
            <SocialQueuePanel
              rows={rows}
              isLoading={listQuery.isLoading}
              statusFilter={statusFilter}
              selectedId={selectedId}
              onStatusFilterChange={setStatusFilter}
              onOpenAgenda={() => handleTabChange("agenda")}
              onOpenComposer={() => handleTabChange("composer")}
              onOpenRow={loadRow}
              onRetry={(rowId) => retryFailed.mutate({ id: rowId })}
              onPublishNow={(rowId) => {
                if (publishPostNow.isPending || publishingPostId) return;
                setPublishingPostId(rowId);
                publishPostNow.mutate({ id: rowId });
              }}
              publishingPostId={publishingPostId}
              onCancel={(rowId) => cancelScheduled.mutate({ id: rowId })}
              onDeletePosts={(input) => deletePosts.mutate(input)}
              isDeleting={deletePosts.isPending}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
