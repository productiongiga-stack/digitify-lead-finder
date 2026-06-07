"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { EmailShellPreviewMessagePicker } from "@/components/email/email-shell-preview-message-picker";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Switch,
  Textarea,
} from "@digitify/ui";
import {
  AlignCenter,
  AlignLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutTemplate,
  Loader2,
  Palette,
  Sparkles,
  Square,
  Type,
  Wand2,
  Zap,
} from "lucide-react";
import {
  ChoicePills,
  ControlCard,
  FontFamilySelect,
  OptionSection,
  PresetStarterChips,
  WizardSidebar,
  WizardStepTabs,
} from "@/components/email/email-shell-wizard-ui";
import { EmailPreview } from "@/components/email/preview";
import { EmailShellBrandingChecklist } from "@/components/email/email-shell-branding-checklist";
import { useToast } from "@/components/feedback/toast-provider";
import { trpc } from "@/lib/trpc/client";
import {
  brandingToWizardDefaults,
  buildEmailShellPreviewProps,
  getEmailShellBrandingChecklist,
  getEmailShellChecklistSummary,
  type EmailShellBrandingContext,
  type EmailShellChecklistAction,
} from "@/lib/email-shell-branding";
import {
  GENERIC_SHELL_PREVIEW_MESSAGE,
  type ShellPreviewMessage,
} from "@/lib/email-shell-preview-messages";
import {
  BLANK_SHELL_WIZARD_CONFIG,
  buildEmailShellHtml,
  createInitialWizardConfig,
  wizardConfigToAiInstructions,
  FONT_PAIRING_PRESETS,
  WIZARD_BASE_OPTIONS,
  type ShellBackgroundTone,
  type ShellBaseStyle,
  type ShellBodySize,
  type ShellBodyTone,
  type ShellCardBorder,
  type ShellCardRadius,
  type ShellCardShadow,
  type ShellCardWidth,
  type ShellContentAlign,
  type ShellCtaSize,
  type ShellCtaSpacing,
  type ShellCtaStyle,
  type ShellCtaZone,
  type ShellFontFamily,
  type ShellFooterAlign,
  type ShellHeaderCase,
  type ShellHeaderWeight,
  type ShellLineHeight,
  type ShellFooterStyle,
  type ShellHeaderBackground,
  type ShellHeaderSize,
  type ShellHeaderStyle,
  type ShellLogoSize,
  type ShellSignatureStyle,
  type ShellSpacing,
  type ShellWizardConfig,
} from "@/lib/email-shell-builder";

const STEPS = [
  { id: "basis", label: "Basis", icon: LayoutTemplate },
  { id: "typografie", label: "Typografie", icon: Type },
  { id: "layout", label: "Layout", icon: Square },
  { id: "cta", label: "Actieknop", icon: Sparkles },
  { id: "kleur", label: "Kleuren", icon: Palette },
  { id: "preview", label: "Afronden", icon: Check },
] as const;

type WizardStep = (typeof STEPS)[number]["id"];

const STEP_META: Record<WizardStep, { description: string; tip: string }> = {
  basis: {
    description: "Welk type mail wil je bouwen?",
    tip: "Blank is een leeg beginpunt. Brief, Studio en Convert kiezen alleen de opbouw — stijl stel je daarna per stap in.",
  },
  typografie: {
    description: "Lettertypes en leesbaarheid van je mail.",
    tip: "Kies een kant-en-klaar font-duo of stel header en body apart in.",
  },
  layout: {
    description: "Opbouw van header, logo, handtekening en footer.",
    tip: "Zet de header uit voor een rustige, persoonlijke 1-op-1 mail.",
  },
  cta: {
    description: "Hoe je actieknop eruitziet en waar die staat.",
    tip: "Een afgeronde knop past bij de meeste zakelijke mails. Vol breed werkt sterk voor conversie.",
  },
  kleur: {
    description: "Sfeer, achtergrond en uitstraling van je mail.",
    tip: "Donkere sfeer combineert mooi met de Convert-opbouw.",
  },
  preview: {
    description: "Controleer alles en pas je mail-opmaak toe.",
    tip: "AI-verfijning is optioneel — je eigen keuzes blijven het uitgangspunt.",
  },
};

type CardFeel = "flat" | "soft" | "premium";

