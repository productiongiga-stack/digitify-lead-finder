export type ImageGeneratorMode = "T2I" | "I2I";
export type VideoGeneratorMode = "T2V" | "I2V";

export type ModelListItem = {
  id: string;
  label: string;
  type: string;
  description?: string | null;
  costLabel?: string | null;
  costDetail?: string | null;
  aspectRatios?: string[];
  resolutions?: string[];
  durations?: number[];
  qualities?: string[];
  defaultAspectRatio?: string;
  maxReferenceImages?: number | null;
  lipSyncMode?: "PORTRAIT" | "VIDEO" | null;
  isNew?: boolean;
};

export const IMAGE_MODE_DEFAULTS: Record<ImageGeneratorMode, string> = {
  T2I: "flux-2-dev",
  I2I: "nano-banana-2-edit",
};

export const VIDEO_MODE_DEFAULTS: Record<VideoGeneratorMode, string> = {
  T2V: "kling-v2.1",
  I2V: "kling-v2.1-i2v",
};

const FAST_IMAGE_IDS = new Set([
  "flux-schnell",
  "hidream-i1-fast",
  "nano-banana",
  "google-imagen4-fast",
]);

const FAST_VIDEO_IDS = new Set([
  "seedance-lite-t2v",
  "pixverse-v5.5-t2v",
  "wan2.7-text-to-video",
  "hunyuan-fast-text-to-video",
  "veo3.1-lite-text-to-video",
]);

const MODEL_QUALITY_OPTIONS: Record<string, string[]> = {
  "seedream-5.0": ["basic", "high"],
  "bytedance-seedream-v5.0": ["basic", "high"],
  "bytedance-seedream-v5.0-edit": ["basic", "high"],
  "seedance-2.0-t2v": ["basic", "high"],
  "sd-2-i2v": ["basic", "high"],
  "sd-2-t2v": ["basic", "high"],
  "grok-imagine-t2v": ["fun", "normal", "spicy"],
  "grok-imagine-i2v": ["fun", "normal", "spicy"],
};

export type ModelGroup = "fast" | "premium" | "edit";

export function getModelQualities(modelId: string, model?: ModelListItem): string[] {
  if (model?.qualities?.length) return model.qualities;
  return MODEL_QUALITY_OPTIONS[modelId] ?? [];
}

export function filterModelsByMode(
  models: ModelListItem[],
  mode: ImageGeneratorMode | VideoGeneratorMode,
): ModelListItem[] {
  if (mode === "T2I") return models.filter((model) => model.type === "IMAGE");
  if (mode === "I2I") return models.filter((model) => model.type === "IMAGE_I2I");
  if (mode === "T2V") return models.filter((model) => model.type === "VIDEO");
  return models.filter((model) => model.type === "VIDEO_I2V");
}

export function groupModels(models: ModelListItem[], mode: ImageGeneratorMode | VideoGeneratorMode) {
  if (mode === "I2I") {
    return [{ key: "edit" as const, label: "Bewerken", items: models }];
  }

  const fast: ModelListItem[] = [];
  const premium: ModelListItem[] = [];

  for (const model of models) {
    const isFast =
      mode === "T2I" ? FAST_IMAGE_IDS.has(model.id) : FAST_VIDEO_IDS.has(model.id);
    if (isFast) fast.push(model);
    else premium.push(model);
  }

  return [
    { key: "fast" as const, label: "Snel", items: fast },
    { key: "premium" as const, label: "Premium", items: premium },
  ].filter((group) => group.items.length > 0);
}

export function pickDefaultModel(models: ModelListItem[], preferredId: string): string {
  if (models.some((model) => model.id === preferredId)) return preferredId;
  return models[0]?.id ?? preferredId;
}

export function filterModelsBySearch(models: ModelListItem[], query: string): ModelListItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return models;
  return models.filter(
    (model) =>
      model.label.toLowerCase().includes(normalized) ||
      model.id.toLowerCase().includes(normalized) ||
      (model.description?.toLowerCase().includes(normalized) ?? false),
  );
}

export type RegeneratePayload = {
  jobId: string;
  type: string;
  prompt: string;
  model: string;
  metadata: Record<string, unknown>;
};

export function metadataRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
