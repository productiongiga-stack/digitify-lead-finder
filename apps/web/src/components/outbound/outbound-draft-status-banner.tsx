"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowRight, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@digitify/ui";

type OutboundDraftStatusBannerVariant = "error" | "warning" | "success";

type OutboundDraftStatusBannerProps = {
  variant: OutboundDraftStatusBannerVariant;
  title: string;
  detail: string;
  /** Override default variant eyebrow (e.g. "Google Places"). */
  eyebrow?: string;
  /** Override default variant icon. */
  icon?: LucideIcon;
  action?: {
    label: string;
    href: string;
  };
};

const VARIANT_CONFIG: Record<
  OutboundDraftStatusBannerVariant,
  { icon: LucideIcon; tone: string; eyebrow: string }
> = {
  error: {
    icon: XCircle,
    tone: "destructive",
    eyebrow: "Afgekeurd",
  },
  warning: {
    icon: AlertTriangle,
    tone: "amber",
    eyebrow: "Verzending",
  },
  success: {
    icon: CheckCircle,
    tone: "emerald",
    eyebrow: "Goedgekeurd",
  },
};

export function OutboundDraftStatusBanner({
  variant,
  title,
  detail,
  eyebrow: eyebrowOverride,
  icon: iconOverride,
  action,
}: OutboundDraftStatusBannerProps) {
  const { icon: defaultIcon, tone, eyebrow: defaultEyebrow } = VARIANT_CONFIG[variant];
  const Icon = iconOverride ?? defaultIcon;
  const eyebrow = eyebrowOverride ?? defaultEyebrow;

  return (
    <div
      className={cn(
        "outbound-draft-status-banner",
        `outbound-draft-status-banner-${tone}`,
      )}
      role="status"
    >
      <div className="outbound-draft-status-banner-glow" aria-hidden="true" />
      <div className="outbound-draft-status-banner-body">
        <div className="outbound-draft-status-banner-icon">
          <Icon className="h-5 w-5" />
        </div>
        <div className="outbound-draft-status-banner-copy">
          <p className="outbound-draft-status-banner-eyebrow">{eyebrow}</p>
          <p className="outbound-draft-status-banner-title">{title}</p>
          <p className="outbound-draft-status-banner-detail">{detail}</p>
        </div>
        {action ? (
          <Button
            asChild
            size="sm"
            variant="outline"
            className="outbound-draft-status-banner-action shrink-0"
          >
            <Link href={action.href}>
              {action.label}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function getOutboundFailureAction(detail: string) {
  const normalized = detail.toLowerCase();
  if (
    normalized.includes("smtp") ||
    normalized.includes("afzender") ||
    normalized.includes("e-mailinstellingen")
  ) {
    return {
      label: "SMTP instellen",
      href: "/settings/integrations",
    };
  }
  return undefined;
}
