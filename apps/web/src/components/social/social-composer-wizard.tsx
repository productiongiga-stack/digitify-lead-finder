"use client";

import type { ReactNode } from "react";
import {
  Building2,
  Check,
  CircleCheck,
  ImageIcon,
  Palette,
  PenLine,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@digitify/ui";
import { cn } from "@/lib/utils";

export type SocialWizardStep = {
  id: string;
  label: string;
  hint: string;
};

type Props = {
  steps: SocialWizardStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  canProceed: boolean;
  onNext: () => void;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
  disabled?: boolean;
};

export const SOCIAL_WIZARD_STEPS: SocialWizardStep[] = [
  { id: "account", label: "Account", hint: "Pagina en kanalen" },
  { id: "brand", label: "Merkkit", hint: "Kies je merk — vult hashtags, tone en CTA in" },
  { id: "text", label: "Tekst", hint: "Je caption" },
  { id: "media", label: "Beeld", hint: "Afbeelding of video" },
  { id: "overview", label: "Klaar", hint: "Opslaan of inplannen" },
];

const STEP_ICONS: Record<string, LucideIcon> = {
  account: Building2,
  brand: Palette,
  text: PenLine,
  media: ImageIcon,
  overview: CircleCheck,
};

function WizardStepNode({
  index,
  item,
  done,
  active,
  disabled,
  onSelect,
}: {
  index: number;
  item: SocialWizardStep;
  done: boolean;
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const Icon = STEP_ICONS[item.id];
  const clickable = !disabled && (done || active);

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onSelect}
      className={cn(
        "group relative z-10 flex min-w-0 flex-1 flex-col items-center gap-2 px-1 text-center transition",
        !clickable && "cursor-default",
        clickable && "hover:opacity-90",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold shadow-sm transition-all",
          active && "border-amber-500 bg-amber-500 text-white shadow-amber-500/25 ring-4 ring-amber-500/15",
          done && !active && "border-emerald-500 bg-emerald-500 text-white shadow-emerald-500/20",
          !active && !done && "border-border/80 bg-background text-muted-foreground",
        )}
      >
        {done && !active ? <Check className="h-4 w-4" strokeWidth={2.5} /> : Icon ? <Icon className="h-4 w-4" /> : index + 1}
      </span>
      <span
        className={cn(
          "max-w-[5.5rem] truncate text-[11px] font-semibold leading-tight sm:max-w-none",
          active && "text-foreground",
          done && !active && "text-emerald-700 dark:text-emerald-300",
          !active && !done && "text-muted-foreground",
        )}
      >
        {item.label}
      </span>
    </button>
  );
}

export function SocialComposerWizard({
  steps,
  currentStep,
  onStepChange,
  canProceed,
  onNext,
  onBack,
  children,
  footer,
  disabled = false,
}: Props) {
  const step = steps[currentStep];
  const isLast = currentStep >= steps.length - 1;
  const progressPercent = steps.length > 1 ? (currentStep / (steps.length - 1)) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-gradient-to-b from-muted/30 to-background px-3 py-4 sm:px-5">
        <div className="mb-3 flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>
            Stap {currentStep + 1} van {steps.length}
          </span>
          <span>{Math.round(progressPercent)}% voltooid</span>
        </div>

        <div className="relative">
          <div className="absolute left-[10%] right-[10%] top-[18px] h-[2px] rounded-full bg-border/80" />
          <div
            className="absolute left-[10%] top-[18px] h-[2px] rounded-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-300 ease-out"
            style={{ width: `calc(${progressPercent}% * 0.8 + ${progressPercent > 0 ? 0 : 0}px)`, maxWidth: "80%" }}
          />

          <div className="relative flex items-start justify-between gap-1">
            {steps.map((item, index) => {
              const done = index < currentStep;
              const active = index === currentStep;
              return (
                <WizardStepNode
                  key={item.id}
                  index={index}
                  item={item}
                  done={done}
                  active={active}
                  disabled={disabled || index > currentStep}
                  onSelect={() => index <= currentStep && onStepChange(index)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {step ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/15 bg-amber-50/40 px-3 py-2.5 dark:bg-amber-950/15">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-700 dark:text-amber-300">
            {currentStep + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{step.label}</p>
            {step.hint ? <p className="text-xs text-muted-foreground">{step.hint}</p> : null}
          </div>
        </div>
      ) : null}

      <div>{children}</div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <Button type="button" variant="ghost" size="sm" disabled={disabled || currentStep === 0} onClick={onBack}>
          Terug
        </Button>
        {isLast ? (
          footer ?? null
        ) : (
          <Button type="button" size="sm" disabled={disabled || !canProceed} onClick={onNext}>
            Volgende
          </Button>
        )}
      </div>
    </div>
  );
}
