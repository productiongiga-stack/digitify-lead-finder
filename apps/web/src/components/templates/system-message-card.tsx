"use client";

import { Badge, Button } from "@digitify/ui";
import {
  Calendar,
  Eye,
  FileText,
  Mail,
  Megaphone,
  Pencil,
  Receipt,
  Shield,
  Star,
  Zap,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { SystemMessageItem } from "@/components/templates/system-message-editor";

export type SystemMessageListItem = SystemMessageItem & {
  module: string;
  moduleLabel: string;
  updatedAt: Date | string | null;
};

const MODULE_STYLES: Record<
  string,
  { icon: typeof Mail; chip: string; iconBg: string }
> = {
  AUTH: {
    icon: Shield,
    chip: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    iconBg: "bg-sky-500/10 text-sky-600",
  },
  BOOKINGS: {
    icon: Calendar,
    chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    iconBg: "bg-emerald-500/10 text-emerald-600",
  },
  CAMPAIGNS: {
    icon: Megaphone,
    chip: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
    iconBg: "bg-orange-500/10 text-orange-600",
  },
  INVOICES: {
    icon: Receipt,
    chip: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    iconBg: "bg-violet-500/10 text-violet-600",
  },
  REVIEWS: {
    icon: Star,
    chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    iconBg: "bg-amber-500/10 text-amber-600",
  },
  SYSTEM: {
    icon: Zap,
    chip: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
    iconBg: "bg-slate-500/10 text-slate-600",
  },
};

type Props = {
  item: SystemMessageListItem;
  showModuleBadge?: boolean;
  onPreview: () => void;
  onEdit: () => void;
};

export function SystemMessageCard({ item, showModuleBadge = false, onPreview, onEdit }: Props) {
  const style = MODULE_STYLES[item.module] ?? {
    icon: FileText,
    chip: "bg-muted text-muted-foreground",
    iconBg: "bg-muted text-muted-foreground",
  };
  const Icon = style.icon;
  const isCustomized = Boolean(item.updatedAt);
  const hasCta = Boolean(item.ctaText?.trim());

  return (
    <article className="group flex flex-col gap-4 rounded-xl border border-border/70 bg-card/80 p-4 transition-all hover:border-primary/35 hover:shadow-sm sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.iconBg}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold tracking-tight">{item.name}</h3>
            {showModuleBadge ? (
              <Badge variant="secondary" className={`text-[10px] ${style.chip}`}>
                {item.moduleLabel}
              </Badge>
            ) : null}
            {isCustomized ? (
              <Badge variant="secondary" className="text-[10px]">
                Aangepast
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Standaard
              </Badge>
            )}
            {hasCta ? (
              <Badge variant="outline" className="text-[10px]">
                CTA
              </Badge>
            ) : null}
          </div>

          <p className="text-sm text-muted-foreground">{item.trigger}</p>

          <div className="rounded-lg border border-border/50 bg-muted/15 px-3 py-2">
            <p className="truncate text-sm">
              <span className="text-muted-foreground">Onderwerp: </span>
              <span className="font-medium">{item.subject || "—"}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="font-mono">{item.templateKey}</span>
            {item.updatedAt ? (
              <span>Laatst bewerkt: {formatDate(item.updatedAt)}</span>
            ) : (
              <span>Nog niet aangepast</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 gap-2 sm:flex-col sm:items-stretch lg:flex-row">
        <Button size="sm" variant="outline" onClick={onPreview}>
          <Eye className="mr-1.5 h-4 w-4" />
          Preview
        </Button>
        <Button size="sm" onClick={onEdit}>
          <Pencil className="mr-1.5 h-4 w-4" />
          Bewerken
        </Button>
      </div>
    </article>
  );
}
