"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@digitify/ui";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ExternalLink,
  HelpCircle,
  Link2,
  RefreshCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FacebookPageAvatar, MetaAdsBrandMark } from "@/components/social/social-platform-avatars";

export type SocialManagedPage = {
  id: string;
  name: string;
  instagramBusinessId?: string;
  instagramUsername?: string;
};

type Props = {
  pages: SocialManagedPage[];
  selectedPageId: string;
  onSelectedPageIdChange: (pageId: string) => void;
  selectedPage: SocialManagedPage | null;
  targetFacebook: boolean;
  onTargetFacebookChange: (checked: boolean) => void;
  facebookDisabled?: boolean;
  facebookDisabledReason?: string;
  targetInstagram: boolean;
  onTargetInstagramChange: (checked: boolean) => void;
  instagramDisabled?: boolean;
  instagramDisabledReason?: string;
  disabled?: boolean;
  isLoading?: boolean;
};

const INTEGRATIONS_META_URL = "/settings/integrations?tab=meta";

function instagramHandle(username?: string) {
  if (!username?.trim()) return null;
  return `@${username.replace(/^@/, "")}`;
}

function hasInstagram(page?: SocialManagedPage | null) {
  return Boolean(page?.instagramBusinessId?.trim());
}

function FacebookMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1877F2] text-white shadow-[0_2px_8px_rgba(24,119,242,0.28)]",
        className,
      )}
      aria-hidden
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.5 22v-8h2.7l.4-3.1h-3.1V9.1c0-.9.2-1.5 1.5-1.5H17V5.1c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4v2.9H8.2v3.1h2.4V22h2.9z" />
      </svg>
    </span>
  );
}

function InstagramMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] p-[2px] shadow-[0_2px_10px_rgba(221,42,123,0.22)]",
        className,
      )}
      aria-hidden
    >
      <span className="flex h-full w-full items-center justify-center rounded-full bg-white dark:bg-slate-950">
        <svg className="h-4 w-4 stroke-[#ee2a7b]" viewBox="0 0 24 24" fill="none" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="1.2" fill="#ee2a7b" stroke="none" />
        </svg>
      </span>
    </span>
  );
}

