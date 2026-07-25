// Money formatting lives in lib/currency.ts (currency-aware) — use the
// useCurrency() hook's `format()` in components. This module keeps the pure,
// currency-independent input parser.

/** Lenient user input → positive amount, or null ("3,50" works; "" / "0" / junk don't). */
export function parseAmount(raw: string): number | null {
  const n = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}
