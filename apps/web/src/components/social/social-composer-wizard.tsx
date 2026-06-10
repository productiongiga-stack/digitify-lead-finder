"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
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
  { id: "brand", label: "Merk", hint: "Welk merk en waar publiceer je?" },
  { id: "text", label: "Tekst", hint: "Wat wil je zeggen?" },
  { id: "media", label: "Beeld", hint: "Welk formaat en welke media?" },
  { id: "finish", label: "Klaar", hint: "Controleer en bewaar." },
];

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        {steps.map((item, index) => {
          const done = index < currentStep;
          const active = index === currentStep;
          return (
            <div key={item.id} className="flex min-w-0 flex-1 items-center gap-1">
              <button
                type="button"
                disabled={disabled || index > currentStep}
                onClick={() => index <= currentStep && onStepChange(index)}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 transition-colors",
                  active && "bg-primary/10",
                  done && !active && "opacity-80 hover:bg-muted/40",
                  index > currentStep && "cursor-default opacity-40",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                    active && "border-primary bg-primary text-primary-foreground",
                    done && !active && "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                    !active && !done && "border-border bg-background text-muted-foreground",
                  )}
                >
                  {done && !active ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className={cn("truncate text-[10px] font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                  {item.label}
                </span>
              </button>
              {index < steps.length - 1 ? <div className={cn("h-px w-2 shrink-0", done ? "bg-emerald-500/40" : "bg-border")} /> : null}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border bg-muted/10 px-4 py-3">
        <p className="text-sm font-semibold text-foreground">
          Stap {currentStep + 1}: {step?.label}
        </p>
        <p className="text-xs text-muted-foreground">{step?.hint}</p>
      </div>

      <div className="space-y-4">{children}</div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
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
