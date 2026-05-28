const QUOTE_ID_MARKER_RE = /\[\[QUOTE_ID=([^\]]+)\]\]/;

export function extractQuoteIdFromDraftBody(body: string) {
  return body.match(QUOTE_ID_MARKER_RE)?.[1] ?? null;
}

export function getQuoteConfiguratorUrl(quoteId: string, returnTo?: string) {
  const params = new URLSearchParams({ quoteId });
  if (returnTo) params.set("returnTo", returnTo);
  return `/quotes/new?${params.toString()}`;
}
