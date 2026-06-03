import { lookup } from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
]);

function isPrivateIp(ip: string): boolean {
  if (!net.isIP(ip)) return false;
  if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  const lower = ip.toLowerCase();
  if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:")) return true;
  if (lower.startsWith("::ffff:127.") || lower.startsWith("::ffff:10.") || lower.startsWith("::ffff:192.168.")) {
    return true;
  }
  return false;
}

export function isBlockedFetchHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".localhost")) return true;
  return isPrivateIp(host);
}

export async function assertPublicHttpUrl(raw: string): Promise<string> {
  const trimmed = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Ongeldige URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Alleen http(s)-URL's zijn toegestaan.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("URL's met credentials zijn niet toegestaan.");
  }

  const hostname = parsed.hostname.replace(/^\[/, "").replace(/\]$/, "");
  if (isBlockedFetchHost(hostname)) {
    throw new Error("Deze host is niet toegestaan voor server-side requests.");
  }

  const records = await lookup(hostname, { all: true, verbatim: true }).catch(() => []);
  for (const rec of records) {
    if (isBlockedFetchHost(rec.address)) {
      throw new Error("Deze host is niet toegestaan voor server-side requests.");
    }
  }

  return parsed.toString();
}
