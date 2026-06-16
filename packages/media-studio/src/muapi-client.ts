import { resolveMuapiEndpoint } from "./endpoint-aliases";
import { getModelById } from "./models";

const MUAPI_BASE_URL = "https://api.muapi.ai";

export type MuapiPollResult = {
  status: string;
  url?: string;
  outputs?: string[];
  error?: string;
  raw: Record<string, unknown>;
};

export type MuapiSubmitResult = {
  requestId: string | null;
  immediateUrl?: string;
  raw: Record<string, unknown>;
};

export class MuapiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "MuapiError";
    this.status = status;
  }
}

function extractOutputUrl(data: Record<string, unknown>): string | undefined {
  const outputs = data.outputs;
  if (Array.isArray(outputs) && typeof outputs[0] === "string") return outputs[0];
  if (typeof data.url === "string") return data.url;
  const output = data.output;
  if (output && typeof output === "object" && "url" in output && typeof (output as { url?: string }).url === "string") {
    return (output as { url: string }).url;
  }
  return undefined;
}

function normalizeStatus(status: unknown): string {
  return String(status ?? "").toLowerCase();
}

export function isTerminalSuccess(status: string): boolean {
  return status === "completed" || status === "succeeded" || status === "success";
}

export function isTerminalFailure(status: string): boolean {
  return status === "failed" || status === "error";
}

