import { safeRelativeAppPath } from "./utils";

const QUOTE_ID_MARKER_RE = /\[\[QUOTE_ID=([^\]]+)\]\]/;

export function extractQuoteIdFromDraftBody(body: string) {
  return body.match(QUOTE_ID_MARKER_RE)?.[1] ?? null;
}

export function getQuoteConfiguratorUrl(quoteId: string, returnTo?: string) {
  const params = new URLSearchParams({ quoteId });
  const safeReturnTo = returnTo ? safeRelativeAppPath(returnTo) : null;
  if (safeReturnTo) params.set("returnTo", safeReturnTo);
  return `/quotes/new?${params.toString()}`;
}
