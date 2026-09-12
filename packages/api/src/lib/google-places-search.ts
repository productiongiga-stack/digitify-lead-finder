import { TRPCError } from "@trpc/server";
import { formatGooglePlacesErrorMessage } from "./google-places";

const FIELD_MASK = [
  "places.id", "places.displayName", "places.formattedAddress", "places.websiteUri",
  "places.nationalPhoneNumber", "places.googleMapsUri", "places.rating",
  "places.userRatingCount", "places.types", "places.primaryType", "nextPageToken",
].join(",");

/** Keep provider ranking; follow pagination only up to the requested result budget. */
export async function searchGooglePlaces(textQuery: string, apiKey: string, limit: number) {
  const results = new Map<string, Record<string, unknown>>();
  const seenTokens = new Set<string>();
  let pageToken: string | undefined;
  for (let page = 0; page < 4; page++) {
    let response: Response;
    try {
      response = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST", signal: AbortSignal.timeout(10_000),
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELD_MASK },
        body: JSON.stringify({ textQuery, pageSize: Math.min(20, limit - results.size), ...(pageToken ? { pageToken } : {}) }),
      });
    } catch {
      throw new TRPCError({ code: "TIMEOUT", message: "De zoekdienst reageert niet. Probeer het opnieuw." });
    }
    if (!response.ok) {
      throw new TRPCError({ code: "BAD_REQUEST", message: formatGooglePlacesErrorMessage(`HTTP ${response.status}: ${await response.text()}`) });
    }
    const data = await response.json() as { places?: Record<string, unknown>[]; nextPageToken?: string };
    for (const place of Array.isArray(data.places) ? data.places : []) {
      if (typeof place.id === "string" && !results.has(place.id)) results.set(place.id, place);
    }
    pageToken = data.nextPageToken;
    if (results.size >= limit || !pageToken || seenTokens.has(pageToken)) break;
    seenTokens.add(pageToken);
  }
  return [...results.values()].slice(0, limit);
}
