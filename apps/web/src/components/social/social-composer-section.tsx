"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@digitify/ui";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  badge?: string;
  badgeVariant?: "secondary" | "success" | "warning" | "info";
  children: ReactNode;
  className?: string;
};

export function SocialComposerSection({
  title,
  description,
  icon: Icon,
  defaultOpen = false,
  badge,
  badgeVariant = "secondary",
  children,
  className,
}: Props) {
  return (
    <details
      className={cn(
        "group overflow-hidden rounded-xl border border-border/60 bg-muted/10 transition-colors open:border-border/80 open:bg-muted/15",
        className,
      )}
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3.5 marker:content-none [&::-webkit-details-marker]:hidden">
        {Icon ? (
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/80 text-muted-foreground ring-1 ring-border/60">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {badge ? (
              <Badge variant={badgeVariant} className="text-[10px]">
                {badge}
              </Badge>
            ) : null}
          </div>
          {description ? <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-border/50 px-4 py-4">{children}</div>
    </details>
  );
}
