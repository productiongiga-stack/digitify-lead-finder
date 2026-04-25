"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { useBranding } from "@/lib/branding";
import { MAIN_NAV_ITEMS, TOOL_NAV_ITEMS, BOTTOM_NAV_ITEMS, isNavItemActive } from "@/lib/navigation";
import { Button } from "@digitify/ui";
import { ScrollArea } from "@digitify/ui";
import { Separator } from "@digitify/ui";
import { Sheet, SheetContent } from "@digitify/ui";
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  Bot,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore();
  const { branding } = useBranding();

  const logoUrl = branding.logoUrl;
  const brandName = branding.companyName || process.env.NEXT_PUBLIC_APP_NAME || "Lead Finder";
  const brandSlogan = branding.companySlogan;

  const content = (
    <aside
      className={cn(
        "inset-y-0 left-0 z-30 flex h-full flex-col border-r bg-card/95 backdrop-blur transition-all duration-300",
        sidebarCollapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(255,255,255,0))] px-3 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.45),rgba(15,23,42,0))]">
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
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-base font-bold tracking-tight">{brandName}</p>
              {brandSlogan ? (
                <p className="truncate text-[11px] text-muted-foreground">{brandSlogan}</p>
              ) : null}
            </div>
          )}
        </Link>
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 py-2">
        {!sidebarCollapsed && (
          <p className="px-5 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
            Navigatie
          </p>
        )}
        <nav className="space-y-1 px-2">
          {MAIN_NAV_ITEMS.map((item) => {
            const isActive = isNavItemActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <Separator className="my-2 mx-2" />

        {!sidebarCollapsed && (
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
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <Separator className="my-2 mx-2" />

        <nav className="space-y-1 px-2">
          <button
            onClick={() => useUIStore.getState().toggleOpenClaw()}
            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-accent/80 hover:text-accent-foreground"
          >
            <Bot className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>OpenClaw</span>}
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
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full justify-center rounded-xl text-muted-foreground"
          onClick={toggleSidebar}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Inklappen
            </>
          )}
        </Button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">{content}</div>
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-[280px] p-0 sm:max-w-[280px]">
          {content}
        </SheetContent>
      </Sheet>
    </>
  );
}
