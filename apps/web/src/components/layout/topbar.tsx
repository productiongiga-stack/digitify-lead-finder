"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@digitify/ui";
import { Avatar, AvatarFallback } from "@digitify/ui";
import { Badge } from "@digitify/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@digitify/ui";
import { Moon, Sun, Bot, Menu, Bell, Plus } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { useBranding } from "@/lib/branding";
import { resolvePageTitle } from "@/lib/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";

export function Topbar() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const { toggleOpenClaw, toggleMobileSidebar } = useUIStore();
  const { branding } = useBranding();
  const { data: topbarStats } = trpc.contact.getTopbarStats.useQuery(undefined, {
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() ?? "U";

  const pageTitle = resolvePageTitle(pathname, branding.companyName);
  const followUpCount = topbarStats?.followUpCount ?? 0;

  return (
    <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b bg-background/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/65 sm:px-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-border/70 lg:hidden" onClick={toggleMobileSidebar}>
          <Menu className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <p className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70 sm:block">
            Werkruimte
          </p>
          <h2 className="truncate text-sm font-semibold sm:text-[15px]">
            {pageTitle}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {followUpCount > 0 ? (
          <Link href="/contacts" className="hidden md:block">
            <Badge variant="warning" className="h-8 rounded-full px-3">
              {followUpCount} reminders
            </Badge>
          </Link>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg sm:hidden">
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
              <Link href="/campaigns">Campagnes</Link>
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
            <Button variant="outline" size="sm" className="hidden sm:inline-flex">
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
              <Link href="/campaigns">Campagnes</Link>
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

        <Link href="/contacts/approval" className="relative">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" aria-label="Goedkeuringswachtrij">
            <Bell className="h-4 w-4" />
          </Button>
          {(topbarStats?.pendingDrafts ?? 0) > 0 ? (
            <Badge
              variant="destructive"
              className="absolute -right-1.5 -top-1.5 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]"
            >
              {topbarStats?.pendingDrafts}
            </Badge>
          ) : null}
        </Link>

        <Button variant="ghost" size="icon" className="hidden h-8 w-8 rounded-lg md:inline-flex" onClick={toggleOpenClaw}>
          <Bot className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="hidden h-8 w-8 rounded-lg md:inline-flex"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{session?.user?.name}</p>
                <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
              Uitloggen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
