// Pure helpers for recurring rules. Day-of-month is capped at 28 so every month
// actually has that day (matches the DB CHECK on recurring_rules.day_of_month).
export const MAX_DAY_OF_MONTH = 28;

/** Clamp any number to a valid day-of-month [1, 28], flooring and defaulting to 1. */
export function clampDay(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_DAY_OF_MONTH, Math.max(1, Math.floor(n)));
}

/** Parse free text into a valid day-of-month; falls back to 1 when unparseable. */
export function parseDayOfMonth(text: string): number {
  const n = parseInt(text, 10);
  return Number.isNaN(n) ? 1 : clampDay(n);
}