async function muapiFetch(
  apiKey: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `${MUAPI_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init?.headers);
  headers.set("x-api-key", apiKey);
  if (!headers.has("Content-Type") && init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...init, headers });
}

export async function submitMuapiJob(
  apiKey: string,
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<MuapiSubmitResult> {
  const resolvedEndpoint = resolveMuapiEndpoint(endpoint);
  const response = await muapiFetch(apiKey, `/api/v1/${resolvedEndpoint}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new MuapiError(
      `MuAPI submit mislukt (${response.status}): ${errText.slice(0, 200)}`,
      response.status,
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  const requestId =
    (typeof data.request_id === "string" && data.request_id) ||
    (typeof data.id === "string" && data.id) ||
    null;

  return {
    requestId,
    immediateUrl: extractOutputUrl(data),
    raw: data,
  };
}

export async function fetchMuapiResultOnce(apiKey: string, requestId: string): Promise<MuapiPollResult> {
  const response = await muapiFetch(apiKey, `/api/v1/predictions/${requestId}/result`, { method: "GET" });
  if (!response.ok) {
    const errText = await response.text();
    throw new MuapiError(
      `MuAPI poll mislukt (${response.status}): ${errText.slice(0, 200)}`,
      response.status,
    );
  }
  const data = (await response.json()) as Record<string, unknown>;
  const status = normalizeStatus(data.status);
  return {
    status,
    url: extractOutputUrl(data),
    outputs: Array.isArray(data.outputs) ? (data.outputs as string[]) : undefined,
    error: typeof data.error === "string" ? data.error : undefined,
    raw: data,
  };
}

export async function pollMuapiResult(
  apiKey: string,
  requestId: string,
  options?: { maxAttempts?: number; intervalMs?: number; signal?: AbortSignal },
): Promise<MuapiPollResult> {
  const maxAttempts = options?.maxAttempts ?? 900;
  const intervalMs = options?.intervalMs ?? 2000;
  const pollUrl = `/api/v1/predictions/${requestId}/result`;
  let consecutive5xx = 0;
  const maxConsecutive5xx = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (options?.signal?.aborted) {
      throw new MuapiError("Generatie geannuleerd.");
    }
    if (attempt > 1 || intervalMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    const response = await muapiFetch(apiKey, pollUrl, { method: "GET", signal: options?.signal });
    if (!response.ok) {
      const errText = await response.text();
      if (response.status >= 500) {
        consecutive5xx += 1;
        if (consecutive5xx >= maxConsecutive5xx) {
          throw new MuapiError(
            `MuAPI poll mislukt na ${maxConsecutive5xx} serverfouten: ${errText.slice(0, 200)}`,
            response.status,
          );
        }
        continue;
      }
      throw new MuapiError(
        `MuAPI poll mislukt (${response.status}): ${errText.slice(0, 200)}`,
        response.status,
      );
    }

    consecutive5xx = 0;
    const data = (await response.json()) as Record<string, unknown>;
    const status = normalizeStatus(data.status);

    if (isTerminalSuccess(status)) {
      return {
        status,
        url: extractOutputUrl(data),
        outputs: Array.isArray(data.outputs) ? (data.outputs as string[]) : undefined,
        raw: data,
      };
    }

    if (isTerminalFailure(status)) {
      const error =
        (typeof data.error === "string" && data.error) ||
        (typeof data.message === "string" && data.message) ||
        "Generatie mislukt";
      throw new MuapiError(error);
    }
  }

  throw new MuapiError("Generatie time-out na polling.");
}

export async function submitAndPollMuapiJob(
  apiKey: string,
  endpoint: string,
  payload: Record<string, unknown>,
  options?: { maxAttempts?: number; intervalMs?: number },
): Promise<MuapiPollResult> {
  const submit = await submitMuapiJob(apiKey, endpoint, payload);
  if (!submit.requestId) {
    if (submit.immediateUrl) {
      return { status: "completed", url: submit.immediateUrl, raw: submit.raw };
    }
    throw new MuapiError("Geen request_id ontvangen van MuAPI.");
  }
  return pollMuapiResult(apiKey, submit.requestId, options);
}

export type GenerateImageParams = {
  model: string;
  prompt: string;
  aspect_ratio?: string;
  resolution?: string;
  quality?: string;
  image_url?: string | null;
  images_list?: string[];
  seed?: number;
};

export function buildImagePayload(params: GenerateImageParams): Record<string, unknown> {
  const modelInfo = getModelById(params.model);
  const payload: Record<string, unknown> = { prompt: params.prompt };

  if (params.aspect_ratio) payload.aspect_ratio = params.aspect_ratio;
  if (params.resolution) payload.resolution = params.resolution;
  if (params.quality) payload.quality = params.quality;

  const referenceImages = [...(params.images_list ?? []), ...(params.image_url ? [params.image_url] : [])]
    .filter((url, index, urls) => urls.indexOf(url) === index);
  const imageField = modelInfo?.imageField || "image_url";

  if (referenceImages.length && imageField === "images_list") {
    payload.images_list = referenceImages;
  } else if (referenceImages.length) {
    payload[imageField] = referenceImages[0];
    if (imageField === "image_url") payload.strength = 0.6;
  } else if (imageField === "image_url") {
    payload.image_url = null;
  }

  if (params.seed !== undefined && params.seed !== -1) payload.seed = params.seed;

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

export async function generateImage(apiKey: string, params: GenerateImageParams) {
  const modelInfo = getModelById(params.model);
  const endpoint = modelInfo?.endpoint || params.model;
  const payload = buildImagePayload(params);

  return submitAndPollMuapiJob(apiKey, endpoint, payload, { maxAttempts: 60 });
}

export type GenerateVideoParams = {
  model: string;
  prompt?: string;
  aspect_ratio?: string;
  duration?: number;
  resolution?: string;
  quality?: string;
  mode?: string;
  image_url?: string;
};

export async function generateVideo(apiKey: string, params: GenerateVideoParams) {
  const modelInfo = getModelById(params.model);
  const endpoint = modelInfo?.endpoint || params.model;
  const payload: Record<string, unknown> = {};

  if (params.prompt) payload.prompt = params.prompt;
  if (params.aspect_ratio) payload.aspect_ratio = params.aspect_ratio;
  if (params.duration) payload.duration = params.duration;
  if (params.resolution) payload.resolution = params.resolution;
  if (params.quality) payload.quality = params.quality;
  if (params.mode) payload.mode = params.mode;

  const imageField = modelInfo?.imageField || "image_url";
  if (params.image_url) {
    if (imageField === "images_list") payload.images_list = [params.image_url];
    else payload[imageField] = params.image_url;
  }

  return submitAndPollMuapiJob(apiKey, endpoint, payload, { maxAttempts: 900 });
}

export type GenerateMarketingAdParams = {
  prompt: string;
  aspect_ratio?: string;
  duration?: number;
  resolution?: "720p" | "1080p";
  images_list?: string[];
  video_files?: string[];
};

export type GenerateLipSyncParams = {
  model: string;
  prompt?: string;
  image_url?: string;
  video_url?: string;
  audio_url: string;
  resolution?: string;
};

export function buildLipSyncPayload(params: GenerateLipSyncParams): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    audio_url: params.audio_url,
  };
  if (params.prompt?.trim()) payload.prompt = params.prompt.trim();
  if (params.image_url) payload.image_url = params.image_url;
  if (params.video_url) payload.video_url = params.video_url;
  if (params.resolution) payload.resolution = params.resolution;
  return payload;
}

