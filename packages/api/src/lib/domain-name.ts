/** Normalizes user input to a bare hostname (no scheme, path, or www). */
export function normalizeDomainName(value: string): string {
  let host = value.trim().toLowerCase();
  host = host.replace(/^https?:\/\//, "");
  host = host.replace(/^www\./, "");
  host = (host.split("/")[0] ?? host).split(":")[0] ?? host;
  return host.replace(/\.+$/, "");
}

export function isValidDomainName(value: string): boolean {
  if (!value || value.length > 253) return false;
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(value);
}
