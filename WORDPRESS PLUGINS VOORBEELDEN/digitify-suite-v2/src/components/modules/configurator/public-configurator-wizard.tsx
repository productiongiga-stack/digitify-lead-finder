"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import {
  calculatePrice,
  type PricingRuleConfig,
  type PricingResult,
} from "@/lib/services/pricing-engine.service";

// ============================================================================
// Types
// ============================================================================

interface BlockData {
  id: string;
  blockType: string;
  fieldKey: string;
  label: string;
  helpText: string | null;
  config: Record<string, any>;
  isRequired: boolean;
  condition: Record<string, any> | null;
  pricingKeys: string[];
}

interface StepData {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  condition: Record<string, any> | null;
  blocks: BlockData[];
}

interface Props {
  configuratorId: string;
  steps: StepData[];
  pricingRules: PricingRuleConfig[];
  brandColor: string;
  source: "hosted" | "embed-iframe" | "embed-js";
  compact?: boolean;
}

// ============================================================================
// Public Configurator Wizard
//
// Multi-step wizard with live pricing. Renders all block types,
// evaluates conditions, calculates price in real-time, and submits.
// ============================================================================

export function PublicConfiguratorWizard({
  configuratorId,
  steps,
  pricingRules,
  brandColor,
  source,
  compact = false,
}: Props) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, any>>({});
  const [contactInfo, setContactInfo] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter steps based on conditions
  const visibleSteps = useMemo(
    () =>
      steps.filter(
        (step) =>
          !step.condition ||
          evaluateSimpleCondition(step.condition, selections)
      ),
    [steps, selections]
  );

  const currentStep = visibleSteps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === visibleSteps.length - 1;

  // Calculate live pricing
  const pricing = useMemo(
    () => calculatePrice(pricingRules, selections),
    [pricingRules, selections]
  );

  // Update a selection value
  const setValue = useCallback(
    (key: string, value: any) => {
      setSelections((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Step navigation
  const goNext = useCallback(() => {
    if (isLastStep) return;
    setCurrentStepIndex((prev) => Math.min(prev + 1, visibleSteps.length - 1));
  }, [isLastStep, visibleSteps.length]);

  const goBack = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  // Submit
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/public/configurator/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configuratorId,
          selections,
          contactName: contactInfo.name,
          contactEmail: contactInfo.email,
          contactPhone: contactInfo.phone || undefined,
          contactCompany: contactInfo.company || undefined,
          contactNotes: contactInfo.notes || undefined,
          source,
          referrer: typeof window !== "undefined" ? document.referrer : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Verzending mislukt. Probeer het opnieuw.");
      }

      setIsSubmitted(true);

      // Notify parent iframe if embedded
      if (typeof window !== "undefined" && window !== window.parent) {
        window.parent.postMessage(
          {
            type: "digitify:configurator:submitted",
            data: { configuratorId, total: pricing.total },
          },
          "*"
        );
      }
    } catch (err: any) {
      setError(err.message ?? "Er is een fout opgetreden.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (isSubmitted) {
    return (
      <div className="py-12 text-center">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
        >
          <Check className="h-8 w-8" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">
          Bedankt voor uw aanvraag!
        </h2>
        <p className="text-gray-600">
          We nemen zo snel mogelijk contact met u op.
        </p>
        <div className="mx-auto mt-6 max-w-xs rounded-lg bg-gray-50 p-4 text-left">
          <p className="mb-2 text-xs font-semibold text-gray-500 uppercase">
            Geschatte prijs
          </p>
          <p className="text-2xl font-bold" style={{ color: brandColor }}>
            €{pricing.total.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500">incl. BTW</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Step progress bar */}
      <div className="mb-6 flex items-center gap-1">
        {visibleSteps.map((step, idx) => (
          <div key={step.id} className="flex flex-1 items-center gap-1">
            <div className="flex-1">
              <div
                className="h-1.5 rounded-full transition-colors"
                style={{
                  backgroundColor:
                    idx <= currentStepIndex ? brandColor : "#e5e7eb",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Step header */}
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
          Stap {currentStepIndex + 1} van {visibleSteps.length}
        </p>
        <h2 className={`mt-1 font-bold text-gray-900 ${compact ? "text-lg" : "text-xl"}`}>
          {currentStep?.title}
        </h2>
        {currentStep?.description && (
          <p className="mt-1 text-sm text-gray-500">{currentStep.description}</p>
        )}
      </div>

      {/* Blocks */}
      <div className="space-y-5">
        {currentStep?.blocks
          .filter(
            (block) =>
              !block.condition ||
              evaluateSimpleCondition(block.condition, selections)
          )
          .map((block) => (
            <div key={block.id}>
              <BlockRenderer
                block={block}
                value={selections[block.fieldKey]}
                onChange={(value) => setValue(block.fieldKey, value)}
                contactInfo={contactInfo}
                onContactInfoChange={setContactInfo}
                brandColor={brandColor}
              />
            </div>
          ))}
      </div>

      {/* Live price summary (shown on every step) */}
      {pricingRules.length > 0 && pricing.lineItems.length > 0 && (
        <div className="mt-6 rounded-lg bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Geschatte prijs
            </span>
            <span
              className="text-lg font-bold"
              style={{ color: brandColor }}
            >
              €{pricing.total.toFixed(2)}
            </span>
          </div>
          {pricing.lineItems.length > 1 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
                Prijsopbouw bekijken
              </summary>
              <div className="mt-2 space-y-1 text-xs">
                {pricing.lineItems.map((item) => (
                  <div
                    key={item.key}
                    className="flex justify-between text-gray-600"
                  >
                    <span>{item.label}</span>
                    <span>
                      {item.type === "discount" ? "−" : ""}€
                      {Math.abs(item.amount).toFixed(2)}
                      {item.detail && (
                        <span className="ml-1 text-gray-400">
                          ({item.detail})
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      )}

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={goBack}
          disabled={isFirstStep}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:invisible"
        >
          <ChevronLeft className="h-4 w-4" />
          Vorige
        </button>

        {isLastStep ? (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: brandColor }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Verzenden...
              </>
            ) : (
              <>
                Aanvraag versturen
                <Check className="h-4 w-4" />
              </>
            )}
          </button>
        ) : (
          <button
            onClick={goNext}
            className="flex items-center gap-1.5 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: brandColor }}
          >
            Volgende
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Block Renderer — renders each block type with its interactive control
// ============================================================================

function BlockRenderer({
  block,
  value,
  onChange,
  contactInfo,
  onContactInfoChange,
  brandColor,
}: {
  block: BlockData;
  value: any;
  onChange: (value: any) => void;
  contactInfo: { name: string; email: string; phone: string; company: string; notes: string };
  onContactInfoChange: (info: any) => void;
  brandColor: string;
}) {
  switch (block.blockType) {
    case "SELECT_CARDS": {
      const options = (block.config.options ?? []) as Array<{
        label: string;
        value: string;
        icon?: string;
        description?: string;
      }>;
      return (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900">
            {block.label}
            {block.isRequired && <span className="ml-0.5 text-red-500">*</span>}
          </label>
          {block.helpText && (
            <p className="mb-3 text-xs text-gray-500">{block.helpText}</p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onChange(opt.value)}
                className="rounded-xl border-2 p-4 text-center transition-all"
                style={{
                  borderColor: value === opt.value ? brandColor : "#e5e7eb",
                  backgroundColor: value === opt.value ? `${brandColor}08` : "transparent",
                }}
              >
                {opt.icon && (
                  <span className="mb-2 block text-2xl">{opt.icon}</span>
                )}
                <span className="block text-sm font-medium">{opt.label}</span>
                {opt.description && (
                  <span className="mt-0.5 block text-[11px] text-gray-500">
                    {opt.description}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      );
    }

    case "SELECT_DROPDOWN": {
      const options = (block.config.options ?? []) as Array<{
        label: string;
        value: string;
      }>;
      return (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900">
            {block.label}
          </label>
          {block.helpText && (
            <p className="mb-2 text-xs text-gray-500">{block.helpText}</p>
          )}
          <select
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
          >
            <option value="">Selecteer...</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    case "CHECKBOX_GROUP": {
      const options = (block.config.options ?? []) as Array<{
        label: string;
        value: string;
      }>;
      const selected = Array.isArray(value) ? value : [];
      return (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900">
            {block.label}
          </label>
          {block.helpText && (
            <p className="mb-3 text-xs text-gray-500">{block.helpText}</p>
          )}
          <div className="space-y-2">
            {options.map((opt) => {
              const isChecked = selected.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors"
                  style={{
                    borderColor: isChecked ? brandColor : "#e5e7eb",
                    backgroundColor: isChecked ? `${brandColor}08` : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      if (isChecked) {
                        onChange(selected.filter((v: string) => v !== opt.value));
                      } else {
                        onChange([...selected, opt.value]);
                      }
                    }}
                    className="h-4 w-4 rounded"
                    style={{ accentColor: brandColor }}
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      );
    }

    case "SLIDER": {
      const min = block.config.min ?? 1;
      const max = block.config.max ?? 100;
      const step = block.config.step ?? 1;
      const unit = block.config.unit ?? "";
      const current = value ?? block.config.defaultValue ?? min;
      return (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-900">
              {block.label}
            </label>
            <span
              className="rounded-md px-2.5 py-1 text-sm font-bold"
              style={{
                backgroundColor: `${brandColor}15`,
                color: brandColor,
              }}
            >
              {current} {unit}
            </span>
          </div>
          {block.helpText && (
            <p className="mb-3 text-xs text-gray-500">{block.helpText}</p>
          )}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={current}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: brandColor }}
          />
          <div className="mt-1 flex justify-between text-[11px] text-gray-400">
            <span>
              {min} {unit}
            </span>
            <span>
              {max} {unit}
            </span>
          </div>
        </div>
      );
    }

    case "NUMBER_INPUT":
      return (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900">
            {block.label}
          </label>
          {block.helpText && (
            <p className="mb-2 text-xs text-gray-500">{block.helpText}</p>
          )}
          <input
            type="number"
            value={value ?? ""}
            onChange={(e) => onChange(Number(e.target.value))}
            min={block.config.min}
            max={block.config.max}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
            placeholder={block.config.placeholder ?? ""}
          />
        </div>
      );

    case "TEXT_INPUT":
      return (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900">
            {block.label}
          </label>
          {block.helpText && (
            <p className="mb-2 text-xs text-gray-500">{block.helpText}</p>
          )}
          <input
            type="text"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
            placeholder={block.config.placeholder ?? ""}
          />
        </div>
      );

    case "TEXTAREA":
      return (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900">
            {block.label}
          </label>
          {block.helpText && (
            <p className="mb-2 text-xs text-gray-500">{block.helpText}</p>
          )}
          <textarea
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            rows={block.config.rows ?? 3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
            placeholder={block.config.placeholder ?? ""}
          />
        </div>
      );

    case "TOGGLE":
      return (
        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 p-4">
          <div>
            <span className="block text-sm font-medium text-gray-900">
              {block.label}
            </span>
            {block.helpText && (
              <span className="block text-xs text-gray-500">
                {block.helpText}
              </span>
            )}
          </div>
          <button
            onClick={() => onChange(!value)}
            className="relative h-6 w-11 rounded-full transition-colors"
            style={{
              backgroundColor: value ? brandColor : "#d1d5db",
            }}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                value ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>
      );

    case "CONTACT_FORM":
      return (
        <div>
          <label className="mb-3 block text-sm font-medium text-gray-900">
            {block.label}
          </label>
          {block.helpText && (
            <p className="mb-4 text-xs text-gray-500">{block.helpText}</p>
          )}
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Naam <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={contactInfo.name}
                onChange={(e) =>
                  onContactInfoChange({ ...contactInfo, name: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                placeholder="Uw volledige naam"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                E-mailadres <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={contactInfo.email}
                onChange={(e) =>
                  onContactInfoChange({ ...contactInfo, email: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                placeholder="naam@bedrijf.be"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Telefoon
                </label>
                <input
                  type="tel"
                  value={contactInfo.phone}
                  onChange={(e) =>
                    onContactInfoChange({ ...contactInfo, phone: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                  placeholder="+32..."
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Bedrijf
                </label>
                <input
                  type="text"
                  value={contactInfo.company}
                  onChange={(e) =>
                    onContactInfoChange({
                      ...contactInfo,
                      company: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                  placeholder="Bedrijfsnaam"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Opmerkingen
              </label>
              <textarea
                value={contactInfo.notes}
                onChange={(e) =>
                  onContactInfoChange({ ...contactInfo, notes: e.target.value })
                }
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                placeholder="Extra informatie over uw project..."
              />
            </div>
          </div>
        </div>
      );

    case "PRICE_PREVIEW":
      // This is handled above in the wizard itself
      return null;

    case "HEADING":
      return (
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            {block.label}
          </h3>
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
          <label className="mb-1 block text-sm font-medium text-gray-900">
            {block.label}
          </label>
          <p className="text-xs text-gray-400">
            Block type "{block.blockType}" — not yet implemented
          </p>
        </div>
      );
  }
}

// ============================================================================
// Condition evaluator (minimal, matches pricing engine format)
// ============================================================================

function evaluateSimpleCondition(
  condition: Record<string, any>,
  selections: Record<string, any>
): boolean {
  const op = Object.keys(condition)[0];
  const args = condition[op];

  const resolve = (v: any): any => {
    if (v && typeof v === "object" && "var" in v) return selections[v.var];
    return v;
  };

  switch (op) {
    case "==":
      return resolve(args[0]) === resolve(args[1]);
    case "!=":
      return resolve(args[0]) !== resolve(args[1]);
    case "in": {
      const needle = resolve(args[0]);
      const haystack = resolve(args[1]);
      return Array.isArray(haystack) ? haystack.includes(needle) : false;
    }
    case "and":
      return args.every((a: any) => evaluateSimpleCondition(a, selections));
    case "or":
      return args.some((a: any) => evaluateSimpleCondition(a, selections));
    default:
      return true;
  }
}
