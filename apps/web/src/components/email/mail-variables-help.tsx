"use client";

import { useMemo, useState, type ElementType } from "react";
import { Badge, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@digitify/ui";
import { BookOpen, Building2, CalendarDays, ChevronDown, ChevronRight, FileSignature, FileText, MousePointer, User } from "lucide-react";
import { getMailVariablesByCategory, MAIL_VARIABLE_REGISTRY } from "@/lib/mail-variables";

type MailVariablesHelpProps = {
  onInsert?: (key: string) => void;
  defaultOpen?: boolean;
  title?: string;
  insertHint?: string;
};

const CATEGORY_ICONS: Record<string, ElementType> = {
  Lead: Building2,
  Afzender: User,
  Rapport: BookOpen,
  Offerte: FileSignature,
  Acties: MousePointer,
  Systeem: CalendarDays,
};

const CATEGORY_COLORS: Record<string, string> = {
  Lead: "bg-blue-500/10 text-blue-700 border-blue-500/20 hover:bg-blue-500/15 dark:text-blue-400",
  Afzender: "bg-purple-500/10 text-purple-700 border-purple-500/20 hover:bg-purple-500/15 dark:text-purple-400",
  Rapport: "bg-amber-500/10 text-amber-700 border-amber-500/20 hover:bg-amber-500/15 dark:text-amber-400",
  Offerte: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 hover:bg-emerald-500/15 dark:text-emerald-400",
  Acties: "bg-rose-500/10 text-rose-700 border-rose-500/20 hover:bg-rose-500/15 dark:text-rose-400",
  Systeem: "bg-muted text-muted-foreground border-border hover:bg-muted/80",
};

export function MailVariablesHelp({
  onInsert,
  defaultOpen = false,
  title = "Mail Variables",
  insertHint = "Klik op een variable om die in te voegen.",
}: MailVariablesHelpProps) {
  const [open, setOpen] = useState(defaultOpen);
  const grouped = useMemo(() => getMailVariablesByCategory(), []);
  const clickable = typeof onInsert === "function";

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
          <Badge variant="secondary" className="text-xs">{MAIL_VARIABLE_REGISTRY.length}</Badge>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open ? (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          <p className="text-xs text-muted-foreground">
            {clickable ? insertHint : "Gebruik deze variables in onderwerp en bericht met de notatie {{variable}}."}
          </p>
          <TooltipProvider delayDuration={200}>
            {Object.entries(grouped).map(([category, placeholders]) => {
              const Icon = CATEGORY_ICONS[category] || FileText;
              return (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {category}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {placeholders.map((item) => {
                      const colorClass = CATEGORY_COLORS[category] || "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100";
                      const chip = (
                        <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${colorClass}`}>
                          <code className="font-mono">{`{{${item.key}}}`}</code>
                        </span>
                      );

                      if (!clickable) {
                        return (
                          <Tooltip key={item.key}>
                            <TooltipTrigger asChild>{chip}</TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="font-medium">{item.label}</p>
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                              <p className="text-xs mt-1">
                                Voorbeeld: <span className="font-mono text-primary">{item.example}</span>
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      }

                      return (
                        <Tooltip key={item.key}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${colorClass}`}
                              onClick={() => onInsert(item.key)}
                            >
                              <code className="font-mono">{`{{${item.key}}}`}</code>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="font-medium">{item.label}</p>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                            <p className="text-xs mt-1">
                              Voorbeeld: <span className="font-mono text-primary">{item.example}</span>
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </TooltipProvider>
        </div>
      ) : null}
    </div>
  );
}
