"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
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
import type { LucideIcon } from "lucide-react";
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
  Palette,
  RefreshCcw,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  Wand2,
  X,
  XCircle,
} from "lucide-react";
import { useToast } from "@/components/feedback/toast-provider";
import {
  resolvePrimaryImageFromAssets,
  SocialPlacementEditor,
  type FeedAspectFormat,
  type PlacementAssets,
  type SocialPlacement,
} from "@/components/social/social-placement-editor";
import { persistPlacementAssets } from "@/lib/persist-social-assets";
import { FacebookPageAvatar, InstagramPageAvatar } from "@/components/social/social-platform-avatars";
import { SocialBrandKitPicker, type SocialBrandKitApplyPayload } from "@/components/social/social-brand-kit-picker";
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
};

type ManagedMetaPage = {
  id: string;
  name: string;
  accessToken: string;
  instagramBusinessId: string;
  instagramUsername: string;
};

const FORMAT_OPTIONS: Array<{ value: PostFormat; label: string; description: string; className: string }> = [
  { value: "SQUARE", label: "Square", description: "1:1 · veilig voor FB + IG", className: "aspect-square" },
  { value: "PORTRAIT", label: "Portrait", description: "4:5 · sterk voor IG feed", className: "aspect-[4/5]" },
  { value: "LANDSCAPE", label: "Landscape", description: "1.91:1 · breed beeld", className: "aspect-[1.91/1]" },
  { value: "STORY", label: "Story", description: "9:16 · FB + IG Stories", className: "aspect-[9/16]" },
];

const SOCIAL_TONE_OPTIONS = [
  {
    value: "warm en professioneel",
    label: "Warm & professioneel",
    description: "Vertrouwd en toegankelijk — ideaal voor B2B en KMO",
  },
  {
    value: "kort en krachtig",
    label: "Kort & krachtig",
    description: "Punchy hooks, weinig woorden, sterke CTA",
  },
  {
    value: "vriendelijk en toegankelijk",
    label: "Vriendelijk & toegankelijk",
    description: "Menselijk, laagdrempelig en conversationeel",
  },
  {
    value: "zakelijk en betrouwbaar",
    label: "Zakelijk & betrouwbaar",
    description: "Formeel, geloofwaardig en resultaatgericht",
  },
  {
    value: "inspirerend en motiverend",
    label: "Inspirerend & motiverend",
    description: "Energiek, positief en forward-looking",
  },
  {
    value: "speels en creatief",
    label: "Speels & creatief",
    description: "Luchtig, onderscheidend en social-first",
  },
  {
    value: "direct en actiegericht",
    label: "Direct & actiegericht",
    description: "Geen omwegen — focus op actie en conversie",
  },
  {
    value: "premium en exclusief",
    label: "Premium & exclusief",
    description: "Verfijnd, high-end en selectief",
  },
  {
    value: "educatief en informatief",
    label: "Educatief & informatief",
    description: "Tips, uitleg en thought leadership",
  },
  {
    value: "lokaal en persoonlijk",
    label: "Lokaal & persoonlijk",
    description: "Belgisch, nabij en community-gevoel",
  },
] as const;

type SocialTone = (typeof SOCIAL_TONE_OPTIONS)[number]["value"];

const DEFAULT_SOCIAL_TONE: SocialTone = "warm en professioneel";

