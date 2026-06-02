/** Client-side image checks (data URLs). Ratios match packages/api/src/lib/social-image.ts */

const INSTAGRAM_FEED_MIN_ASPECT_RATIO = 0.8;
const INSTAGRAM_FEED_MAX_ASPECT_RATIO = 1.91;
const STORY_MIN_ASPECT_RATIO = 0.5;
const STORY_MAX_ASPECT_RATIO = 0.75;

export function computeSocialImageValidityClient(dimensions: {
  width: number;
  height: number;
  aspectRatio: number;
}) {
  const { width, height, aspectRatio: ratio } = dimensions;
  return {
    validForInstagram:
      ratio >= INSTAGRAM_FEED_MIN_ASPECT_RATIO &&
      ratio <= INSTAGRAM_FEED_MAX_ASPECT_RATIO &&
      width >= 320 &&
      height >= 320,
    validForStory:
      ratio >= STORY_MIN_ASPECT_RATIO &&
      ratio <= STORY_MAX_ASPECT_RATIO &&
      width >= 720 &&
      height >= 1280,
  };
}

export type ClientSocialImageProbe =
  | {
      ok: true;
      width: number;
      height: number;
      aspectRatio: number;
      contentType: string;
      byteLength: number;
      validForInstagram: boolean;
      validForStory: boolean;
      publishableUrl: boolean;
    }
  | { ok: false; message: string };

function estimateDataUrlBytes(imageUrl: string) {
  const base64 = imageUrl.split(",")[1] || "";
  return Math.max(0, Math.floor((base64.length * 3) / 4));
}

export function probeDataUrlImage(imageUrl: string): Promise<ClientSocialImageProbe> {
  const trimmed = imageUrl.trim();
  if (!trimmed.startsWith("data:")) {
    return Promise.resolve({ ok: false, message: "Geen data-URL." });
  }

  const match = /^data:([^;,]+)/i.exec(trimmed);
  const contentType = match?.[1]?.trim().toLowerCase() || "image/png";
  if (!contentType.startsWith("image/") || contentType.includes("svg")) {
    return Promise.resolve({
      ok: false,
      message: "SVG kan niet betrouwbaar naar Meta. Gebruik JPG, PNG of WebP.",
    });
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      if (!width || !height) {
        resolve({ ok: false, message: "Afbeelding heeft geen geldige afmetingen." });
        return;
      }
      const aspectRatio = width / height;
      const validity = computeSocialImageValidityClient({ width, height, aspectRatio });
      resolve({
        ok: true,
        width,
        height,
        aspectRatio,
        contentType,
        byteLength: estimateDataUrlBytes(trimmed),
        ...validity,
        publishableUrl: false,
      });
    };
    img.onerror = () => {
      resolve({ ok: false, message: "Afbeelding kon niet geladen worden uit de upload." });
    };
    img.src = trimmed;
  });
}

export function friendlySocialProbeError(message: string) {
  const lower = message.toLowerCase();
  if (lower === "failed to fetch" || lower.includes("networkerror") || lower.includes("load failed")) {
    return "Afbeeldingscheck mislukt (netwerk). Bij uploads lokaal zou dit automatisch moeten werken — ververs de pagina of gebruik een publieke https-URL.";
  }
  return message;
}
