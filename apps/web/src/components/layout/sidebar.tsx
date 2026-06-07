"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSidebarLayout, useUIStore } from "@/stores/ui-store";
import { useBranding } from "@/lib/branding";
import {
  BOTTOM_NAV_ITEMS,
  DASHBOARD_NAV_ITEM,
  SIDEBAR_NAV_GROUPS,
  isNavItemActive,
  type QuickNavItem,
} from "@/lib/navigation";
import { Button } from "@digitify/ui";
import { ScrollArea } from "@digitify/ui";
import { Separator } from "@digitify/ui";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@digitify/ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@digitify/ui";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Zap,
  Bot,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMyModules } from "@/components/layout/modules-provider";

type SidebarNavEntry = {
  href: string;
  label: string;
  icon: LucideIcon;
};

function sidebarItemClass(active?: boolean, collapsed?: boolean) {
  if (collapsed) {
    return cn(
      "sidebar-nav-icon-btn",
      active && "sidebar-nav-icon-btn-active",
    );
  }

  return cn(
    "sidebar-nav-link",
    active && "sidebar-nav-link-active",
  );
}

function SidebarTooltip({
  label,
  collapsed,
  children,
}: {
  label: string;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  if (!collapsed) return <>{children}</>;

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="border-0 font-medium shadow-lg">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function SidebarDivider({ collapsed }: { collapsed: boolean }) {
  return collapsed ? (
    <div className="my-2 flex justify-center px-2" aria-hidden>
      <span className="h-1 w-1 rounded-full bg-border/80" />
    </div>
  ) : (
    <Separator className="my-2.5 mx-3 bg-border/50" />
  );
}

function NavSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      suppressHydrationWarning
      className="px-5 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70"
    >
      {children}
    </p>
  );
}

function BrandBlock({
  logoUrl,
  brandName,
  brandSlogan,
  collapsed,
  mobile,
}: {
  logoUrl?: string | null;
  brandName: string;
  brandSlogan?: string | null;
  collapsed: boolean;
  mobile: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex h-[4.25rem] shrink-0 items-center border-b border-border/40",
        "bg-gradient-to-b from-primary/[0.06] via-background/40 to-transparent",
        collapsed ? "justify-center px-0" : "justify-between px-3",
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent"
        aria-hidden
      />
      <Link
        href="/dashboard"
        className={cn("flex items-center gap-2.5 transition-opacity hover:opacity-90", collapsed && "justify-center")}
      >
        {logoUrl ? (
          <div className="sidebar-brand-mark overflow-hidden border border-border/50 bg-background shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
            <img src={logoUrl} alt={brandName} className="h-full w-full object-contain p-1" />
          </div>
        ) : (
          <div className="sidebar-brand-mark bg-gradient-to-br from-primary via-primary to-primary/85 text-primary-foreground shadow-md shadow-primary/30">
            <Zap className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.25} />
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0">
            <p suppressHydrationWarning className="truncate text-base font-bold tracking-tight">
              {brandName}
            </p>
            {brandSlogan ? (
              <p suppressHydrationWarning className="truncate text-[11px] text-muted-foreground">
                {brandSlogan}
              </p>
            ) : null}
          </div>
        )}
      </Link>
      {mobile ? (
        <SheetClose asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground">
            <X className="h-4 w-4" />
          </Button>
        </SheetClose>
      ) : null}
    </div>
  );
}

