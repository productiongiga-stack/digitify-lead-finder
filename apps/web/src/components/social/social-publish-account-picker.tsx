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
  Megaphone,
  RefreshCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FacebookPageAvatar,
  InstagramPageAvatar,
  MetaAdsBrandMark,
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

function DestinationCard({
  active,
  disabled,
  icon,
  title,
  subtitle,
  checked,
  onCheckedChange,
  unavailable,
}: {
  active: boolean;
  disabled?: boolean;
  icon: ReactNode;
  title: string;
  subtitle: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  unavailable?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border p-3.5 text-left transition-all",
        active
          ? "border-primary/40 bg-primary/[0.07] shadow-sm ring-1 ring-primary/20"
          : "border-border/70 bg-background/80 hover:border-border hover:bg-muted/20",
        disabled && "pointer-events-none opacity-55",
        unavailable && !active && "border-dashed border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/15",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-0.5 opacity-0 transition-opacity",
          active && "opacity-100 bg-gradient-to-r from-[#1877F2] via-primary to-[#ee2a7b]",
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 shrink-0">{icon}</div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold leading-snug text-foreground">{title}</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
            checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border/80 bg-background text-transparent group-hover:border-muted-foreground/40",
          )}
          aria-hidden
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </div>
      </div>
    </button>
  );
}

function ConnectionChip({
  label,
  value,
  ok,
  icon,
}: {
  label: string;
  value: string;
  ok: boolean;
  icon: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2.5 py-2",
        ok ? "border-emerald-500/25 bg-emerald-500/[0.06]" : "border-amber-500/30 bg-amber-500/[0.07]",
      )}
    >
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("truncate text-xs font-medium", ok ? "text-foreground" : "text-amber-800 dark:text-amber-200")}>
          {value}
        </p>
      </div>
      {ok ? (
        <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-600" />
      ) : (
        <AlertTriangle className="ml-auto h-3.5 w-3.5 shrink-0 text-amber-600" />
      )}
    </div>
  );
}

