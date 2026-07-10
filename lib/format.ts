/** 12.5 → "12.50", 1234.5 → "1,234.50" (device locale decides the separators). */
export function formatAmount(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Lenient user input → positive amount, or null ("3,50" works; "" / "0" / junk don't). */
export function parseAmount(raw: string): number | null {
  const n = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}
