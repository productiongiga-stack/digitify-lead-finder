"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@digitify/ui";
import { ArrowRight, KeyRound, Palette, Sparkles, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatModelOptionLabel } from "@/lib/format-model-label";
import {
  filterModelsBySearch,
  groupModels,
  type ImageGeneratorMode,
  type ModelListItem,
  type VideoGeneratorMode,
} from "./generator-utils";

export const studioCardClass =
  "overflow-hidden border-border/60 shadow-sm transition-shadow hover:shadow-md";

export const studioSectionClass =
  "rounded-xl border border-dashed border-border/70 bg-muted/20 p-4";

export function CreativeStudioHero() {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-amber-500/10 via-background to-violet-500/10 p-6 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-amber-400/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 left-1/3 h-32 w-32 rounded-full bg-violet-400/15 blur-3xl"
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
            Open Generative AI
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Creative Studio</h1>
          <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
            Genereer on-brand afbeeldingen, reels en advertenties en stuur resultaten direct naar
            Social Planner of Meta Ads.
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 bg-background/80 backdrop-blur" asChild>
          <Link href="/settings/creative-studio">
            <KeyRound className="mr-2 h-4 w-4" />
            MuAPI-instellingen
          </Link>
        </Button>
      </div>
    </div>
  );
}

type StatProps = {
  hasKey?: boolean;
  balance?: string | number | null;
  brandEnabled?: boolean;
  isLoading?: boolean;
  monthGenerations?: number;
  monthSpendEur?: string | null;
  failedJobs?: number;
};

export function CreativeStudioStats({
  hasKey,
  balance,
  brandEnabled,
  isLoading,
  monthGenerations,
  monthSpendEur,
  failedJobs,
}: StatProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-[4.5rem] animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
    );
  }

  const items = [
    {
      label: "MuAPI",
      value: hasKey ? "Verbonden" : "Niet ingesteld",
      icon: KeyRound,
      tone: hasKey ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
    },
    {
      label: "Tegoed",
      value: balance != null ? String(balance) : hasKey ? "—" : "—",
      icon: Wallet,
      tone: "text-foreground",
    },
    {
      label: "Merkkit",
      value: brandEnabled ? "Actief" : "Uit",
      icon: Palette,
      tone: brandEnabled ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
    },
    {
      label: "Deze maand",
      value: monthGenerations != null ? String(monthGenerations) : "—",
      icon: Sparkles,
      tone: "text-foreground",
    },
    {
      label: "Geschatte kosten",
      value: monthSpendEur ?? "—",
      icon: Wallet,
      tone: "text-foreground",
    },
    {
      label: "Mislukt",
      value: failedJobs != null ? String(failedJobs) : "0",
      icon: Sparkles,
      tone: (failedJobs ?? 0) > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/80 px-4 py-3 shadow-sm"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            <item.icon className={cn("h-4 w-4", item.tone)} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={cn("truncate text-sm font-medium", item.tone)}>{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

type GeneratorShellProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  costLabel?: string | null;
  brandActive?: boolean;
  children: ReactNode;
};

export function GeneratorShell({
  icon: Icon,
  title,
  description,
  costLabel,
  brandActive,
  children,
}: GeneratorShellProps) {
  return (
    <Card className={cn(studioCardClass, "border-t-4 border-t-amber-500/70")}>
      <CardHeader className="space-y-3 border-b border-border/50 bg-muted/10 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Icon className="h-4 w-4" />
              </span>
              {title}
            </CardTitle>
            <CardDescription className="max-w-2xl">{description}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {costLabel ? (
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/5 font-mono text-xs">
                {costLabel} / run
              </Badge>
            ) : null}
            {brandActive ? (
              <Badge className="gap-1 bg-amber-600 hover:bg-amber-600">
                <Sparkles className="h-3 w-3" />
                Merk actief
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">{children}</CardContent>
    </Card>
  );
}

export function GeneratorModeToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; hint?: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? "default" : "outline"}
          className={cn(
            value === option.value && "bg-amber-600 hover:bg-amber-500",
            "h-auto flex-col items-start gap-0.5 px-3 py-2",
          )}
          onClick={() => onChange(option.value)}
        >
          <span>{option.label}</span>
          {option.hint ? <span className="text-[10px] font-normal opacity-80">{option.hint}</span> : null}
        </Button>
      ))}
    </div>
  );
}

export function ModelSelectField({
  models,
  mode,
  value,
  onChange,
  isLoading,
  search,
  onSearchChange,
}: {
  models: ModelListItem[];
  mode: ImageGeneratorMode | VideoGeneratorMode;
  value: string;
  onChange: (modelId: string) => void;
  isLoading?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const filtered = filterModelsBySearch(models, search);
  const groups = groupModels(filtered, mode);

  if (isLoading) return <Skeleton className="h-10 w-full" />;

  return (
    <div className="space-y-2">
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Zoek model..."
        className="h-9"
      />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {groups.map((group) => (
            <SelectGroup key={group.key}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.items.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  <span className="flex items-center gap-2">
                    {formatModelOptionLabel(item.label, item.costLabel)}
                    {item.isNew ? (
                      <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                        Nieuw
                      </Badge>
                    ) : null}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function PlacementFormatPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const options = [
    { value: "NONE", label: "Vrij", ratio: "—" },
    { value: "SQUARE", label: "Feed vierkant", ratio: "1:1" },
    { value: "PORTRAIT", label: "Feed portret", ratio: "4:5" },
    { value: "STORY", label: "Story / Reel", ratio: "9:16" },
    { value: "LANDSCAPE", label: "Landschap", ratio: "16:9" },
  ];

  return (
    <div className="space-y-2">
      <Label>Social placement</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label} {option.ratio !== "—" ? `(${option.ratio})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ModelMeta({ description, costDetail }: { description?: string | null; costDetail?: string | null }) {
  if (!description && !costDetail) return null;
  return (
    <div className="space-y-1 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      {description ? <p>{description}</p> : null}
      {costDetail ? <p className="font-mono text-[11px] leading-relaxed opacity-90">{costDetail}</p> : null}
    </div>
  );
}

type PreviewProps = {
  children: ReactNode;
  actions?: ReactNode;
  label?: string;
};

export function CreativePreview({ children, actions, label = "Resultaat" }: PreviewProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-background p-1 shadow-inner">
      <div className="rounded-[14px] border bg-card p-3">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="overflow-hidden rounded-xl bg-muted/30">{children}</div>
        {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function GenerateButton({
  children,
  disabled,
  isLoading,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  isLoading?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      size="lg"
      className="w-full bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md hover:from-amber-500 hover:to-amber-400 sm:w-auto"
      disabled={disabled}
      aria-busy={isLoading}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function HistorySectionHeader({
  title = "Recente creaties",
  href,
}: {
  title?: string;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      {href ? (
        <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
          <Link href={href}>
            Alle historie
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

export function CreativeEmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}