function MetaConnectionTroubleshoot({ pagesWithoutInstagram }: { pagesWithoutInstagram: number }) {
  const [open, setOpen] = useState(pagesWithoutInstagram > 0);

  return (
    <div className="overflow-hidden rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-500/[0.07] via-background to-background">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-sky-500/[0.04]"
      >
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300">
          <HelpCircle className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Instagram ontbreekt? Zo los je het op</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Veel Facebook-pagina&apos;s tonen geen Instagram in Digitify totdat de koppeling in Meta Business Suite actief is.
          </p>
        </div>
        <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-sky-500/15 px-4 py-4 text-sm leading-relaxed">
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2.5 text-xs text-amber-950 dark:text-amber-100">
            <p className="font-semibold">Waarom zie ik &quot;Geen Instagram gekoppeld&quot;?</p>
            <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
              Digitify leest Instagram via de Meta Graph API op je Facebook Page. Zonder actieve Page ↔ Instagram-koppeling
              kan er niet naar Instagram gepubliceerd worden — ook al staat je account wel in Meta Business Suite.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stap 1 — Instagram klaarzetten</p>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-xs text-muted-foreground">
              <li>
                Zet Instagram op <strong className="text-foreground">Professional</strong> (Business of Creator), geen persoonlijk account.
              </li>
              <li>
                Open{" "}
                <a
                  href="https://business.facebook.com/latest/settings/instagram_account"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Meta Business Suite → Instagram-accounts
                  <ExternalLink className="h-3 w-3" />
                </a>{" "}
                of ga via je Facebook Page → <strong className="text-foreground">Instellingen → Gekoppelde accounts → Instagram</strong>.
              </li>
              <li>
                Koppel het juiste Instagram-account aan de <strong className="text-foreground">Facebook Page</strong> die je in Digitify wilt gebruiken.
              </li>
              <li>
                Controleer dat jij <strong className="text-foreground">beheerder</strong> bent van zowel de Page als het Instagram-account.
              </li>
            </ol>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stap 2 — Digitify opnieuw koppelen</p>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-xs text-muted-foreground">
              <li>
                Ga naar{" "}
                <Link href={INTEGRATIONS_META_URL} className="text-primary hover:underline">
                  Instellingen → Integraties → Meta
                </Link>
                .
              </li>
              <li>
                Klik <strong className="text-foreground">Opnieuw koppelen</strong> en log in met het Meta-account dat de Page beheert.
              </li>
              <li>
                Geef toestemming voor <span className="font-mono text-[11px]">pages_show_list</span>,{" "}
                <span className="font-mono text-[11px]">instagram_basic</span> en{" "}
                <span className="font-mono text-[11px]">instagram_content_publish</span>.
              </li>
              <li>
                Wacht 2–5 minuten na de koppeling in Meta — de API toont Instagram soms pas na een korte vertraging.
              </li>
            </ol>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stap 3 — Juiste pagina kiezen</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs text-muted-foreground">
              <li>
                In de dropdown hierboven zie je per pagina of Instagram gekoppeld is. Kies een pagina met een{" "}
                <strong className="text-foreground">@handle</strong>, niet &quot;Geen Instagram gekoppeld&quot;.
              </li>
              <li>
                Heb je meerdere Pages? Elke Page heeft een eigen Instagram-koppeling — koppel ze apart in Meta Business Suite.
              </li>
              <li>
                Staat Instagram wél in Meta maar nog niet in Digitify? Klik opnieuw koppelen en refresh deze pagina.
              </li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={INTEGRATIONS_META_URL}>
                <Link2 className="mr-2 h-3.5 w-3.5" />
                Naar Meta-integratie
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/integrations/meta/connect">
                <RefreshCcw className="mr-2 h-3.5 w-3.5" />
                Opnieuw koppelen
              </a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a
                href="https://www.facebook.com/business/help/898752960195806"
                target="_blank"
                rel="noopener noreferrer"
              >
                Meta help: Instagram koppelen
                <ExternalLink className="ml-2 h-3.5 w-3.5" />
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

  const showInstagramWarning = pages.length > 0 && (!instagramLinked || pagesWithoutInstagram > 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/20 shadow-sm">
      <div className="h-1 bg-gradient-to-r from-[#1877F2]/90 via-primary/70 to-[#ee2a7b]/80" />

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <MetaAdsBrandMark className="mt-0.5" />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold tracking-tight text-foreground">Publicatie-account</p>
                <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Megaphone className="h-3 w-3" />
                  Meta
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Kies waar deze post live gaat na goedkeuring — Facebook Page, Instagram feed, of beide.
              </p>
            </div>
          </div>
          {pages.length > 0 ? (
            <Badge variant={instagramLinked ? "success" : "warning"} className="shrink-0">
              {instagramLinked ? "Instagram actief" : "Instagram ontbreekt"}
            </Badge>
          ) : null}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : pages.length > 0 ? (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-background via-background to-muted/15 shadow-sm">
              <div className="border-b border-border/50 bg-muted/15 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2.5">
                    <FacebookPageAvatar size="md" alt={selectedPage?.name || "Facebook Page"} className="ring-2 ring-background" />
                    <InstagramPageAvatar
                      size="md"
                      label={avatarLabel(selectedPage?.name || "D", selectedPage?.instagramUsername)}
                      className={cn("ring-2 ring-background", !instagramLinked && "opacity-45 grayscale-[0.35]")}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold tracking-tight text-foreground">
                      {selectedPage?.name || "Kies een account"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {instagramUser ? `Instagram ${instagramUser}` : "Geen Instagram gekoppeld aan deze pagina"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <ConnectionChip
                    label="Facebook"
                    value={selectedPage?.name || "—"}
                    ok={Boolean(selectedPage?.name)}
                    icon={<FacebookPageAvatar size="sm" alt={selectedPage?.name} />}
                  />
                  <ConnectionChip
                    label="Instagram"
                    value={instagramUser || "Niet gekoppeld"}
                    ok={instagramLinked}
                    icon={
                      <InstagramPageAvatar
                        size="sm"
                        label={avatarLabel(selectedPage?.name || "D", selectedPage?.instagramUsername)}
                      />
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="social-publish-account" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Facebook Page wisselen
                  </Label>
                  <Select
                    value={selectedPageId || undefined}
                    onValueChange={onSelectedPageIdChange}
                    disabled={disabled}
                  >
                    <SelectTrigger id="social-publish-account" className="h-11 border-border/70 bg-muted/15">
                      <SelectValue placeholder="Kies een Facebook-pagina" />
                    </SelectTrigger>
                    <SelectContent>
                      {pages.map((page) => {
                        const pageInstagram = hasInstagram(page);
                        const handle = instagramHandle(page.instagramUsername);
                        return (
                          <SelectItem key={page.id} value={page.id}>
                            <span className="flex w-full items-center gap-2.5">
                              <FacebookPageAvatar size="sm" alt={page.name} />
                              <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                                <span className="font-medium">{page.name}</span>
                                <span className={cn("text-xs", pageInstagram ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300")}>
                                  {handle ? `Instagram ${handle}` : "Geen Instagram gekoppeld"}
                                </span>
                              </span>
                              {pageInstagram ? (
                                <Badge variant="success" className="ml-2 shrink-0 text-[10px]">
                                  IG
                                </Badge>
                              ) : (
                                <Badge variant="warning" className="ml-2 shrink-0 text-[10px]">
                                  Geen IG
                                </Badge>
                              )}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {pagesWithoutInstagram > 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      {pagesWithoutInstagram} van {pages.length} pagina&apos;s hebben nog geen Instagram-koppeling.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {!instagramLinked ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-3.5 py-3 text-xs text-amber-950 dark:text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p>
                  <strong className="font-semibold">Instagram is uitgeschakeld</strong> voor {selectedPage?.name || "deze pagina"}.
                  Koppel Instagram in Meta Business Suite en kies daarna opnieuw koppelen in Integraties.
                </p>
              </div>
            ) : null}

            <div className="space-y-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Waar publiceren?</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <DestinationCard
                  active={targetFacebook}
                  disabled={disabled}
                  checked={targetFacebook}
                  onCheckedChange={onTargetFacebookChange}
                  icon={<FacebookPageAvatar size="sm" alt={selectedPage?.name} />}
                  title="Facebook Page"
                  subtitle={selectedPage?.name ? `${selectedPage.name} · feed` : "Pagina-feed"}
                />
                <DestinationCard
                  active={targetInstagram}
                  disabled={disabled || !instagramLinked}
                  unavailable={!instagramLinked}
                  checked={targetInstagram}
                  onCheckedChange={onTargetInstagramChange}
                  icon={
                    <InstagramPageAvatar
                      size="sm"
                      label={avatarLabel(selectedPage?.name || "D", selectedPage?.instagramUsername)}
                    />
                  }
                  title="Instagram Business"
                  subtitle={
                    instagramLinked
                      ? instagramUser
                        ? `${instagramUser} · feed`
                        : "Business feed"
                      : "Koppel Instagram via Meta Business Suite"
                  }
                />
              </div>
            </div>

            {showInstagramWarning ? <MetaConnectionTroubleshoot pagesWithoutInstagram={pagesWithoutInstagram} /> : null}
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-5">
            <p className="text-sm text-muted-foreground">
              Geen beheerde Facebook-pagina&apos;s gevonden. Koppel Meta via Integraties om te kunnen publiceren.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href={INTEGRATIONS_META_URL}>
                <Link2 className="mr-2 h-4 w-4" />
                Meta koppelen in Integraties
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
