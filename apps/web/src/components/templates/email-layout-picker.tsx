"use client";

import type { EmailLayout } from "@/lib/email-content";
import { LAYOUT_CATALOG } from "@/lib/template-studio";
import { cn } from "@/lib/utils";

type LayoutEntry = (typeof LAYOUT_CATALOG)[number];

function LayoutPreviewMock({ layoutId }: { layoutId: EmailLayout }) {
  switch (layoutId) {
    case "modern":
      return (
        <div className="layout-preview layout-preview-modern">
          <div className="layout-preview-modern-header">
            <span className="layout-preview-dot" />
            <span className="layout-preview-dot layout-preview-dot-muted" />
          </div>
          <div className="layout-preview-modern-body">
            <span className="layout-preview-badge layout-preview-badge-warm">UPDATE</span>
            <div className="layout-preview-line layout-preview-line-strong w-3/4" />
            <div className="layout-preview-summary layout-preview-summary-warm">
              <div className="layout-preview-line layout-preview-line-strong w-2/5" />
              <div className="layout-preview-line w-full" />
            </div>
            <div className="layout-preview-line w-full" />
            <div className="layout-preview-line w-5/6" />
          </div>
        </div>
      );

    case "minimal":
      return (
        <div className="layout-preview layout-preview-minimal">
          <div className="layout-preview-minimal-body">
            <div className="layout-preview-line layout-preview-line-faint w-1/4" />
            <div className="layout-preview-spacer" />
            <div className="layout-preview-line layout-preview-line-strong w-2/3" />
            <div className="layout-preview-line layout-preview-line-faint w-full" />
            <div className="layout-preview-line layout-preview-line-faint w-11/12" />
            <div className="layout-preview-spacer layout-preview-spacer-lg" />
            <div className="layout-preview-line layout-preview-line-faint w-4/5" />
            <div className="layout-preview-line layout-preview-line-faint w-3/5" />
          </div>
        </div>
      );

    case "business":
      return (
        <div className="layout-preview layout-preview-business">
          <div className="layout-preview-business-header">
            <span className="layout-preview-line layout-preview-line-inverse w-1/3" />
            <span className="layout-preview-badge layout-preview-badge-light">BUSINESS</span>
          </div>
          <div className="layout-preview-business-body">
            <div className="layout-preview-business-grid">
              <div className="layout-preview-business-sidebar" />
              <div className="space-y-1.5">
                <div className="layout-preview-line layout-preview-line-strong w-full" />
                <div className="layout-preview-line w-full" />
                <div className="layout-preview-line w-4/5" />
                <div className="layout-preview-cta layout-preview-cta-blue" />
              </div>
            </div>
          </div>
        </div>
      );

    case "proposal":
      return (
        <div className="layout-preview layout-preview-proposal">
          <div className="layout-preview-proposal-header">
            <span className="layout-preview-line layout-preview-line-strong w-2/5" />
          </div>
          <div className="layout-preview-proposal-body">
            <div className="layout-preview-line w-full" />
            <div className="layout-preview-highlight layout-preview-highlight-green">
              <div className="layout-preview-line layout-preview-line-strong w-1/2" />
              <div className="layout-preview-line w-2/3" />
              <span className="layout-preview-price">€ 2.450</span>
            </div>
            <div className="layout-preview-line w-5/6" />
            <div className="layout-preview-cta layout-preview-cta-green" />
          </div>
        </div>
      );

    case "followup":
      return (
        <div className="layout-preview layout-preview-followup">
          <div className="layout-preview-followup-accent" />
          <div className="layout-preview-followup-body">
            <span className="layout-preview-badge layout-preview-badge-violet">OPVOLGING</span>
            <div className="layout-preview-line layout-preview-line-strong w-3/4" />
            <div className="layout-preview-line w-full" />
            <div className="layout-preview-line w-4/5" />
            <div className="layout-preview-cta layout-preview-cta-violet layout-preview-cta-compact" />
          </div>
        </div>
      );

    default:
      return null;
  }
}

function EmailLayoutPickerCard({
  layout,
  selected,
  onSelect,
}: {
  layout: LayoutEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group rounded-xl border p-3 text-left transition-all",
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
          : "border-border/60 hover:border-primary/40 hover:bg-muted/20",
      )}
    >
      <LayoutPreviewMock layoutId={layout.id} />
      <p className="mt-2.5 text-sm font-medium">{layout.label}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{layout.description}</p>
    </button>
  );
}

export function EmailLayoutPicker({
  value,
  onChange,
}: {
  value: EmailLayout;
  onChange: (layout: EmailLayout) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {LAYOUT_CATALOG.map((layout) => (
        <EmailLayoutPickerCard
          key={layout.id}
          layout={layout}
          selected={value === layout.id}
          onSelect={() => onChange(layout.id)}
        />
      ))}
    </div>
  );
}

export function EmailLayoutPickerHint({ layoutId }: { layoutId: EmailLayout }) {
  const layout = LAYOUT_CATALOG.find((entry) => entry.id === layoutId);
  if (!layout) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Aanbevolen voor: {layout.bestFor.join(", ")}
    </p>
  );
}
