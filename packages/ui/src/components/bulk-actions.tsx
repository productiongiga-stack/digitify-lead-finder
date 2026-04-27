import * as React from "react";
import { cn } from "../lib/utils";
import { Button } from "./button";

export interface BulkActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  count: number;
  itemLabel?: { singular: string; plural: string };
  onClear?: () => void;
  clearLabel?: string;
  sticky?: boolean;
}

export function BulkActions({
  count,
  itemLabel = { singular: "item", plural: "items" },
  onClear,
  clearLabel = "Annuleren",
  sticky = true,
  className,
  children,
  ...props
}: BulkActionsProps) {
  if (count <= 0) return null;
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-primary/5 px-4 py-2.5 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between",
        sticky && "sticky top-0 z-20",
        className,
      )}
      {...props}
    >
      <span className="text-sm font-medium">
        {count} {count === 1 ? itemLabel.singular : itemLabel.plural} geselecteerd
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {onClear ? (
          <Button size="sm" variant="ghost" onClick={onClear}>
            {clearLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
