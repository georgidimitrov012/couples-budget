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
