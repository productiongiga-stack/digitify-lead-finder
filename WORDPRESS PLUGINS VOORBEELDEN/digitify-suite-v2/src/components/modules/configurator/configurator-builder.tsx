"use client";

import { useState, useCallback } from "react";
import {
  ArrowLeft,
  Plus,
  GripVertical,
  ChevronRight,
  Eye,
  Save,
  Rocket,
  Trash2,
  Settings2,
  DollarSign,
  Layers,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

// ============================================================================
// Types
// ============================================================================

interface BlockData {
  id: string;
  blockType: string;
  fieldKey: string;
  label: string;
  helpText: string | null;
  position: number;
  config: Record<string, any>;
  isRequired: boolean;
  validation: Record<string, any> | null;
  condition: Record<string, any> | null;
  pricingKeys: string[];
}

interface StepData {
  id: string;
  title: string;
  description: string | null;
  position: number;
  icon: string | null;
  condition: Record<string, any> | null;
  blocks: BlockData[];
}

interface PricingRuleData {
  id: string;
  key: string;
  label: string;
  ruleType: string;
  position: number;
  config: Record<string, any>;
  isOptional: boolean;
}

interface VersionData {
  id: string;
  versionNumber: number;
  label: string | null;
  steps: StepData[];
  pricingRules: PricingRuleData[];
}

interface ConfiguratorData {
  id: string;
  name: string;
  slug: string;
  status: string;
  brandColor: string | null;
  brandLogoUrl: string | null;
  backgroundColor: string | null;
  accentColor: string | null;
  fontFamily: string | null;
}

type PanelTab = "structure" | "pricing";
type RightPanelMode = "step" | "block" | "pricing-rule" | "settings" | null;

// ============================================================================
// Block type registry
// ============================================================================

const BLOCK_TYPES: Array<{
  type: string;
  label: string;
  category: string;
  icon: string;
}> = [
  { type: "SELECT_CARDS", label: "Kaart selectie", category: "Selectie", icon: "□" },
  { type: "SELECT_DROPDOWN", label: "Dropdown", category: "Selectie", icon: "▼" },
  { type: "RADIO_GROUP", label: "Radio knoppen", category: "Selectie", icon: "○" },
  { type: "CHECKBOX_GROUP", label: "Checkboxen", category: "Selectie", icon: "☐" },
  { type: "TOGGLE", label: "Aan/uit schakelaar", category: "Selectie", icon: "⊘" },
  { type: "TEXT_INPUT", label: "Tekstveld", category: "Invoer", icon: "T" },
  { type: "TEXTAREA", label: "Tekstgebied", category: "Invoer", icon: "¶" },
  { type: "NUMBER_INPUT", label: "Nummer", category: "Invoer", icon: "#" },
  { type: "SLIDER", label: "Schuifregelaar", category: "Invoer", icon: "═" },
  { type: "DATE_PICKER", label: "Datum", category: "Invoer", icon: "📅" },
  { type: "HEADING", label: "Koptekst", category: "Layout", icon: "H" },
  { type: "DIVIDER", label: "Scheiding", category: "Layout", icon: "—" },
  { type: "PRICE_PREVIEW", label: "Prijsoverzicht", category: "Layout", icon: "€" },
  { type: "CONTACT_FORM", label: "Contactformulier", category: "Speciaal", icon: "👤" },
];

// ============================================================================
// Configurator Builder — Premium 3-panel editor
// ============================================================================

/**
 * The main builder component for configurators.
 *
 * Three-panel layout:
 * LEFT (240px):   Structure tree (steps + blocks) + pricing rules
 * CENTER (flex):  Live preview of the configurator
 * RIGHT (320px):  Properties panel for selected item
 */
export function ConfiguratorBuilder({
  configurator,
  version,
  workspaceSlug,
}: {
  configurator: ConfiguratorData;
  version: VersionData | null;
  workspaceSlug: string;
}) {
  // Local state for the builder
  const [steps, setSteps] = useState<StepData[]>(version?.steps ?? []);
  const [pricingRules, setPricingRules] = useState<PricingRuleData[]>(
    version?.pricingRules ?? []
  );
  const [selectedStepId, setSelectedStepId] = useState<string | null>(
    steps[0]?.id ?? null
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<PanelTab>("structure");
  const [rightMode, setRightMode] = useState<RightPanelMode>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showBlockPicker, setShowBlockPicker] = useState(false);

  const selectedStep = steps.find((s) => s.id === selectedStepId);
  const selectedBlock = selectedStep?.blocks.find(
    (b) => b.id === selectedBlockId
  );

  // --- Step operations ---

  const addStep = useCallback(() => {
    const newStep: StepData = {
      id: `step-${Date.now()}`,
      title: `Stap ${steps.length + 1}`,
      description: null,
      position: steps.length,
      icon: null,
      condition: null,
      blocks: [],
    };
    setSteps((prev) => [...prev, newStep]);
    setSelectedStepId(newStep.id);
    setSelectedBlockId(null);
    setRightMode("step");
    setIsDirty(true);
  }, [steps.length]);

  const removeStep = useCallback(
    (stepId: string) => {
      setSteps((prev) => prev.filter((s) => s.id !== stepId));
      if (selectedStepId === stepId) {
        setSelectedStepId(steps[0]?.id ?? null);
        setSelectedBlockId(null);
        setRightMode(null);
      }
      setIsDirty(true);
    },
    [selectedStepId, steps]
  );

  // --- Block operations ---

  const addBlock = useCallback(
    (blockType: string) => {
      if (!selectedStepId) return;

      const typeInfo = BLOCK_TYPES.find((bt) => bt.type === blockType);
      const newBlock: BlockData = {
        id: `block-${Date.now()}`,
        blockType,
        fieldKey: `field_${Date.now()}`,
        label: typeInfo?.label ?? blockType,
        helpText: null,
        position: selectedStep?.blocks.length ?? 0,
        config: {},
        isRequired: false,
        validation: null,
        condition: null,
        pricingKeys: [],
      };

      setSteps((prev) =>
        prev.map((s) =>
          s.id === selectedStepId
            ? { ...s, blocks: [...s.blocks, newBlock] }
            : s
        )
      );
      setSelectedBlockId(newBlock.id);
      setRightMode("block");
      setShowBlockPicker(false);
      setIsDirty(true);
    },
    [selectedStepId, selectedStep?.blocks.length]
  );

  const removeBlock = useCallback(
    (blockId: string) => {
      setSteps((prev) =>
        prev.map((s) => ({
          ...s,
          blocks: s.blocks.filter((b) => b.id !== blockId),
        }))
      );
      if (selectedBlockId === blockId) {
        setSelectedBlockId(null);
        setRightMode(null);
      }
      setIsDirty(true);
    },
    [selectedBlockId]
  );

  // --- Update operations ---

  const updateStep = useCallback(
    (stepId: string, updates: Partial<StepData>) => {
      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, ...updates } : s))
      );
      setIsDirty(true);
    },
    []
  );

  const updateBlock = useCallback(
    (blockId: string, updates: Partial<BlockData>) => {
      setSteps((prev) =>
        prev.map((s) => ({
          ...s,
          blocks: s.blocks.map((b) =>
            b.id === blockId ? { ...b, ...updates } : b
          ),
        }))
      );
      setIsDirty(true);
    },
    []
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Top toolbar */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/${workspaceSlug}/configurators/${configurator.id}`}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Terug
          </Link>
          <div className="h-5 w-px bg-border" />
          <div>
            <h1 className="text-sm font-semibold">{configurator.name}</h1>
            <p className="text-[10px] text-muted-foreground">
              /{configurator.slug} · {version ? `v${version.versionNumber}` : "Nieuw"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="mr-2 text-xs text-amber-500">
              Niet-opgeslagen wijzigingen
            </span>
          )}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-muted"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-muted">
            <Save className="h-3.5 w-3.5" />
            Opslaan
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            <Rocket className="h-3.5 w-3.5" />
            Publiceren
          </button>
        </div>
      </header>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL: Structure */}
        <aside className="flex w-60 flex-col border-r border-border bg-card">
          {/* Panel tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setLeftTab("structure")}
              className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                leftTab === "structure"
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="mr-1.5 inline h-3.5 w-3.5" />
              Structuur
            </button>
            <button
              onClick={() => setLeftTab("pricing")}
              className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                leftTab === "pricing"
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <DollarSign className="mr-1.5 inline h-3.5 w-3.5" />
              Prijzen
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {leftTab === "structure" ? (
              <>
                {/* Steps list */}
                {steps.map((step, idx) => (
                  <div key={step.id} className="mb-2">
                    {/* Step header */}
                    <button
                      onClick={() => {
                        setSelectedStepId(step.id);
                        setSelectedBlockId(null);
                        setRightMode("step");
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition-colors ${
                        selectedStepId === step.id
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <GripVertical className="h-3 w-3 text-muted-foreground" />
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <span className="flex-1 truncate font-medium">
                        {step.title}
                      </span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    </button>

                    {/* Blocks under this step */}
                    {selectedStepId === step.id && (
                      <div className="ml-5 mt-1 space-y-1 border-l-2 border-border pl-3">
                        {step.blocks.map((block) => (
                          <button
                            key={block.id}
                            onClick={() => {
                              setSelectedBlockId(block.id);
                              setRightMode("block");
                            }}
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors ${
                              selectedBlockId === block.id
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                              {BLOCK_TYPES.find(
                                (bt) => bt.type === block.blockType
                              )?.icon ?? "?"}
                            </span>
                            <span className="flex-1 truncate">
                              {block.label}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeBlock(block.id);
                              }}
                              className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </button>
                        ))}

                        {/* Add block button */}
                        <button
                          onClick={() => setShowBlockPicker(true)}
                          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Plus className="h-3 w-3" />
                          Blok toevoegen
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add step */}
                <button
                  onClick={addStep}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Stap toevoegen
                </button>
              </>
            ) : (
              /* Pricing rules tab */
              <div className="space-y-2">
                {pricingRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="rounded-lg border border-border p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{rule.label}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {rule.ruleType}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {rule.key}
                    </p>
                  </div>
                ))}

                <button className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                  <Plus className="h-3.5 w-3.5" />
                  Prijsregel toevoegen
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* CENTER: Preview */}
        <main className="flex flex-1 flex-col items-center overflow-y-auto bg-gray-50 p-8">
          <div className="w-full max-w-xl rounded-xl border border-border bg-white shadow-sm">
            {/* Step progress */}
            <div className="flex items-center gap-2 border-b border-border px-6 py-4">
              {steps.map((step, idx) => (
                <div key={step.id} className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      selectedStepId === step.id
                        ? "text-white"
                        : idx < steps.findIndex((s) => s.id === selectedStepId)
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-400"
                    }`}
                    style={
                      selectedStepId === step.id
                        ? {
                            backgroundColor:
                              configurator.brandColor ?? "#6366f1",
                          }
                        : undefined
                    }
                  >
                    {idx + 1}
                  </div>
                  <span
                    className={`text-xs ${
                      selectedStepId === step.id
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {step.title}
                  </span>
                  {idx < steps.length - 1 && (
                    <div className="h-px w-6 bg-border" />
                  )}
                </div>
              ))}
            </div>

            {/* Selected step content preview */}
            <div className="p-6">
              {selectedStep ? (
                <>
                  <h2 className="mb-1 text-lg font-semibold">
                    {selectedStep.title}
                  </h2>
                  {selectedStep.description && (
                    <p className="mb-6 text-sm text-gray-500">
                      {selectedStep.description}
                    </p>
                  )}

                  <div className="space-y-4">
                    {selectedStep.blocks.map((block) => (
                      <div
                        key={block.id}
                        className={`rounded-lg border-2 p-4 transition-colors ${
                          selectedBlockId === block.id
                            ? "border-primary/50 bg-primary/5"
                            : "border-transparent hover:border-border"
                        }`}
                        onClick={() => {
                          setSelectedBlockId(block.id);
                          setRightMode("block");
                        }}
                      >
                        <BlockPreview block={block} brandColor={configurator.brandColor} />
                      </div>
                    ))}

                    {selectedStep.blocks.length === 0 && (
                      <div className="rounded-lg border-2 border-dashed border-border py-12 text-center">
                        <p className="text-sm text-muted-foreground">
                          Voeg blokken toe via het linker paneel
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Voeg een stap toe om te beginnen.
                </div>
              )}
            </div>
          </div>
        </main>

        {/* RIGHT PANEL: Properties */}
        <aside className="w-80 overflow-y-auto border-l border-border bg-card p-4">
          {rightMode === "step" && selectedStep && (
            <StepProperties
              step={selectedStep}
              onUpdate={(updates) => updateStep(selectedStep.id, updates)}
              onDelete={() => removeStep(selectedStep.id)}
            />
          )}
          {rightMode === "block" && selectedBlock && (
            <BlockProperties
              block={selectedBlock}
              onUpdate={(updates) => updateBlock(selectedBlock.id, updates)}
              onDelete={() => removeBlock(selectedBlock.id)}
            />
          )}
          {rightMode === null && (
            <div className="flex h-full items-center justify-center">
              <p className="text-center text-xs text-muted-foreground">
                Selecteer een stap of blok om de eigenschappen te bewerken.
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* Block picker modal */}
      {showBlockPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-[480px] rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-sm font-semibold">Blok toevoegen</h3>
              <button
                onClick={() => setShowBlockPicker(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[400px] overflow-y-auto p-4">
              {["Selectie", "Invoer", "Layout", "Speciaal"].map((cat) => (
                <div key={cat} className="mb-4">
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {cat}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {BLOCK_TYPES.filter((bt) => bt.category === cat).map(
                      (bt) => (
                        <button
                          key={bt.type}
                          onClick={() => addBlock(bt.type)}
                          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-left text-xs transition-colors hover:border-primary/30 hover:bg-primary/5"
                        >
                          <span className="text-base">{bt.icon}</span>
                          {bt.label}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

/** Preview renderer for a single block in the center panel. */
function BlockPreview({
  block,
  brandColor,
}: {
  block: BlockData;
  brandColor: string | null;
}) {
  const color = brandColor ?? "#6366f1";

  switch (block.blockType) {
    case "SELECT_CARDS": {
      const options = block.config.options ?? [];
      return (
        <div>
          <label className="mb-2 block text-sm font-medium">{block.label}</label>
          {block.helpText && (
            <p className="mb-3 text-xs text-gray-500">{block.helpText}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {(options as any[]).slice(0, 4).map((opt: any, i: number) => (
              <div
                key={i}
                className="rounded-lg border-2 border-gray-200 p-3 text-center transition-colors hover:border-gray-400"
              >
                {opt.icon && <span className="mb-1 block text-lg">{opt.icon}</span>}
                <span className="text-xs font-medium">{opt.label}</span>
              </div>
            ))}
            {options.length === 0 && (
              <>
                <div className="rounded-lg border-2 border-dashed border-gray-200 p-3 text-center text-xs text-gray-400">
                  Optie A
                </div>
                <div className="rounded-lg border-2 border-dashed border-gray-200 p-3 text-center text-xs text-gray-400">
                  Optie B
                </div>
              </>
            )}
          </div>
        </div>
      );
    }

    case "SLIDER": {
      const min = block.config.min ?? 1;
      const max = block.config.max ?? 50;
      const unit = block.config.unit ?? "";
      return (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium">{block.label}</label>
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium">
              {Math.round((min + max) / 2)} {unit}
            </span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            defaultValue={Math.round((min + max) / 2)}
            className="w-full"
            style={{ accentColor: color }}
          />
          <div className="mt-1 flex justify-between text-[10px] text-gray-400">
            <span>{min} {unit}</span>
            <span>{max} {unit}</span>
          </div>
        </div>
      );
    }

    case "CONTACT_FORM":
      return (
        <div>
          <label className="mb-3 block text-sm font-medium">{block.label}</label>
          <div className="space-y-3">
            {["Naam", "E-mailadres", "Telefoon", "Bedrijf"].map((field) => (
              <div key={field}>
                <label className="mb-1 block text-xs text-gray-500">
                  {field}
                </label>
                <div className="h-9 rounded-lg border border-gray-200 bg-gray-50" />
              </div>
            ))}
          </div>
        </div>
      );

    case "PRICE_PREVIEW":
      return (
        <div className="rounded-lg bg-gray-50 p-4">
          <h3 className="mb-3 text-sm font-semibold">Prijsoverzicht</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Basis</span>
              <span>€ —</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Extra's</span>
              <span>€ —</span>
            </div>
            <div className="border-t border-gray-200 pt-2">
              <div className="flex justify-between font-semibold">
                <span>Totaal (excl. BTW)</span>
                <span>€ —</span>
              </div>
            </div>
          </div>
        </div>
      );

    case "HEADING":
      return (
        <div>
          <h3 className="text-base font-semibold">{block.label}</h3>
          {block.helpText && (
            <p className="mt-1 text-sm text-gray-500">{block.helpText}</p>
          )}
        </div>
      );

    case "DIVIDER":
      return <hr className="border-gray-200" />;

    default:
      return (
        <div>
          <label className="mb-2 block text-sm font-medium">{block.label}</label>
          {block.helpText && (
            <p className="mb-2 text-xs text-gray-500">{block.helpText}</p>
          )}
          <div className="h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-400">
            {block.blockType.toLowerCase().replace(/_/g, " ")} preview
          </div>
        </div>
      );
  }
}

/** Step properties panel (right side). */
function StepProperties({
  step,
  onUpdate,
  onDelete,
}: {
  step: StepData;
  onUpdate: (updates: Partial<StepData>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Stap eigenschappen
        </h3>
        <button
          onClick={onDelete}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium">Titel</label>
        <input
          type="text"
          value={step.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium">Beschrijving</label>
        <textarea
          value={step.description ?? ""}
          onChange={(e) =>
            onUpdate({ description: e.target.value || null })
          }
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="Optionele beschrijving voor deze stap..."
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium">Icoon</label>
        <input
          type="text"
          value={step.icon ?? ""}
          onChange={(e) => onUpdate({ icon: e.target.value || null })}
          placeholder="Lucide icon naam (bijv. Globe)"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="rounded-lg bg-muted/50 p-3">
        <p className="text-[11px] text-muted-foreground">
          <strong>{step.blocks.length}</strong> blok{step.blocks.length !== 1 ? "ken" : ""} in deze stap.
          Gebruik het linker paneel om blokken toe te voegen of te herordenen.
        </p>
      </div>
    </div>
  );
}

/** Block properties panel (right side). */
function BlockProperties({
  block,
  onUpdate,
  onDelete,
}: {
  block: BlockData;
  onUpdate: (updates: Partial<BlockData>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Blok eigenschappen
        </h3>
        <button
          onClick={onDelete}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="rounded-lg bg-muted/50 px-3 py-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {BLOCK_TYPES.find((bt) => bt.type === block.blockType)?.label ?? block.blockType}
        </span>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium">Label</label>
        <input
          type="text"
          value={block.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium">Veldsleutel</label>
        <input
          type="text"
          value={block.fieldKey}
          onChange={(e) => onUpdate({ fieldKey: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="fieldName"
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          Gebruikt in prijsregels en condities.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium">Hulptekst</label>
        <input
          type="text"
          value={block.helpText ?? ""}
          onChange={(e) =>
            onUpdate({ helpText: e.target.value || null })
          }
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="Optionele hulptekst..."
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="text-xs font-medium">Verplicht</label>
        <button
          onClick={() => onUpdate({ isRequired: !block.isRequired })}
          className={`relative h-5 w-9 rounded-full transition-colors ${
            block.isRequired ? "bg-primary" : "bg-gray-200"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
              block.isRequired ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Pricing keys */}
      <div>
        <label className="mb-1 block text-xs font-medium">
          Prijsregel koppelingen
        </label>
        <input
          type="text"
          value={block.pricingKeys.join(", ")}
          onChange={(e) =>
            onUpdate({
              pricingKeys: e.target.value
                .split(",")
                .map((k) => k.trim())
                .filter(Boolean),
            })
          }
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="basePrice, pageMultiplier"
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          Komma-gescheiden lijst van prijsregel keys die dit blok beïnvloedt.
        </p>
      </div>
    </div>
  );
}
