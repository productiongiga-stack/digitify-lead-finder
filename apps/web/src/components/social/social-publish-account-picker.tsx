"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
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

function ChannelPill({
  active,
  disabled,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border/70 bg-background text-foreground hover:bg-muted/40",
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
      {active ? <Check className="h-3.5 w-3.5 opacity-90" strokeWidth={3} /> : null}
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
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Waar publiceer je?</p>
        <p className="text-xs text-muted-foreground">Kies je account en welke kanalen actief zijn.</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : pages.length > 0 ? (
        <div className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-3 sm:p-4">
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Account</p>
            <Select value={selectedPageId || undefined} onValueChange={onSelectedPageIdChange} disabled={disabled}>
              <SelectTrigger id="social-publish-account" className="h-11 bg-background">
                <SelectValue placeholder="Kies een pagina">
                  {selectedPage ? (
                    <span className="flex min-w-0 items-center gap-2.5">
                      <FacebookPageAvatar size="sm" alt={selectedPage.name} />
                      <span className="min-w-0 truncate font-medium">{selectedPage.name}</span>
                      {instagramUser ? (
                        <span className="hidden truncate text-xs text-muted-foreground sm:inline">{instagramUser}</span>
                      ) : (
                        <span className="hidden text-xs text-amber-700 sm:inline">Geen Instagram</span>
                      )}
                    </span>
                  ) : null}
                </SelectValue>
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

          <div className="border-t border-border/50 pt-3">
            <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Kanalen</p>
            <div className="flex flex-wrap gap-2">
              <ChannelPill
                active={targetFacebook}
                disabled={disabled}
                label="Facebook"
                icon={<FacebookPageAvatar size="sm" alt={selectedPage?.name} />}
                onClick={() => onTargetFacebookChange(!targetFacebook)}
              />
              <ChannelPill
                active={targetInstagram}
                disabled={disabled || !instagramLinked}
                label="Instagram"
                icon={
                  <InstagramPageAvatar
                    size="sm"
                    label={avatarLabel(selectedPage?.name || "D", selectedPage?.instagramUsername)}
                  />
                }
                onClick={() => onTargetInstagramChange(!targetInstagram)}
              />
            </div>
          </div>

          {selectedPage ? (
            <p className="text-xs text-muted-foreground">
              {activeChannels.length === 0 ? (
                <span className="text-amber-700 dark:text-amber-300">Kies minstens één kanaal om verder te gaan.</span>
              ) : (
                <>
                  <span className="font-medium text-foreground">{selectedPage.name}</span>
                  {" · "}
                  {activeChannels.join(" + ")}
                </>
              )}
            </p>
          ) : null}
        </div>
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

      {!isLoading && selectedPage && !instagramLinked ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
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
