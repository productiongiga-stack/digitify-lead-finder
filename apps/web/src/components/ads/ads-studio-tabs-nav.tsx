"use client";

import type { LucideIcon } from "lucide-react";
import {
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  TabsList,
  TabsTrigger,
} from "@digitify/ui";
import { cn } from "@/lib/utils";

export type AdsStudioTab = { value: string; label: string; icon: LucideIcon };

/** Shorter labels when horizontal space is limited (tablet / sidebar layout). */
function compactTabLabel(label: string) {
  const short: Record<string, string> = {
    Campagnes: "Camp.",
    Overzicht: "Overz.",
    "Campagne-wizard": "Wizard",
    Goedkeuring: "OK",
    Prestaties: "Stats",
    Instellingen: "Setup",
  };
  return short[label] ?? label;
}

const STUDIO_ACCENTS = {
  meta: {
    label: "Meta Ads",
    iconWrap: "bg-[#1877F2]/12 text-[#1877F2] dark:bg-[#1877F2]/20",
    trigger:
      "border-[#1877F2]/20 bg-gradient-to-r from-slate-50/95 via-white to-blue-50/50 shadow-[0_1px_2px_rgba(24,119,242,0.08)] focus-visible:ring-[#1877F2]/25 dark:from-slate-900/80 dark:via-slate-950 dark:to-blue-950/30",
    itemActive:
      "data-[state=checked]:bg-[#1877F2]/10 focus:bg-[#1877F2]/8 data-[highlighted]:bg-[#1877F2]/8",
  },
  google: {
    label: "Google Ads",
    iconWrap: "bg-[#4285F4]/12 text-[#4285F4] dark:bg-[#4285F4]/20",
    trigger:
      "border-[#4285F4]/20 bg-gradient-to-r from-slate-50/95 via-white to-emerald-50/40 shadow-[0_1px_2px_rgba(66,133,244,0.08)] focus-visible:ring-[#4285F4]/25 dark:from-slate-900/80 dark:via-slate-950 dark:to-emerald-950/25",
    itemActive:
      "data-[state=checked]:bg-[#4285F4]/10 focus:bg-[#4285F4]/8 data-[highlighted]:bg-[#4285F4]/8",
  },
} as const;

export function AdsStudioTabsNav({
  value,
  onValueChange,
  tabs,
  studio,
  getBadgeCount,
  mobileNavLabel,
  approvalTabValue = "approval",
}: {
  value: string;
  onValueChange: (value: string) => void;
  tabs: AdsStudioTab[];
  studio: "meta" | "google";
  getBadgeCount?: (tabValue: string) => number;
  mobileNavLabel: string;
  approvalTabValue?: string;
}) {
  const activeTab = tabs.find((tab) => tab.value === value) ?? tabs[0];
  const ActiveIcon = activeTab.icon;
  const activeBadge = getBadgeCount?.(activeTab.value) ?? 0;
  const accent = STUDIO_ACCENTS[studio];
  const listClass = studio === "meta" ? "ads-studio-tabs--meta" : "ads-studio-tabs--google";

  return (
    <>
      <div className="md:hidden">
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger
            aria-label={mobileNavLabel}
            className={cn(
              "ads-studio-tabs-mobile-trigger h-11 gap-2 rounded-xl px-2.5 py-0 shadow-sm ring-0 focus:ring-2",
              accent.trigger,
              "[&>svg]:ml-0.5 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 [&>svg]:opacity-55",
            )}
          >
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                accent.iconWrap,
              )}
            >
              <ActiveIcon className="block h-3.5 w-3.5 shrink-0" aria-hidden />
            </div>
            <span className="min-w-0 flex-1 truncate text-left text-sm leading-tight">
              <span className="font-normal text-muted-foreground">Menu</span>
              <span className="mx-1.5 font-normal text-border/80" aria-hidden>
                ·
              </span>
              <span className="font-semibold text-foreground">{activeTab.label}</span>
            </span>
            {activeBadge > 0 ? (
              <Badge
                variant={activeTab.value === approvalTabValue ? "warning" : "secondary"}
                className="h-5 min-w-5 shrink-0 justify-center px-1.5 text-[10px] font-semibold"
              >
                {activeBadge}
              </Badge>
            ) : null}
          </SelectTrigger>
          <SelectContent
            align="start"
            className="max-h-[min(70vh,22rem)] rounded-2xl border-border/60 p-1.5 shadow-lg"
          >
            <p className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Navigatie
            </p>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const badgeCount = getBadgeCount?.(tab.value) ?? 0;
              const selected = tab.value === value;
              return (
                <SelectItem
                  key={tab.value}
                  value={tab.value}
                  className={cn(
                    "cursor-pointer rounded-xl py-2.5 pl-2.5 pr-9",
                    selected && accent.itemActive,
                  )}
                >
                  <span className="flex w-full items-center gap-3">
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        selected ? accent.iconWrap : "bg-muted/60 text-muted-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", selected && "font-semibold")}>{tab.label}</span>
                    </span>
                    {badgeCount > 0 ? (
                      <Badge
                        variant={tab.value === approvalTabValue ? "warning" : "secondary"}
                        className="h-5 min-w-5 justify-center px-1.5 text-[10px] font-semibold"
                      >
                        {badgeCount}
                      </Badge>
                    ) : null}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
      <TabsList className={cn("ads-studio-tabs hidden md:flex", listClass)}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const badgeCount = getBadgeCount?.(tab.value) ?? 0;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              aria-label={tab.label}
              title={tab.label}
              className="ads-studio-tabs-trigger"
            >
              <Icon className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              <span className="ads-studio-tabs-label ads-studio-tabs-label--compact shrink-0 leading-none">
                {compactTabLabel(tab.label)}
              </span>
              <span className="ads-studio-tabs-label ads-studio-tabs-label--full min-w-0 truncate leading-none">
                {tab.label}
              </span>
              {badgeCount > 0 ? (
                <Badge
                  variant={tab.value === approvalTabValue ? "warning" : "secondary"}
                  className="h-4 min-w-4 shrink-0 justify-center px-1 text-[9px] font-semibold leading-none"
                >
                  {badgeCount}
                </Badge>
              ) : null}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </>
  );
}
