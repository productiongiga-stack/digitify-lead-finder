import { TRPCError } from "@trpc/server";

const PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

export function assertGooglePlacesApiKeyShape(key: string): void {
  const trimmed = key.trim();
  if (!trimmed) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Google Places API key is niet geconfigureerd.",
    });
  }

  if (trimmed.includes("googleusercontent.com")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Dit is een OAuth Client ID, geen API key. Maak een API key aan onder Google Cloud > Credentials (formaat AIza...).",
    });
  }

  if (!trimmed.startsWith("AIza")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Ongeldig key-formaat. Google API keys beginnen met AIza. Maak er een aan via Google Cloud Console > Credentials.",
    });
  }
}

function extractGoogleErrorMessage(raw: string): string | null {
  const jsonStart = raw.indexOf("{");
  if (jsonStart < 0) return null;

  try {
    const parsed = JSON.parse(raw.slice(jsonStart)) as { error?: { message?: string } };
    const message = parsed.error?.message?.trim();
    return message || null;
  } catch {
    return null;
  }
}

/** Maps raw Google Places HTTP/JSON errors to short Dutch guidance. */
export function formatGooglePlacesErrorMessage(raw: string): string {
  const googleMessage = extractGoogleErrorMessage(raw);
  const source = googleMessage ?? raw;
  const lower = source.toLowerCase();

  if (lower.includes("api key not valid")) {
    return "De API key wordt door Google geweigerd. Controleer of je de juiste key hebt gekopieerd (AIza...), Places API (New) hebt ingeschakeld, en dat facturering op je Cloud-project staat.";
  }

  if (
    lower.includes("permission denied")
    || lower.includes("has not been used in project")
    || lower.includes("is disabled")
    || lower.includes("service disabled")
  ) {
    return "Places API (New) is niet ingeschakeld op dit Google Cloud-project. Schakel die API in via console.cloud.google.com/apis/library/places.googleapis.com.";
  }

  if (lower.includes("billing") || lower.includes("billing account")) {
    return "Facturering is niet ingeschakeld op je Google Cloud-project. Google Places vereist een actief billing-account.";
  }

  if (lower.includes("api key expired")) {
    return "Deze API key is verlopen of verwijderd. Maak een nieuwe key aan in Google Cloud Console.";
  }

  if (googleMessage) {
    return googleMessage;
  }

  if (raw.startsWith("HTTP ")) {
    return "Google Places antwoordde met een fout. Controleer je API key en of Places API (New) is ingeschakeld.";
  }

  return raw;
}

export async function verifyGooglePlacesApiKey(apiKey: string): Promise<void> {
  assertGooglePlacesApiKeyShape(apiKey);

  const response = await fetch(PLACES_TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey.trim(),
      "X-Goog-FieldMask": "places.displayName",
    },
    body: JSON.stringify({ textQuery: "restaurant", maxResultCount: 1 }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(formatGooglePlacesErrorMessage(`HTTP ${response.status}: ${body}`));
  }
}