function SidebarNavDropdown({
  label,
  icon: Icon,
  items,
  groupActive,
  open,
  onToggleOpen,
  activeHref,
  collapsed,
  onNavigate,
  onPrefetch,
  expandSidebar,
}: {
  label: string;
  icon: LucideIcon;
  items: QuickNavItem[];
  groupActive: boolean;
  open: boolean;
  onToggleOpen: () => void;
  activeHref?: string;
  collapsed: boolean;
  onNavigate: () => void;
  onPrefetch: (href: string) => void;
  expandSidebar: () => void;
}) {
  return (
    <div className="space-y-1">
      <SidebarTooltip label={label} collapsed={collapsed}>
        <div
          className={cn(
            "flex items-center transition-all duration-200",
            collapsed
              ? cn("justify-center", groupActive ? "sidebar-nav-icon-btn sidebar-nav-icon-btn-active" : "sidebar-nav-icon-btn")
              : cn(
                  "gap-1 rounded-2xl pr-1",
                  groupActive
                    ? "bg-primary/12 text-primary shadow-sm ring-1 ring-primary/15"
                    : "text-muted-foreground hover:bg-accent/75 hover:text-accent-foreground",
                ),
          )}
        >
          <button
            type="button"
            onClick={() => {
              if (collapsed) {
                expandSidebar();
                onToggleOpen();
                return;
              }
              onToggleOpen();
            }}
            className={cn(
              "flex min-w-0 items-center text-left text-sm font-medium",
              collapsed ? "h-10 w-10 justify-center" : "flex-1 gap-2.5 px-3 py-2.5",
            )}
            aria-label={label}
          >
            <Icon className={cn("shrink-0", collapsed ? "h-[1.125rem] w-[1.125rem]" : "h-4 w-4")} strokeWidth={groupActive ? 2.25 : 2} />
            {!collapsed && <span>{label}</span>}
          </button>
          {!collapsed ? (
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/80 hover:text-accent-foreground"
              onClick={onToggleOpen}
              aria-label={`${label} dropdown tonen`}
              aria-expanded={open}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
            </button>
          ) : null}
        </div>
      </SidebarTooltip>
      {open && !collapsed ? (
        <div className="ml-6 space-y-1 border-l pl-2">
          {items.map((entry) => {
            const entryActive = activeHref === entry.href;
            return (
              <Link
                key={entry.href}
                href={entry.href}
                onClick={onNavigate}
                onMouseEnter={() => onPrefetch(entry.href)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors",
                  entryActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground",
                )}
              >
                <entry.icon className="h-3.5 w-3.5 shrink-0" />
                <span>{entry.label}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SidebarNavLink({
  item,
  active,
  collapsed,
  onNavigate,
  onPrefetch,
}: {
  item: SidebarNavEntry;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
  onPrefetch: (href: string) => void;
}) {
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      onMouseEnter={() => onPrefetch(item.href)}
      className={sidebarItemClass(active, collapsed)}
      aria-label={collapsed ? item.label : undefined}
    >
      <item.icon className={cn("shrink-0", collapsed ? "h-[1.125rem] w-[1.125rem]" : "h-4 w-4")} strokeWidth={active ? 2.25 : 2} />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );

  return (
    <SidebarTooltip label={item.label} collapsed={collapsed}>
      {link}
    </SidebarTooltip>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed: sidebarCollapsed } = useSidebarLayout();
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const mobileSidebarOpen = useUIStore((state) => state.mobileSidebarOpen);
  const setMobileSidebarOpen = useUIStore((state) => state.setMobileSidebarOpen);
  const { branding } = useBranding();

  const { data: moduleAccess } = useMyModules();
  const disabledModules = useMemo(
    () => new Set(moduleAccess?.disabled ?? []),
    [moduleAccess?.disabled],
  );

  const visibleNavGroups = useMemo(
    () =>
      SIDEBAR_NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.moduleId || !disabledModules.has(item.moduleId)),
      })).filter((group) => group.items.length > 0),
    [disabledModules],
  );

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of SIDEBAR_NAV_GROUPS) {
      if (group.defaultOpen) initial[group.id] = true;
    }
    return initial;
  });

  const prevPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    const pathnameChanged = prevPathnameRef.current !== pathname;
    prevPathnameRef.current = pathname;

    setOpenGroups((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const group of visibleNavGroups) {
        const matches = group.items.some(
          (entry) => pathname === entry.href || pathname.startsWith(`${entry.href}/`),
        );
        if (!matches) continue;
        // Re-open on navigation; respect explicit `false` from user collapsing on same page.
        if (!pathnameChanged && next[group.id] === false) continue;
        if (!next[group.id]) {
          next[group.id] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pathname, visibleNavGroups]);

  const logoUrl = branding.logoUrl;
  const brandName = branding.companyName || process.env.NEXT_PUBLIC_APP_NAME || "Lead Finder";
  const brandSlogan = branding.companySlogan;
  const renderContent = (mobile: boolean) => {
    const collapsed = mobile ? false : sidebarCollapsed;

    return (
    <aside
      className={cn(
        "app-sidebar inset-y-0 left-0 z-30 flex h-full flex-col transition-[width,box-shadow] duration-300 ease-out",
        mobile ? "w-full border-r-0" : "w-60",
        !mobile && collapsed && "w-[4.25rem]",
      )}
    >
      <BrandBlock
        logoUrl={logoUrl}
        brandName={brandName}
        brandSlogan={brandSlogan}
        collapsed={collapsed}
        mobile={mobile}
      />

      {/* Nav */}
      <ScrollArea className="flex-1 py-3">
        {!collapsed && <NavSectionLabel>Navigatie</NavSectionLabel>}
        <nav className={cn("space-y-1", collapsed ? "px-2" : "space-y-1.5 px-2")}>
          <SidebarNavLink
            item={DASHBOARD_NAV_ITEM}
            active={isNavItemActive(DASHBOARD_NAV_ITEM, pathname)}
            collapsed={collapsed}
            onNavigate={() => setMobileSidebarOpen(false)}
            onPrefetch={(href) => router.prefetch(href)}
          />

          {visibleNavGroups.map((group) => {
            const activeMenuHref = group.items
              .filter((entry) => pathname === entry.href || pathname.startsWith(`${entry.href}/`))
              .sort((left, right) => right.href.length - left.href.length)[0]?.href;
            const groupActive = Boolean(activeMenuHref);
            const isOpen = openGroups[group.id] ?? false;

            return (
              <SidebarNavDropdown
                key={group.id}
                label={group.label}
                icon={group.icon}
                items={group.items}
                groupActive={groupActive}
                open={isOpen}
                onToggleOpen={() =>
                  setOpenGroups((prev) => ({
                    ...prev,
                    [group.id]: !(prev[group.id] ?? false),
                  }))
                }
                activeHref={activeMenuHref}
                collapsed={collapsed}
                onNavigate={() => setMobileSidebarOpen(false)}
                onPrefetch={(href) => router.prefetch(href)}
                expandSidebar={toggleSidebar}
              />
            );
          })}
        </nav>

        <SidebarDivider collapsed={collapsed} />

        <nav className={cn("space-y-1", collapsed ? "px-2" : "px-2")}>
          <SidebarTooltip label="OpenClaw" collapsed={collapsed}>
            <button
              type="button"
              onClick={() => useUIStore.getState().toggleOpenClaw()}
              className={sidebarItemClass(false, collapsed)}
              aria-label="OpenClaw"
            >
              <Bot className={cn("shrink-0", collapsed ? "h-[1.125rem] w-[1.125rem]" : "h-4 w-4")} />
              {!collapsed && <span>OpenClaw</span>}
            </button>
          </SidebarTooltip>
        </nav>
      </ScrollArea>

      {/* Bottom */}
      <div
        className={cn(
          "shrink-0 border-t border-border/40 bg-gradient-to-t from-muted/30 to-transparent",
          collapsed ? "px-2 py-3" : "px-2 py-3",
        )}
      >
        {BOTTOM_NAV_ITEMS.map((item) => {
          const isActive = isNavItemActive(item, pathname);
          return (
            <SidebarNavLink
              key={item.href}
              item={item}
              active={isActive}
              collapsed={collapsed}
              onNavigate={() => setMobileSidebarOpen(false)}
              onPrefetch={(href) => router.prefetch(href)}
            />
          );
        })}

        {!mobile ? (
          <SidebarTooltip label={collapsed ? "Sidebar uitklappen" : "Sidebar inklappen"} collapsed={collapsed}>
            <Button
              variant="ghost"
              size={collapsed ? "icon" : "sm"}
              className={cn(
                "mt-2 text-muted-foreground transition-all hover:bg-accent/80 hover:text-foreground",
                collapsed ? "sidebar-nav-icon-btn mx-auto h-9 w-9 rounded-xl" : "w-full justify-center rounded-2xl",
              )}
              onClick={toggleSidebar}
              aria-label={collapsed ? "Sidebar uitklappen" : "Sidebar inklappen"}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Inklappen
                </>
              )}
            </Button>
          </SidebarTooltip>
        ) : null}
      </div>
    </aside>
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">{renderContent(false)}</div>
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-[90vw] max-w-[340px] p-0 sm:max-w-[340px]">
          <SheetTitle className="sr-only">Navigatie</SheetTitle>
          <SheetDescription className="sr-only">Open het hoofdmenu en navigeer door Lead Finder.</SheetDescription>
          {renderContent(true)}
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