export async function generateLipSync(apiKey: string, params: GenerateLipSyncParams) {
  const modelInfo = getModelById(params.model);
  const endpoint = modelInfo?.endpoint || params.model;
  const payload = buildLipSyncPayload(params);
  return submitAndPollMuapiJob(apiKey, endpoint, payload, { maxAttempts: 900 });
}

export async function generateMarketingAd(apiKey: string, params: GenerateMarketingAdParams) {
  const endpoint =
    params.resolution === "1080p"
      ? "sd-2-vip-omni-reference-1080p"
      : "seedance-2-vip-omni-reference";

  const payload: Record<string, unknown> = {
    prompt: params.prompt,
    aspect_ratio: params.aspect_ratio || "16:9",
    duration: params.duration || 5,
    images_list: params.images_list || [],
    video_files: params.video_files || [],
  };

  return submitAndPollMuapiJob(apiKey, endpoint, payload, { maxAttempts: 900 });
}

function copyToArrayBuffer(file: Buffer | Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(file.byteLength);
  copy.set(file);
  return copy.buffer;
}

export async function uploadFileToMuapi(
  apiKey: string,
  file: Blob | Buffer | Uint8Array,
  filename: string,
  contentType = "application/octet-stream",
): Promise<string> {
  const formData = new FormData();
  const blob =
    file instanceof Blob
      ? file
      : new Blob([copyToArrayBuffer(file)], { type: contentType });
  formData.append("file", blob, filename);

  const response = await muapiFetch(apiKey, "/api/v1/upload_file", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new MuapiError(
      `Bestandsupload mislukt (${response.status}): ${errText.slice(0, 200)}`,
      response.status,
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  const nestedData = data.data;
  let fileUrl = "";
  if (typeof data.url === "string") {
    fileUrl = data.url;
  } else if (typeof data.file_url === "string") {
    fileUrl = data.file_url;
  } else if (
    nestedData &&
    typeof nestedData === "object" &&
    !Array.isArray(nestedData) &&
    typeof (nestedData as { url?: unknown }).url === "string"
  ) {
    fileUrl = (nestedData as { url: string }).url;
  }

  if (!fileUrl) throw new MuapiError("Geen URL ontvangen na upload.");
  return fileUrl;
}

export async function getUserBalance(apiKey: string): Promise<{ balance?: number; raw: Record<string, unknown> }> {
  const response = await muapiFetch(apiKey, "/api/v1/account/balance", { method: "GET" });
  if (!response.ok) {
    const errText = await response.text();
    throw new MuapiError(
      `Balance ophalen mislukt (${response.status}): ${errText.slice(0, 200)}`,
      response.status,
    );
  }
  const data = (await response.json()) as Record<string, unknown>;
  const balance =
    typeof data.balance === "number"
      ? data.balance
      : typeof data.credits === "number"
        ? data.credits
        : undefined;
  return { balance, raw: data };
}

const REMOTE_ASSET_MAX_BYTES = 5 * 1024 * 1024;
const REMOTE_ASSET_ALLOWED_HOSTS = new Set(["api.muapi.ai", "cdn.muapi.ai"]);

export async function fetchRemoteAsset(url: string): Promise<{ bytes: Buffer; contentType: string }> {
  const parsed = new URL(url);
  if (!REMOTE_ASSET_ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new MuapiError(`Asset host niet toegestaan: ${parsed.hostname}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new MuapiError(`Asset download mislukt (${response.status}) voor ${url}`, response.status);
    }
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > REMOTE_ASSET_MAX_BYTES) {
      throw new MuapiError("Asset is te groot.");
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > REMOTE_ASSET_MAX_BYTES) {
      throw new MuapiError("Asset is te groot.");
    }
    return { bytes: Buffer.from(arrayBuffer), contentType };
  } finally {
    clearTimeout(timeout);
  }
}
