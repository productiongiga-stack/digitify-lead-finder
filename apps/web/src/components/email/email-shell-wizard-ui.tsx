"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@digitify/ui";
import { WIZARD_FONT_OPTIONS, type ShellFontFamily } from "@/lib/email-shell-fonts";

type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
};

export function ChoicePills<T extends string>({
  value,
  options,
  onChange,
  columns,
  compact = true,
}: {
  value: T;
  options: Array<ChoiceOption<T>>;
  onChange: (value: T) => void;
  columns?: 2 | 3 | 4;
  compact?: boolean;
}) {
  const gridClass =
    columns === 4
      ? "grid grid-cols-2 gap-1.5 sm:grid-cols-4"
      : columns === 3
        ? "grid grid-cols-3 gap-1.5"
        : columns === 2
          ? "grid grid-cols-2 gap-1.5"
          : "flex flex-wrap gap-1";

  const pillClass = compact
    ? "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all"
    : "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-all";

  const gridCellClass = compact
    ? "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-center transition-all"
    : "flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-center transition-all";

  return (
    <div
      className={[
        gridClass,
        columns ? "rounded-lg border border-border/50 bg-muted/20 p-1" : "",
      ].join(" ")}
      role="radiogroup"
    >
      {options.map((option) => {
        const selected = value === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.hint}
            onClick={() => onChange(option.value)}
            className={[
              columns ? gridCellClass : pillClass,
              selected
                ? columns
                  ? "border-primary/60 bg-primary/10 text-primary shadow-sm ring-1 ring-primary/25"
                  : "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-transparent bg-background/80 text-foreground hover:border-border hover:bg-background",
            ].join(" ")}
          >
            {Icon ? <Icon className={["h-3.5 w-3.5", selected ? "text-primary" : "text-muted-foreground"].join(" ")} /> : null}
            <span className={columns ? "text-[11px] font-semibold leading-tight" : ""}>{option.label}</span>
            {option.hint && columns ? (
              <span className="line-clamp-2 text-[9px] leading-snug text-muted-foreground">{option.hint}</span>
            ) : null}
            {selected && !columns ? <Check className="h-2.5 w-2.5 opacity-90" /> : null}
          </button>
        );
      })}
    </div>
  );
}

export function PresetStarterChips({
  items,
  onSelect,
  resetLabel = "Reset blank",
  onReset,
  resetHint,
}: {
  items: Array<{ id: string; label: string; hint?: string }>;
  onSelect: (id: string) => void;
  resetLabel?: string;
  onReset?: () => void;
  resetHint?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.hint}
          onClick={() => onSelect(item.id)}
          className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2.5 py-1 text-[10px] font-medium text-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
        >
          <Sparkles className="h-3 w-3 text-primary/80" />
          {item.label}
        </button>
      ))}
      {onReset ? (
        <button
          type="button"
          title={resetHint}
          onClick={onReset}
          className="inline-flex items-center rounded-full border border-dashed border-border/80 px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-all hover:border-foreground/30 hover:bg-muted/30 hover:text-foreground"
        >
          {resetLabel}
        </button>
      ) : null}
    </div>
  );
}

export function ControlCard({
  label,
  hint,
  icon: Icon,
  children,
}: {
  label: string;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-start gap-2.5 border-b border-border/40 bg-muted/15 px-3 py-2">
        {Icon ? (
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">{label}</p>
          {hint ? <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
      <div className="p-2.5">{children}</div>
    </section>
  );
}

/** @deprecated Use ControlCard */
export function OptionSection({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return <ControlCard label={label} hint={hint}>{children}</ControlCard>;
}

export function WizardSidebar({
  stepLabel,
  stepDescription,
  stepIndex,
  stepTotal,
  tip,
  children,
}: {
  stepLabel: string;
  stepDescription?: string;
  stepIndex?: number;
  stepTotal?: number;
  tip?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-muted/25 via-background to-background">
      <div className="shrink-0 border-b border-border/50 px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">{stepLabel}</p>
            {stepDescription ? (
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{stepDescription}</p>
            ) : null}
          </div>
          {stepIndex && stepTotal ? (
            <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
              {stepIndex}/{stepTotal}
            </span>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">{children}</div>

      {tip ? (
        <div className="shrink-0 border-t border-border/50 bg-muted/10 px-3 py-2">
          <p className="text-[10px] leading-relaxed text-muted-foreground">{tip}</p>
        </div>
      ) : null}
    </div>
  );
}

export function FontFamilySelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ShellFontFamily;
  onChange: (value: ShellFontFamily) => void;
}) {
  const selected = WIZARD_FONT_OPTIONS.find((font) => font.id === value);

  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(next as ShellFontFamily)}>
        <SelectTrigger className="h-8 rounded-lg border-border/70 bg-background text-xs shadow-sm">
          <SelectValue placeholder="Kies lettertype">{selected?.label ?? value}</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[min(280px,50vh)]">
          {(["sans", "serif", "mono"] as const).map((category) => {
            const fonts = WIZARD_FONT_OPTIONS.filter((font) => font.category === category);
            if (fonts.length === 0) return null;
            const groupLabel =
              category === "sans" ? "Sans-serif" : category === "serif" ? "Serif" : "Monospace";
            return (
              <div key={category}>
                <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {groupLabel}
                </p>
                {fonts.map((font) => (
                  <SelectItem key={font.id} value={font.id} className="text-xs">
                    {font.label}
                  </SelectItem>
                ))}
              </div>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

type WizardStepItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export function WizardStepTabs({
  steps,
  currentIndex,
  onStepClick,
}: {
  steps: WizardStepItem[];
  currentIndex: number;
  onStepClick: (index: number) => void;
}) {
  return (
    <nav aria-label="Wizard-stappen" className="mx-auto max-w-full overflow-x-auto">
      <ol className="inline-flex w-max max-w-full items-center gap-0.5 rounded-lg border border-border/70 bg-muted/25 p-0.5">
        {steps.map((item, index) => {
          const active = index === currentIndex;
          const done = index < currentIndex;
          const upcoming = index > currentIndex;
          const Icon = item.icon;

          return (
            <li key={item.id}>
              <button
                type="button"
                disabled={upcoming}
                onClick={() => (done || active) && onStepClick(index)}
                aria-current={active ? "step" : undefined}
                title={item.label}
                className={[
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all",
                  active
                    ? "bg-background text-primary shadow-sm ring-1 ring-border/60"
                    : done
                      ? "text-foreground hover:bg-background/70"
                      : "cursor-not-allowed text-muted-foreground/70",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    active
                      ? "bg-primary text-primary-foreground"
                      : done
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground",
                  ].join(" ")}
                >
                  {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                </span>
                <span>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function CollapsiblePanel({
  title,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-md border border-border/60 bg-muted/10">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left"
      >
        <span className="flex items-center gap-2 text-[11px] font-semibold text-foreground">
          {title}
          {badge}
        </span>
        {open ? (
          <ChevronUp className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open ? <div className="border-t border-border/50 px-2.5 py-1.5">{children}</div> : null}
    </div>
  );
}
