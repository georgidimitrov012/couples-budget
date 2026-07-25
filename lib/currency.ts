// Display currency for money amounts. Amounts are always stored as plain numbers;
// this only controls how they're rendered. The choice is a device-local setting
// (see hooks/useCurrency.tsx), mirroring the language setting — Bulgaria adopted
// the euro in Jan 2026, so EUR is the default.

export type Currency = 'EUR' | 'BGN' | 'USD';
export const CURRENCIES: Currency[] = ['EUR', 'BGN', 'USD'];
export const DEFAULT_CURRENCY: Currency = 'EUR';

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  EUR: '€',
  BGN: 'лв.',
  USD: '$',
};

// Fixed names (like LANG_LABEL) — used as accessibility labels on the picker.
export const CURRENCY_LABEL: Record<Currency, string> = {
  EUR: 'Euro',
  BGN: 'Lev',
  USD: 'Dollar',
};

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (CURRENCIES as string[]).includes(value);
}

// A non-breaking space keeps the amount and its symbol on the same line (U+00A0).
const NBSP = String.fromCharCode(0xa0);

/** 12.5 → "12.50 €", "12.50 лв." or "12.50 $" (device locale decides separators). */
export function formatMoney(n: number, currency: Currency = DEFAULT_CURRENCY): string {
  const number = n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${number}${NBSP}${CURRENCY_SYMBOL[currency]}`;
}
