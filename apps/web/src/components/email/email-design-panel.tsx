"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@digitify/ui";
import { Code2, LayoutTemplate, Type } from "lucide-react";
import { EmailPreview } from "@/components/email/preview";
import type { EmailLayout, TemplateType } from "@/lib/email-content";
import {
  DEFAULT_CUSTOM_EMAIL_HTML,
  EMAIL_DESIGN_EXAMPLES,
} from "@/lib/email-design-examples";

export type EmailDesignMode = "preset" | "custom";

const LAYOUT_OPTIONS: Array<{
  value: EmailLayout;
  label: string;
  description: string;
}> = [
  { value: "modern", label: "Modern", description: "Heldere allround layout voor algemene outreach." },
  { value: "minimal", label: "Minimalistisch", description: "Rustig en persoonlijk, ideaal voor korte mails." },
  { value: "business", label: "Zakelijk", description: "Strakker voor rapporten, afspraken en professionele updates." },
  { value: "proposal", label: "Voorstel", description: "Visueel sterker voor offertes en commerciële voorstellen." },
  { value: "followup", label: "Follow-up", description: "Compacte opvolg-layout voor reminders en check-ins." },
];

const TYPE_LAYOUT_LABELS: Array<{ type: TemplateType; label: string }> = [
  { type: "OUTREACH", label: "Eerste contact" },
  { type: "FOLLOW_UP", label: "Follow-up" },
  { type: "PROPOSAL", label: "Offerte/voorstel" },
  { type: "REPORT", label: "Rapport" },
  { type: "BOOKING", label: "Afspraak" },
  { type: "REVIEW", label: "Review" },
  { type: "REENGAGEMENT", label: "Heractivatie" },
  { type: "CUSTOM", label: "Custom" },
];

const PREVIEW_BODY_TEXT = [
  "Beste {{contactName}},",
  "",
  "Bedankt voor je tijd. Hieronder vind je een helder overzicht met de volgende stap voor onze samenwerking.",
  "",
  "Alles is bewust compact gehouden zodat je snel kan scannen en reageren.",
  "",
  "Vriendelijke groeten,",
].join("\n");

type EmailDesignPanelProps = {
  designMode: EmailDesignMode;
  onDesignModeChange: (mode: EmailDesignMode) => void;
  defaultLayout: EmailLayout;
  onDefaultLayoutChange: (layout: EmailLayout) => void;
  layoutByType: Partial<Record<TemplateType, EmailLayout>>;
  onLayoutByTypeChange: (type: TemplateType, layout: EmailLayout) => void;
  customHtml: string;
  onCustomHtmlChange: (html: string) => void;
  customPresets: Array<{ id: string; name: string }>;
  onSavePreset: (name: string) => void;
  onLoadPreset: (id: string) => void;
  onDeletePreset: (id: string) => void;
  previewSubject: string;
  fromName: string;
  headerSlogan: string;
  companyName: string;
  primaryColor: string;
};