function ChannelToggle({
  active,
  disabled,
  label,
  description,
  icon,
  accent,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  icon: ReactNode;
  accent: "facebook" | "instagram";
  onClick: () => void;
}) {
  const accentStyles =
    accent === "facebook"
      ? active
        ? "border-[#1877F2]/45 bg-[#1877F2]/[0.07] ring-1 ring-[#1877F2]/20"
        : "border-border/60 bg-background hover:border-[#1877F2]/25 hover:bg-[#1877F2]/[0.04]"
      : active
        ? "border-[#ee2a7b]/40 bg-gradient-to-br from-[#f9ce34]/10 via-[#ee2a7b]/8 to-[#6228d7]/10 ring-1 ring-[#ee2a7b]/15"
        : "border-border/60 bg-background hover:border-[#ee2a7b]/25 hover:bg-[#ee2a7b]/[0.04]";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group flex min-h-[4.25rem] flex-1 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
        accentStyles,
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{description}</span>
      </span>
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          active
            ? accent === "facebook"
              ? "border-[#1877F2] bg-[#1877F2] text-white"
              : "border-[#ee2a7b] bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white"
            : "border-muted-foreground/25 bg-transparent group-hover:border-muted-foreground/40",
        )}
      >
        {active ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

function MetaConnectionTroubleshoot({ pagesWithoutInstagram }: { pagesWithoutInstagram: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-background/60">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
      >
        <HelpCircle className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">Instagram ontbreekt? Hulp bij koppelen</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-border/50 bg-muted/10 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
          <p>
            Koppel Instagram aan je Facebook Page in{" "}
            <a
              href="https://business.facebook.com/latest/settings/instagram_account"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Meta Business Suite
            </a>
            , klik daarna <strong className="text-foreground">Opnieuw koppelen</strong> in Digitify.
          </p>
          {pagesWithoutInstagram > 0 ? (
            <p>
              <strong className="text-foreground">{pagesWithoutInstagram}</strong> van je pagina&apos;s hebben nog geen Instagram.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={INTEGRATIONS_META_URL}>
                <Link2 className="mr-1.5 h-3 w-3" />
                Integraties
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/integrations/meta/connect">
                <RefreshCcw className="mr-1.5 h-3 w-3" />
                Opnieuw koppelen
              </a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="https://www.facebook.com/business/help/898752960195806" target="_blank" rel="noopener noreferrer">
                Meta help
                <ExternalLink className="ml-1.5 h-3 w-3" />
              </a>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AccountSelectorPreview({ page }: { page: SocialManagedPage }) {
  const handle = instagramHandle(page.instagramUsername);
  const linked = hasInstagram(page);

  return (
    <span className="flex min-w-0 flex-1 items-center gap-3.5 text-left">
      {linked ? (
        <MetaAdsBrandMark className="h-10 w-[2.85rem] shrink-0" />
      ) : (
        <FacebookPageAvatar size="sm" alt={page.name} className="h-10 w-10" />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold tracking-tight text-foreground">{page.name}</span>
          <span className="hidden shrink-0 rounded-full border border-[#1877F2]/20 bg-[#1877F2]/8 px-2 py-0.5 text-[10px] font-medium text-[#1877F2] sm:inline">
            Facebook Page
          </span>
        </span>
        {handle ? (
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <InstagramMark className="!h-4 !w-4 !shadow-none" />
            <span className="truncate">{handle}</span>
          </span>
        ) : (
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            Geen Instagram gekoppeld
          </span>
        )}
      </span>
    </span>
  );
}

function AccountSelectorItem({ page }: { page: SocialManagedPage }) {
  const handle = instagramHandle(page.instagramUsername);
  const linked = hasInstagram(page);

  return (
    <span className="flex w-full items-center gap-3 py-0.5">
      {linked ? (
        <MetaAdsBrandMark className="h-9 w-[2.6rem] shrink-0" />
      ) : (
        <FacebookPageAvatar size="sm" alt={page.name} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{page.name}</span>
        <span
          className={cn(
            "block truncate text-[11px]",
            linked ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300",
          )}
        >
          {handle || "Geen Instagram"}
        </span>
      </span>
    </span>
  );
}

export function SocialPublishAccountPicker({
  pages,
  selectedPageId,
  onSelectedPageIdChange,
  selectedPage,
  targetFacebook,
  onTargetFacebookChange,
  facebookDisabled = false,
  facebookDisabledReason,
  targetInstagram,
  onTargetInstagramChange,
  instagramDisabled = false,
  instagramDisabledReason,
  disabled = false,
  isLoading = false,
}: Props) {
  const instagramLinked = hasInstagram(selectedPage);

  const pagesWithoutInstagram = useMemo(
    () => pages.filter((page) => !hasInstagram(page)).length,
    [pages],
  );

  const activeChannels = [
    targetFacebook ? "Facebook" : null,
    targetInstagram ? "Instagram" : null,
  ].filter(Boolean);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold tracking-tight text-foreground">Waar publiceer je?</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Kies je account en welke kanalen actief zijn.</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-36 w-full rounded-2xl" />
      ) : pages.length > 0 ? (
        <div className="space-y-4 rounded-2xl border border-border/60 bg-gradient-to-b from-muted/25 via-background to-background p-3.5 sm:p-4">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Account</p>
            <Select value={selectedPageId || undefined} onValueChange={onSelectedPageIdChange} disabled={disabled}>
              <SelectTrigger
                id="social-publish-account"
                className={cn(
                  "group h-auto min-h-[4.25rem] rounded-2xl border-border/50 bg-gradient-to-br from-background via-background to-muted/30 px-3.5 py-3 shadow-sm transition-all",
                  "hover:border-[#1877F2]/30 hover:shadow-md hover:shadow-[#1877F2]/[0.06]",
                  "focus:ring-2 focus:ring-[#1877F2]/15 focus:border-[#1877F2]/35",
                  "data-[state=open]:border-[#1877F2]/35 data-[state=open]:ring-2 data-[state=open]:ring-[#1877F2]/10",
                  "[&>span]:line-clamp-none [&>span]:min-w-0 [&>span]:flex-1",
                  "[&>svg]:ml-2 [&>svg]:h-8 [&>svg]:w-8 [&>svg]:shrink-0 [&>svg]:rounded-full [&>svg]:border [&>svg]:border-border/50 [&>svg]:bg-muted/40 [&>svg]:p-1.5 [&>svg]:opacity-100",
                  "group-hover:[&>svg]:border-[#1877F2]/25 group-hover:[&>svg]:bg-[#1877F2]/5",
                  "data-[state=open]:[&>svg]:rotate-180 data-[state=open]:[&>svg]:border-[#1877F2]/30 data-[state=open]:[&>svg]:bg-[#1877F2]/8",
                )}
              >
                <SelectValue placeholder="Kies een pagina">
                  {selectedPage ? <AccountSelectorPreview page={selectedPage} /> : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/60 p-1.5 shadow-lg">
                {pages.map((page) => (
                  <SelectItem key={page.id} value={page.id} className="rounded-lg py-2.5 pl-2.5 pr-9">
                    <AccountSelectorItem page={page} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Kanalen</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <ChannelToggle
                active={targetFacebook}
                disabled={disabled || facebookDisabled}
                label="Facebook"
                description={
                  facebookDisabled
                    ? facebookDisabledReason || "Publicatie geblokkeerd"
                    : targetFacebook
                      ? "Wordt meegenomen"
                      : "Niet geselecteerd"
                }
                accent="facebook"
                icon={<FacebookMark />}
                onClick={() => onTargetFacebookChange(!targetFacebook)}
              />
              <ChannelToggle
                active={targetInstagram}
                disabled={disabled || !instagramLinked || instagramDisabled}
                label="Instagram"
                description={
                  !instagramLinked
                    ? "Niet gekoppeld aan pagina"
                    : instagramDisabled
                      ? instagramDisabledReason || "Publicatie geblokkeerd"
                    : targetInstagram
                      ? "Wordt meegenomen"
                      : "Niet geselecteerd"
                }
                accent="instagram"
                icon={<InstagramMark />}
                onClick={() => onTargetInstagramChange(!targetInstagram)}
              />
            </div>
          </div>

          {selectedPage ? (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-3">
              {activeChannels.length === 0 ? (
                <span className="text-xs text-amber-700 dark:text-amber-300">Kies minstens één kanaal om verder te gaan.</span>
              ) : (
                <>
                  <Badge variant="outline" className="font-normal text-muted-foreground">
                    {selectedPage.name}
                  </Badge>
                  {targetFacebook ? (
                    <Badge className="border-[#1877F2]/30 bg-[#1877F2]/10 font-normal text-[#1877F2] hover:bg-[#1877F2]/10">
                      Facebook
                    </Badge>
                  ) : null}
                  {targetInstagram ? (
                    <Badge className="border-[#ee2a7b]/25 bg-[#ee2a7b]/10 font-normal text-[#c13584] hover:bg-[#ee2a7b]/10 dark:text-[#ee2a7b]">
                      Instagram
                    </Badge>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-5 text-center">
          <p className="text-sm text-muted-foreground">Geen Facebook-pagina gevonden.</p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link href={INTEGRATIONS_META_URL}>
              <Link2 className="mr-2 h-3.5 w-3.5" />
              Meta koppelen
            </Link>
          </Button>
        </div>
      )}

      {!isLoading && selectedPage && !instagramLinked ? (
        <p className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5 text-xs text-amber-950 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Instagram is niet gekoppeld aan deze pagina. Je kunt wel op Facebook posten.
        </p>
      ) : null}

      {!isLoading && pagesWithoutInstagram > 0 ? (
        <MetaConnectionTroubleshoot pagesWithoutInstagram={pagesWithoutInstagram} />
      ) : null}
    </div>
  );
}
