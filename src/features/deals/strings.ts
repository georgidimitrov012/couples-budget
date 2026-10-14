// The deals feature's own text (kept here, not in lib/i18n, so removing the
// feature is deleting one folder). Placeholders are {name}.

import type { Lang } from '../../../lib/i18n';

const en = {
  badgeA11y: 'On sale at {chain}: {product} for {price}, {pct}% off. Tap to compare prices.',
  moreChainsA11y: '{n} more chains have it on sale',
  sheetTitle: '{item}: prices',
  pricesFrom: 'Prices from {date}',
  promo: 'On sale −{pct}%, usually {price}',
  someStores: 'On sale in some stores only',
  disclaimer: 'Prices are for information and may have changed since — check in store.',
  source: 'Source: КЗП (Consumer Protection Commission) · kolkostruva.bg',
  loadError: "Couldn't load prices. Tap to try again.",
  empty: 'No current prices for this item.',
  more: '+ {n} more',
  bestPerChain: 'Best at each store',
  topDeals: 'Biggest discounts',
  showAll: 'All {n} products ›',
  showAllA11y: 'Show all {n} products at {chain}',
  chainProducts: '{chain} · {n} products',
  allStores: '‹ All stores',
  close: 'Close',
  kg: 'kg',
  l: 'l',
  pc: 'pc',
};

type Strings = typeof en;

const bg: Strings = {
  badgeA11y: 'В промоция в {chain}: {product} за {price}, −{pct}%. Докоснете, за да сравните цените.',
  moreChainsA11y: 'Още {n} вериги с промоция',
  sheetTitle: '{item}: цени',
  pricesFrom: 'Цени от {date}',
  promo: 'Промоция −{pct}%, иначе {price}',
  someStores: 'Промоция само в някои магазини',
  disclaimer: 'Цените са информативни и може вече да са се променили — проверете в магазина.',
  source: 'Източник: КЗП · kolkostruva.bg',
  loadError: 'Цените не можаха да се заредят. Докоснете, за да опитате отново.',
  empty: 'Няма текущи цени за този продукт.',
  more: '+ още {n}',
  bestPerChain: 'Най-добре във всяка верига',
  topDeals: 'Най-големи намаления',
  showAll: 'Всички {n} продукта ›',
  showAllA11y: 'Покажи всички {n} продукта в {chain}',
  chainProducts: '{chain} · {n} продукта',
  allStores: '‹ Всички вериги',
  close: 'Затвори',
  kg: 'кг',
  l: 'л',
  pc: 'бр',
};

export const STRINGS: Record<Lang, Strings> = { en, bg };

export function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (all, key: string) => (key in params ? String(params[key]) : all));
}

/** "2026-10-11" → "11.10.2026". */
export function displayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return y && m && d ? `${d}.${m}.${y}` : isoDate;
}
