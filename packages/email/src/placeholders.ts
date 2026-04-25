export interface PlaceholderContext {
  // Lead data
  companyName?: string;
  contactName?: string;
  industry?: string;
  city?: string;
  website?: string;
  email?: string;
  phone?: string;
  leadScore?: number;
  scorePriority?: string;

  // Sender/company data
  senderName?: string;
  senderTitle?: string;
  senderCompany?: string;
  senderEmail?: string;
  senderPhone?: string;

  // Report/proposal data
  reportSummary?: string;
  painPoints?: string;

  // Offerte data
  offerTitle?: string;
  offerPrice?: string;
  quoteNumber?: string;

  // Action URLs
  bookingLink?: string;
  reviewLink?: string;
  ctaText?: string;
  ctaUrl?: string;

  // Dynamic
  todayDate?: string;

  // Custom overrides
  [key: string]: string | number | undefined;
}

export const PLACEHOLDER_REGISTRY: Array<{
  key: string;
  label: string;
  category: string;
  description: string;
  example: string;
}> = [
  { key: "companyName", label: "Bedrijfsnaam", category: "Lead", description: "Naam van het leadbedrijf", example: "Bakkerij Peeters" },
  { key: "contactName", label: "Contactpersoon", category: "Lead", description: "Naam van de contactpersoon", example: "Jan Peeters" },
  { key: "industry", label: "Sector", category: "Lead", description: "Sector/industrie van het bedrijf", example: "Horeca" },
  { key: "city", label: "Stad", category: "Lead", description: "Stad van het bedrijf", example: "Gent" },
  { key: "website", label: "Website", category: "Lead", description: "Website URL", example: "www.bakkerijpeeters.be" },
  { key: "email", label: "E-mail", category: "Lead", description: "E-mailadres van het bedrijf", example: "info@bakkerijpeeters.be" },
  { key: "phone", label: "Telefoon", category: "Lead", description: "Telefoonnummer", example: "+32 9 123 45 67" },
  { key: "leadScore", label: "Lead Score", category: "Lead", description: "Opportunity score (0-100)", example: "78" },
  { key: "scorePriority", label: "Prioriteit", category: "Lead", description: "Score prioriteit", example: "Hot" },
  { key: "senderName", label: "Afzender Naam", category: "Afzender", description: "Naam van de verzender", example: "Klim" },
  { key: "senderTitle", label: "Afzender Functie", category: "Afzender", description: "Functie of titel van de verzender", example: "Zaakvoerder" },
  { key: "senderCompany", label: "Afzender Bedrijf", category: "Afzender", description: "Bedrijfsnaam van de verzender", example: "Mijn Bedrijf BV" },
  { key: "senderEmail", label: "Afzender E-mail", category: "Afzender", description: "E-mail van de verzender", example: "info@mijnbedrijf.be" },
  { key: "senderPhone", label: "Afzender Telefoon", category: "Afzender", description: "Telefoon van de verzender", example: "+32 9 000 00 00" },
  { key: "reportSummary", label: "Rapport Samenvatting", category: "Rapport", description: "AI-gegenereerde samenvatting", example: "Dit bedrijf heeft..." },
  { key: "painPoints", label: "Pijnpunten", category: "Rapport", description: "Geïdentificeerde pijnpunten", example: "Geen website, slechte online zichtbaarheid" },
  { key: "offerTitle", label: "Offerte Titel", category: "Offerte", description: "Titel van de offerte", example: "Website Redesign" },
  { key: "offerPrice", label: "Offerte Prijs", category: "Offerte", description: "Totaalprijs van de offerte", example: "€2.500,00" },
  { key: "quoteNumber", label: "Offerte Nummer", category: "Offerte", description: "Uniek offertenummer", example: "OFF-2026-0001" },
  { key: "bookingLink", label: "Booking Link", category: "Acties", description: "Link om afspraak te boeken", example: "/bookings" },
  { key: "reviewLink", label: "Review Link", category: "Acties", description: "Link voor Google review", example: "https://g.page/r/abc/review" },
  { key: "ctaText", label: "CTA Tekst", category: "Acties", description: "Call-to-action knoptekst", example: "Plan een gesprek" },
  { key: "ctaUrl", label: "CTA URL", category: "Acties", description: "Call-to-action link", example: "/contact" },
  { key: "todayDate", label: "Datum Vandaag", category: "Systeem", description: "Huidige datum", example: "9 april 2026" },
];

/**
 * Replace all {{placeholder}} in text with values from context.
 * Unknown placeholders are left as-is or replaced with fallback.
 */
export function replacePlaceholders(
  text: string,
  context: PlaceholderContext,
  options?: { removeMissing?: boolean; fallback?: string }
): string {
  // Always inject todayDate
  const now = new Date();
  const months = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
  const fullContext: PlaceholderContext = {
    todayDate: `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`,
    ...context,
  };

  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = fullContext[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
    if (options?.removeMissing) return "";
    if (options?.fallback !== undefined) return options.fallback;
    return match; // Leave {{key}} as-is
  });
}

/**
 * Build PlaceholderContext from a lead object and settings
 */
export function buildLeadContext(lead: {
  companyName?: string;
  email?: string;
  phone?: string;
  website?: string;
  industry?: string;
  city?: string;
  overallScore?: number | null;
  scorePriority?: string | null;
  contacts?: Array<{ name?: string; isPrimary?: boolean }>;
}, senderSettings?: {
  senderName?: string;
  senderTitle?: string;
  senderCompany?: string;
  senderEmail?: string;
  senderPhone?: string;
}): PlaceholderContext {
  const primaryContact = lead.contacts?.find(c => c.isPrimary) || lead.contacts?.[0];
  return {
    companyName: lead.companyName,
    contactName: primaryContact?.name,
    industry: lead.industry ?? undefined,
    city: lead.city ?? undefined,
    website: lead.website ?? undefined,
    email: lead.email ?? undefined,
    phone: lead.phone ?? undefined,
    leadScore: lead.overallScore ?? undefined,
    scorePriority: lead.scorePriority ?? undefined,
    ...senderSettings,
  };
}

/**
 * Validate that a text doesn't contain unresolved {{...}} placeholders
 */
export function hasUnresolvedPlaceholders(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return Array.from(new Set(matches));
}

/**
 * Get all available placeholders grouped by category
 */
export function getPlaceholdersByCategory(): Record<string, typeof PLACEHOLDER_REGISTRY> {
  const grouped: Record<string, typeof PLACEHOLDER_REGISTRY> = {};
  for (const p of PLACEHOLDER_REGISTRY) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  }
  return grouped;
}