function cardFeelFromConfig(config: ShellWizardConfig): CardFeel {
  if (config.cardShadow === "lifted" || config.cardBorder === "accent") return "premium";
  if (config.cardShadow === "soft") return "soft";
  return "flat";
}

function patchCardFeel(config: ShellWizardConfig, feel: CardFeel): Partial<ShellWizardConfig> {
  if (feel === "flat") return { cardShadow: "none", cardBorder: "none" };
  if (feel === "soft") return { cardShadow: "soft", cardBorder: "subtle" };
  return { cardShadow: "lifted", cardBorder: "accent" };
}

const STRUCTURE_ICONS: Record<ShellBaseStyle, typeof Square> = {
  blank: Square,
  brief: FileText,
  studio: LayoutTemplate,
  convert: Zap,
};

function CtaStylePreview({
  style,
  selected,
  label,
  styleLabel,
  primaryColor,
  onClick,
}: {
  style: ShellCtaStyle;
  selected: boolean;
  label: string;
  styleLabel: string;
  primaryColor: string;
  onClick: () => void;
}) {
  const color = primaryColor || "#f9ae5a";

  const previewClass = (() => {
    switch (style) {
      case "rounded":
        return "rounded-lg bg-[var(--cta-color)] text-white shadow-md";
      case "soft":
        return "rounded-lg border border-[color-mix(in_srgb,var(--cta-color)_25%,transparent)] bg-[color-mix(in_srgb,var(--cta-color)_12%,white)] text-[var(--cta-color)]";
      case "outline":
        return "rounded-lg border-2 border-[var(--cta-color)] bg-white text-[var(--cta-color)]";
      case "block":
        return "w-full rounded-md bg-[var(--cta-color)] text-center text-white shadow-sm";
      case "pill":
      default:
        return "rounded-full bg-[var(--cta-color)] text-white shadow-lg";
    }
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ "--cta-color": color } as CSSProperties}
      className={[
        "flex flex-col items-center gap-2 rounded-xl border p-3 transition-all",
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border/70 bg-card hover:border-primary/30 hover:bg-muted/20",
      ].join(" ")}
    >
      <span className={["inline-flex min-w-[88px] px-4 py-2 text-[11px] font-bold", previewClass].join(" ")}>
        {label}
      </span>
      <span className="text-[10px] font-medium text-muted-foreground">{styleLabel}</span>
    </button>
  );
}

function TogglePill({
  active,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={hint}
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border/60 bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40",
      ].join(" ")}
    >
      {active ? <Check className="h-3 w-3" /> : null}
      {label}
    </button>
  );
}

function WizardPreviewPanel({
  branding,
  previewHtml,
  previewSubject,
  previewMessage,
  previewMessageId,
  onPreviewMessageChange,
  catalogEnabled,
}: {
  branding: EmailShellBrandingContext;
  previewHtml: string;
  previewSubject?: string;
  previewMessage: ShellPreviewMessage;
  previewMessageId: string;
  onPreviewMessageChange: (message: ShellPreviewMessage) => void;
  catalogEnabled: boolean;
}) {
  const previewProps = buildEmailShellPreviewProps(branding, {
    masterShellHtml: previewHtml,
    previewSubject: previewMessage.id === GENERIC_SHELL_PREVIEW_MESSAGE.id
      ? (previewSubject ?? previewMessage.subject)
      : previewMessage.subject,
    body: previewMessage.body,
    bodyFormat: previewMessage.bodyFormat,
    ctaText: previewMessage.ctaText,
    ctaUrl: previewMessage.ctaUrl,
  });

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-border/70 bg-muted/10 p-2">
      <div className="mb-1.5 flex shrink-0 items-end justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Live preview</p>
        <div className="min-w-0 flex-1 max-w-[280px]">
          <EmailShellPreviewMessagePicker
            compact
            enabled={catalogEnabled}
            value={previewMessageId}
            onChange={onPreviewMessageChange}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <EmailPreview wizard showMeta={false} {...previewProps} />
      </div>
    </div>
  );
}

type EmailShellWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (html: string) => void;
  branding: EmailShellBrandingContext;
  previewSubject?: string;
  onChecklistAction?: (action: EmailShellChecklistAction, fieldId?: string) => void;
};

