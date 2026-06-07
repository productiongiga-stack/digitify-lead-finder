"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Label,
  Textarea,
} from "@digitify/ui";
import {
  ArrowRight,
  ChevronDown,
  Code2,
  Copy,
  LayoutTemplate,
  Mail,
  Palette,
  Sparkles,
  Type,
  Wand2,
  Zap,
} from "lucide-react";
import { EmailPreview } from "@/components/email/preview";
import { EmailShellWizard } from "@/components/email/email-shell-wizard";
import { EmailShellBrandingChecklist } from "@/components/email/email-shell-branding-checklist";
import { useToast } from "@/components/feedback/toast-provider";
import {
  DEFAULT_MASTER_SHELL_HTML,
  EMAIL_SHELL_PRESETS,
  findMatchingShellPreset,
  type EmailShellPreset,
} from "@/lib/email-design-examples";
import {
  buildEmailShellPreviewProps,
  getEmailShellChecklistSummary,
  getEmailShellBrandingChecklist,
  type EmailShellBrandingContext,
  type EmailShellChecklistAction,
} from "@/lib/email-shell-branding";

const SHELL_PLACEHOLDER_GROUPS = [
  {
    label: "Inhoud",
    tokens: ["{{content}}", "{{ctaBlock}}", "{{signatureBlock}}", "{{footerBlock}}"],
  },
  {
    label: "Branding",
    tokens: ["{{companyName}}", "{{primaryColor}}", "{{headerSlogan}}", "{{logoBlock}}"],
  },
  {
    label: "Overig",
    tokens: ["{{unsubscribeBlock}}"],
  },
] as const;

const PRESET_META: Record<
  string,
  { icon: typeof Mail; frameClass: string }
> = {
  "minimal-clean": { icon: Mail, frameClass: "from-[#f5f2ee] via-[#faf8f5] to-[#ebe6df]" },
  "branded-header": { icon: LayoutTemplate, frameClass: "from-slate-100 via-white to-primary/10" },
  "action-focused": { icon: Zap, frameClass: "from-slate-950 via-slate-900 to-slate-950" },
};

