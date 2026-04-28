export function resolveSmtpServername(params: {
  host: string;
  explicitServername?: string;
  username?: string;
}) {
  const explicit = params.explicitServername?.trim();
  if (explicit) return explicit;

  const usernameDomain = params.username?.split("@")[1]?.trim();
  if (usernameDomain) return usernameDomain;

  const hostParts = params.host.split(".").filter(Boolean);
  if (hostParts.length > 2) {
    return hostParts.slice(-2).join(".");
  }

  return params.host;
}

export function normalizeTlsOptions(params: {
  host: string;
  explicitServername?: string;
  username?: string;
  rejectUnauthorized: boolean;
}) {
  return {
    rejectUnauthorized: params.rejectUnauthorized,
    servername: resolveSmtpServername({
      host: params.host,
      explicitServername: params.explicitServername,
      username: params.username,
    }),
  };
}

export function formatSmtpErrorMessage(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("Hostname/IP does not match certificate's altnames")) {
    return "SMTP mislukt: het SSL-certificaat past niet bij de SMTP-host. Vul bij 'Server naam (TLS)' de host uit het certificaat in, bijvoorbeeld je hoofddomein of de officiële mailhost van je provider.";
  }
  if (/auth|login|invalid credentials|username|password/i.test(message)) {
    return "SMTP mislukt: authenticatie geweigerd. Controleer gebruikersnaam, wachtwoord of app-password, en kijk na of SMTP-auth is toegestaan.";
  }
  if (/timeout|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|EHOSTUNREACH|EAI_AGAIN/i.test(message)) {
    return "SMTP mislukt: de mailserver is niet bereikbaar vanaf de app. Controleer host, poort, firewall/DNS en of je mailprovider SMTP-verkeer vanaf Vercel/cloudservers toestaat.";
  }
  return `SMTP mislukt: ${message}`;
}

export function extractEmailCta(body: string) {
  const textMatch = body.match(/\[\[CTA_TEXT=(.+?)\]\]/);
  const urlMatch = body.match(/\[\[CTA_URL=(.+?)\]\]/);

  const cleanBody = body
    .replace(/\n?\[\[CTA_TEXT=.+?\]\]/g, "")
    .replace(/\n?\[\[CTA_URL=.+?\]\]/g, "")
    .trim();

  const ctaText = textMatch?.[1]?.trim();
  const ctaUrl = urlMatch?.[1]?.trim();

  return {
    cleanBody,
    ctaText: ctaText || undefined,
    ctaUrl: ctaUrl || undefined,
  };
}

export function normalizeLegacyPlaceholders(
  text: string,
  replacements: Record<string, string | undefined>
) {
  return Object.entries(replacements).reduce((current, [key, value]) => {
    const safeValue = value?.trim() || "";
    const pattern = new RegExp(`\\[${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`, "gi");
    // Use a function as replacer to prevent $ in values being treated as regex group references
    return current.replace(pattern, () => safeValue);
  }, text);
}

export function normalizeAiPlaceholderSyntax(text: string) {
  const normalizedRules: Array<[RegExp, string]> = [
    [/\{\{\s*sender_name\s*\}\}/gi, "{{senderName}}"],
    [/\{\{\s*sender_title\s*\}\}/gi, "{{senderTitle}}"],
    [/\{\{\s*sender_company\s*\}\}/gi, "{{senderCompany}}"],
    [/\{\{\s*sender_email\s*\}\}/gi, "{{senderEmail}}"],
    [/\{\{\s*sender_phone\s*\}\}/gi, "{{senderPhone}}"],
    [/\{\{\s*company_name\s*\}\}/gi, "{{companyName}}"],
    [/\{\{\s*contact_name\s*\}\}/gi, "{{contactName}}"],
    [/\{\{\s*lead_city\s*\}\}/gi, "{{city}}"],
    [/\{\{\s*lead_industry\s*\}\}/gi, "{{industry}}"],
    [/\{\{\s*lead_website\s*\}\}/gi, "{{website}}"],
    [/\{\{\s*lead_email\s*\}\}/gi, "{{email}}"],
  ];

  return normalizedRules.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}
