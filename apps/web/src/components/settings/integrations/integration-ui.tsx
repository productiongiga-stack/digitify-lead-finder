"use client";

import { useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@digitify/ui";
import {
  AlertCircle,
  Check,
  CheckCircle,
  Copy,
  Eye,
  EyeOff,
  Key,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useToast } from "@/components/feedback/toast-provider";
import { cn } from "@/lib/utils";

export function IntegrationTestResult({ result, isError }: { result: string | null; isError: boolean }) {
  if (!result) return null;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm",
        isError ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
      )}
    >
      {isError ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      <span className="whitespace-pre-line leading-relaxed">{result}</span>
    </div>
  );
}

export function IntegrationStatusBadge({ configured, activeLabel = "Actief", inactiveLabel = "Niet geconfigureerd" }: {
  configured: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return configured ? (
    <Badge variant="success" className="shrink-0">
      <CheckCircle className="mr-1 h-3 w-3" />
      {activeLabel}
    </Badge>
  ) : (
    <Badge variant="secondary" className="shrink-0">
      <XCircle className="mr-1 h-3 w-3" />
      {inactiveLabel}
    </Badge>
  );
}

type IntegrationPanelProps = {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  description: ReactNode;
  configured?: boolean;
  statusLabel?: { active?: string; inactive?: string };
  children: ReactNode;
  footer?: ReactNode;
};

export function IntegrationPanel({
  icon: Icon,
  iconClassName = "bg-primary/10 text-primary",
  title,
  description,
  configured,
  statusLabel,
  children,
  footer,
}: IntegrationPanelProps) {
  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      <CardHeader className="border-b border-border/40 bg-gradient-to-br from-muted/30 via-card to-card pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", iconClassName)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg tracking-tight">{title}</CardTitle>
              <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
            </div>
          </div>
          {configured !== undefined ? (
            <IntegrationStatusBadge
              configured={configured}
              activeLabel={statusLabel?.active}
              inactiveLabel={statusLabel?.inactive}
            />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">{children}</CardContent>
      {footer ? <div className="border-t border-border/40 bg-muted/10 px-6 py-4">{footer}</div> : null}
    </Card>
  );
}

export function SecretKeyField({
  label,
  value,
  onChange,
  placeholder,
  show,
  onToggleShow,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  show: boolean;
  onToggleShow: () => void;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 pr-10 font-mono text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={show ? "Verberg sleutel" : "Toon sleutel"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function IntegrationActionBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function SetupSteps({ title, steps }: { title: string; steps: ReactNode[] }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
        {steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

export function DnsCopyField({ label, value }: { label: string; value: string }) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      showToast({ title: "Gekopieerd", description: `${label} staat op je klembord.` });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({ title: "Kopiëren mislukt", variant: "error" });
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCopy}>
          {copied ? <Check className="mr-1 h-3 w-3 text-emerald-600" /> : <Copy className="mr-1 h-3 w-3" />}
          {copied ? "Gekopieerd" : "Kopiëren"}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-lg border bg-muted/40 px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground">
        {value}
      </pre>
    </div>
  );
}

export type IntegrationNavItem = {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  configured: boolean;
  dirty?: boolean;
  group?: string;
};

export function IntegrationNav({
  items,
  activeId,
  onSelect,
}: {
  items: IntegrationNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const groups = Array.from(new Set(items.map((item) => item.group ?? "Overige")));

  return (
    <nav className="integrations-nav" aria-label="Integraties">
      {groups.map((group) => {
        const groupItems = items.filter((item) => (item.group ?? "Overige") === group);
        return (
          <div key={group} className="integrations-nav-group">
            <p className="integrations-nav-group-label">{group}</p>
            <ul className="space-y-1">
              {groupItems.map((item) => {
                const Icon = item.icon;
                const active = item.id === activeId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(item.id)}
                      className={cn("integrations-nav-item", active && "integrations-nav-item-active")}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="integrations-nav-item-icon" aria-hidden />
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-medium">{item.label}</span>
                        {item.description ? (
                          <span className="block truncate text-[11px] text-muted-foreground">{item.description}</span>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {item.dirty ? <span className="integrations-nav-dirty-dot" title="Niet opgeslagen" /> : null}
                        <span
                          className={cn(
                            "integrations-nav-status-dot",
                            item.configured ? "integrations-nav-status-dot-ok" : "integrations-nav-status-dot-pending",
                          )}
                          title={item.configured ? "Geconfigureerd" : "Nog instellen"}
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function IntegrationOverviewCard({
  icon: Icon,
  title,
  description,
  configured,
  dirty,
  onOpen,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  configured: boolean;
  dirty?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="integrations-overview-card text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <IntegrationStatusBadge configured={configured} />
      </div>
      <div className="mt-3 space-y-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {dirty ? <p className="mt-2 text-[11px] font-medium text-amber-700 dark:text-amber-300">Niet opgeslagen</p> : null}
    </button>
  );
}
