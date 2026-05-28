"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type PageInfoTone = "emerald" | "amber" | "sky" | "violet";

export type PageInfoCardItem = {
  eyebrow: string;
  body: string;
  tone: PageInfoTone;
  icon: LucideIcon;
};

export type PageInfoRelatedLink = {
  label: string;
  href: string;
};

type PageInfoCardsProps = {
  cards: PageInfoCardItem[];
  related?: {
    eyebrow?: string;
    links: PageInfoRelatedLink[];
  };
  className?: string;
};

export function PageInfoCards({ cards, related, className }: PageInfoCardsProps) {
  return (
    <div className={cn("page-info-grid", className)}>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article
            key={card.eyebrow}
            className={cn("page-info-card", `page-info-card-${card.tone}`)}
          >
            <div className="page-info-card-glow" aria-hidden="true" />
            <div className="page-info-card-inner">
              <div className="page-info-card-icon">
                <Icon className="h-5 w-5" />
              </div>
              <div className="page-info-card-copy">
                <p className="page-info-card-eyebrow">{card.eyebrow}</p>
                <p className="page-info-card-body">{card.body}</p>
              </div>
            </div>
          </article>
        );
      })}

      {related && related.links.length > 0 ? (
        <article className="page-info-card page-info-card-sky">
          <div className="page-info-card-glow" aria-hidden="true" />
          <div className="page-info-card-inner page-info-card-inner-related">
            <div className="page-info-card-icon">
              <ArrowUpRight className="h-5 w-5" />
            </div>
            <div className="page-info-card-copy">
              <p className="page-info-card-eyebrow">{related.eyebrow ?? "Gerelateerd"}</p>
              <div className="page-info-links">
                {related.links.map((link) => (
                  <Link key={link.href} href={link.href} className="page-info-link">
                    {link.label}
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </article>
      ) : null}
    </div>
  );
}
