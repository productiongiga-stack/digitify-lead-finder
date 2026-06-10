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
  { id: "account", label: "Account", hint: "Pagina en kanalen" },
  { id: "brand", label: "Merkkit", hint: "Optioneel — standaardvelden" },
  { id: "text", label: "Tekst", hint: "Je caption" },
  { id: "media", label: "Beeld", hint: "Afbeelding of video" },
  { id: "overview", label: "Klaar", hint: "Opslaan of inplannen" },
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
    <div className="space-y-3">
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
        {steps.map((item, index) => {
          const done = index < currentStep;
          const active = index === currentStep;
          return (
            <div key={item.id} className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                disabled={disabled || index > currentStep}
                onClick={() => index <= currentStep && onStepChange(index)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium transition-colors",
                  active && "border-primary bg-primary/10 text-foreground",
                  done && !active && "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
                  !active && !done && "border-border text-muted-foreground",
                  index > currentStep && "cursor-default opacity-40",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                    active && "bg-primary text-primary-foreground",
                    done && !active && "bg-emerald-500 text-white",
                    !active && !done && "bg-muted text-muted-foreground",
                  )}
                >
                  {done && !active ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
              {index < steps.length - 1 ? <div className={cn("h-px w-2", done ? "bg-emerald-500/40" : "bg-border")} /> : null}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{step?.label}</span>
        {step?.hint ? ` — ${step.hint}` : ""}
      </p>

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
