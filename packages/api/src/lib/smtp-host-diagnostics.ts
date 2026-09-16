import dns from "node:dns/promises";
import net from "node:net";

/** Well-known Cloudflare anycast ranges (IPv4). Used to detect proxied “smtp.*” hosts. */
const CLOUDFLARE_IPV4_CIDRS = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
] as const;

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return ((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!;
}

function parseCidr(cidr: string): { start: number; end: number } | null {
  const [base, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  const baseInt = base ? ipv4ToInt(base) : null;
  if (baseInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return null;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  const start = (baseInt & mask) >>> 0;
  const end = (start | (~mask >>> 0)) >>> 0;
  return { start, end };
}

const PARSED_CF_RANGES = CLOUDFLARE_IPV4_CIDRS.map(parseCidr).filter(
  (r): r is { start: number; end: number } => Boolean(r),
);

export function isCloudflareIpv4(ip: string): boolean {
  if (net.isIPv4(ip) !== true) return false;
  const value = ipv4ToInt(ip);
  if (value === null) return false;
  return PARSED_CF_RANGES.some((range) => value >= range.start && value <= range.end);
}

export function looksLikeMailSubdomain(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return /^(smtp|mail|email|mx)\./i.test(normalized);
}

export type SmtpHostDiagnosis =
  | { status: "ok"; addresses: string[] }
  | {
      status: "cloudflare_proxy";
      addresses: string[];
      message: string;
    }
  | { status: "dns_failed"; message: string };

/**
 * Fail fast when an SMTP hostname resolves only to Cloudflare proxy IPs.
 * Cloudflare does not forward submission ports (587/465), so connections time out.
 */
export async function diagnoseSmtpHost(host: string): Promise<SmtpHostDiagnosis> {
  const normalized = host.trim().toLowerCase();
  if (!normalized) {
    return { status: "dns_failed", message: "SMTP-host ontbreekt." };
  }

  let addresses: string[] = [];
  try {
    addresses = await dns.resolve4(normalized);
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
    if (code === "ENOTFOUND" || code === "ENODATA") {
      return {
        status: "dns_failed",
        message: `SMTP-host '${normalized}' is niet gevonden in DNS. Controleer de hostnaam.`,
      };
    }
    // Other DNS errors: don't block the real SMTP attempt.
    return { status: "ok", addresses: [] };
  }

  const cloudflareHits = addresses.filter(isCloudflareIpv4);
  if (addresses.length > 0 && cloudflareHits.length === addresses.length && looksLikeMailSubdomain(normalized)) {
    return {
      status: "cloudflare_proxy",
      addresses,
      message:
        `SMTP-host '${normalized}' wijst naar Cloudflare (proxy). Poort 587/465 werkt daar niet. ` +
        `Gebruik de echte mailhost van je provider (voor Stackmail/20i: smtp.stackmail.com), ` +
        `niet een proxied smtp./mail.-subdomein van je website.`,
    };
  }

  return { status: "ok", addresses };
}
