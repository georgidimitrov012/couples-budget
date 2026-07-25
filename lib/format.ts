/** Currency symbol shown after every amount. Bulgaria adopted the euro in Jan 2026. */
export const CURRENCY_SYMBOL = '€';

// A non-breaking space keeps the amount and its symbol on the same line (U+00A0).
const NBSP = String.fromCharCode(0xa0);

/** 12.5 → "12.50 €", 1234.5 → "1,234.50 €" (device locale decides the number separators). */
export function formatAmount(n: number): string {
  const number = n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${number}${NBSP}${CURRENCY_SYMBOL}`;
}

/** Lenient user input → positive amount, or null ("3,50" works; "" / "0" / junk don't). */
export function parseAmount(raw: string): number | null {
  const n = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}
