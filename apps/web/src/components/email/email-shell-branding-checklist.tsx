"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Badge, Button } from "@digitify/ui";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Sparkles,
} from "lucide-react";
import {
  getEmailShellBrandingChecklist,
  getEmailShellChecklistSummary,
  type EmailShellBrandingContext,
  type EmailShellChecklistAction,
} from "@/lib/email-shell-branding";

type EmailShellBrandingChecklistProps = {
  branding: EmailShellBrandingContext;
  compact?: boolean;
  onAction?: (action: EmailShellChecklistAction, fieldId?: string) => void;
};

function ChecklistProgress({ percent, complete, total }: { percent: number; complete: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-11 w-11 shrink-0">
        <svg className="h-11 w-11 -rotate-90" viewBox="0 0 36 36" aria-hidden>
          <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-muted/50" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            className="stroke-primary transition-all duration-500"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${percent} 100`}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
          {percent}%
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold">
          {complete}/{total} ingevuld
        </p>
        <p className="text-xs text-muted-foreground">Preview gebruikt je huidige gegevens</p>
      </div>
    </div>
  );
}

export function EmailShellBrandingChecklist({
  branding,
  compact = false,
  onAction,
}: EmailShellBrandingChecklistProps) {
  const items = useMemo(() => getEmailShellBrandingChecklist(branding), [branding]);
  const summary = useMemo(() => getEmailShellChecklistSummary(items), [items]);
  const missing = items.filter((item) => !item.complete);

  if (summary.completeCount === summary.total) {
    return (
      <div
        className={[
          "rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/8 via-card to-card",
          compact ? "p-3" : "p-4 sm:p-5",
        ].join(" ")}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Mail-gegevens compleet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Voorbeelden en wizard tonen je branding, afzender, handtekening en footer.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleAction = (action: EmailShellChecklistAction, fieldId?: string) => {
    if (onAction) {
      onAction(action, fieldId);
      return;
    }
    if (action.type === "link") {
      window.location.href = action.href;
    }
  };

  return (
    <div
      className={[
        "overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/6 via-card to-primary/5",
        compact ? "p-3" : "p-4 sm:p-5",
      ].join(" ")}
    >
      <div className={["flex gap-4", compact ? "flex-col" : "flex-col sm:flex-row sm:items-center sm:justify-between"].join(" ")}>
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/12 text-amber-600">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">Vul je mail-gegevens aan</p>
              {summary.missingRequired.length > 0 ? (
                <Badge variant="outline" className="border-amber-500/30 text-[10px] text-amber-700">
                  {summary.missingRequired.length} verplicht
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-emerald-500/30 text-[10px] text-emerald-700">
                  <Sparkles className="h-3 w-3" />
                  Basis klaar
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Voorbeelden en wizard gebruiken wat je al hebt ingevuld. Ontbrekende velden blijven leeg in de preview.
            </p>
          </div>
        </div>
        {!compact ? <ChecklistProgress percent={summary.progressPercent} complete={summary.completeCount} total={summary.total} /> : null}
      </div>

      <ul className={["mt-4 grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-2"].join(" ")}>
        {(compact ? missing.slice(0, 3) : missing).map((item) => (
          <li key={item.id}>
            {item.action.type === "link" && !onAction ? (
              <Link
                href={item.action.href}
                className="group flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/80 px-3 py-2.5 transition-colors hover:border-primary/35 hover:bg-primary/5"
              >
                <ChecklistItemContent item={item} />
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => handleAction(item.action, item.fieldId)}
                className="group flex w-full items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/80 px-3 py-2.5 text-left transition-colors hover:border-primary/35 hover:bg-primary/5"
              >
                <ChecklistItemContent item={item} />
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {compact && missing.length > 3 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {missing.length - 3} andere velden openen via Mail-opmaak → checklist.
        </p>
      ) : null}

      {!compact && summary.missingRequired.length === 0 && summary.missingOptional.length > 0 ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Optionele velden maken je mails professioneler — logo, slogan, handtekening en footer.
        </p>
      ) : null}
    </div>
  );
}

function ChecklistItemContent({
  item,
}: {
  item: ReturnType<typeof getEmailShellBrandingChecklist>[number];
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
      <div className="min-w-0">
        <p className="text-xs font-semibold">
          {item.label}
          {item.required ? <span className="ml-1 text-amber-600">*</span> : null}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{item.description}</p>
      </div>
    </div>
  );
}

export function EmailShellBrandingChecklistCompactActions({
  branding,
  onAction,
}: {
  branding: EmailShellBrandingContext;
  onAction?: (action: EmailShellChecklistAction, fieldId?: string) => void;
}) {
  const items = useMemo(() => getEmailShellBrandingChecklist(branding), [branding]);
  const missing = items.filter((item) => !item.complete).slice(0, 3);

  if (missing.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {missing.map((item) => (
        <Button
          key={item.id}
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 border-amber-500/25 bg-amber-500/5 px-2 text-[11px] text-amber-800 hover:bg-amber-500/10"
          onClick={() => {
            if (item.action.type === "link") {
              window.location.href = item.action.href;
              return;
            }
            onAction?.(item.action, item.fieldId);
          }}
        >
          {item.label}
          <ArrowRight className="h-3 w-3" />
        </Button>
      ))}
    </div>
  );
}
