"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Layers3,
  Megaphone,
  Settings2,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge, Button } from "@digitify/ui";
import type { CampaignScoreResult } from "@/lib/meta-ads-campaign-score";
import { cn } from "@/lib/utils";

type BuilderStep = "campaign" | "adsets" | "ads" | "review";

type OperationalRequirement = {
  code: string;
  title: string;
  description: string;
  nextStep: string;
};

export type MetaStudioStepTodos = {
  campaign: string[];
  adsets: string[];
  ads: string[];
};

const STEP_SECTIONS: Array<{
  id: "campaign" | "adsets" | "ads";
  step: BuilderStep;
  label: string;
  icon: typeof Megaphone;
}> = [
  { id: "campaign", step: "campaign", label: "Campagne", icon: Megaphone },
  { id: "adsets", step: "adsets", label: "Ad sets", icon: Target },
  { id: "ads", step: "ads", label: "Ads", icon: Layers3 },
];

function scoreTone(score: number) {
  if (score >= 85) return "text-emerald-700 dark:text-emerald-300";
  if (score >= 65) return "text-amber-800 dark:text-amber-200";
  return "text-rose-700 dark:text-rose-300";
}

function requirementCta(code: string): { label: string; href?: string; step?: BuilderStep } {
  if (code === "META_ACCOUNT_NOT_SELECTED") return { label: "Module-instellingen", href: undefined };
  if (code === "META_MEDIA_MISSING") return { label: "Naar advertenties", step: "ads" };
  if (["META_NOT_CONNECTED", "META_SCOPE_MISSING", "META_PAGE_MISSING"].includes(code)) {
    return { label: "Naar integraties", href: "/settings/integrations" };
  }
  return { label: "Instellingen openen" };
}

function splitAiTip(tip: string) {
  const colonIndex = tip.indexOf(": ");
  if (colonIndex !== -1) {
    return { title: tip.slice(0, colonIndex), body: tip.slice(colonIndex + 2) };
  }

  for (const pattern of [" om ", " zodat ", " bijvoorbeeld ", " als je ", " als "]) {
    const index = tip.indexOf(pattern);
    if (index > 16 && index < tip.length - 12) {
      return {
        title: tip.slice(0, index).replace(/[.,;]$/, ""),
        body: tip
          .slice(index + pattern.length)
          .trim()
          .replace(/^[a-z]/, (char) => char.toUpperCase()),
      };
    }
  }

  return { title: tip, body: null as string | null };
}

