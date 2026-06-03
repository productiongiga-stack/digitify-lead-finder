import { cn } from "@/lib/utils";

type AvatarSize = "sm" | "md";

const OUTER_SIZE: Record<AvatarSize, string> = {
  sm: "h-9 w-9",
  md: "h-10 w-10",
};

const LABEL_SIZE: Record<AvatarSize, string> = {
  sm: "text-[10px]",
  md: "text-xs",
};

const FB_ICON_SIZE: Record<AvatarSize, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
};

function FacebookLogoIcon({ size }: { size: AvatarSize }) {
  return (
    <svg className={FB_ICON_SIZE[size]} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13.5 22v-8h2.7l.4-3.1h-3.1V9.1c0-.9.2-1.5 1.5-1.5H17V5.1c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4v2.9H8.2v3.1h2.4V22h2.9z" />
    </svg>
  );
}

function InstagramLogoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MetaAdsBrandMark({ className }: { className?: string }) {
  const logoRing = "ring-2 ring-white dark:ring-slate-950";

  return (
    <div className={cn("relative h-11 w-[3.35rem] shrink-0", className)} aria-hidden>
      <div
        className={cn(
          "absolute left-0 top-1/2 z-[1] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[#1877F2] text-white",
          logoRing,
        )}
      >
        <FacebookLogoIcon size="sm" />
      </div>
      <div
        className={cn(
          "absolute left-[1.15rem] top-1/2 z-[2] -translate-y-1/2 rounded-full bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] p-[1.5px]",
          logoRing,
        )}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-slate-950">
          <InstagramLogoIcon className="h-[15px] w-[15px] stroke-[1.75] text-[#ee2a7b]" />
        </div>
      </div>
    </div>
  );
}

function BrandAvatarCore({
  label,
  size,
}: {
  label: string;
  size: AvatarSize;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-1 items-center justify-center overflow-hidden rounded-full",
        "bg-gradient-to-br from-[#ffcb6b] via-[#f9ae5a] to-[#ea580c] font-bold tracking-tight text-white",
        LABEL_SIZE[size],
      )}
    >
      <span className="relative z-[1] drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">{label}</span>
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/30" />
      <span className="pointer-events-none absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-white/30 blur-[1px]" />
    </div>
  );
}

export function FacebookPageAvatar({
  size = "md",
  imageUrl,
  alt = "Pagina",
  className,
}: {
  size?: AvatarSize;
  /** Bedrijfsfavicon of pagina-logo; anders standaard Facebook-icoon. */
  imageUrl?: string;
  alt?: string;
  className?: string;
}) {
  const hasImage = Boolean(imageUrl?.trim());

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-[1.5px] ring-white/90",
        hasImage ? "bg-white shadow-sm" : "bg-[#1877F2] text-white shadow-[0_2px_8px_rgba(24,119,242,0.35)]",
        OUTER_SIZE[size],
        className,
      )}
      aria-hidden={!hasImage}
      role={hasImage ? "img" : undefined}
      aria-label={hasImage ? alt : undefined}
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl!.trim()} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <FacebookLogoIcon size={size} />
      )}
    </div>
  );
}

export function InstagramPageAvatar({
  size = "md",
  label = "D",
  className,
}: {
  size?: AvatarSize;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 rounded-full bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] p-[2.5px]",
        "shadow-[0_2px_12px_rgba(221,42,123,0.28)]",
        OUTER_SIZE[size],
        className,
      )}
      aria-hidden
    >
      <div className="flex h-full w-full rounded-full bg-white p-[2px]">
        <BrandAvatarCore label={label} size={size} />
      </div>
    </div>
  );
}
