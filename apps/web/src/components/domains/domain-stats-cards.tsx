"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DomainStatTone = "neutral" | "positive" | "negative" | "warning" | "info";

export type DomainStatAccent = "sky" | "amber" | "violet" | "indigo" | "teal";

export type DomainStatItem = {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: DomainStatTone;
  accent?: DomainStatAccent;
  empty?: boolean;
  valueVariant?: "default" | "text" | "date";
  progress?: number;
};

type DomainStatsCardsProps = {
  items: DomainStatItem[];
  className?: string;
  columns?: 3 | 5;
};

const TONE_CLASS: Record<DomainStatTone, string> = {
  neutral: "domain-stat-card-tone-neutral",
  positive: "domain-stat-card-tone-positive",
  negative: "domain-stat-card-tone-negative",
  warning: "domain-stat-card-tone-warning",
  info: "domain-stat-card-tone-info",
};

const ACCENT_CLASS: Record<DomainStatAccent, string> = {
  sky: "domain-stat-card-accent-sky",
  amber: "domain-stat-card-accent-amber",
  violet: "domain-stat-card-accent-violet",
  indigo: "domain-stat-card-accent-indigo",
  teal: "domain-stat-card-accent-teal",
};

const RING_STROKE: Record<DomainStatTone, string> = {
  neutral: "stroke-slate-400",
  positive: "stroke-emerald-500",
  negative: "stroke-red-500",
  warning: "stroke-amber-500",
  info: "stroke-sky-500",
};

function isEmptyValue(value: string | number) {
  return value === "—" || value === "-";
}

function HealthScoreRing({ score, tone }: { score: number; tone: DomainStatTone }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div className="domain-stat-ring domain-stat-ring-sm" aria-hidden="true">
      <svg className="domain-stat-ring-svg" viewBox="0 0 56 56">
        <circle className="domain-stat-ring-track" cx="28" cy="28" r={radius} fill="none" strokeWidth="4" />
        <circle
          className={cn("domain-stat-ring-progress", RING_STROKE[tone])}
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 28 28)"
        />
      </svg>
      <span className="domain-stat-ring-label">{score}</span>
    </div>
  );
}

function DomainStatCard({ item }: { item: DomainStatItem }) {
  const tone = item.tone ?? "neutral";
  const accent = item.accent ?? "sky";
  const empty = item.empty ?? isEmptyValue(item.value);
  const valueVariant =
    item.valueVariant ??
    (typeof item.value === "string" && /[a-zA-Z]/.test(item.value) ? "text" : "default");
  const showRing = item.progress !== undefined && !empty;
  const valueTitle = typeof item.value === "string" ? item.value : undefined;

  return (
    <article
      className={cn(
        "domain-stat-card",
        ACCENT_CLASS[accent],
        TONE_CLASS[tone],
        empty && "domain-stat-card-empty",
        showRing && "domain-stat-card-has-ring",
      )}
    >
      <div className="domain-stat-card-inner">
        {item.icon ? <span className="domain-stat-card-icon">{item.icon}</span> : null}

        <div className="domain-stat-card-main">
          <p className="domain-stat-card-label">{item.label}</p>

          {showRing ? (
            <div className="domain-stat-card-ring-row">
              <HealthScoreRing score={item.progress ?? 0} tone={tone} />
              <div className="domain-stat-card-ring-copy">
                <p className="domain-stat-card-value domain-stat-card-value-compact" title={valueTitle}>
                  {item.value}
                </p>
                {item.hint ? <p className="domain-stat-card-hint">{item.hint}</p> : null}
              </div>
            </div>
          ) : (
            <>
              <p
                className={cn(
                  "domain-stat-card-value",
                  valueVariant === "text" && "domain-stat-card-value-text",
                  valueVariant === "date" && "domain-stat-card-value-date",
                  empty && "domain-stat-card-value-empty",
                )}
                title={valueTitle}
              >
                {item.value}
              </p>
              {item.hint ? <p className="domain-stat-card-hint">{item.hint}</p> : null}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export function DomainStatsCards({ items, className, columns = 5 }: DomainStatsCardsProps) {
  return (
    <section className={cn("domain-stats-panel", className)} aria-label="Domein statistieken">
      <div
        className={cn(
          "domain-stats-grid",
          columns === 3 ? "domain-stats-grid-cols-3" : "domain-stats-grid-5",
        )}
      >
        {items.map((item, index) => (
          <DomainStatCard key={index} item={item} />
        ))}
      </div>
    </section>
  );
}
