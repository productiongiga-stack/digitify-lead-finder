export function resolveSmtpServername(params: {
  host: string;
  explicitServername?: string;
  /** @deprecated Ignored — TLS servername must match the SMTP host certificate, not the mailbox domain. */
  username?: string;
}) {
  const explicit = params.explicitServername?.trim();
  if (explicit) return explicit;
  return params.host.trim();
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

function isRunningOnVercel() {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
}

function smtpReachabilityHint() {
  if (isRunningOnVercel()) {
    return "Controleer host, poort, firewall/DNS en of je mailprovider SMTP-verkeer vanaf Vercel toestaat.";
  }
  return (
    "Controleer host, poort, firewall en DNS. " +
    "Let op: smtp./mail.-subdomeinen die via Cloudflare proxied zijn (zoals smtp.digitify.be) accepteren geen SMTP — " +
    "gebruik de echte mailhost (bij Stackmail/20i: smtp.stackmail.com). " +
    "Lokaal kun je met EMAIL_PROVIDER=console e-mails naar de console loggen i.p.v. SMTP."
  );
}

export function formatSmtpErrorMessage(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (message.startsWith("SMTP mislukt:")) {
    return message;
  }
  if (message.includes("Hostname/IP does not match certificate's altnames")) {
    return "SMTP mislukt: het SSL-certificaat past niet bij de SMTP-host. Vul bij 'Server naam (TLS)' de host uit het certificaat in (meestal gelijk aan de SMTP-host), of laat het veld leeg.";
  }
  if (/auth|login|invalid credentials|username|password/i.test(message)) {
    return "SMTP mislukt: authenticatie geweigerd. Controleer gebruikersnaam, wachtwoord of app-password, en kijk na of SMTP-auth is toegestaan.";
  }
  if (
    /timeout|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|EHOSTUNREACH|EAI_AGAIN|verbinding met de mailserver mislukt|niet bereikbaar|cloudflare/i.test(
      message,
    )
  ) {
    return `SMTP mislukt: de mailserver is niet bereikbaar vanaf de app. ${smtpReachabilityHint()}`;
  }
  return `SMTP mislukt: ${message}`;
}

/**
 * Resolve which email provider to use.
 * - EMAIL_PROVIDER=console in non-production skips workspace SMTP (avoids local timeouts).
 * - Explicit DB `email.provider=console` is respected even when SMTP credentials exist.
 */
export function resolveEmailProviderName(params: {
  configuredProvider: string;
  hasSmtpCredentials: boolean;
  envProvider?: string;
  nodeEnv?: string;
}) {
  const envProvider = (params.envProvider ?? process.env.EMAIL_PROVIDER ?? "").toLowerCase().trim();
  const nodeEnv = params.nodeEnv ?? process.env.NODE_ENV ?? "";
  if (envProvider === "console" && nodeEnv !== "production") {
    return "console";
  }
  if (params.configuredProvider === "console") return "console";
  if (params.configuredProvider === "smtp") return "smtp";
  return params.hasSmtpCredentials ? "smtp" : "console";
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