export function EmailDesignPanel({
  designMode,
  onDesignModeChange,
  defaultLayout,
  onDefaultLayoutChange,
  layoutByType,
  onLayoutByTypeChange,
  customHtml,
  onCustomHtmlChange,
  customPresets,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  previewSubject,
  fromName,
  headerSlogan,
  companyName,
  primaryColor,
}: EmailDesignPanelProps) {
  const [presetName, setPresetName] = useState("");
  const [previewLayout, setPreviewLayout] = useState<EmailLayout>(defaultLayout);

  useEffect(() => {
    setPreviewLayout(defaultLayout);
  }, [defaultLayout]);

  const layoutInfo = LAYOUT_OPTIONS.find((layout) => layout.value === previewLayout);
  const previewBody = customHtml.trim() || DEFAULT_CUSTOM_EMAIL_HTML;
  const previewSender = fromName || companyName || "Jouw naam";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Premium compact maildesign</Badge>
        <p className="text-xs text-muted-foreground">
          Kies een standaard layout of bouw je eigen HTML met live preview.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Designmodus</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onDesignModeChange("preset")}
            className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-all ${
              designMode === "preset"
                ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                : "border-border/60 hover:border-primary/40"
            }`}
          >
            <LayoutTemplate className="h-4 w-4 shrink-0" />
            <span>
              <span className="font-medium">Standaard layouts</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Automatische branded HTML</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => onDesignModeChange("custom")}
            className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-all ${
              designMode === "custom"
                ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                : "border-border/60 hover:border-primary/40"
            }`}
          >
            <Code2 className="h-4 w-4 shrink-0" />
            <span>
              <span className="font-medium">Eigen HTML</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Plak code en bekijk het resultaat</span>
            </span>
          </button>
        </div>
      </div>

      {designMode === "preset" ? (
        <>
          <div className="space-y-2">
            <Label>Standaard e-mail layout</Label>
            <Select
              value={defaultLayout}
              onValueChange={(value) => {
                const layout = value as EmailLayout;
                onDefaultLayoutChange(layout);
                setPreviewLayout(layout);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LAYOUT_OPTIONS.map((layout) => (
                  <SelectItem key={layout.value} value={layout.value}>
                    {layout.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{layoutInfo?.description}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            {LAYOUT_OPTIONS.map((layout) => (
              <button
                key={layout.value}
                type="button"
                onClick={() => {
                  onDefaultLayoutChange(layout.value);
                  setPreviewLayout(layout.value);
                }}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  defaultLayout === layout.value
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <p className="text-sm font-medium">{layout.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{layout.description}</p>
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Layout per standaard mailtype</Label>
            <p className="text-xs text-muted-foreground">
              Gebruik een andere HTML-opmaak per type. Een template met expliciete layout-instelling blijft voorrang krijgen.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {TYPE_LAYOUT_LABELS.map((entry) => (
                <div key={entry.type} className="rounded-lg border border-border/60 bg-background/70 p-2.5">
                  <p className="mb-1 text-xs font-medium">{entry.label}</p>
                  <Select
                    value={layoutByType[entry.type] || defaultLayout}
                    onValueChange={(value) => {
                      const layout = value as EmailLayout;
                      onLayoutByTypeChange(entry.type, layout);
                      setPreviewLayout(layout);
                    }}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LAYOUT_OPTIONS.map((layout) => (
                        <SelectItem key={`${entry.type}-${layout.value}`} value={layout.value}>
                          {layout.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label>Eigen HTML presets</Label>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Textarea
                rows={2}
                className="min-h-[2.5rem] resize-none text-xs"
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                placeholder="Naam voor preset (bijv. Follow-up compact)"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10"
                onClick={() => {
                  const name = presetName.trim();
                  if (!name) return;
                  onSavePreset(name);
                  setPresetName("");
                }}
              >
                Preset opslaan
              </Button>
            </div>
            {customPresets.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {customPresets.map((preset) => (
                  <div key={preset.id} className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-background/70 px-2 py-1">
                    <button
                      type="button"
                      className="text-xs font-medium hover:text-primary"
                      onClick={() => onLoadPreset(preset.id)}
                    >
                      {preset.name}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-destructive/80 hover:text-destructive"
                      onClick={() => onDeletePreset(preset.id)}
                      aria-label={`Verwijder preset ${preset.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Presets bewaren je eigen HTML-opmaak. Standaard layouts blijven apart beschikbaar.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Voorbeelden</Label>
            <div className="flex flex-wrap gap-2">
              {EMAIL_DESIGN_EXAMPLES.map((example) => (
                <Button
                  key={example.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto flex-col items-start gap-0.5 px-3 py-2 text-left"
                  onClick={() => onCustomHtmlChange(example.html)}
                >
                  <span className="text-xs font-semibold">{example.label}</span>
                  <span className="text-[10px] font-normal text-muted-foreground">{example.description}</span>
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>HTML code</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onCustomHtmlChange(DEFAULT_CUSTOM_EMAIL_HTML)}
              >
                <Type className="mr-1 h-3 w-3" />
                Leeg canvas
              </Button>
            </div>
            <Textarea
              rows={16}
              className="font-mono text-xs leading-relaxed"
              value={customHtml}
              onChange={(event) => onCustomHtmlChange(event.target.value)}
              placeholder="<!DOCTYPE html>..."
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              Plak volledige HTML of een fragment. Placeholders zoals {"{{contactName}}"} en {"{{companyName}}"}{" "}
              worden in de preview ingevuld.
            </p>
          </div>
        </>
      )}

      <div className="sticky top-4 rounded-xl border bg-muted/20 p-3">
        <p className="mb-3 text-sm font-medium">
          Live preview — {designMode === "custom" ? "eigen HTML" : layoutInfo?.label || previewLayout}
        </p>
        <EmailPreview
          subject={previewSubject}
          body={
            designMode === "custom"
              ? previewBody
              : [...PREVIEW_BODY_TEXT, previewSender].join("\n")
          }
          bodyFormat={designMode === "custom" ? "HTML" : "TEXT"}
          companyName={companyName}
          primaryColor={primaryColor}
          fromName={previewSender}
          headerSlogan={headerSlogan || "Premium outreach, helder en compact"}
          recipientCompany="Voorbeeldbedrijf BV"
          layout={previewLayout}
        />
      </div>
    </div>
  );
}
