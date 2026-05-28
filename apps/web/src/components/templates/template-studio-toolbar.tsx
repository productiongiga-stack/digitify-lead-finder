"use client";

import type { ComponentType } from "react";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@digitify/ui";
import {
  CalendarDays,
  FileText,
  LayoutGrid,
  LayoutTemplate,
  Mail,
  Megaphone,
  RefreshCw,
  Reply,
  Search,
  Sparkles,
  Star,
  BarChart3,
} from "lucide-react";
import { TEMPLATE_TYPES, type TemplateType } from "@/lib/template-studio";

const TYPE_ICONS: Record<TemplateType | "ALL", ComponentType<{ className?: string }>> = {
  ALL: LayoutGrid,
  OUTREACH: Mail,
  FOLLOW_UP: Reply,
  PROPOSAL: FileText,
  REPORT: BarChart3,
  BOOKING: CalendarDays,
  REVIEW: Star,
  REENGAGEMENT: RefreshCw,
  CUSTOM: Sparkles,
};

type TemplateStudioToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  campaignFilterId: string;
  onCampaignFilterChange: (value: string) => void;
  campaigns: Array<{ id: string; name: string }>;
  typeFilter: TemplateType | "ALL";
  onTypeFilterChange: (value: TemplateType | "ALL") => void;
  typeCounts: Partial<Record<TemplateType | "ALL", number>>;
  /** Sidebar: vertical filters for 2-column studio layout. */
  variant?: "default" | "sidebar";
};

export function TemplateStudioToolbar({
  search,
  onSearchChange,
  campaignFilterId,
  onCampaignFilterChange,
  campaigns,
  typeFilter,
  onTypeFilterChange,
  typeCounts,
  variant = "default",
}: TemplateStudioToolbarProps) {
  const isSidebar = variant === "sidebar";
  const typeEntries = [
    { id: "ALL" as const, label: "Alles" },
    ...TEMPLATE_TYPES.map((entry) => ({ id: entry.id, label: entry.label })),
  ] as Array<{ id: TemplateType | "ALL"; label: string }>;

  return (
    <div className={isSidebar ? "templates-toolbar templates-toolbar-sidebar" : "templates-toolbar"}>
      <div className="templates-toolbar-filters">
        <div className="templates-toolbar-search">
          <label htmlFor="template-search" className="templates-toolbar-label">
            <Search className="h-3.5 w-3.5" />
            Zoeken
          </label>
          <div className="relative min-w-0">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="template-search"
              className="templates-toolbar-search-input"
              placeholder="Zoek op naam of onderwerp…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>

        <div className="templates-toolbar-campaign">
          <p className="templates-toolbar-label">
            <Megaphone className="h-3.5 w-3.5" />
            Campagne-filter
          </p>
          <Select
            value={campaignFilterId || "all"}
            onValueChange={(value) => onCampaignFilterChange(value === "all" ? "" : value)}
          >
            <SelectTrigger className="templates-toolbar-select" data-testid="template-campaign-filter">
              <SelectValue placeholder="Alle templates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle campagnes + globaal</SelectItem>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="templates-toolbar-hint">
            {campaignFilterId
              ? `Bibliotheek gefilterd op ${campaigns.find((c) => c.id === campaignFilterId)?.name ?? "campagne"}.`
              : "Globale templates en items zonder campagne zijn altijd zichtbaar in Outbound."}
          </p>
        </div>
      </div>

      <div className="templates-toolbar-types-wrap">
        <div className="templates-toolbar-types-header">
          <p className="templates-toolbar-label">
            <LayoutTemplate className="h-3.5 w-3.5" />
            Type
          </p>
          {typeFilter !== "ALL" ? (
            <button
              type="button"
              className="templates-toolbar-reset"
              onClick={() => onTypeFilterChange("ALL")}
            >
              Wis filter
            </button>
          ) : (
            <span className="templates-toolbar-total">{typeCounts.ALL ?? 0} totaal</span>
          )}
        </div>
        <nav
          className={isSidebar ? "templates-toolbar-types templates-toolbar-types-vertical" : "templates-toolbar-types"}
          aria-label="Filter op template-type"
        >
          {typeEntries.map((entry) => {
            const Icon = TYPE_ICONS[entry.id];
            const active = typeFilter === entry.id;
            const count = typeCounts[entry.id] ?? 0;
            return (
              <button
                key={entry.id}
                type="button"
                data-active={active ? "true" : "false"}
                data-empty={count === 0 ? "true" : "false"}
                className={
                  isSidebar ? "templates-toolbar-type-chip templates-toolbar-type-chip-vertical" : "templates-toolbar-type-chip"
                }
                onClick={() => onTypeFilterChange(entry.id)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="templates-toolbar-type-icon">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate">{entry.label}</span>
                </span>
                <span className="templates-toolbar-type-count">{count}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
