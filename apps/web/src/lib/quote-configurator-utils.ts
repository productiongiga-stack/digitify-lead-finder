export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function sanitizeNumber(input: string) {
  const parsed = Number(input.replace(",", "."));
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

export function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function parseEmojiMap(raw: string): Record<string, string> {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .map(([key, value]) => [String(key).trim(), typeof value === "string" ? value.trim() : ""])
        .filter(([key, value]) => key.length > 0 && value.length > 0),
    );
  } catch {
    return {};
  }
}

export function stringifyEmojiMap(map: Record<string, string>) {
  return JSON.stringify(map, null, 2);
}

export function isImageIcon(value: string) {
  const trimmed = value.trim();
  return (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("/uploads/") ||
    /\.public\.blob\.vercel-storage\.com\//i.test(trimmed)
  );
}

export type QuoteIconLibraryItem = {
  id: string;
  url: string;
  label?: string;
};

export const QUOTE_CONFIGURATOR_EMOJI_OPTIONS = [
  "💻",
  "🛍️",
  "🎬",
  "🎥",
  "📸",
  "📣",
  "🔎",
  "🌐",
  "⚙️",
  "🧩",
  "🧠",
  "🎨",
  "🖨️",
  "📈",
  "💡",
  "📦",
  "📱",
  "🔧",
  "🚀",
] as const;

export function parseIconLibrary(raw: string): QuoteIconLibraryItem[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry, index) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
        const item = entry as Record<string, unknown>;
        const url = typeof item.url === "string" ? item.url.trim() : "";
        if (!url || !isImageIcon(url)) return null;
        const id =
          typeof item.id === "string" && item.id.trim().length > 0
            ? item.id.trim()
            : `icon-${index + 1}`;
        const label = typeof item.label === "string" ? item.label.trim() : undefined;
        return { id, url, ...(label ? { label } : {}) } satisfies QuoteIconLibraryItem;
      })
      .filter((item): item is QuoteIconLibraryItem => item !== null);
  } catch {
    return [];
  }
}

export function stringifyIconLibrary(items: QuoteIconLibraryItem[]) {
  const unique = new Map<string, QuoteIconLibraryItem>();
  items.forEach((item) => {
    if (!item.url.trim()) return;
    unique.set(item.url.trim(), {
      id: item.id.trim() || `icon-${unique.size + 1}`,
      url: item.url.trim(),
      ...(item.label?.trim() ? { label: item.label.trim() } : {}),
    });
  });
  return JSON.stringify([...unique.values()], null, 2);
}

export function collectIconPickerValues(
  currentValue: string,
  library: QuoteIconLibraryItem[],
  emojiOptions: readonly string[] = QUOTE_CONFIGURATOR_EMOJI_OPTIONS,
) {
  const values = new Set<string>();
  if (currentValue.trim()) values.add(currentValue.trim());
  library.forEach((item) => {
    if (item.url.trim()) values.add(item.url.trim());
  });
  emojiOptions.forEach((emoji) => values.add(emoji));
  return [...values];
}