function AiTipCards({ tips, startIndex = 0, compact = false }: { tips: string[]; startIndex?: number; compact?: boolean }) {
  return (
    <ul className={cn("space-y-2", compact && "pt-0.5")}>
      {tips.map((tip, index) => {
        const { title, body } = splitAiTip(tip);
        return (
          <li
            key={tip}
            className="rounded-lg border border-[#1877F2]/15 bg-background/80 px-2.5 py-2 shadow-sm dark:bg-slate-950/55"
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1877F2]/10 text-[10px] font-bold tabular-nums text-[#1877F2] dark:bg-[#1877F2]/15 dark:text-[#8CB4FF]">
                {startIndex + index + 1}
              </span>
              <div className="min-w-0 flex-1">
                {body ? (
                  <>
                    <p className="text-xs font-semibold leading-snug text-foreground">{title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{body}</p>
                  </>
                ) : (
                  <p className="text-xs leading-relaxed text-foreground/90">{title}</p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function BuilderStepDetails({
  label,
  icon: Icon,
  complete,
  todos,
  step,
  onStepClick,
}: {
  label: string;
  icon: typeof Megaphone;
  complete: boolean;
  todos: string[];
  step: BuilderStep;
  onStepClick: (step: BuilderStep) => void;
}) {
  const openCount = todos.length;

  return (
    <details className="group rounded-lg border border-border/50 bg-background/70 dark:bg-slate-950/50">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 marker:content-none [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-open:rotate-180" />
        {complete ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
        ) : (
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 text-xs font-semibold">{label}</span>
        {complete ? (
          <Badge variant="success" className="h-5 px-1.5 text-[10px] font-normal">
            OK
          </Badge>
        ) : (
          <Badge variant="warning" className="h-5 min-w-5 justify-center px-1.5 text-[10px] font-normal tabular-nums">
            {openCount}
          </Badge>
        )}
      </summary>
      <div className="border-t border-border/40 px-2.5 pb-2.5 pt-1">
        {complete ? (
          <p className="text-xs text-muted-foreground">Deze stap is compleet.</p>
        ) : todos.length ? (
          <ul className="space-y-1">
            {todos.slice(0, 6).map((item) => (
              <li key={item} className="flex gap-1.5 text-xs leading-snug text-foreground/90">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
            {todos.length > 6 ? (
              <li className="text-[11px] text-muted-foreground">+{todos.length - 6} andere punt(en)</li>
            ) : null}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Open de stap om velden te controleren.</p>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2 h-7 w-full text-xs"
          onClick={() => onStepClick(step)}
        >
          Naar {label.toLowerCase()}
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>
    </details>
  );
}

export function MetaAdsStudioSummary({
  adsetCount,
  variantCount,
  placementCount,
  score,
  builderCompletionPercent,
  readyToSave,
  campaignComplete,
  adsetsComplete,
  adsComplete,
  stepTodos,
  operationalRequirements,
  onStepClick,
  onOpenSettings,
}: {
  adsetCount: number;
  variantCount: number;
  placementCount: number;
  score: CampaignScoreResult;
  builderCompletionPercent: number;
  readyToSave: boolean;
  campaignComplete: boolean;
  adsetsComplete: boolean;
  adsComplete: boolean;
  stepTodos: MetaStudioStepTodos;
  operationalRequirements: OperationalRequirement[];
  onStepClick: (step: BuilderStep) => void;
  onOpenSettings: () => void;
}) {
  const stepComplete = {
    campaign: campaignComplete,
    adsets: adsetsComplete,
    ads: adsComplete,
  };

  const openChecks = score.checks.filter((check) => !check.ok).slice(0, 4);
  const aiTips = score.tips;
  const aiTipsPreview = aiTips.slice(0, 2);
  const aiTipsExtra = aiTips.slice(2);
  const blockerCount = operationalRequirements.length;

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-xl border border-[#1877F2]/15 bg-gradient-to-r from-slate-50/90 via-background to-blue-50/35 p-3 dark:from-slate-950 dark:to-blue-950/20">
        <div className="flex items-center gap-3">
          <div
            className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-background ring-2 ring-[#1877F2]/20"
            role="img"
            aria-label={`Voortgang ${builderCompletionPercent} procent`}
          >
            <span className={cn("text-base font-bold tabular-nums", scoreTone(score.score))}>{score.score}</span>
            <svg className="absolute inset-0 h-14 w-14 -rotate-90" viewBox="0 0 56 56" aria-hidden>
              <circle cx="28" cy="28" r="24" className="stroke-muted/40" strokeWidth="4" fill="none" />
              <circle
                cx="28"
                cy="28"
                r="24"
                className="stroke-[#1877F2] transition-all duration-500"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${(builderCompletionPercent / 100) * 150.8} 150.8`}
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">Bouwvoortgang</p>
              <Badge variant={readyToSave ? "success" : "warning"} className="text-[10px] font-normal">
                {readyToSave ? "Klaar om op te slaan" : "Nog niet compleet"}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Checklist {builderCompletionPercent}% · AI-score {score.score}/100 ({score.label})
            </p>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          {STEP_SECTIONS.map((section) => (
            <BuilderStepDetails
              key={section.id}
              label={section.label}
              icon={section.icon}
              complete={stepComplete[section.id]}
              todos={stepTodos[section.id]}
              step={section.step}
              onStepClick={onStepClick}
            />
          ))}
        </div>
        {readyToSave ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2 h-7 w-full text-xs"
            onClick={() => onStepClick("review")}
          >
            Naar controleren
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border bg-muted/20 px-2.5 py-2 text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Ad sets</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{adsetCount}</p>
          <p className="text-[10px] text-muted-foreground">{placementCount} placements</p>
        </div>
        <div className="rounded-lg border bg-muted/20 px-2.5 py-2 text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Ads</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{variantCount}</p>
          <p className="text-[10px] text-muted-foreground">varianten</p>
        </div>
        <div className="rounded-lg border bg-muted/20 px-2.5 py-2 text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Blokkades</p>
          <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", blockerCount ? "text-amber-700" : "text-emerald-700")}>
            {blockerCount}
          </p>
          <p className="text-[10px] text-muted-foreground">{blockerCount ? "actie nodig" : "geen"}</p>
        </div>
      </div>

      {openChecks.length ? (
        <details className="group rounded-xl border border-amber-500/25 bg-amber-500/5">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-3 marker:content-none [&::-webkit-details-marker]:hidden">
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-amber-800/70 transition group-open:rotate-180 dark:text-amber-200/70" />
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-800 dark:text-amber-200" />
            <span className="min-w-0 flex-1 text-xs font-semibold text-amber-950 dark:text-amber-100">Verbeter je score</span>
            <Badge variant="warning" className="h-5 min-w-5 justify-center px-1.5 text-[10px] font-normal tabular-nums">
              {openChecks.length}
            </Badge>
          </summary>
          <div className="space-y-2 border-t border-amber-500/20 px-3 pb-3 pt-2">
            <p className="text-[11px] leading-relaxed text-amber-900/75 dark:text-amber-100/75">
              Los deze punten op om je AI-score te verhogen.
            </p>
            <ul className="space-y-2">
              {openChecks.map((check, index) => (
                <li
                  key={check.label}
                  className="rounded-lg border border-amber-500/15 bg-background/80 px-2.5 py-2 shadow-sm dark:bg-slate-950/55"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[10px] font-bold tabular-nums text-amber-800 dark:bg-amber-500/20 dark:text-amber-100">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold leading-snug text-amber-950 dark:text-amber-50">{check.label}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{check.hint}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}

      {aiTips.length ? (
        <details className="group rounded-xl border bg-muted/20">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-3 marker:content-none [&::-webkit-details-marker]:hidden">
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-open:rotate-180" />
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#1877F2] dark:text-[#8CB4FF]" />
            <span className="min-w-0 flex-1 text-xs font-semibold text-muted-foreground">AI-tips</span>
            <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5 text-[10px] font-normal tabular-nums">
              {aiTips.length}
            </Badge>
          </summary>
          <div className="space-y-2 border-t border-border/40 px-3 pb-3 pt-2">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Concrete suggesties op basis van je huidige campagne-opbouw.
            </p>
            <AiTipCards tips={aiTipsPreview} />
            {aiTipsExtra.length ? (
              <details className="group/more overflow-hidden rounded-lg border border-[#1877F2]/15 bg-[#1877F2]/[0.03] dark:bg-[#1877F2]/5">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-2.5 text-xs font-medium text-foreground/90 marker:content-none hover:bg-[#1877F2]/[0.04] [&::-webkit-details-marker]:hidden dark:hover:bg-[#1877F2]/10">
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-open/more:rotate-180" />
                  Meer info
                  <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px] font-normal tabular-nums">
                    {aiTipsExtra.length}
                  </Badge>
                </summary>
                <div className="space-y-2 border-t border-[#1877F2]/10 px-2.5 pb-2.5 pt-2">
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Extra aanbevelingen voor adsets, varianten en doelgroepen.
                  </p>
                  <AiTipCards tips={aiTipsExtra} startIndex={aiTipsPreview.length} compact />
                </div>
              </details>
            ) : null}
          </div>
        </details>
      ) : null}

      <details className="group rounded-xl border bg-muted/20">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-3 marker:content-none [&::-webkit-details-marker]:hidden">
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-open:rotate-180" />
          {blockerCount ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          )}
          <span className="min-w-0 flex-1 font-medium">Operationeel</span>
          {blockerCount ? (
            <Badge variant="warning" className="h-5 px-1.5 text-[10px] font-normal tabular-nums">
              {blockerCount} open
            </Badge>
          ) : (
            <Badge variant="success" className="h-5 px-1.5 text-[10px] font-normal">
              OK
            </Badge>
          )}
        </summary>
        <div className="border-t border-border/40 px-3 pb-3 pt-2">
          {operationalRequirements.length ? (
            <ul className="space-y-2">
              {operationalRequirements.map((requirement) => {
                const cta = requirementCta(requirement.code);
                const settingsAction =
                  requirement.code === "META_ACCOUNT_NOT_SELECTED" ? onOpenSettings : undefined;

                return (
                  <li
                    key={requirement.code}
                    className="rounded-lg border border-amber-500/20 bg-background/80 px-2.5 py-2 dark:bg-slate-950/60"
                  >
                    <p className="text-sm font-medium">{requirement.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{requirement.description}</p>
                    <p className="mt-1 text-xs font-medium text-foreground">{requirement.nextStep}</p>
                    <div className="mt-2">
                      {cta.href ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                          <Link href={cta.href}>
                            {cta.label}
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      ) : cta.step ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => onStepClick(cta.step!)}
                        >
                          {cta.label}
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      ) : settingsAction ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={settingsAction}>
                          <Settings2 className="mr-1 h-3 w-3" />
                          {cta.label}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onOpenSettings}>
                          <Settings2 className="mr-1 h-3 w-3" />
                          {cta.label}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Koppeling en account zijn in orde voor publiceren.
            </p>
          )}
        </div>
      </details>

      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-full text-xs text-muted-foreground"
        onClick={() => onStepClick(readyToSave ? "review" : "campaign")}
      >
        <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
        {readyToSave ? "Ga naar controleren" : "Start bij campagne"}
        <ArrowRight className="ml-1 h-3 w-3" />
      </Button>
    </div>
  );
}
