/** MuAPI USD cost per generation (from api.muapi.ai/api/v1/models). */
export const MODEL_COST_USD: Record<string, number> = {
  "bytedance-seededit-v3": 0.03,
  "bytedance-seedream-v3": 0.03,
  "bytedance-seedream-v4": 0.04,
  "bytedance-seedream-v4-edit": 0.04,
  "bytedance-seedream-v4.5": 0.05,
  "bytedance-seedream-v4.5-edit": 0.05,
  "bytedance-seedream-v5.0": 0.0325,
  "bytedance-seedream-v5.0-edit": 0.0325,
  "flux-2-dev": 0.015,
  "flux-dev": 0.015,
  "flux-kontext-dev-i2i": 0.02,
  "flux-kontext-dev-t2i": 0.02,
  "flux-kontext-max-i2i": 0.06,
  "flux-kontext-pro-i2i": 0.03,
  "flux-kontext-pro-t2i": 0.03,
  "flux-schnell": 0.003,
  "google-imagen4-fast": 0.02,
  "gpt-image-1.5": 0.054,
  "gpt-image-1.5-edit": 0.054,
  "gpt4o-edit": 0.04,
  "gpt4o-text-to-image": 0.04,
  "hidream-i1-dev": 0.02,
  "hidream-i1-fast": 0.008,
  "hidream-i1-full": 0.04,
  "hunyuan-fast-text-to-video": 0.05,
  "ideogram-v3-t2i": 0.02,
  "kling-v2.1-master-t2v": 1.2,
  "kling-v2.1-pro-i2v": 0.4,
  "kling-v2.1-standard-i2v": 0.225,
  "kling-v2.5-turbo-pro-i2v": 0.45,
  "kling-v2.5-turbo-pro-t2v": 0.45,
  "kling-v2.6-pro-t2v": 0.9,
  "midjourney-v7": 0.1,
  "midjourney-v8": 0.1,
  "minimax-hailuo-02-standard-i2v": 0.15,
  "minimax-hailuo-02-standard-t2v": 0.3,
  "nano-banana": 0.03,
  "nano-banana-2": 0.06,
  "nano-banana-2-edit": 0.06,
  "nano-banana-edit": 0.03,
  "nano-banana-pro": 0.12,
  "nano-banana-pro-edit": 0.12,
  "pixverse-v5.5-i2v": 0.1,
  "pixverse-v5.5-t2v": 0.1,
  "qwen-image": 0.03,
  "qwen-image-edit": 0.03,
  "reve-image-edit": 0.05,
  "reve-text-to-image": 0.032,
  "runway-image-to-video": 0.15,
  "runway-text-to-video": 0.09,
  "sd-2-i2v": 0.75,
  "sd-2-image-to-video-fast": 0.75,
  "sd-2-omni-reference": 1.5,
  "sd-2-vip-omni-reference": 1.5,
  "sd-2-vip-omni-reference-1080p": 2.25,
  "sd-2-vip-omni-reference-fast": 1.05,
  "seedance-lite-t2v": 0.1,
  "seedance-pro-i2v": 0.18,
  "seedance-pro-i2v-fast": 0.06,
  "seedance-pro-t2v": 0.18,
  "seedance-pro-t2v-fast": 0.06,
  "veo3-fast-image-to-video": 0.6,
  "veo3-fast-text-to-video": 0.6,
  "veo3.1-lite-text-to-video": 0.3,
  "wan2.7-image-to-video": 0.1,
  "wan2.7-text-to-video": 0.1,
};

/** MuAPI catalog prices are USD; UI shows estimated EUR (nl-NL, 4 decimals). */
export const USD_TO_EUR_RATE = Number(process.env.MUAPI_USD_TO_EUR ?? "0.92");

const EUR_COST_FORMAT = new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const USD_COST_FORMAT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

export function usdToEur(costUsd: number): number {
  return costUsd * USD_TO_EUR_RATE;
}

export function formatModelCostEur(costUsd?: number): string {
  if (costUsd == null) return "";
  return `€${EUR_COST_FORMAT.format(usdToEur(costUsd))}`;
}

export function formatModelCostUsd(costUsd?: number): string {
  if (costUsd == null) return "";
  return `$${USD_COST_FORMAT.format(costUsd)}`;
}

export type ModelCostUnit = "beeld" | "video" | "generatie";

export function formatModelCostDetail(
  costUsd?: number,
  unit: ModelCostUnit = "generatie",
): string {
  if (costUsd == null) return "";
  return [
    `${formatModelCostEur(costUsd)} per ${unit}`,
    `MuAPI ${formatModelCostUsd(costUsd)}`,
    `koers ca. €${EUR_COST_FORMAT.format(USD_TO_EUR_RATE)} per $1`,
  ].join(" · ");
}