function statusBadge(status: RowStatus) {
  if (status === "PUBLISHED") return <Badge variant="success">Gepubliceerd</Badge>;
  if (status === "FAILED") return <Badge variant="warning">Mislukt</Badge>;
  if (status === "SCHEDULED") return <Badge variant="info">Ingepland</Badge>;
  if (status === "PENDING_APPROVAL") return <Badge variant="warning">Wacht op goedkeuring</Badge>;
  if (status === "PUBLISHING") return <Badge variant="secondary">Publiceren...</Badge>;
  if (status === "CANCELLED") return <Badge variant="outline">Geannuleerd</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
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

type SocialHeroStatTone = "amber" | "emerald" | "rose";

const SOCIAL_HERO_STAT_TONES: Record<
  SocialHeroStatTone,
  { shell: string; icon: string; value: string; active: string }
> = {
  amber: {
    shell:
      "border-amber-200/80 bg-gradient-to-br from-amber-50/95 via-white/80 to-white/60 dark:border-amber-500/25 dark:from-amber-950/50 dark:via-white/5 dark:to-transparent",
    icon: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    value: "text-amber-800 dark:text-amber-200",
    active: "ring-amber-400/40 shadow-[0_8px_24px_rgba(245,158,11,0.18)]",
  },
  emerald: {
    shell:
      "border-emerald-200/80 bg-gradient-to-br from-emerald-50/95 via-white/80 to-white/60 dark:border-emerald-500/25 dark:from-emerald-950/50 dark:via-white/5 dark:to-transparent",
    icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    value: "text-emerald-800 dark:text-emerald-200",
    active: "ring-emerald-400/40 shadow-[0_8px_24px_rgba(16,185,129,0.18)]",
  },
  rose: {
    shell:
      "border-rose-200/80 bg-gradient-to-br from-rose-50/95 via-white/80 to-white/60 dark:border-rose-500/25 dark:from-rose-950/50 dark:via-white/5 dark:to-transparent",
    icon: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    value: "text-rose-800 dark:text-rose-200",
    active: "ring-rose-400/40 shadow-[0_8px_24px_rgba(244,63,94,0.18)]",
  },
};

function SocialHeroStat({
  label,
  value,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: SocialHeroStatTone;
  onClick?: () => void;
}) {
  const styles = SOCIAL_HERO_STAT_TONES[tone];
  const isActive = value > 0;
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group flex min-w-0 flex-1 flex-col gap-2 rounded-2xl border p-3 text-left shadow-sm backdrop-blur transition-all duration-200",
        styles.shell,
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:translate-y-0",
        isActive && `ring-1 ${styles.active}`,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
            styles.icon,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className={cn("text-2xl font-bold tabular-nums leading-none tracking-tight", styles.value)}>
          {value}
        </span>
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
    </Wrapper>
  );
}

