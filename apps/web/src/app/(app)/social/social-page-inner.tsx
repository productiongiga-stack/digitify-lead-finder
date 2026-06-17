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
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
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
  CheckCircle2,
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
  resolvePrimaryImageFromAssets,
  type FeedAspectFormat,
  type PlacementAssets,
  type SocialPlacement,
} from "@/components/social/social-placement-editor";
import {
  applyCarouselImage,
  applyCarouselVideo,
  type SocialCarouselState,
} from "@/components/social/social-carousel-editor";
import { persistCarouselAssets, persistPlacementAssets } from "@/lib/persist-social-assets";
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
type RowStatus = "DRAFT" | "PENDING_APPROVAL" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "CANCELLED";
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
  publisherPageId?: string;
  publisherPageName?: string;
  publisherInstagramUsername?: string;
  assets?: PlacementAssets;
  carousel?: SocialCarouselState;
};

type ManagedMetaPage = {
  id: string;
  name: string;
  accessToken: string;
  instagramBusinessId: string;
  instagramUsername: string;
};

const FORMAT_OPTIONS: Array<{ value: PostFormat; label: string; description: string; className: string; ratio: number }> = [
  { value: "SQUARE", label: "Square", description: "1:1 · veilig voor FB + IG", className: "aspect-square", ratio: 1 },
  { value: "PORTRAIT", label: "Portrait", description: "4:5 · sterk voor IG feed", className: "aspect-[4/5]", ratio: 4 / 5 },
  { value: "LANDSCAPE", label: "Landscape", description: "1.91:1 · breed beeld", className: "aspect-[1.91/1]", ratio: 1.91 },
  { value: "STORY", label: "Story", description: "9:16 · FB + IG Stories", className: "aspect-[9/16]", ratio: 9 / 16 },
];


