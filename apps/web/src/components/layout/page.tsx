import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@digitify/ui";

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("app-page", className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("app-page-header", className)}>
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/75">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="app-page-title">{title}</h1>
        {description ? <p className="app-page-subtitle">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="app-page-actions">{actions}</div> : null}
    </section>
  );
}

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("app-page-filters", className)}>{children}</div>;
}

export function PageActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("app-page-actions", className)}>{children}</div>;
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("app-surface", className)}>
      {(title || description || actions) ? (
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            {title ? <CardTitle className="text-base">{title}</CardTitle> : null}
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn(!(title || description || actions) && "pt-4 sm:pt-5", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
