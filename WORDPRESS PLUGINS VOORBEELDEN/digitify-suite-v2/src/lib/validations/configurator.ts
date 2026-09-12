import { z } from "zod";

// ============================================================================
// Configurator Validation Schemas
// ============================================================================

// --- Block config schemas per type ---

const selectOptionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  icon: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

const blockConfigSchema = z.object({
  options: z.array(selectOptionSchema).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  unit: z.string().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.unknown().optional(),
  minSelect: z.number().optional(),
  maxSelect: z.number().optional(),
  rows: z.number().optional(),
  content: z.string().optional(), // For HEADING / info blocks
  imageUrl: z.string().optional(),
});

// --- Block schema ---

export const configuratorBlockSchema = z.object({
  blockType: z.enum([
    "SELECT_CARDS",
    "SELECT_DROPDOWN",
    "RADIO_GROUP",
    "CHECKBOX_GROUP",
    "TOGGLE",
    "TEXT_INPUT",
    "TEXTAREA",
    "NUMBER_INPUT",
    "SLIDER",
    "DATE_PICKER",
    "HEADING",
    "DIVIDER",
    "IMAGE",
    "PRICE_PREVIEW",
    "CONTACT_FORM",
  ]),
  fieldKey: z.string().min(1).max(64).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Veldsleutel moet alfanumeriek zijn"),
  label: z.string().min(1).max(200),
  helpText: z.string().max(500).optional(),
  config: blockConfigSchema.default({}),
  isRequired: z.boolean().default(false),
  validation: z.record(z.unknown()).optional(),
  condition: z.record(z.unknown()).optional(),
  pricingKeys: z.array(z.string()).default([]),
});

// --- Step schema ---

export const configuratorStepSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
  condition: z.record(z.unknown()).optional(),
  blocks: z.array(configuratorBlockSchema).min(1, "Minstens één blok per stap"),
});

// --- Pricing rule schema ---

export const pricingRuleSchema = z.object({
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(200),
  ruleType: z.enum([
    "FIXED",
    "PER_UNIT",
    "MULTIPLIER",
    "TIERED",
    "CONDITIONAL",
    "PERCENTAGE",
    "DISCOUNT",
  ]),
  config: z.record(z.unknown()),
  isOptional: z.boolean().default(false),
});

// --- Configurator CRUD schemas ---

export const createConfiguratorSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Slug mag alleen kleine letters, cijfers en koppeltekens bevatten"),
  description: z.string().max(1000).optional(),
  brandColor: z.string().optional(),
  brandLogoUrl: z.string().url().optional().or(z.literal("")),
  backgroundColor: z.string().optional(),
  accentColor: z.string().optional(),
  fontFamily: z.string().optional(),
  settings: z.record(z.unknown()).default({}),
});

export const updateConfiguratorSchema = createConfiguratorSchema.partial();

export const createConfiguratorVersionSchema = z.object({
  label: z.string().max(100).optional(),
  steps: z.array(configuratorStepSchema).min(1, "Minstens één stap nodig"),
  pricingRules: z.array(pricingRuleSchema).default([]),
});

export const configuratorSubmissionSchema = z.object({
  selections: z.record(z.unknown()),
  contactName: z.string().min(1, "Naam is verplicht"),
  contactEmail: z.string().email("Ongeldig e-mailadres"),
  contactPhone: z.string().optional(),
  contactCompany: z.string().optional(),
  contactNotes: z.string().max(2000).optional(),
  source: z.enum(["hosted", "embed-iframe", "embed-js"]).default("hosted"),
  referrer: z.string().optional(),
  utmSource: z.string().optional(),
});

// --- Types ---

export type CreateConfiguratorInput = z.infer<typeof createConfiguratorSchema>;
export type UpdateConfiguratorInput = z.infer<typeof updateConfiguratorSchema>;
export type CreateVersionInput = z.infer<typeof createConfiguratorVersionSchema>;
export type ConfiguratorSubmissionInput = z.infer<typeof configuratorSubmissionSchema>;
export type ConfiguratorStepInput = z.infer<typeof configuratorStepSchema>;
export type ConfiguratorBlockInput = z.infer<typeof configuratorBlockSchema>;
export type PricingRuleInput = z.infer<typeof pricingRuleSchema>;