export function EmailShellWizard({
  open,
  onOpenChange,
  onApply,
  branding,
  previewSubject,
  onChecklistAction,
}: EmailShellWizardProps) {
  const { showToast } = useToast();
  const [step, setStep] = useState<WizardStep>("basis");
  const [config, setConfig] = useState<ShellWizardConfig>(BLANK_SHELL_WIZARD_CONFIG);
  const [aiInstructions, setAiInstructions] = useState("");
  const [useAiPolish, setUseAiPolish] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<ShellPreviewMessage>(GENERIC_SHELL_PREVIEW_MESSAGE);
  const [previewMessageId, setPreviewMessageId] = useState(GENERIC_SHELL_PREVIEW_MESSAGE.id);
  const [brandingPanelOpen, setBrandingPanelOpen] = useState(false);

  const previewHtml = useMemo(() => buildEmailShellHtml(config), [config]);
  const brandingSummary = useMemo(() => {
    const items = getEmailShellBrandingChecklist(branding);
    return getEmailShellChecklistSummary(items);
  }, [branding]);

  useEffect(() => {
    if (!open) return;
    setStep("basis");
    setConfig(createInitialWizardConfig(brandingToWizardDefaults(branding)));
    setAiInstructions("");
    setUseAiPolish(false);
    setPreviewMessage(GENERIC_SHELL_PREVIEW_MESSAGE);
    setPreviewMessageId(GENERIC_SHELL_PREVIEW_MESSAGE.id);
    setBrandingPanelOpen(false);
  }, [open, branding]);

  const handlePreviewMessageChange = (message: ShellPreviewMessage) => {
    setPreviewMessage(message);
    setPreviewMessageId(message.id);
  };

  const generateShell = trpc.settings.generateMasterShellHtml.useMutation({
    onSuccess: (result) => {
      onApply(result.html);
      onOpenChange(false);
      showToast({
        title: "AI-shell toegepast",
        description: "Je verfijnde mail-opmaak staat klaar. Sla op om te bewaren.",
      });
    },
    onError: (error) => {
      showToast({
        title: "AI-verfijning mislukt",
        description: error.message,
        variant: "error",
      });
    },
  });

  const stepIndex = STEPS.findIndex((item) => item.id === step);
  const patch = (partial: Partial<ShellWizardConfig>) => {
    setConfig((current) => ({ ...current, ...partial }));
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };

  const applyShell = () => {
    if (useAiPolish) {
      const built = wizardConfigToAiInstructions(config);
      const extra = aiInstructions.trim();
      generateShell.mutate({
        style: config.baseStyle === "blank" ? "custom" : config.baseStyle,
        referenceHtml: previewHtml,
        instructions: extra ? `${built}. ${extra}` : built,
        companyName: branding.companyName || undefined,
        primaryColor: branding.primaryColor || undefined,
        headerSlogan: branding.headerSlogan || undefined,
        logoUrl: branding.logoUrl || undefined,
        signature: branding.signature || undefined,
        footer: branding.footer || undefined,
      });
      return;
    }

    onApply(previewHtml);
    onOpenChange(false);
    showToast({
      title: "Shell toegepast",
      description: "Je mail-opmaak staat in de editor. Sla op om te bewaren.",
    });
  };

  const companyName = branding.companyName?.trim() || "je bedrijf";
  const primaryColor = branding.primaryColor?.trim() || "#f9ae5a";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="fixed left-1/2 top-[1.5vh] z-50 flex h-[97vh] max-h-[97vh] w-[99vw] max-w-[99vw] -translate-x-1/2 translate-y-0 flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-[99vw] [&>button]:right-3 [&>button]:top-3 [&>button]:z-20 [&>button]:flex [&>button]:h-8 [&>button]:w-8 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-md [&>button]:border [&>button]:border-border/70 [&>button]:bg-background [&>button]:opacity-100 [&>button]:shadow-sm hover:[&>button]:bg-muted/60">
        <DialogHeader className="shrink-0 gap-0 border-b border-border/60 py-2.5 pl-4 pr-14">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Wand2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-semibold leading-tight">Shell wizard</DialogTitle>
                <p className="truncate text-[11px] text-muted-foreground">{companyName}</p>
              </div>
            </div>

            <WizardStepTabs
              steps={[...STEPS]}
              currentIndex={stepIndex}
              onStepClick={(index) => {
                const target = STEPS[index];
                if (target) setStep(target.id);
              }}
            />

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant={brandingPanelOpen ? "secondary" : "outline"}
                size="sm"
                onClick={() => setBrandingPanelOpen((open) => !open)}
                className={[
                  "h-8 gap-1.5 text-xs",
                  brandingSummary.completeCount < brandingSummary.total
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "",
                ].join(" ")}
              >
                Branding
                <span
                  className={[
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    brandingSummary.completeCount === brandingSummary.total
                      ? "bg-emerald-500/15 text-emerald-700"
                      : "bg-amber-500/15 text-amber-700",
                  ].join(" ")}
                >
                  {brandingSummary.completeCount}/{brandingSummary.total}
                </span>
              </Button>
              <div
                className="hidden min-w-[7.5rem] shrink-0 rounded-lg border border-border/60 bg-muted/25 px-3 py-1.5 text-right sm:block"
                aria-label={`Stap ${stepIndex + 1} van ${STEPS.length}: ${STEPS[stepIndex]?.label}`}
              >
                <p className="text-xs font-semibold leading-tight text-foreground">{STEPS[stepIndex]?.label}</p>
                <p className="text-[10px] font-medium text-muted-foreground">
                  Stap {stepIndex + 1} van {STEPS.length}
                </p>
              </div>
            </div>
          </div>

          <DialogDescription className="sr-only">
            Bouw een mail-shell voor {companyName}. Stap {stepIndex + 1} van {STEPS.length}: {STEPS[stepIndex]?.label}.
          </DialogDescription>

          {brandingPanelOpen ? (
            <div className="mt-2 rounded-lg border border-border/60 bg-muted/10 p-2">
              <EmailShellBrandingChecklist
                compact
                branding={branding}
                onAction={(action, fieldId) => {
                  onOpenChange(false);
                  if (action.type === "link") {
                    window.location.href = action.href;
                    return;
                  }
                  onChecklistAction?.(action, fieldId);
                }}
              />
            </div>
          ) : null}
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(280px,24%)_minmax(0,76%)]">
          <div className="min-h-0 border-b border-border/50 lg:border-b-0 lg:border-r">
            <WizardSidebar
              stepLabel={STEPS[stepIndex]?.label ?? "Instellingen"}
              stepDescription={STEP_META[step].description}
              stepIndex={stepIndex + 1}
              stepTotal={STEPS.length}
              tip={STEP_META[step].tip}
            >
              {step === "basis" ? (
                <>
                  <ControlCard
                    label="Mailtype"
                    hint="Kiest alleen de opbouw. Kleuren, lettertypes en knop stel je in de volgende stappen in."
                    icon={LayoutTemplate}
                  >
                    <ChoicePills<ShellBaseStyle>
                      value={config.baseStyle}
                      onChange={(value) => {
                        if (value === "blank") {
                          setConfig({
                            ...BLANK_SHELL_WIZARD_CONFIG,
                            ...brandingToWizardDefaults(branding),
                          });
                          return;
                        }
                        patch({ baseStyle: value });
                      }}
                      columns={2}
                      options={WIZARD_BASE_OPTIONS.map((option) => ({
                        value: option.id,
                        label: option.label,
                        hint: option.description,
                        icon: STRUCTURE_ICONS[option.id],
                      }))}
                    />
                  </ControlCard>

                  <ControlCard label="Tekstuitlijning" hint="Waar je hoofdtekst staat." icon={AlignLeft}>
                    <ChoicePills<ShellContentAlign>
                      value={config.contentAlign}
                      onChange={(value) => patch({ contentAlign: value })}
                      columns={2}
                      options={[
                        { value: "left", label: "Links", icon: AlignLeft },
                        { value: "center", label: "Gecentreerd", icon: AlignCenter },
                      ]}
                    />
                  </ControlCard>
                </>
              ) : null}

              {step === "typografie" ? (
                <>
                  <ControlCard label="Font-combinaties" hint="Kant-en-klare duo's voor header en tekst." icon={Type}>
                    <PresetStarterChips
                      items={FONT_PAIRING_PRESETS.map((pair) => ({
                        id: pair.id,
                        label: pair.label,
                      }))}
                      onSelect={(id) => {
                        const pair = FONT_PAIRING_PRESETS.find((item) => item.id === id);
                        if (pair) patch({ headerFont: pair.headerFont, bodyFont: pair.bodyFont });
                      }}
                    />
                  </ControlCard>

                  <ControlCard label="Lettertypes" hint="Stel header en tekst apart in." icon={Type}>
                    <div className="grid grid-cols-2 gap-2">
                      <FontFamilySelect
                        label="Bedrijfsnaam"
                        value={config.headerFont}
                        onChange={(value) => patch({ headerFont: value })}
                      />
                      <FontFamilySelect
                        label="Leestekst"
                        value={config.bodyFont}
                        onChange={(value) => patch({ bodyFont: value })}
                      />
                    </div>
                  </ControlCard>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <OptionSection label="Tekstgrootte">
                      <ChoicePills<ShellBodySize>
                        value={config.bodySize}
                        onChange={(value) => patch({ bodySize: value })}
                        columns={3}
                        options={[
                          { value: "sm", label: "Klein" },
                          { value: "md", label: "Normaal" },
                          { value: "lg", label: "Groot" },
                        ]}
                      />
                    </OptionSection>

                    <OptionSection label="Regelafstand">
                      <ChoicePills<ShellLineHeight>
                        value={config.lineHeight}
                        onChange={(value) => patch({ lineHeight: value })}
                        columns={3}
                        options={[
                          { value: "tight", label: "Strak" },
                          { value: "normal", label: "Normaal" },
                          { value: "relaxed", label: "Ruim" },
                        ]}
                      />
                    </OptionSection>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <OptionSection label="Naamdikte">
                      <ChoicePills<ShellHeaderWeight>
                        value={config.headerWeight}
                        onChange={(value) => patch({ headerWeight: value })}
                        columns={3}
                        options={[
                          { value: "semibold", label: "Licht" },
                          { value: "bold", label: "Normaal" },
                          { value: "extrabold", label: "Zwaar" },
                        ]}
                      />
                    </OptionSection>

                    <OptionSection label="Naamgrootte">
                      <ChoicePills<ShellHeaderSize>
                        value={config.headerSize}
                        onChange={(value) => patch({ headerSize: value })}
                        columns={3}
                        options={[
                          { value: "sm", label: "Klein" },
                          { value: "md", label: "Normaal" },
                          { value: "lg", label: "Groot" },
                        ]}
                      />
                    </OptionSection>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <OptionSection label="Bedrijfsnaam">
                      <ChoicePills<ShellHeaderCase>
                        value={config.headerCase}
                        onChange={(value) => patch({ headerCase: value })}
                        columns={2}
                        options={[
                          { value: "normal", label: "Normaal" },
                          { value: "uppercase", label: "Hoofdletters" },
                        ]}
                      />
                    </OptionSection>

                    <OptionSection label="Tekstkleur">
                      <ChoicePills<ShellBodyTone>
                        value={config.bodyTone}
                        onChange={(value) => patch({ bodyTone: value })}
                        columns={2}
                        options={[
                          { value: "default", label: "Donker" },
                          { value: "muted", label: "Zacht grijs" },
                        ]}
                      />
                    </OptionSection>
                  </div>
                </>
              ) : null}

              {step === "layout" ? (
                <div className="space-y-2.5">
                  <OptionSection label="Wat tonen?" hint="Kies welke onderdelen zichtbaar zijn.">
                    <div className="flex flex-wrap gap-1.5">
                      <TogglePill
                        active={config.showHeader}
                        label="Koptekst"
                        onClick={() => patch({ showHeader: !config.showHeader })}
                      />
                      <TogglePill
                        active={config.showLogoArea}
                        label="Logo"
                        onClick={() => patch({ showLogoArea: !config.showLogoArea })}
                      />
                      <TogglePill
                        active={config.showSlogan}
                        label="Slogan"
                        onClick={() => patch({ showSlogan: !config.showSlogan })}
                      />
                      <TogglePill
                        active={config.showContentDivider}
                        label="Accentlijn"
                        onClick={() => patch({ showContentDivider: !config.showContentDivider })}
                      />
                    </div>
                  </OptionSection>

                  <OptionSection label="Koptekst-stijl">
                    <div className="space-y-2">
                      <ChoicePills<ShellHeaderStyle>
                        value={config.headerStyle}
                        onChange={(value) => patch({ headerStyle: value })}
                        columns={3}
                        options={[
                          { value: "bold", label: "Vol" },
                          { value: "minimal", label: "Licht" },
                          { value: "accent-bar", label: "Met lijn" },
                        ]}
                      />
                      {config.headerStyle === "bold" && config.showHeader ? (
                        <ChoicePills<ShellHeaderBackground>
                          value={config.headerBackground}
                          onChange={(value) => patch({ headerBackground: value })}
                          columns={3}
                          options={[
                            { value: "brand", label: "Merkkleur" },
                            { value: "white", label: "Wit" },
                            { value: "light", label: "Licht" },
                          ]}
                        />
                      ) : null}
                    </div>
                  </OptionSection>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <OptionSection label="Breedte">
                      <ChoicePills<ShellCardWidth>
                        value={config.cardWidth}
                        onChange={(value) => patch({ cardWidth: value })}
                        columns={3}
                        options={[
                          { value: "narrow", label: "Smal" },
                          { value: "standard", label: "Normaal" },
                          { value: "wide", label: "Breed" },
                        ]}
                      />
                    </OptionSection>

                    <OptionSection label="Hoeken">
                      <ChoicePills<ShellCardRadius>
                        value={config.cardRadius}
                        onChange={(value) => patch({ cardRadius: value })}
                        columns={3}
                        options={[
                          { value: "sharp", label: "Strak" },
                          { value: "soft", label: "Zacht" },
                          { value: "round", label: "Rond" },
                        ]}
                      />
                    </OptionSection>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <OptionSection label="Witruimte">
                      <ChoicePills<ShellSpacing>
                        value={config.spacing}
                        onChange={(value) => patch({ spacing: value })}
                        columns={3}
                        options={[
                          { value: "compact", label: "Compact" },
                          { value: "comfortable", label: "Comfortabel" },
                          { value: "generous", label: "Ruim" },
                        ]}
                      />
                    </OptionSection>

                    <OptionSection label="Logo">
                      <ChoicePills<ShellLogoSize>
                        value={config.logoSize}
                        onChange={(value) => patch({ logoSize: value })}
                        columns={3}
                        options={[
                          { value: "sm", label: "Klein" },
                          { value: "md", label: "Normaal" },
                          { value: "lg", label: "Groot" },
                        ]}
                      />
                    </OptionSection>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <OptionSection label="Handtekening">
                      <ChoicePills<ShellSignatureStyle>
                        value={config.signatureStyle}
                        onChange={(value) => patch({ signatureStyle: value })}
                        options={[
                          { value: "subtle", label: "Subtiel" },
                          { value: "bordered", label: "Lijn" },
                          { value: "card", label: "Kaart" },
                        ]}
                      />
                    </OptionSection>
                  </div>

                  <OptionSection label="Footer">
                    <div className="space-y-2">
                      <ChoicePills<ShellFooterStyle>
                        value={config.footerStyle}
                        onChange={(value) => patch({ footerStyle: value })}
                        options={[
                          { value: "subtle", label: "Subtiel" },
                          { value: "bar", label: "Balk" },
                          { value: "minimal", label: "Minimaal" },
                        ]}
                      />
                      <ChoicePills<ShellFooterAlign>
                        value={config.footerAlign}
                        onChange={(value) => patch({ footerAlign: value })}
                        options={[
                          { value: "left", label: "Links" },
                          { value: "center", label: "Gecentreerd" },
                        ]}
                      />
                    </div>
                  </OptionSection>
                </div>
              ) : null}

              {step === "cta" ? (
                <div className="space-y-2.5">
                  <OptionSection label="Knopstijl" hint="Zo ziet je actieknop eruit in elke mail.">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                      {(
                        [
                          { value: "pill", label: "Rond" },
                          { value: "rounded", label: "Afgerond" },
                          { value: "soft", label: "Zacht" },
                          { value: "outline", label: "Omlijnd" },
                          { value: "block", label: "Vol breed" },
                        ] as const
                      ).map((option) => (
                        <CtaStylePreview
                          key={option.value}
                          style={option.value}
                          label="Plan gesprek"
                          styleLabel={option.label}
                          primaryColor={primaryColor}
                          selected={config.ctaStyle === option.value}
                          onClick={() =>
                            patch({
                              ctaStyle: option.value,
                              ctaFullWidth: option.value === "block" ? true : config.ctaFullWidth,
                            })
                          }
                        />
                      ))}
                    </div>
                  </OptionSection>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <OptionSection label="Plaatsing">
                      <ChoicePills<ShellCtaZone>
                        value={config.ctaZone}
                        onChange={(value) => patch({ ctaZone: value })}
                        columns={3}
                        options={[
                          { value: "inline", label: "In tekst" },
                          { value: "highlighted", label: "Uitgelicht" },
                          { value: "minimal", label: "Minimaal" },
                        ]}
                      />
                    </OptionSection>

                    <OptionSection label="Grootte & ruimte">
                      <div className="space-y-2">
                        <ChoicePills<ShellCtaSize>
                          value={config.ctaSize}
                          onChange={(value) => patch({ ctaSize: value })}
                          options={[
                            { value: "sm", label: "Klein" },
                            { value: "md", label: "Normaal" },
                            { value: "lg", label: "Groot" },
                          ]}
                        />
                        <ChoicePills<ShellCtaSpacing>
                          value={config.ctaSpacing}
                          onChange={(value) => patch({ ctaSpacing: value })}
                          options={[
                            { value: "tight", label: "Krap" },
                            { value: "normal", label: "Normaal" },
                            { value: "roomy", label: "Ruim" },
                          ]}
                        />
                      </div>
                    </OptionSection>
                  </div>

                  <OptionSection label="Extra opties">
                    <div className="flex flex-wrap gap-1.5">
                      <TogglePill
                        active={config.centerCta}
                        label="Centreren"
                        onClick={() => patch({ centerCta: !config.centerCta })}
                      />
                      <TogglePill
                        active={config.ctaFullWidth}
                        label="Volle breedte"
                        onClick={() => patch({ ctaFullWidth: !config.ctaFullWidth })}
                      />
                      <TogglePill
                        active={config.ctaShadow}
                        label="Met schaduw"
                        onClick={() => patch({ ctaShadow: !config.ctaShadow })}
                      />
                    </div>
                  </OptionSection>
                </div>
              ) : null}

              {step === "kleur" ? (
                <div className="space-y-2.5">
                  <OptionSection label="Sfeer" hint="De achtergrondkleur rond je mail.">
                    <ChoicePills<ShellBackgroundTone>
                      value={config.backgroundTone}
                      onChange={(value) => patch({ backgroundTone: value })}
                      columns={4}
                      options={[
                        { value: "warm", label: "Warm" },
                        { value: "cool", label: "Fris" },
                        { value: "neutral", label: "Neutraal" },
                        { value: "dark", label: "Donker" },
                      ]}
                    />
                  </OptionSection>

                  <OptionSection label="Kaartuitstraling" hint="Hoe je mailkaart eruitziet.">
                    <ChoicePills<CardFeel>
                      value={cardFeelFromConfig(config)}
                      onChange={(value) => patch(patchCardFeel(config, value))}
                      columns={3}
                      options={[
                        { value: "flat", label: "Vlak" },
                        { value: "soft", label: "Zacht" },
                        { value: "premium", label: "Luxe" },
                      ]}
                    />
                  </OptionSection>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <OptionSection label="Schaduw">
                      <ChoicePills<ShellCardShadow>
                        value={config.cardShadow}
                        onChange={(value) => patch({ cardShadow: value })}
                        columns={3}
                        options={[
                          { value: "none", label: "Geen" },
                          { value: "soft", label: "Licht" },
                          { value: "lifted", label: "Diep" },
                        ]}
                      />
                    </OptionSection>

                    <OptionSection label="Rand">
                      <ChoicePills<ShellCardBorder>
                        value={config.cardBorder}
                        onChange={(value) => patch({ cardBorder: value })}
                        columns={3}
                        options={[
                          { value: "none", label: "Geen" },
                          { value: "subtle", label: "Subtiel" },
                          { value: "accent", label: "Met accent" },
                        ]}
                      />
                    </OptionSection>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5 shadow-sm">
                    <div
                      className="h-9 w-9 shrink-0 rounded-lg border border-border/60 shadow-inner"
                      style={{ backgroundColor: primaryColor || "#f9ae5a" }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">Jouw merkkleur</p>
                      <p className="text-[10px] text-muted-foreground">
                        Wordt gebruikt in knoppen, accenten en header
                      </p>
                    </div>
                    <Palette className="h-4 w-4 shrink-0 text-primary" />
                  </div>
                </div>
              ) : null}

              {step === "preview" ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-1.5 text-xs font-semibold">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          Verfijn met AI
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          AI verbetert je wizard-ontwerp — startpunt blijft behouden.
                        </p>
                      </div>
                      <Switch checked={useAiPolish} onCheckedChange={setUseAiPolish} />
                    </div>
                    {useAiPolish ? (
                      <Textarea
                        className="mt-2 bg-background text-sm"
                        value={aiInstructions}
                        onChange={(event) => setAiInstructions(event.target.value)}
                        placeholder="Bv. premium uitstraling, donkere footer, meer contrast…"
                        rows={3}
                        maxLength={1000}
                      />
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Jouw keuzes</Label>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 rounded-lg border border-border/70 bg-card p-3 text-xs">
                      <SummaryRow label="Opbouw" value={config.baseStyle} />
                      <SummaryRow label="Koptekst" value={config.showHeader ? "aan" : "uit"} />
                      <SummaryRow label="Sfeer" value={config.backgroundTone} />
                      <SummaryRow label="Lettertype kop" value={config.headerFont} />
                      <SummaryRow label="Lettertype tekst" value={config.bodyFont} />
                      <SummaryRow label="Actieknop" value={config.ctaStyle} />
                      <SummaryRow label="Breedte" value={config.cardWidth} />
                      <SummaryRow label="Witruimte" value={config.spacing} />
                      <SummaryRow label="Logo" value={config.logoSize} />
                      <SummaryRow label="Handtekening" value={config.signatureStyle} />
                      <SummaryRow label="Footer" value={config.footerStyle} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Zonder AI wordt de wizard-shell direct toegepast. Met AI verfijnt het model je ontwerp.
                    </p>
                  </div>
                </div>
              ) : null}
            </WizardSidebar>
          </div>

          <div className="hidden min-h-0 p-2 lg:flex lg:h-full lg:flex-col">
            <WizardPreviewPanel
                branding={branding}
                previewHtml={previewHtml}
                previewSubject={previewSubject}
                previewMessage={previewMessage}
                previewMessageId={previewMessageId}
                onPreviewMessageChange={handlePreviewMessageChange}
                catalogEnabled={open}
              />
          </div>
        </div>

        <div className="h-[min(50vh,420px)] border-t border-border/60 px-3 py-2 lg:hidden">
          <WizardPreviewPanel
            branding={branding}
            previewHtml={previewHtml}
            previewSubject={previewSubject}
            previewMessage={previewMessage}
            previewMessageId={previewMessageId}
            onPreviewMessageChange={handlePreviewMessageChange}
            catalogEnabled={open}
          />
        </div>

        <DialogFooter className="shrink-0 border-t border-border/60 bg-muted/15 px-4 py-3">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const prev = STEPS[stepIndex - 1];
                if (prev) setStep(prev.id);
              }}
              disabled={stepIndex === 0 || generateShell.isPending}
              className="order-2 gap-1.5 sm:order-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Vorige stap
            </Button>

            <div className="order-1 text-center sm:order-2">
              <p className="text-sm font-semibold text-foreground">{STEPS[stepIndex]?.label}</p>
              <p className="text-xs text-muted-foreground">
                {stepIndex + 1} van {STEPS.length}
                {step !== "preview" ? " — kies je opties en ga verder" : " — klaar om toe te passen"}
              </p>
            </div>

            <div className="order-3 flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={generateShell.isPending}
              >
                Annuleren
              </Button>
              {step !== "preview" ? (
                <Button
                  type="button"
                  onClick={() => {
                    const next = STEPS[stepIndex + 1];
                    if (next) setStep(next.id);
                  }}
                  className="min-w-[120px] gap-1.5"
                >
                  Volgende stap
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={applyShell}
                  disabled={generateShell.isPending}
                  className="min-w-[140px] gap-1.5"
                >
                  {generateShell.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      AI verfijnt…
                    </>
                  ) : useAiPolish ? (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Toepassen met AI
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Shell toepassen
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/30 py-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}