function ShellPresetCard({
  preset,
  isActive,
  branding,
  onSelect,
}: {
  preset: EmailShellPreset;
  isActive: boolean;
  branding: EmailShellBrandingContext;
  onSelect: () => void;
}) {
  const meta = PRESET_META[preset.id] ?? PRESET_META["branded-header"];
  const Icon = meta.icon;
  const previewProps = buildEmailShellPreviewProps(branding, { masterShellHtml: preset.html });

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border text-left transition-all duration-200",
        isActive
          ? "border-primary/60 bg-card shadow-md shadow-primary/10 ring-2 ring-primary/25"
          : "border-border/60 bg-card/90 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg hover:shadow-primary/5",
      ].join(" ")}
    >
      <div
        className={[
          "relative border-b border-border/40 bg-gradient-to-br px-2 pb-2 pt-3",
          meta.frameClass,
        ].join(" ")}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.25]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.8) 0%, transparent 45%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.4) 0%, transparent 40%)",
          }}
        />
        <div className="relative overflow-hidden rounded-lg border border-white/50 bg-white/70 shadow-sm backdrop-blur-sm">
          <EmailPreview thumbnail showMeta={false} {...previewProps} />
        </div>
        {isActive ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm">
            Actief
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <div
            className={[
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
              isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold tracking-tight">{preset.label}</p>
              <Badge
                variant="secondary"
                className="border-0 bg-muted/80 text-[10px] font-medium text-muted-foreground"
              >
                {preset.tag}
              </Badge>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {preset.description}
            </p>
            <p className="mt-2 text-[10px] font-medium text-primary/80">
              Preview met {branding.companyName?.trim() || "je bedrijfsnaam"}
            </p>
          </div>
        </div>

        <div
          className={[
            "flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors",
            isActive
              ? "bg-primary/10 text-primary"
              : "bg-muted/40 text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary",
          ].join(" ")}
        >
          <span>{isActive ? "Huidige layout" : "Layout toepassen"}</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </button>
  );
}

type EmailDesignPanelProps = {
  masterShellHtml: string;
  onMasterShellHtmlChange: (html: string) => void;
  branding: EmailShellBrandingContext;
  previewSubject?: string;
  onChecklistAction?: (action: EmailShellChecklistAction, fieldId?: string) => void;
};

export function EmailDesignPanel({
  masterShellHtml,
  onMasterShellHtmlChange,
  branding,
  previewSubject,
  onChecklistAction,
}: EmailDesignPanelProps) {
  const { showToast } = useToast();
  const shellHtml = masterShellHtml.trim() || DEFAULT_MASTER_SHELL_HTML;
  const activePreset = useMemo(() => findMatchingShellPreset(shellHtml), [shellHtml]);
  const [lastAppliedPresetId, setLastAppliedPresetId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  const selectedPresetId = activePreset?.id ?? lastAppliedPresetId;
  const checklistSummary = useMemo(
    () => getEmailShellChecklistSummary(getEmailShellBrandingChecklist(branding)),
    [branding],
  );

  const previewProps = useMemo(
    () => buildEmailShellPreviewProps(branding, {
      masterShellHtml: shellHtml,
      previewSubject,
    }),
    [branding, shellHtml, previewSubject],
  );

  const applyPreset = (presetId: string) => {
    const preset = EMAIL_SHELL_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    onMasterShellHtmlChange(preset.html);
    setLastAppliedPresetId(presetId);
    showToast({
      title: `Voorbeeld "${preset.label}" geladen`,
      description: "Preview toont je ingevulde mail-gegevens in deze layout.",
    });
  };

  const copyPlaceholder = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      showToast({ title: "Gekopieerd", description: token });
    } catch {
      showToast({ title: "Kopiëren mislukt", variant: "error" });
    }
  };

  return (
    <div className="space-y-5">
      <EmailShellBrandingChecklist branding={branding} onAction={onChecklistAction} />

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border/70 bg-gradient-to-br from-primary/5 via-muted/20 to-card p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <LayoutTemplate className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="font-semibold">
              Mail-shell voor {branding.companyName?.trim() || "je bedrijf"}
            </p>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Wizard en voorbeelden gebruiken je afzender, branding, handtekening en footer.
              Berichtteksten beheer je via{" "}
              <a href="/templates" className="font-medium text-primary underline-offset-2 hover:underline">
                E-mailtemplates
              </a>
              .
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" className="gap-1.5" onClick={() => setWizardOpen(true)}>
            <Wand2 className="h-4 w-4" />
            Shell wizard
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onMasterShellHtmlChange(DEFAULT_MASTER_SHELL_HTML);
              setLastAppliedPresetId("branded-header");
            }}
          >
            Reset standaard
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-primary/15 bg-card shadow-sm ring-1 ring-primary/5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 bg-muted/20 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-semibold">Live preview</Label>
            {!activePreset ? (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Sparkles className="h-3 w-3" />
                Aangepast
              </Badge>
            ) : null}
            {checklistSummary.isReady ? (
              <Badge variant="outline" className="border-emerald-500/30 text-[10px] text-emerald-700">
                Jouw gegevens
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {checklistSummary.completeCount}/{checklistSummary.total} velden ingevuld in preview
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <EmailPreview
            tall
            {...previewProps}
            metaHint={
              checklistSummary.isReady
                ? "Preview met jouw volledige mail-gegevens — ontvanger-velden zijn fictief."
                : "Preview met ingevulde gegevens — ontbrekende velden blijven leeg tot je ze invult."
            }
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70">
        <button
          type="button"
          onClick={() => setPresetsOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 bg-muted/15 px-4 py-3 text-left transition-colors hover:bg-muted/25 sm:px-5"
        >
          <div>
            <p className="text-sm font-semibold">Snelle voorbeelden</p>
            <p className="text-xs text-muted-foreground">
              Brief, Studio of Convert — elk voorbeeld toont jouw ingevulde gegevens
            </p>
          </div>
          <ChevronDown
            className={["h-4 w-4 shrink-0 text-muted-foreground transition-transform", presetsOpen ? "rotate-180" : ""].join(" ")}
          />
        </button>
        {presetsOpen ? (
          <div className="grid gap-3 border-t border-border/50 p-4 sm:grid-cols-3 sm:p-5">
            {EMAIL_SHELL_PRESETS.map((preset) => (
              <ShellPresetCard
                key={preset.id}
                preset={preset}
                isActive={selectedPresetId === preset.id}
                branding={branding}
                onSelect={() => applyPreset(preset.id)}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70">
        <button
          type="button"
          onClick={() => setEditorOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 bg-muted/15 px-4 py-3 text-left transition-colors hover:bg-muted/25 sm:px-5"
        >
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold">Geavanceerd: HTML-editor</p>
              <p className="text-xs text-muted-foreground">Handmatig finetunen na de wizard</p>
            </div>
          </div>
          <ChevronDown
            className={["h-4 w-4 shrink-0 text-muted-foreground transition-transform", editorOpen ? "rotate-180" : ""].join(" ")}
          />
        </button>
        {editorOpen ? (
          <div className="space-y-4 border-t border-border/50 p-4 sm:p-5">
            <Textarea
              value={masterShellHtml}
              onChange={(event) => {
                onMasterShellHtmlChange(event.target.value);
                setLastAppliedPresetId(null);
              }}
              rows={16}
              className="min-h-[280px] font-mono text-xs leading-relaxed"
              spellCheck={false}
              placeholder="Plak of bewerk je master shell HTML…"
            />

            <div className="space-y-3 rounded-lg border border-dashed border-border/70 bg-muted/15 p-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <BracesIcon />
                Placeholders — klik om te kopiëren
              </p>
              {SHELL_PLACEHOLDER_GROUPS.map((group) => (
                <div key={group.label} className="space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground">{group.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.tokens.map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => copyPlaceholder(token)}
                        className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 font-mono text-[11px] text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                        title={`Kopieer ${token}`}
                      >
                        {token}
                        <Copy className="h-3 w-3 opacity-40" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Type className="h-3.5 w-3.5" />
                {"{{content}}"} = berichttekst
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5" />
                {"{{primaryColor}}"} = {branding.primaryColor || "merkkleur"}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <EmailShellWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onApply={(html) => {
          onMasterShellHtmlChange(html);
          setLastAppliedPresetId(null);
        }}
        branding={branding}
        previewSubject={previewSubject}
        onChecklistAction={onChecklistAction}
      />
    </div>
  );
}

function BracesIcon() {
  return <span className="font-mono text-sm leading-none">{"{ }"}</span>;
}
