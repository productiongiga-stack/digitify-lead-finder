"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { useBranding } from "@/lib/branding";
import { MAIN_NAV_ITEMS, TOOL_NAV_ITEMS, BOTTOM_NAV_ITEMS, LEADS_WORKFLOW_ITEMS, isNavItemActive } from "@/lib/navigation";
import { Button } from "@digitify/ui";
import { ScrollArea } from "@digitify/ui";
import { Separator } from "@digitify/ui";
import { Sheet, SheetClose, SheetContent } from "@digitify/ui";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Zap,
  Bot,
  X,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore();
  const { branding } = useBranding();
  const hasLeadWorkflowMatch = LEADS_WORKFLOW_ITEMS.some(
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
      ...LEADS_WORKFLOW_ITEMS.map((item) => item.href),
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
  const hasToolNav = TOOL_NAV_ITEMS.length > 0;

  const renderContent = (mobile: boolean) => {
    const collapsed = mobile ? false : sidebarCollapsed;

    return (
    <aside
      className={cn(
        "inset-y-0 left-0 z-30 flex h-full flex-col bg-card/95 backdrop-blur transition-all duration-300",
        mobile ? "w-full border-r-0" : "border-r",
        !mobile && (collapsed ? "w-16" : "w-60")
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(255,255,255,0))] px-3 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.45),rgba(15,23,42,0))]">
        <Link href="/dashboard" className="flex items-center gap-2">
          {logoUrl ? (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg overflow-hidden">
              <img src={logoUrl} alt={brandName} className="h-8 w-8 object-contain" />
            </div>
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
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

      {/* Nav */}
      <ScrollArea className="flex-1 py-2">
        {!collapsed && (
          <p className="px-5 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
            Navigatie
          </p>
        )}
        <nav className="space-y-1 px-2">
          {MAIN_NAV_ITEMS.map((item) => {
            const isActive = isNavItemActive(item, pathname);
            const canShowLeadWorkflow = item.href === "/leads" && !collapsed;

            if (canShowLeadWorkflow) {
              return (
                <div key={item.href} className="space-y-1">
                  <div
                    className={cn(
                      "flex items-center gap-1 rounded-xl pr-1 transition-all",
                      isActive
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground"
                    )}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setMobileSidebarOpen(false)}
                      onMouseEnter={() => router.prefetch(item.href)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2.5 text-sm font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                    <button
                      type="button"
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/80 hover:text-accent-foreground"
                      onClick={() => setLeadWorkflowOpen((prev) => !prev)}
                      aria-label="Leads workflow tonen"
                    >
                      <ChevronDown className={cn("h-4 w-4 transition-transform", leadWorkflowOpen && "rotate-180")} />
                    </button>
                  </div>
                  {leadWorkflowOpen ? (
                    <div className="ml-6 space-y-1 border-l pl-2">
                      {LEADS_WORKFLOW_ITEMS.map((entry) => {
                        const workflowActive = pathname === entry.href || pathname.startsWith(`${entry.href}/`);
                        return (
                          <Link
                            key={entry.href}
                            href={entry.href}
                            onClick={() => setMobileSidebarOpen(false)}
                            onMouseEnter={() => router.prefetch(entry.href)}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
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
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileSidebarOpen(false)}
                onMouseEnter={() => router.prefetch(item.href)}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {hasToolNav ? (
          <>
            <Separator className="my-2 mx-2" />

            {!collapsed && (
              <p className="px-5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                Tools
              </p>
            )}

            <nav className="space-y-1 px-2">
              {TOOL_NAV_ITEMS.map((item) => {
                const isActive = isNavItemActive(item, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileSidebarOpen(false)}
                    onMouseEnter={() => router.prefetch(item.href)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </nav>

            <Separator className="my-2 mx-2" />
          </>
        ) : null}

        <nav className="space-y-1 px-2">
          <button
            onClick={() => useUIStore.getState().toggleOpenClaw()}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-accent/80 hover:text-accent-foreground"
        >
          <Bot className="h-4 w-4 shrink-0" />
            {!collapsed && <span>OpenClaw</span>}
          </button>
        </nav>
      </ScrollArea>

      {/* Bottom */}
      <div className="border-t bg-muted/20 px-1.5 py-2">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const isActive = isNavItemActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileSidebarOpen(false)}
              onMouseEnter={() => router.prefetch(item.href)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {!mobile ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-center rounded-xl text-muted-foreground"
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
          {renderContent(true)}
        </SheetContent>
      </Sheet>
    </>
  );
}
