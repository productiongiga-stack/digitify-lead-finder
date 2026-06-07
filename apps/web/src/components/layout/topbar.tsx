"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@digitify/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@digitify/ui";
import { Badge } from "@digitify/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@digitify/ui";
import { Moon, Sun, Bot, Menu, Bell, Plus, Building2, KeyRound, LogOut, Mail, Palette, Settings, ShieldCheck, UserCircle } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { useBranding } from "@/lib/branding";
import { resolvePageTitle } from "@/lib/navigation";
import { canAccessSettingsPath } from "@/lib/permissions";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { useHasMounted } from "@/lib/use-has-mounted";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";

export function Topbar() {
  const mounted = useHasMounted();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const toggleOpenClaw = useUIStore((state) => state.toggleOpenClaw);
  const toggleMobileSidebar = useUIStore((state) => state.toggleMobileSidebar);
  const { branding } = useBranding();
  const onDashboard = pathname === "/dashboard";
  const pollAttention =
    pathname.startsWith("/contacts") || pathname.startsWith("/leads");
  const { data: dashboardOverview } = trpc.dashboard.getOverview.useQuery(undefined, {
    enabled: onDashboard,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const { data: attentionSummary } = trpc.dashboard.getAttentionSummary.useQuery(undefined, {
    enabled: pollAttention,
    staleTime: 5 * 60_000,
    refetchInterval: pollAttention ? 5 * 60_000 : false,
    refetchOnWindowFocus: false,
  });
  const sessionUser = session?.user as { name?: string | null; email?: string | null; role?: string } | undefined;
  const needsProfile = !sessionUser?.name || !sessionUser?.email || !sessionUser?.role;
  const { data: profile } = trpc.user.getProfile.useQuery(undefined, {
    enabled: needsProfile,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const displayName = profile?.name || session?.user?.name || "";
  const displayEmail = profile?.email || session?.user?.email || "";
  const initials = displayName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || displayEmail.slice(0, 1).toUpperCase() || "U";

  const pageTitle = resolvePageTitle(pathname, branding.companyName);
  const attentionCount = mounted
    ? onDashboard
      ? (dashboardOverview?.attentionCount ?? 0)
      : (attentionSummary?.totalCount ?? 0)
    : 0;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canOpen = (href: string) => canAccessSettingsPath(role, href);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-background/85 px-3 shadow-sm shadow-slate-950/5 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 sm:px-5">
      <div className="flex items-center gap-2">
        <Button
          suppressHydrationWarning
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-xl border-border/70 bg-card/70 lg:hidden"
          onClick={toggleMobileSidebar}
        >
          <Menu className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <p
            suppressHydrationWarning
            className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70 sm:block"
          >
            Werkruimte
          </p>
          <h2
            suppressHydrationWarning
            className="truncate text-sm font-semibold tracking-tight sm:text-[15px]"
          >
            {pageTitle}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <WorkspaceSwitcher />
        {attentionCount > 0 ? (
          <Link href="/notifications" className="hidden md:block">
            <Badge variant="warning" className="h-8 px-3">
              {attentionCount} melding{attentionCount !== 1 ? "en" : ""}
            </Badge>
          </Link>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              suppressHydrationWarning
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl bg-card/70 sm:hidden"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Snelle acties</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/leads/search">Leads zoeken</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/campaigns">Campagneprofielen</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/contacts">Outbound</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/quotes">Offertes</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/reports">Rapporten</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/crm">CRM</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="hidden rounded-full bg-card/70 sm:inline-flex">
              <Plus className="mr-2 h-4 w-4" />
              Snel starten
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Snelle acties</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/leads/search">Leads zoeken</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/campaigns">Campagneprofielen</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/contacts">Outbound</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/quotes">Offertes</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/reports">Rapporten</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/crm">CRM</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          suppressHydrationWarning
          asChild
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-xl"
          aria-label="Meldingen"
        >
          <Link suppressHydrationWarning href="/notifications">
            <Bell className="h-4 w-4" />
            {attentionCount > 0 ? (
              <Badge
                variant="destructive"
                className="absolute -right-1.5 -top-1.5 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]"
              >
                {attentionCount > 99 ? "99+" : attentionCount}
              </Badge>
            ) : null}
          </Link>
        </Button>

        <Button variant="ghost" size="icon" className="hidden h-9 w-9 rounded-xl md:inline-flex" onClick={toggleOpenClaw}>
          <Bot className="h-4 w-4" />
        </Button>

        <Button
          suppressHydrationWarning
          variant="ghost"
          size="icon"
          className="hidden h-9 w-9 rounded-xl md:inline-flex"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          disabled={!mounted}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button suppressHydrationWarning variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9 ring-1 ring-border/70">
                {profile?.image ? <AvatarImage src={profile.image} alt={displayName || displayEmail || "Account"} /> : null}
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {profile?.image ? <AvatarImage src={profile.image} alt={displayName || displayEmail || "Account"} /> : null}
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{displayName || "Gebruiker"}</p>
                  <p className="truncate text-xs text-muted-foreground">{displayEmail}</p>
                  {profile?.role ? (
                    <Badge variant="outline" className="mt-1 h-5 px-1.5 text-[10px]">
                      {profile.role}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/account?tab=profile">
                <UserCircle className="mr-2 h-4 w-4" />
                Account & profiel
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/account?tab=security">
                <KeyRound className="mr-2 h-4 w-4" />
                Wachtwoord wijzigen
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {canOpen("/settings/company") ? (
              <DropdownMenuItem asChild>
                <Link href="/settings/company">
                  <Building2 className="mr-2 h-4 w-4" />
                  Bedrijfsgegevens
                </Link>
              </DropdownMenuItem>
            ) : null}
            {canOpen("/settings/branding") ? (
              <DropdownMenuItem asChild>
                <Link href="/settings/branding">
                  <Palette className="mr-2 h-4 w-4" />
                  Branding
                </Link>
              </DropdownMenuItem>
            ) : null}
            {canOpen("/settings/email") ? (
              <DropdownMenuItem asChild>
                <Link href="/settings/email">
                  <Mail className="mr-2 h-4 w-4" />
                  E-mail instellingen
                </Link>
              </DropdownMenuItem>
            ) : null}
            {canOpen("/settings/integrations") ? (
              <DropdownMenuItem asChild>
                <Link href="/settings/integrations">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Integraties & API keys
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Alle instellingen
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Uitloggen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
