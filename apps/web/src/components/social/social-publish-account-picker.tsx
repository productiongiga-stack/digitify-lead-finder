"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Label,
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
import {
  FacebookPageAvatar,
  InstagramPageAvatar,
} from "@/components/social/social-platform-avatars";

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
  targetInstagram: boolean;
  onTargetInstagramChange: (checked: boolean) => void;
  disabled?: boolean;
  isLoading?: boolean;
};

const INTEGRATIONS_META_URL = "/settings/integrations?tab=meta";

function instagramHandle(username?: string) {
  if (!username?.trim()) return null;
  return `@${username.replace(/^@/, "")}`;
}

function avatarLabel(name: string, username?: string) {
  const source = username?.replace(/^@/, "") || name;
  return source.charAt(0).toUpperCase() || "D";
}

function hasInstagram(page?: SocialManagedPage | null) {
  return Boolean(page?.instagramBusinessId?.trim());
}

function ChannelToggle({
  active,
  disabled,
  label,
  detail,
  icon,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  detail: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
        active
          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
          : "border-border/70 bg-background hover:bg-muted/30",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-tight">{label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{detail}</span>
      </span>
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
          active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
        )}
        aria-hidden
      >
        {active ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

function MetaConnectionTroubleshoot({ pagesWithoutInstagram }: { pagesWithoutInstagram: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border/60 bg-muted/10">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-muted-foreground hover:text-foreground"
      >
        <HelpCircle className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1">Instagram ontbreekt? Hulp bij koppelen</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-border/50 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
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

export function SocialPublishAccountPicker({
  pages,
  selectedPageId,
  onSelectedPageIdChange,
  selectedPage,
  targetFacebook,
  onTargetFacebookChange,
  targetInstagram,
  onTargetInstagramChange,
  disabled = false,
  isLoading = false,
}: Props) {
  const instagramLinked = hasInstagram(selectedPage);
  const instagramUser = instagramHandle(selectedPage?.instagramUsername);

  const pagesWithoutInstagram = useMemo(
    () => pages.filter((page) => !hasInstagram(page)).length,
    [pages],
  );

  const activeChannels = [
    targetFacebook ? "Facebook" : null,
    targetInstagram ? "Instagram" : null,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Waar publiceer je?</p>
        <p className="text-xs text-muted-foreground">Kies je pagina en de kanalen voor deze post.</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : pages.length > 0 ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="social-publish-account" className="text-xs font-medium text-muted-foreground">
              Facebook-pagina
            </Label>
            <Select value={selectedPageId || undefined} onValueChange={onSelectedPageIdChange} disabled={disabled}>
              <SelectTrigger id="social-publish-account" className="h-11">
                <SelectValue placeholder="Kies een pagina" />
              </SelectTrigger>
              <SelectContent>
                {pages.map((page) => {
                  const pageInstagram = hasInstagram(page);
                  const handle = instagramHandle(page.instagramUsername);
                  return (
                    <SelectItem key={page.id} value={page.id}>
                      <span className="flex w-full items-center gap-2">
                        <FacebookPageAvatar size="sm" alt={page.name} />
                        <span className="min-w-0 flex-1 truncate font-medium">{page.name}</span>
                        <span className={cn("text-[11px]", pageInstagram ? "text-muted-foreground" : "text-amber-700")}>
                          {handle || "Geen IG"}
                        </span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {selectedPage ? (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/15 px-3 py-2.5">
              <div className="flex -space-x-2">
                <FacebookPageAvatar size="sm" alt={selectedPage.name} className="ring-2 ring-background" />
                <InstagramPageAvatar
                  size="sm"
                  label={avatarLabel(selectedPage.name, selectedPage.instagramUsername)}
                  className={cn("ring-2 ring-background", !instagramLinked && "opacity-40")}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{selectedPage.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {instagramUser ? `Instagram ${instagramUser}` : "Instagram niet gekoppeld"}
                </p>
              </div>
              <Badge variant={instagramLinked ? "success" : "warning"} className="shrink-0 text-[10px]">
                {instagramLinked ? "Klaar" : "Alleen FB"}
              </Badge>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Kanalen voor deze post</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <ChannelToggle
                active={targetFacebook}
                disabled={disabled}
                label="Facebook"
                detail={selectedPage?.name || "Pagina-feed"}
                icon={<FacebookPageAvatar size="sm" alt={selectedPage?.name} />}
                onClick={() => onTargetFacebookChange(!targetFacebook)}
              />
              <ChannelToggle
                active={targetInstagram}
                disabled={disabled || !instagramLinked}
                label="Instagram"
                detail={instagramLinked ? instagramUser || "Business feed" : "Eerst koppelen in Meta"}
                icon={
                  <InstagramPageAvatar
                    size="sm"
                    label={avatarLabel(selectedPage?.name || "D", selectedPage?.instagramUsername)}
                  />
                }
                onClick={() => onTargetInstagramChange(!targetInstagram)}
              />
            </div>
            {activeChannels.length === 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">Kies minstens één kanaal.</p>
            ) : (
              <p className="text-xs text-muted-foreground">Publiceert naar: {activeChannels.join(" + ")}</p>
            )}
          </div>

          {!instagramLinked ? (
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Instagram is niet gekoppeld aan deze pagina. Je kunt wel op Facebook posten.
            </p>
          ) : null}

          {pagesWithoutInstagram > 0 ? <MetaConnectionTroubleshoot pagesWithoutInstagram={pagesWithoutInstagram} /> : null}
        </>
      ) : (
        <div className="rounded-lg border border-dashed px-4 py-4 text-center">
          <p className="text-sm text-muted-foreground">Geen Facebook-pagina gevonden.</p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link href={INTEGRATIONS_META_URL}>
              <Link2 className="mr-2 h-3.5 w-3.5" />
              Meta koppelen
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
