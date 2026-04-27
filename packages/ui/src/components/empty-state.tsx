import * as React from "react";
import { cn } from "../lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  size?: "sm" | "md";
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "md",
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "sm" ? "px-4 py-8" : "px-4 py-12",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-muted text-muted-foreground",
            size === "sm" ? "h-10 w-10 [&_svg]:h-5 [&_svg]:w-5" : "h-14 w-14 [&_svg]:h-7 [&_svg]:w-7",
          )}
        >
          {icon}
        </div>
      ) : null}
      <p className={cn("font-medium", size === "sm" ? "mt-2 text-sm" : "mt-3 text-base", icon ? "" : "mt-0")}>
        {title}
      </p>
      {description ? (
        <p className={cn("text-muted-foreground", size === "sm" ? "mt-1 text-xs" : "mt-1 text-sm")}>
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
