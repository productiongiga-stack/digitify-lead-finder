export function eur(cents?: number | null, currency = "EUR") {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency }).format(Number(cents || 0) / 100);
}

export function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function budgetCentsOrNull(value: string) {
  const cents = numberValue(value);
  return cents >= 100 ? cents : null;
}

export function normalizeCampaignNameKey(name: string) {
  return name.trim().toLowerCase();
}

export function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}
