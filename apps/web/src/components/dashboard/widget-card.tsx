import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@digitify/ui";
import { cn } from "@/lib/utils";

export interface WidgetCardProps {
  title: string;
  icon?: LucideIcon;
  iconClassName?: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function WidgetCard({
  title,
  icon: Icon,
  iconClassName,
  href,
  linkLabel = "Alles",
  children,
  className,
  contentClassName,
}: WidgetCardProps) {
  return (
    <Card
      className={cn(
        "dashboard-widget border-border/50 bg-card/90 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md",
        className,
      )}
    >
      <CardHeader className="dashboard-widget-header pb-2.5">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            {Icon ? (
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10",
                  iconClassName,
                )}
              >
                <Icon className="h-4 w-4 text-primary" />
              </span>
            ) : null}
            <span className="truncate">{title}</span>
          </CardTitle>
          {href ? (
            <Link
              href={href}
              className="shrink-0 text-[11px] font-medium text-primary transition-colors hover:underline"
            >
              {linkLabel}
            </Link>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className={cn("pt-0", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
