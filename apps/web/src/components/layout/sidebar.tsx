"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { useBranding } from "@/lib/branding";
import { MAIN_NAV_ITEMS, TOOL_NAV_ITEMS, BOTTOM_NAV_ITEMS, LEADS_MENU_ITEMS, isNavItemActive } from "@/lib/navigation";
import { Button } from "@digitify/ui";
import { ScrollArea } from "@digitify/ui";
import { Separator } from "@digitify/ui";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@digitify/ui";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Zap,
  Bot,
  X,
  type LucideIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";

type SidebarNavEntry = {
  href: string;
  label: string;
  icon: LucideIcon;
};

function sidebarItemClass(active?: boolean) {
  return cn(
    "flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
    active
      ? "bg-primary/12 text-primary shadow-sm ring-1 ring-primary/15"
      : "text-muted-foreground hover:bg-accent/75 hover:text-accent-foreground",
  );
}

function NavSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-5 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
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
    <div className="flex h-16 items-center justify-between border-b border-border/60 bg-gradient-to-b from-background/70 to-transparent px-3">
      <Link href="/dashboard" className="flex items-center gap-2">
        {logoUrl ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm">
            <img src={logoUrl} alt={brandName} className="h-8 w-8 object-contain" />
          </div>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Zap className="h-4 w-4" />
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-base font-bold tracking-tight">{brandName}</p>
            {brandSlogan ? (
              <p className="truncate text-[11px] text-muted-foreground">{brandSlogan}</p>
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
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      onMouseEnter={() => onPrefetch(item.href)}
      className={sidebarItemClass(active)}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore();
  const { branding } = useBranding();

  // Load user's disabled modules (cached for 5 min)
  const { data: moduleAccess } = trpc.user.getMyModules.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const disabledModules = new Set(moduleAccess?.disabled || []);

  const visibleToolNav = TOOL_NAV_ITEMS.filter((item) => !item.moduleId || !disabledModules.has(item.moduleId));
  const visibleLeadsMenu = LEADS_MENU_ITEMS.filter((item) => !item.moduleId || !disabledModules.has(item.moduleId));

  const hasLeadWorkflowMatch = visibleLeadsMenu.some(
    (entry) => pathname === entry.href || pathname.startsWith(`${entry.href}/`)
  );
  const [leadWorkflowOpen, setLeadWorkflowOpen] = useState(hasLeadWorkflowMatch);

  useEffect(() => {
    if (hasLeadWorkflowMatch) setLeadWorkflowOpen(true);
  }, [hasLeadWorkflowMatch]);

  useEffect(() => {
    // Warm common app routes so first navigation feels instant.
    const routes = [
      ...MAIN_NAV_ITEMS.map((item) => item.href),
      ...LEADS_MENU_ITEMS.map((item) => item.href),
      ...TOOL_NAV_ITEMS.map((item) => item.href),
      ...BOTTOM_NAV_ITEMS.map((item) => item.href),
    ];
    let cancelled = false;
    const prefetchRoutes = () => {
      if (cancelled) return;
      routes.forEach((href) => router.prefetch(href));
    };
    const browser = globalThis as any;
    if (typeof browser.requestIdleCallback === "function") {
      const id = browser.requestIdleCallback(prefetchRoutes, { timeout: 1500 });
      return () => {
        cancelled = true;
        browser.cancelIdleCallback?.(id);
      };
    }
    const timeout = browser.setTimeout(prefetchRoutes, 250);
    return () => {
      cancelled = true;
      browser.clearTimeout(timeout);
    };
  }, [router]);

  const logoUrl = branding.logoUrl;
  const brandName = branding.companyName || process.env.NEXT_PUBLIC_APP_NAME || "Lead Finder";
  const brandSlogan = branding.companySlogan;
  const hasToolNav = visibleToolNav.length > 0;

  const renderContent = (mobile: boolean) => {
    const collapsed = mobile ? false : sidebarCollapsed;

    return (
    <aside
      className={cn(
        "inset-y-0 left-0 z-30 flex h-full flex-col bg-card/90 shadow-xl shadow-slate-950/5 backdrop-blur-xl transition-all duration-300",
        mobile ? "w-full border-r-0" : "border-r border-border/60",
        !mobile && (collapsed ? "w-16" : "w-60")
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
        <nav className="space-y-1.5 px-2">
          {MAIN_NAV_ITEMS.map((item) => {
            const isLeadNavItem = item.href === "/leads";
            const activeLeadMenuHref = isLeadNavItem
              ? visibleLeadsMenu
                  .filter((entry) => pathname === entry.href || pathname.startsWith(`${entry.href}/`))
                  .sort((left, right) => right.href.length - left.href.length)[0]?.href
              : undefined;
            const isActive = isLeadNavItem
              ? activeLeadMenuHref === "/leads"
              : isNavItemActive(item, pathname);

            if (isLeadNavItem) {
              return (
                <div key={item.href} className="space-y-1">
                  <div
                    className={cn(
                      "flex items-center gap-1 rounded-2xl pr-1 transition-all",
                      isActive
                        ? "bg-primary/12 text-primary shadow-sm ring-1 ring-primary/15"
                        : "text-muted-foreground hover:bg-accent/75 hover:text-accent-foreground"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (collapsed) {
                          toggleSidebar();
                          setLeadWorkflowOpen(true);
                          return;
                        }
                        setLeadWorkflowOpen((prev) => !prev);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </button>
                    {!collapsed ? (
                      <button
                        type="button"
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/80 hover:text-accent-foreground"
                        onClick={() => setLeadWorkflowOpen((prev) => !prev)}
                        aria-label="Leads dropdown tonen"
                        aria-expanded={leadWorkflowOpen}
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform", leadWorkflowOpen && "rotate-180")} />
                      </button>
                    ) : null}
                  </div>
                  {leadWorkflowOpen && !collapsed ? (
                    <div className="ml-6 space-y-1 border-l pl-2">
                      {visibleLeadsMenu.map((entry) => {
                        const workflowActive = activeLeadMenuHref === entry.href;
                        return (
                          <Link
                            key={entry.href}
                            href={entry.href}
                            onClick={() => setMobileSidebarOpen(false)}
                            onMouseEnter={() => router.prefetch(entry.href)}
                            className={cn(
                              "flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors",
                              workflowActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground"
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
        </nav>

        {hasToolNav ? (
          <>
            <Separator className="my-2 mx-2" />

            {!collapsed && <NavSectionLabel>Tools</NavSectionLabel>}

            <nav className="space-y-1.5 px-2">
              {visibleToolNav.map((item) => {
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
            </nav>

            <Separator className="my-2 mx-2" />
          </>
        ) : null}

        <nav className="space-y-1 px-2">
          <button
            onClick={() => useUIStore.getState().toggleOpenClaw()}
          className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-accent/75 hover:text-accent-foreground"
        >
          <Bot className="h-4 w-4 shrink-0" />
            {!collapsed && <span>OpenClaw</span>}
          </button>
        </nav>
      </ScrollArea>

      {/* Bottom */}
      <div className="border-t border-border/60 bg-muted/20 px-2 py-3">
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
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-center rounded-2xl text-muted-foreground"
            onClick={toggleSidebar}
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
        ) : null}
      </div>
    </aside>
    );
  };

  return (
    <>
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">{renderContent(false)}</div>
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-[90vw] max-w-[340px] p-0 sm:max-w-[340px]">
          <SheetTitle className="sr-only">Navigatie</SheetTitle>
          <SheetDescription className="sr-only">Open het hoofdmenu en navigeer door Lead Finder.</SheetDescription>
          {renderContent(true)}
        </SheetContent>
      </Sheet>
    </>
  );
}
