import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors",
  {
    variants: {
      tone: {
        neutral: "border-transparent bg-muted text-muted-foreground",
        info: "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-400",
        success: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
        warning: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
        danger: "border-transparent bg-red-500/15 text-red-700 dark:text-red-400",
        primary: "border-transparent bg-primary/15 text-primary",
        outline: "border-input bg-background text-foreground",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  dot?: boolean;
  dotClassName?: string;
}

export function StatusBadge({
  tone,
  dot,
  dotClassName,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ tone }), className)} {...props}>
      {dot ? (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            dotClassName ?? "bg-current",
          )}
        />
      ) : null}
      {children}
    </span>
  );
}

export { statusBadgeVariants };
