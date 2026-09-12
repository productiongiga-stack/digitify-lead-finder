"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Mail, Search, Target, X } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@digitify/ui";

const STORAGE_KEY = "digitify:onboarding:core-flow:v1";

const steps = [
  { number: "01", title: "Zoek een lead", description: "Vind bedrijven in een niche of regio.", href: "/leads/search", icon: Search },
  { number: "02", title: "Beoordeel de kans", description: "Bekijk score, factoren en contactgegevens.", href: "/leads", icon: Target },
  { number: "03", title: "Neem contact op", description: "Maak een draft en laat die eerst goedkeuren.", href: "/contacts", icon: Mail },
] as const;

export function OnboardingChecklist() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(STORAGE_KEY) !== "dismissed");
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "dismissed");
    } catch {
      // Keep the checklist dismissible when storage is unavailable.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <Card className="mb-4 overflow-hidden border-primary/20 bg-primary/[0.03]">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
            Start met je eerste verkoopflow
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Doorloop drie stappen en ga van zoeken naar een goedgekeurd contactmoment.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-2 h-8 w-8 shrink-0"
          title="Onboarding verbergen"
          aria-label="Onboarding verbergen"
          onClick={dismiss}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </CardHeader>
      <CardContent className="grid gap-2 pt-0 md:grid-cols-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <Link
              key={step.number}
              href={step.href}
              className="group flex min-w-0 items-center gap-3 rounded-lg border border-border/70 bg-background/80 p-3 transition-colors hover:border-primary/40 hover:bg-background"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                {step.number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  {step.title}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{step.description}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
