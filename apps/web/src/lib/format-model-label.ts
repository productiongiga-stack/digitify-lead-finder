export function formatModelOptionLabel(label: string, costLabel?: string | null): string {
  if (!costLabel) return label;
  return `${label} · ${costLabel}`;
}
