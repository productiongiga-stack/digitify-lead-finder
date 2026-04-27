import * as React from "react";
import { cn } from "../lib/utils";

export interface TimelineItem {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  timestamp?: React.ReactNode;
  icon?: React.ReactNode;
  iconClassName?: string;
}

export interface TimelineProps extends React.HTMLAttributes<HTMLOListElement> {
  items: TimelineItem[];
  emptyLabel?: React.ReactNode;
}

export function Timeline({ items, emptyLabel, className, ...props }: TimelineProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyLabel ?? "Geen activiteit"}
      </p>
    );
  }
  return (
    <ol className={cn("relative space-y-3 border-l border-border pl-5", className)} {...props}>
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span
            className={cn(
              "absolute -left-[27px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border bg-background text-muted-foreground [&_svg]:h-2.5 [&_svg]:w-2.5",
              item.iconClassName,
            )}
          >
            {item.icon ?? <span className="h-1.5 w-1.5 rounded-full bg-current" />}
          </span>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
              ) : null}
            </div>
            {item.timestamp ? (
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {item.timestamp}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
