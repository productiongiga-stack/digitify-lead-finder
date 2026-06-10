/**
 * MuAPI renamed several model endpoints (e.g. flux-dev → flux-dev-image).
 * Keep legacy keys so stored jobs and old model ids keep working.
 */
export const MUAPI_ENDPOINT_ALIASES: Record<string, string> = {
  "flux-schnell": "flux-schnell-image",
  "flux-dev": "flux-dev-image",
  "hidream-i1-fast": "hidream_i1_fast_image",
  "hidream-i1-dev": "hidream_i1_dev_image",
  "hidream-i1-full": "hidream_i1_full_image",
  "bytedance-seedream-v3": "bytedance-seedream-image",
  "bytedance-seedream-v5.0": "seedream-5.0",
  "bytedance-seedream-v4-edit": "bytedance-seedream-edit-v4",
  "bytedance-seedream-v5.0-edit": "seedream-5.0-edit",
  "bytedance-seededit-v3": "bytedance-seededit-image",
  "sd-2-t2v": "seedance-v2.0-t2v",
  "grok-imagine-t2v": "grok-imagine-text-to-video",
  "kling-v3-t2v": "kling-v3.0-standard-text-to-video",
  "sd-2-i2v": "seedance-v2.0-i2v",
  "sd-2-image-to-video-fast": "seedance-2-image-to-video-fast",
  "grok-imagine-i2v": "grok-imagine-image-to-video",
  "sd-2-vip-omni-reference-fast": "seedance-2-vip-omni-reference-fast",
  "sd-2-vip-omni-reference": "seedance-2-vip-omni-reference",
  "sd-2-omni-reference": "seedance-2.0-omni-reference",
};

export function resolveMuapiEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (!trimmed) return trimmed;
  return MUAPI_ENDPOINT_ALIASES[trimmed] || trimmed;
}
