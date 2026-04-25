export type MailVariable = {
  key: string;
  label: string;
  category: string;
  description: string;
  example: string;
};

export const MAIL_VARIABLE_REGISTRY: MailVariable[] = [
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
  { key: "painPoints", label: "Pijnpunten", category: "Rapport", description: "Geidentificeerde pijnpunten", example: "Geen website, slechte online zichtbaarheid" },
  { key: "offerTitle", label: "Offerte Titel", category: "Offerte", description: "Titel van de offerte", example: "Website Redesign" },
  { key: "offerPrice", label: "Offerte Prijs", category: "Offerte", description: "Totaalprijs van de offerte", example: "EUR 2.500,00" },
  { key: "quoteNumber", label: "Offerte Nummer", category: "Offerte", description: "Uniek offertenummer", example: "OFF-2026-0001" },
  { key: "bookingLink", label: "Booking Link", category: "Acties", description: "Link om afspraak te boeken", example: "/bookings" },
  { key: "reviewLink", label: "Review Link", category: "Acties", description: "Link voor Google review", example: "https://g.page/r/abc/review" },
  { key: "ctaText", label: "CTA Tekst", category: "Acties", description: "Call-to-action knoptekst", example: "Plan een gesprek" },
  { key: "ctaUrl", label: "CTA URL", category: "Acties", description: "Call-to-action link", example: "/contact" },
  { key: "todayDate", label: "Datum Vandaag", category: "Systeem", description: "Huidige datum", example: "9 april 2026" },
];

const MAIL_VARIABLE_KEYS = new Set(MAIL_VARIABLE_REGISTRY.map((item) => item.key));

export function extractMailVariableKeys(text: string): string[] {
  if (!text) return [];
  const matches = Array.from(text.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)).map((match) => match[1] || "");
  return Array.from(new Set(matches.filter(Boolean)));
}

export function findUnknownMailVariables(text: string): string[] {
  return extractMailVariableKeys(text).filter((key) => !MAIL_VARIABLE_KEYS.has(key));
}

export function getMailVariablesByCategory() {
  const grouped: Record<string, MailVariable[]> = {};
  for (const item of MAIL_VARIABLE_REGISTRY) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category]!.push(item);
  }
  return grouped;
}
