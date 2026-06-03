"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  postFormat?: PostFormat;
  placements?: SocialPlacement[];
  feedFormat?: FeedAspectFormat;
  assets?: PlacementAssets;
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

function MetadataStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/65 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
    </div>
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
}: {
  caption: string;
  imageUrl: string;
  videoUrl?: string;
}) {
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
              <p className="text-sm font-semibold">digitify.be</p>
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

function FacebookPreview({ caption, imageUrl, format }: { caption: string; imageUrl: string; format: PostFormat }) {
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
                <p className="text-sm font-semibold">Digitify</p>
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
          <p className="truncate text-sm font-semibold">Digitify</p>
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

function InstagramPreview({ caption, imageUrl, firstComment, format }: { caption: string; imageUrl: string; firstComment: string; format: PostFormat }) {
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
                <p className="text-sm font-semibold">digitify.be</p>
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
          <p className="truncate text-sm font-semibold">digitify.be</p>
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
        <p className="text-sm"><span className="font-semibold">digitify.be</span> <span className="whitespace-pre-line">{caption}</span></p>
        {firstComment.trim() ? (
          <p className="rounded-xl bg-zinc-50 p-2 text-xs text-zinc-600">
            Eerste reactie preview: {firstComment.trim()}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function SocialPageInner() {
  const { showToast } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [template, setTemplate] = useState("");
  const [tone, setTone] = useState<SocialTone>(DEFAULT_SOCIAL_TONE);
  const [scheduledFor, setScheduledFor] = useState("");
  const [targetFacebook, setTargetFacebook] = useState(true);
  const [targetInstagram, setTargetInstagram] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"composer" | "queue">("composer");
  const [headline, setHeadline] = useState("");
  const [cta, setCta] = useState("");
  const [hashtags, setHashtags] = useState("digitalegroei marketing belgie");
  const [linkUrl, setLinkUrl] = useState("");
  const [firstComment, setFirstComment] = useState("");
  const [altText, setAltText] = useState("");
  const [brandSignature, setBrandSignature] = useState("Digitify · meer zichtbaarheid, minder manueel werk");
  const [placements, setPlacements] = useState<SocialPlacement[]>(["FEED"]);
  const [feedFormat, setFeedFormat] = useState<FeedAspectFormat>("SQUARE");
  const [placementAssets, setPlacementAssets] = useState<PlacementAssets>({});
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);

  const listQuery = trpc.social.list.useQuery(
    statusFilter === "ALL" ? undefined : { status: statusFilter as any },
    { refetchInterval: 20_000 },
  );
  const connectionStatus = trpc.social.connectionStatus.useQuery();

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
      postFormat: previewFormat,
      placements,
      feedFormat,
      assets: placementAssets,
    }),
    [altText, brandSignature, cta, firstComment, feedFormat, hashtags, headline, linkUrl, placementAssets, placements, previewFormat],
  );

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
      showToast({ title: "Post ingepland" });
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

  async function handleApproveAndSchedule() {
    if (!selected || !scheduledFor) return;
    if (!ensureEditorReady({ requireInstagramSafe: true })) return;
    if (canEditSelected) {
      await saveDraft();
    }
    await approveAndSchedule.mutateAsync({ id: selected.id, scheduledFor: new Date(scheduledFor) });
  }

  function loadRow(row: any) {
    const metadata = (row.metadata || {}) as SocialMetadata;
    setActiveTab("composer");
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
    setScheduledFor(toDateTimeLocal(row.scheduledFor));
    setHeadline(metadata.headline || "");
    setCta(metadata.cta || "");
    setHashtags(metadata.hashtags || "");
    setLinkUrl(metadata.linkUrl || "");
    setFirstComment(metadata.firstComment || "");
    setAltText(metadata.altText || "");
    setBrandSignature(metadata.brandSignature || "");
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
    setHeadline("");
    setCta("");
    setHashtags("digitalegroei marketing belgie");
    setLinkUrl("");
    setFirstComment("");
    setAltText("");
    setBrandSignature("Digitify · meer zichtbaarheid, minder manueel werk");
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
    cancelScheduled.isPending;

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
          <div className="grid min-w-[260px] grid-cols-3 gap-2">
            <MetadataStat label="Approval" value={String(stats.pending)} />
            <MetadataStat label="Gepland" value={String(stats.scheduled)} />
            <MetadataStat label="Fouten" value={String(stats.failed)} />
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

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "composer" | "queue")} className="space-y-4">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="composer">Composer</TabsTrigger>
          <TabsTrigger value="queue" className="gap-2">
            Posts queue
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
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <div className="space-y-5">
          <Card className="overflow-hidden border-amber-200/60 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-amber-50 via-background to-emerald-50 dark:from-amber-950/30 dark:to-emerald-950/20">
              <CardTitle className="flex items-center gap-2 text-base"><Wand2 className="h-4 w-4 text-amber-600" /> Composer</CardTitle>
              <CardDescription>Schrijf de post, voeg custom elementen toe en bewaar als draft.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                <div className="space-y-2">
                  <Label htmlFor="social-template">Template prompt</Label>
                  <Textarea
                    id="social-template"
                    value={template}
                    onChange={(event) => setTemplate(event.target.value)}
                    placeholder="Zomercampagne: focus op lokale zichtbaarheid en gratis intake call..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="social-tone">Tone of voice</Label>
                  <Select value={tone} onValueChange={(value) => setTone(value as SocialTone)}>
                    <SelectTrigger id="social-tone" className="h-8">
                      <SelectValue placeholder="Kies tone of voice" />
                    </SelectTrigger>
                    <SelectContent>
                      {SOCIAL_TONE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {SOCIAL_TONE_OPTIONS.find((option) => option.value === tone)?.description}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={generateSuggestion.isPending || !template.trim()}
                    onClick={() => generateSuggestion.mutate({ template: template.trim(), tone })}
                  >
                    {generateSuggestion.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Megaphone className="mr-2 h-3 w-3" />}
                    AI caption
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="social-headline">Headline / hook</Label>
                <Input id="social-headline" disabled={!canEditSelected} value={headline} onChange={(event) => setHeadline(event.target.value)} placeholder="Bijvoorbeeld: Meer leads zonder extra chaos" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="social-caption">Caption</Label>
                <Textarea id="social-caption" disabled={!canEditSelected} value={caption} onChange={(event) => setCaption(event.target.value)} rows={7} placeholder="Schrijf je posttekst..." />
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{caption.length}/6000 tekens</span>
                  <span>{previewCaption.split(/\s+/).filter(Boolean).length} woorden in preview</span>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="social-cta">CTA</Label>
                  <Input id="social-cta" disabled={!canEditSelected} value={cta} onChange={(event) => setCta(event.target.value)} placeholder="Plan een gratis intake" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="social-link">Link</Label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="social-link" disabled={!canEditSelected} className="pl-9" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://leads.digitify.be" />
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="social-hashtags">Hashtags</Label>
                  <HashtagField id="social-hashtags" disabled={!canEditSelected} value={hashtags} onChange={setHashtags} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="social-brand-signature">Brand signature</Label>
                  <Input id="social-brand-signature" disabled={!canEditSelected} value={brandSignature} onChange={(event) => setBrandSignature(event.target.value)} placeholder="Digitify · ..." />
                </div>
              </div>

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

              <div className="space-y-2">
                <Label htmlFor="social-alt-text">Alt-tekst / interne notitie</Label>
                <Textarea id="social-alt-text" disabled={!canEditSelected} value={altText} onChange={(event) => setAltText(event.target.value)} rows={3} placeholder="Beschrijf de afbeelding voor review en toegankelijkheid..." />
              </div>

              <div className="space-y-2">
                <Label htmlFor="social-first-comment">Eerste reactie preview</Label>
                <Textarea id="social-first-comment" disabled={!canEditSelected} value={firstComment} onChange={(event) => setFirstComment(event.target.value)} rows={3} placeholder="Optioneel: extra hashtags of context. V1 toont dit als preview/notitie, niet als automatische comment." />
                <p className="text-xs text-muted-foreground">V1 publiceert alleen de feed post zelf. Deze reactie blijft bewaard als review-notitie.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                  <input type="checkbox" checked={targetFacebook} disabled={!canEditSelected} onChange={(event) => setTargetFacebook(event.target.checked)} />
                  Facebook Page
                </label>
                <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                  <input type="checkbox" checked={targetInstagram} disabled={!canEditSelected} onChange={(event) => setTargetInstagram(event.target.checked)} />
                  Instagram Business feed
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button onClick={handleCreateOrUpdate} disabled={isBusy || !canEditSelected}>
                  {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {selected ? "Draft opslaan" : "Draft aanmaken"}
                </Button>
                {selected ? (
                  <Button variant="outline" disabled={isBusy || selected.status === "PENDING_APPROVAL"} onClick={handleSubmitForApproval}>
                    <Send className="mr-2 h-4 w-4" /> Ter goedkeuring
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {selected ? (
            <Card className="border-emerald-200/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Approval & planning</CardTitle>
                <CardDescription>Alleen OWNER/ADMIN kan goedkeuren en inplannen.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input id="social-scheduled-for" type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={isBusy || !scheduledFor} onClick={handleApproveAndSchedule}>
                    <Clock3 className="mr-2 h-3.5 w-3.5" /> Goedkeuren & plannen
                  </Button>
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => rejectPost.mutate({ id: selected.id })}>
                    <XCircle className="mr-2 h-3.5 w-3.5" /> Afkeuren
                  </Button>
                </div>
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
                            />
                          ) : null}
                          {targetInstagram ? (
                            activePreviewSlide.id === "STORY" ? (
                              <InstagramPreview
                                caption=""
                                imageUrl={activePreviewSlide.imageUrl}
                                firstComment={firstComment}
                                format="STORY"
                              />
                            ) : (
                              <InstagramPreview
                                caption={previewCaption}
                                imageUrl={activePreviewSlide.imageUrl}
                                firstComment={firstComment}
                                format={activePreviewSlide.format}
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

        <TabsContent value="queue" className="mt-0">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" /> Posts queue</CardTitle>
                <CardDescription>Status, planning, retries en duidelijke publicatiefouten.</CardDescription>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Button size="sm" variant="outline" onClick={() => setActiveTab("composer")}>
                  <Wand2 className="mr-2 h-3.5 w-3.5" /> Nieuw bericht
                </Button>
                <div className="w-full sm:w-56">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue placeholder="Filter status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Alle statussen</SelectItem>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="PENDING_APPROVAL">Pending approval</SelectItem>
                      <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                      <SelectItem value="PUBLISHED">Published</SelectItem>
                      <SelectItem value="FAILED">Failed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {listQuery.isLoading ? (
                <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
              ) : rows.length === 0 ? (
                <EmptyState
                  icon={<Megaphone />}
                  title="Nog geen social posts"
                  description="Maak eerst een draft aan in Composer en stuur die door voor goedkeuring."
                  action={
                    <Button size="sm" onClick={() => setActiveTab("composer")}>
                      <Wand2 className="mr-2 h-4 w-4" /> Naar Composer
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {rows.map((row: any) => {
                    const errorHelp = row.lastError ? explainMetaError(row.lastError) : null;
                    const isSelected = selectedId === row.id;
                    return (
                      <div
                        key={row.id}
                        className={cn(
                          "rounded-2xl border bg-card p-3 transition hover:border-amber-300/70 hover:shadow-sm",
                          isSelected && "border-amber-400/80 ring-1 ring-amber-400/30",
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {statusBadge(row.status)}
                              <span className="text-xs text-muted-foreground">{row.targetPlatforms.join(" + ")}</span>
                              {row.retryCount ? <Badge variant="outline">Retry {row.retryCount}/3</Badge> : null}
                            </div>
                            <p className="line-clamp-2 text-sm font-medium">{row.metadata?.headline ? `${row.metadata.headline} · ` : ""}{row.caption}</p>
                            <p className="text-xs text-muted-foreground">Gepland: {prettyDate(row.scheduledFor)} · Gepubliceerd: {prettyDate(row.publishedAt)}</p>
                            {row.lastError ? (
                              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">
                                <p className="font-semibold"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" /> {errorHelp?.title}</p>
                                <p className="mt-1">{errorHelp?.description}</p>
                                <p className="mt-2 break-words font-mono text-[11px] opacity-80">{row.lastError}</p>
                              </div>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => loadRow(row)}>Open</Button>
                            {row.status === "FAILED" ? (
                              <Button size="sm" variant="outline" onClick={() => retryFailed.mutate({ id: row.id })}>
                                <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Retry
                              </Button>
                            ) : null}
                            {["SCHEDULED", "PENDING_APPROVAL"].includes(row.status) ? (
                              <Button size="sm" variant="outline" onClick={() => cancelScheduled.mutate({ id: row.id })}>
                                <XCircle className="mr-2 h-3.5 w-3.5" /> Annuleer
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
