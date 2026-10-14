// Localized month names for the stats history. Hardcoded (not Intl) so they work
// on Hermes, where Intl month formatting isn't reliable across locales.
import type { Lang } from './i18n';

const SHORT: Record<Lang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  bg: ['яну', 'фев', 'мар', 'апр', 'май', 'юни', 'юли', 'авг', 'сеп', 'окт', 'ное', 'дек'],
};

const LONG: Record<Lang, string[]> = {
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],
  bg: [
    'януари', 'февруари', 'март', 'април', 'май', 'юни',
    'юли', 'август', 'септември', 'октомври', 'ноември', 'декември',
  ],
};

/** 0-based month index from a 'YYYY-MM' key. */
function monthIndex(monthKey: string): number {
  return Number(monthKey.split('-')[1]) - 1;
}

/** 'Jul' / 'юли' for a 'YYYY-MM' key. */
export function monthShort(monthKey: string, lang: Lang): string {
  return SHORT[lang][monthIndex(monthKey)] ?? '';
}

/** 'July 2026' / 'юли 2026' for a 'YYYY-MM' key. */
export function monthLong(monthKey: string, lang: Lang): string {
  const [year] = monthKey.split('-');
  return `${LONG[lang][monthIndex(monthKey)] ?? ''} ${year}`;
}

// ---------------------------------------------------------------------------
// Calendar days ('YYYY-MM-DD', local time) for backdating an expense.

function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

/** Today (or `date`) as a local calendar day — not toISOString(), which is UTC. */
export function localDay(date = new Date()): string {
  return dayKey(date);
}

/** '2026-10-01' + -1 → '2026-09-30'. */
export function addDays(day: string, n: number): string {
  const date = parseDay(day);
  date.setDate(date.getDate() + n);
  return dayKey(date);
}

/** The last day of a 'YYYY-MM' month: '2026-02' → '2026-02-28'. */
export function lastDayOfMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return dayKey(new Date(y, m, 0));
}

const DAY_WORDS: Record<Lang, { today: string; yesterday: string }> = {
  en: { today: 'Today', yesterday: 'Yesterday' },
  bg: { today: 'Днес', yesterday: 'Вчера' },
};

/** 'Today' / 'Yesterday' / '12 Oct 2026' ('12 окт 2026'), relative to `today`. */
export function dayLabel(day: string, today: string, lang: Lang): string {
  if (day === today) return DAY_WORDS[lang].today;
  if (day === addDays(today, -1)) return DAY_WORDS[lang].yesterday;
  const [y, m, d] = day.split('-');
  return `${Number(d)} ${SHORT[lang][Number(m) - 1] ?? ''} ${y}`;
}