function statusBadge(status: RowStatus) {
  if (status === "PUBLISHED") return <Badge variant="success">Gepubliceerd</Badge>;
  if (status === "FAILED") return <Badge variant="warning">Mislukt</Badge>;
  if (status === "SCHEDULED") return <Badge variant="info">Ingepland</Badge>;
  if (status === "PENDING_APPROVAL") return <Badge variant="warning">Wacht op goedkeuring</Badge>;
  if (status === "PUBLISHING") return <Badge variant="secondary">Publiceren...</Badge>;
  if (status === "CANCELLED") return <Badge variant="outline">Geannuleerd</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

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

function prettyDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = new Date(value);
  return date.toLocaleString("nl-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function explainMetaError(message: string) {
  if (/story|stories|9:16/i.test(message)) {
    return {
      title: "Story-afbeelding ongeldig",
      description:
        "Stories werken het veiligst met een verticale 9:16-afbeelding. Gebruik bij voorkeur 1080x1920 en een publieke JPG/PNG/WebP URL.",
    };
  }
  if (/2207009|36003|aspect ratio|afbeeldingsverhouding/i.test(message)) {
    return {
      title: "Afbeeldingsratio ongeldig",
      description:
        "Instagram feed accepteert geen extreem brede of hoge beelden. Gebruik bij voorkeur 1080x1080, 1080x1350 of een ratio tussen 4:5 en 1.91:1.",
    };
  }
  if (/190|token|OAuth/i.test(message)) {
    return {
      title: "Meta token of rechten verlopen",
      description: "Koppel Meta opnieuw via Integraties en controleer of de app de juiste Pages/Instagram publishing scopes heeft.",
    };
  }
  if (/permission|pages_manage_posts|instagram_content_publish|scope/i.test(message)) {
    return {
      title: "Ontbrekende Meta-permissie",
      description: "Controleer in Meta App Review of publishing rechten zijn toegekend en zet de app live wanneer externe users publiceren.",
    };
  }
  return { title: "Publicatiefout", description: "Bekijk de technische details hieronder en probeer daarna opnieuw." };
}

type PreviewSlide = {
  id: string;
  label: string;
  subtitle: string;
  format: PostFormat;
  imageUrl: string;
  videoUrl?: string;
};

function buildPreviewSlides(
  placements: SocialPlacement[],
  feedFormat: FeedAspectFormat,
  assets: PlacementAssets,
  carousel: SocialCarouselState,
): PreviewSlide[] {
  const slides: PreviewSlide[] = [];

  if (placements.includes("FEED")) {
    if (carousel.enabled && carousel.slides.length > 0) {
      carousel.slides.forEach((slide, index) => {
        const imageUrl = slide.mediaType === "IMAGE" ? slide.imageUrl?.trim() || "" : "";
        const videoUrl = slide.mediaType === "VIDEO" ? slide.videoUrl?.trim() || "" : "";
        if (!imageUrl && !videoUrl) return;
        slides.push({
          id: `carousel_${slide.id}`,
          label: `Carousel ${index + 1}`,
          subtitle: slide.mediaType === "VIDEO" ? "Video-slide" : "Foto-slide",
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
    const imageUrl = assets.STORY?.imageUrl?.trim() || "";
    if (imageUrl) {
      slides.push({
        id: "story",
        label: "Story",
        subtitle: "9:16 · FB + IG Stories",
        format: "STORY",
        imageUrl,
      });
    }
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
        // eslint-disable-next-line @next/next/no-img-element
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
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Facebook Story preview" className="h-full w-full object-cover" />
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
          Tekst/CTA uit de composer blijft intern als reviewtekst. Meta Stories publiceren in v1 alleen de afbeelding.
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
          // eslint-disable-next-line @next/next/no-img-element
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
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Instagram Story preview" className="h-full w-full object-cover" />
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
          Stories ondersteunen geen gewone feed-caption. Voeg tekst visueel toe in de afbeelding zelf.
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
          // eslint-disable-next-line @next/next/no-img-element
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
  const [placementAssets, setPlacementAssets] = useState<PlacementAssets>({});
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

  const imageUrl = useMemo(
    () => resolvePrimaryImageFromAssets(placementAssets, carousel),
    [carousel, placementAssets],
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
      publisherPageId: selectedPageId || undefined,
      publisherPageName: selectedManagedPage?.name || undefined,
      publisherInstagramUsername: selectedManagedPage?.instagramUsername || undefined,
      assets: placementAssets,
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
      placements,
      previewFormat,
      selectedManagedPage?.instagramUsername,
      selectedManagedPage?.name,
      selectedPageId,
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
    () => buildPreviewSlides(placements, feedFormat, placementAssets, carousel),
    [carousel, feedFormat, placementAssets, placements],
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
      if (placements.includes("FEED") && !isFeedMediaReady(placementAssets, carousel)) return false;
      if (placements.includes("STORY") && !placementAssets.STORY?.imageUrl?.trim()) return false;
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

    if (placements.includes("FEED") && !isFeedMediaReady(placementAssets, carousel)) {
      showToast({
        title: carousel.enabled ? "Carousel onvolledig" : "Feed-media ontbreekt",
        description: carousel.enabled
          ? "Voeg minstens 2 slides toe met foto of video."
          : "Voeg een feed-foto of -video toe, of schakel carousel in.",
        variant: "error",
      });
      return false;
    }
    if (placements.includes("STORY") && !placementAssets.STORY?.imageUrl?.trim()) {
      showToast({ title: "Story-afbeelding ontbreekt", variant: "error" });
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
      carousel.slides.some((slide) => slide.mediaType === "VIDEO" && slide.videoUrl && !/^https:\/\//i.test(slide.videoUrl))
    ) {
      showToast({
        title: "Carousel-video moet publiek zijn",
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
      !/^https:\/\//i.test(placementAssets.FEED.videoUrl)
    ) {
      showToast({
        title: "Feed-video moet publiek zijn",
        description: "Gebruik een publieke https-MP4-URL of upload via Vercel Blob.",
        variant: "error",
      });
      return false;
    }

    if (requireInstagramSafe && placements.includes("REEL") && !/^https:\/\//i.test(placementAssets.REEL?.videoUrl || "")) {
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
        storyUsesFeedImage:
          placements.includes("STORY") &&
          placements.includes("FEED") &&
          !carousel.enabled &&
          Boolean(placementAssets.FEED?.imageUrl?.trim()) &&
          (placementAssets.STORY?.imageUrl?.trim() === placementAssets.FEED?.imageUrl?.trim() ||
            !placementAssets.STORY?.imageUrl?.trim()),
      });
      const persistedCarousel = await persistCarouselAssets(carousel);
      if (JSON.stringify(persistedAssets) !== JSON.stringify(placementAssets)) {
        setPlacementAssets(persistedAssets);
      }
      if (JSON.stringify(persistedCarousel) !== JSON.stringify(carousel)) {
        setCarousel(persistedCarousel);
      }

      const persistedImageUrl = resolvePrimaryImageFromAssets(persistedAssets, persistedCarousel);
      const persistedMetadata: SocialMetadata = {
        ...metadataPayload,
        assets: persistedAssets,
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
    if (!ensureEditorReady({ requireInstagramSafe: true })) return;
    if (canEditSelected) {
      await saveDraft();
    }
    await submitApproval.mutateAsync({ id: selected.id });
  }

  async function handleCreateAndSubmit() {
    if (!ensureEditorReady({ requireInstagramSafe: true })) return;
    const saved = await saveDraft();
    const postId = saved && typeof saved === "object" && "id" in saved ? String((saved as { id: string }).id) : selected?.id;
    if (!postId) return;
    await submitApproval.mutateAsync({ id: postId });
  }

  async function handleApproveAndSchedule() {
    if (!selected || !scheduledFor) return;
    if (!ensureEditorReady({ requireInstagramSafe: true })) return;
    if (canEditSelected) {
      await saveDraft();
    }
    await approveAndSchedule.mutateAsync({ id: selected.id, scheduledFor: new Date(scheduledFor) });
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
    setPlacementAssets(metadata.assets || {});
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
    setPlacementAssets({});
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
          <Badge variant={connectionStatus.data?.connected ? "success" : "warning"}>
            {connectionStatus.data?.connected ? "Meta OK" : "Meta uit"}
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
                      assets={placementAssets}
                      carousel={carousel}
                      disabled={!canEditSelected}
                      targetInstagram={targetInstagram}
                      onPlacementsChange={setPlacements}
                      onFeedFormatChange={setFeedFormat}
                      onAssetsChange={setPlacementAssets}
                      onCarouselChange={setCarousel}
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
                          ? `Carousel (${carousel.slides.length} slides)`
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
                      ) : (
                        <div
                          className={cn(
                            "grid gap-4 grid-cols-1",
                            targetFacebook && targetInstagram && activePreviewSlide.format === "STORY" && "xl:grid-cols-2",
                            targetFacebook && targetInstagram && activePreviewSlide.format !== "STORY" && "2xl:grid-cols-2",
                          )}
                        >
                          {targetFacebook ? (
                            <FacebookPreview
                              caption={activePreviewSlide.id === "story" ? "" : previewCaption}
                              imageUrl={activePreviewSlide.imageUrl}
                              videoUrl={activePreviewSlide.videoUrl}
                              format={activePreviewSlide.format}
                              pageName={previewPageName}
                            />
                          ) : null}
                          {targetInstagram ? (
                            activePreviewSlide.id === "story" ? (
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
                                format={activePreviewSlide.format}
                                username={previewInstagramUsername}
                              />
                            )
                          ) : null}
                        </div>
                      )}
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
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