type PreviewSlide = {
  id: SocialPlacement;
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
): PreviewSlide[] {
  const slides: PreviewSlide[] = [];

  if (placements.includes("FEED")) {
    const imageUrl = assets.FEED?.imageUrl?.trim() || "";
    if (imageUrl) {
      const feedOption = FORMAT_OPTIONS.find((item) => item.value === feedFormat);
      slides.push({
        id: "FEED",
        label: "Feed post",
        subtitle: feedOption?.description || "Feed",
        format: feedFormat,
        imageUrl,
      });
    }
  }

  if (placements.includes("STORY")) {
    const imageUrl = assets.STORY?.imageUrl?.trim() || "";
    if (imageUrl) {
      slides.push({
        id: "STORY",
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
        id: "REEL",
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
    <div className="overflow-hidden rounded-[1.6rem] border border-zinc-200 bg-zinc-950 text-white shadow-[0_22px_55px_rgba(24,24,27,0.18)]">
      <div className="relative mx-auto aspect-[9/16] max-h-[560px] bg-zinc-900">
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
    </div>
  );
}

function FacebookPreview({
  caption,
  imageUrl,
  format,
  pageName = "Digitify",
}: {
  caption: string;
  imageUrl: string;
  format: PostFormat;
  pageName?: string;
}) {
  if (format === "STORY") {
    return (
      <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-slate-950 text-white shadow-[0_22px_55px_rgba(15,23,42,0.18)]">
        <div className="relative mx-auto aspect-[9/16] max-h-[560px] bg-slate-900">
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
      <div className="bg-slate-100">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Facebook preview" className="max-h-[420px] w-full object-cover" />
        ) : (
          <div className="flex aspect-[1.91/1] items-center justify-center text-sm text-slate-500">
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
  firstComment,
  format,
  username = "digitify.be",
}: {
  caption: string;
  imageUrl: string;
  firstComment: string;
  format: PostFormat;
  username?: string;
}) {
  const displayUsername = username.replace(/^@/, "");
  const formatClass = FORMAT_OPTIONS.find((item) => item.value === format)?.className || "aspect-square";
  if (format === "STORY") {
    return (
      <div className="overflow-hidden rounded-[1.6rem] border border-zinc-200 bg-zinc-950 text-white shadow-[0_22px_55px_rgba(24,24,27,0.18)]">
        <div className="relative mx-auto aspect-[9/16] max-h-[560px] bg-zinc-900">
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
      <div className={cn("bg-zinc-100", formatClass)}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Instagram preview" className="h-full w-full object-cover" />
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
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
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);
  const [selectedPageId, setSelectedPageId] = useState("");

  const listQuery = trpc.social.list.useQuery(
    statusFilter === "ALL" ? undefined : { status: statusFilter as any },
    { refetchInterval: 20_000 },
  );
  const connectionStatus = trpc.social.connectionStatus.useQuery();
  const managedPagesQuery = trpc.social.listManagedPages.useQuery(undefined, {
    enabled: Boolean(connectionStatus.data?.connected),
  });
  const managedPages = useMemo(
    () => (managedPagesQuery.data?.pages ?? []) as ManagedMetaPage[],
    [managedPagesQuery.data?.pages],
  );
  const selectedManagedPage = useMemo(
    () => managedPages.find((page) => page.id === selectedPageId) || null,
    [managedPages, selectedPageId],
  );

  const rows = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);
  const selected = rows.find((row: any) => row.id === selectedId) || null;
  const canEditSelected = !selected || ["DRAFT", "FAILED", "CANCELLED"].includes(selected.status);

  const stats = useMemo(() => {
    const pending = rows.filter((row: any) => row.status === "PENDING_APPROVAL").length;
    const scheduled = rows.filter((row: any) => row.status === "SCHEDULED").length;
    const failed = rows.filter((row: any) => row.status === "FAILED").length;
    return { pending, scheduled, failed };
  }, [rows]);

  const imageUrl = useMemo(() => resolvePrimaryImageFromAssets(placementAssets), [placementAssets]);

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
    }),
    [
      altText,
      brandSignature,
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
      managedPagesQuery.data?.selectedPageId ||
      connectionStatus.data?.pageId ||
      managedPages[0]?.id ||
      "";
    if (defaultPageId) setSelectedPageId(defaultPageId);
  }, [
    connectionStatus.data?.pageId,
    managedPages,
    managedPagesQuery.data?.selectedPageId,
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
    () => buildPreviewSlides(placements, feedFormat, placementAssets),
    [feedFormat, placementAssets, placements],
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
    if (payload.brandSignature) setBrandSignature(payload.brandSignature);
    if (payload.hashtags) setHashtags(payload.hashtags);
    if (payload.tone) setTone(payload.tone as SocialTone);
    if (payload.cta) setCta(payload.cta);
    if (payload.linkUrl) setLinkUrl(payload.linkUrl);
    if (payload.template) setTemplate(payload.template);
  }

  const brandKitsQuery = trpc.social.listBrandKits.useQuery();
  const selectedBrandKitName = useMemo(() => {
    const kits = brandKitsQuery.data?.kits ?? [];
    const match = kits.find((kit) => kit.id === selectedBrandKitId);
    return match?.name || (selectedBrandKitId ? "Merkkit" : "Geen merkkit gekozen");
  }, [brandKitsQuery.data?.kits, selectedBrandKitId]);

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

  useEffect(() => {
    if (!canSchedule || !connectionStatus.data?.autopostEnabled || overdueScheduledCount === 0) return;
    if (publishDuePosts.isPending) return;

    const timer = window.setInterval(() => {
      if (!publishDuePosts.isPending) publishDuePosts.mutate();
    }, 60_000);

    publishDuePosts.mutate();

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll only when overdue queue changes
  }, [canSchedule, connectionStatus.data?.autopostEnabled, overdueScheduledCount]);

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
      if (placements.includes("FEED") && !placementAssets.FEED?.imageUrl?.trim()) return false;
      if (placements.includes("STORY") && !placementAssets.STORY?.imageUrl?.trim()) return false;
      if (placements.includes("REEL") && !placementAssets.REEL?.videoUrl?.trim()) return false;
      return Boolean(imageUrl.trim());
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
        setPlacementAssets((current) => {
          const next = { ...current };
          if (placements.includes("FEED")) next.FEED = { imageUrl };
          if (placements.includes("STORY")) next.STORY = { imageUrl };
          if (placements.includes("REEL") && !next.REEL?.videoUrl) next.REEL = { imageUrl };
          return next;
        });
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
        setPlacementAssets((current) => {
          const next = { ...current };
          if (placements.includes("REEL")) next.REEL = { videoUrl };
          if (placements.includes("STORY") && !next.STORY?.imageUrl) {
            next.STORY = { videoUrl };
          }
          return next;
        });
        if (!placements.includes("REEL")) {
          setPlacements((current) => (current.includes("REEL") ? current : [...current, "REEL"]));
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

    if (placements.includes("FEED") && !placementAssets.FEED?.imageUrl?.trim()) {
      showToast({ title: "Feed-afbeelding ontbreekt", variant: "error" });
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

    if (!imageUrl.trim()) {
      showToast({ title: "Media ontbreekt", description: "Voeg minstens één afbeelding of reel-video toe.", variant: "error" });
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
      const persistedAssets = await persistPlacementAssets(placementAssets);
      if (JSON.stringify(persistedAssets) !== JSON.stringify(placementAssets)) {
        setPlacementAssets(persistedAssets);
      }

      const persistedImageUrl = resolvePrimaryImageFromAssets(persistedAssets);
      const persistedMetadata: SocialMetadata = {
        ...metadataPayload,
        assets: persistedAssets,
      };

      if (!selected) {
        return createDraft.mutateAsync({
          caption: caption.trim(),
          imageUrl: persistedImageUrl.trim(),
          targetPlatforms: targets,
          metadata: persistedMetadata,
        });
      }

      if (!canEditSelected) {
        showToast({ title: "Niet bewerkbaar", description: "Deze post is al ingediend of ingepland. Maak een nieuw draft voor wijzigingen.", variant: "error" });
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
    loadRow(post);
  }

  function loadRow(row: any) {
    const metadata = (row.metadata || {}) as SocialMetadata;
    setActiveTab("composer");
    router.replace("/social?tab=composer");
    setSelectedId(row.id);
    setCaption(row.caption || "");
    setPlacements(metadata.placements?.length ? metadata.placements : metadata.postFormat === "STORY" ? ["STORY"] : ["FEED"]);
    const legacyFormat = metadata.postFormat;
    setFeedFormat(
      metadata.feedFormat ||
        (legacyFormat === "PORTRAIT" || legacyFormat === "LANDSCAPE" || legacyFormat === "SQUARE" ? legacyFormat : "SQUARE"),
    );
    setPlacementAssets(metadata.assets || {});
    setTargetFacebook((row.targetPlatforms || []).includes("FACEBOOK"));
    setTargetInstagram((row.targetPlatforms || []).includes("INSTAGRAM"));
    setSelectedPageId(metadata.publisherPageId || managedPagesQuery.data?.selectedPageId || connectionStatus.data?.pageId || "");
    setScheduledFor(toDateTimeLocal(row.scheduledFor));
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
    setSelectedPageId(managedPagesQuery.data?.selectedPageId || connectionStatus.data?.pageId || managedPages[0]?.id || "");
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
  }

  const isBusy =
    createDraft.isPending ||
    updateDraft.isPending ||
    submitApproval.isPending ||
    approveAndSchedule.isPending ||
    rejectPost.isPending ||
    retryFailed.isPending ||
    cancelScheduled.isPending ||
    publishDuePosts.isPending;

  return (
    <div className="app-page space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] border border-amber-200/70 bg-[radial-gradient(circle_at_12%_10%,rgba(249,174,90,0.35),transparent_28%),linear-gradient(135deg,#fff7ed_0%,#f8fafc_48%,#e8f5ee_100%)] p-5 shadow-[0_28px_70px_rgba(120,74,26,0.12)] dark:border-amber-300/20 dark:bg-[radial-gradient(circle_at_12%_10%,rgba(249,174,90,0.18),transparent_28%),linear-gradient(135deg,#241a12_0%,#111827_55%,#10251f_100%)] sm:p-6">
        <div className="absolute right-6 top-6 hidden h-28 w-28 rounded-full border border-amber-300/50 bg-white/30 blur-xl sm:block" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-3 border-amber-300/70 bg-white/60 text-amber-900 dark:bg-white/10 dark:text-amber-100">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Social Planner v2
            </Badge>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">Plan, preview en publiceer zonder Meta-verrassingen</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700 dark:text-slate-200">
              Composeer je post met CTA, hashtags, link en beeldformaten. We checken Instagram-ratio's vóór approval, tonen Facebook/Instagram previews en vertalen Meta-fouten naar duidelijke acties.
            </p>
          </div>
          <div className="flex w-full min-w-[300px] max-w-[400px] flex-col gap-2 sm:flex-row lg:max-w-[420px]">
            <SocialHeroStat
              label="Approval"
              value={stats.pending}
              icon={ShieldCheck}
              tone="amber"
              onClick={() => {
                setStatusFilter("PENDING_APPROVAL");
                handleTabChange("queue");
              }}
            />
            <SocialHeroStat
              label="Gepland"
              value={stats.scheduled}
              icon={CalendarDays}
              tone="emerald"
              onClick={() => handleTabChange("agenda")}
            />
            <SocialHeroStat
              label="Fouten"
              value={stats.failed}
              icon={AlertTriangle}
              tone="rose"
              onClick={() => {
                setStatusFilter("FAILED");
                handleTabChange("queue");
              }}
            />
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild className="bg-white/70 backdrop-blur dark:bg-white/10">
            <Link href="/settings/integrations">
              <Settings2 className="mr-2 h-4 w-4" /> Integraties
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={resetEditor} className="bg-white/70 backdrop-blur dark:bg-white/10">Nieuw draft</Button>
          <Badge variant={connectionStatus.data?.connected ? "success" : "warning"} className="px-3 py-1.5">
            {connectionStatus.data?.connected ? "Meta verbonden" : "Meta niet verbonden"}
          </Badge>
          <Badge variant={connectionStatus.data?.autopostEnabled ? "success" : "warning"} className="px-3 py-1.5">
            Autopost {connectionStatus.data?.autopostEnabled ? "aan" : "uit"}
          </Badge>
        </div>
      </section>

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

        <TabsContent value="composer" className="mt-0 space-y-5">
      {!connectionStatus.isLoading && !connectionStatus.data?.connected ? (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200/70 bg-amber-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/40 dark:bg-amber-950/25">
          <p className="text-sm text-amber-950/90 dark:text-amber-100">
            Meta is nog niet gekoppeld. Koppel je Page en Instagram Business-account om te kunnen publiceren.
          </p>
          <Button size="sm" variant="outline" className="shrink-0 bg-white/80 dark:bg-white/10" asChild>
            <Link href="/settings/integrations">Meta instellen</Link>
          </Button>
        </div>
      ) : null}
      {!connectionStatus.isLoading && connectionStatus.data?.connected && !connectionStatus.data.autopostEnabled ? (
        <div className="flex flex-col gap-3 rounded-xl border border-rose-200/70 bg-rose-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-rose-900/40 dark:bg-rose-950/25">
          <p className="text-sm text-rose-950/90 dark:text-rose-100">
            Autopost staat uit. Ingeplande posts worden niet automatisch gepubliceerd tot je dit aanzet.
          </p>
          <Button size="sm" variant="outline" className="shrink-0 bg-white/80 dark:bg-white/10" asChild>
            <Link href="/settings/integrations">Autopost aanzetten</Link>
          </Button>
        </div>
      ) : null}
      {canSchedule && overdueScheduledCount > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-violet-200/70 bg-violet-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-violet-900/40 dark:bg-violet-950/25">
          <p className="text-sm text-violet-950/90 dark:text-violet-100">
            {overdueScheduledCount} ingeplande {overdueScheduledCount === 1 ? "post wacht" : "posts wachten"} op publicatie
            {connectionStatus.data?.autopostEnabled ? " en wordt automatisch verwerkt." : "."}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 bg-white/80 dark:bg-white/10"
            disabled={publishDuePosts.isPending}
            onClick={() => publishDuePosts.mutate()}
          >
            {publishDuePosts.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Nu publiceren
          </Button>
        </div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <div className="space-y-5">
          <Card className="overflow-hidden border-amber-200/60 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-amber-50 via-background to-emerald-50 dark:from-amber-950/30 dark:to-emerald-950/20">
              <CardTitle className="flex items-center gap-2 text-base"><Wand2 className="h-4 w-4 text-amber-600" /> Composer</CardTitle>
              <CardDescription>Volg de stappen om je post snel en logisch op te bouwen.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
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
                {wizardStep === 0 ? (
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
                    isLoading={managedPagesQuery.isLoading}
                  />
                ) : null}

                {wizardStep === 1 ? (
                  <SocialBrandKitPicker
                    selectedKitId={selectedBrandKitId}
                    onSelectedKitIdChange={setSelectedBrandKitId}
                    onApplyKit={applyBrandKitDefaults}
                    autoApplyDefaults={!selectedId}
                    disabled={!canEditSelected}
                  />
                ) : null}

                {wizardStep === 2 ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="social-caption">Caption</Label>
                      <Textarea
                        id="social-caption"
                        disabled={!canEditSelected}
                        value={caption}
                        onChange={(event) => setCaption(event.target.value)}
                        rows={7}
                        placeholder="Schrijf je posttekst..."
                      />
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{caption.length}/6000 tekens</span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-dashed bg-muted/10 p-3 space-y-3">
                      <p className="text-xs font-medium text-muted-foreground">Of laat AI helpen</p>
                      <Textarea
                        id="social-template"
                        value={template}
                        onChange={(event) => setTemplate(event.target.value)}
                        placeholder="Waar gaat de post over? Bijv. gratis intake voor KMO's in juni..."
                        rows={2}
                        disabled={!canEditSelected}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Select value={tone} onValueChange={(value) => setTone(value as SocialTone)} disabled={!canEditSelected}>
                          <SelectTrigger className="h-9 w-full sm:w-[220px]">
                            <SelectValue placeholder="Tone of voice" />
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
                          Caption genereren
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {wizardStep === 3 ? (
                  <div className="space-y-4">
                    <SocialPlacementEditor
                      placements={placements}
                      feedFormat={feedFormat}
                      assets={placementAssets}
                      disabled={!canEditSelected}
                      targetInstagram={targetInstagram}
                      onPlacementsChange={setPlacements}
                      onFeedFormatChange={setFeedFormat}
                      onAssetsChange={setPlacementAssets}
                    />
                    <SocialImageGenerator
                      disabled={!canEditSelected}
                      caption={caption}
                      template={template}
                      feedFormat={feedFormat}
                      placements={placements}
                      socialPostId={selectedId ?? undefined}
                      brandKitId={selectedBrandKitId || undefined}
                      onImageReady={(assets) => setPlacementAssets((current) => ({ ...current, ...assets }))}
                    />
                  </div>
                ) : null}

                {wizardStep === 4 ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 rounded-xl border bg-muted/10 p-4 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Account</p>
                        <p className="mt-1 text-sm font-medium">{selectedManagedPage?.name || "Geen pagina"}</p>
                        <p className="text-xs text-muted-foreground">
                          {[targetFacebook ? "Facebook" : null, targetInstagram ? "Instagram" : null].filter(Boolean).join(" · ") || "Geen kanalen"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Merkkit</p>
                        <p className="mt-1 text-sm font-medium">{selectedBrandKitName}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tekst</p>
                        <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm">{previewCaption || caption || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Formaten</p>
                        <p className="mt-1 text-sm font-medium">{placements.join(", ") || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Media</p>
                        <p className="mt-1 text-sm font-medium">{imageUrl ? "Afbeelding/video toegevoegd" : "Ontbreekt"}</p>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="social-hashtags">Hashtags</Label>
                        <HashtagField id="social-hashtags" disabled={!canEditSelected} value={hashtags} onChange={setHashtags} />
                      </div>
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
                    </div>
                    <SocialComposerSection
                      title="Meer opties"
                      description="Headline, CTA, brand signature en interne notities."
                      icon={Settings2}
                      defaultOpen={Boolean(headline.trim() || cta.trim() || brandSignature.trim() || altText.trim())}
                    >
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
                  </div>
                ) : null}
              </SocialComposerWizard>
            </CardContent>
          </Card>

          {selected ? (
            <Card className="border-emerald-200/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Approval & planning</CardTitle>
                <CardDescription>
                  {canSchedule
                    ? selected.status === "SCHEDULED"
                      ? "Deze post staat al in de agenda. Pas de publicatiedatum aan of annuleer de planning."
                      : "Kies een publicatiedatum en keur de post goed."
                    : "Alleen OWNER/ADMIN kan goedkeuren en inplannen."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {canSchedule ? (
                  <>
                    <Input id="social-scheduled-for" type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} />
                    <div className="flex flex-wrap gap-2">
                      {selected.status === "SCHEDULED" ? (
                        <>
                          <Button size="sm" disabled={isBusy || !scheduledFor} onClick={handleApproveAndSchedule}>
                            <Clock3 className="mr-2 h-3.5 w-3.5" /> Planning bijwerken
                          </Button>
                          <Button size="sm" variant="outline" disabled={isBusy} onClick={() => cancelScheduled.mutate({ id: selected.id })}>
                            <XCircle className="mr-2 h-3.5 w-3.5" /> Planning annuleren
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" disabled={isBusy || !scheduledFor} onClick={handleApproveAndSchedule}>
                            <Clock3 className="mr-2 h-3.5 w-3.5" /> Goedkeuren & plannen
                          </Button>
                          {selected.status === "PENDING_APPROVAL" ? (
                            <Button size="sm" variant="outline" disabled={isBusy} onClick={() => rejectPost.mutate({ id: selected.id })}>
                              <XCircle className="mr-2 h-3.5 w-3.5" /> Afkeuren
                            </Button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                    Status: <strong className="text-foreground">{selected.status}</strong>. Een beheerder keurt en plant deze post in.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5 xl:sticky xl:top-5 xl:self-start">
          <Card className="overflow-hidden border-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-amber-50/60 dark:from-slate-950 dark:via-slate-900 dark:to-amber-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Eye className="h-4 w-4" /> Live preview</CardTitle>
              <CardDescription>
                {activePreviewSlide
                  ? `${activePreviewSlide.label} · ${activePreviewSlide.subtitle}`
                  : "Upload per publicatietype om de preview te zien."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
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
                    <div className="space-y-3">
                      <p className="text-center text-xs text-muted-foreground">
                        Preview {previewSlideIndex + 1} van {previewSlides.length}
                        {previewSlides.length > 1 ? " · gebruik pijltjes of tabs" : ""}
                      </p>
                      {activePreviewSlide.id === "REEL" ? (
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
                              caption={activePreviewSlide.id === "STORY" ? "" : previewCaption}
                              imageUrl={activePreviewSlide.imageUrl}
                              format={activePreviewSlide.format}
                              pageName={previewPageName}
                            />
                          ) : null}
                          {targetInstagram ? (
                            activePreviewSlide.id === "STORY" ? (
                              <InstagramPreview
                                caption=""
                                imageUrl={activePreviewSlide.imageUrl}
                                firstComment={firstComment}
                                format="STORY"
                                username={previewInstagramUsername}
                              />
                            ) : (
                              <InstagramPreview
                                caption={previewCaption}
                                imageUrl={activePreviewSlide.imageUrl}
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
                <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                  <ImageIcon className="mx-auto mb-3 h-8 w-8 opacity-40" />
                  <p className="font-medium text-foreground">Nog geen preview beschikbaar</p>
                  <p className="mt-1 text-xs">Upload een afbeelding (of reel-video) per gekozen publicatietype links.</p>
                </div>
              )}

              <div className="rounded-2xl border bg-white/70 p-3 text-xs leading-5 text-muted-foreground dark:bg-white/5">
                <p className="font-semibold text-foreground"><Palette className="mr-1 inline h-3.5 w-3.5" /> Publicatie-regels</p>
                <p>
                  Feed: 4:5 tot 1.91:1 · Story/Reel: 9:16 (1080×1920). Reels vereisen een publieke MP4-video; cover is optioneel.
                  {placements.length > 1 ? ` Je publiceert ${placements.length} varianten in één planning.` : ""}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
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
              onCancel={(rowId) => cancelScheduled.mutate({ id: rowId })}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
