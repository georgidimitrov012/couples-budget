// Matching a free-typed shopping-list item to official product groups, and
// deciding which of a chain's products in those groups really are that item.
//
// Two layers handle "there are many kinds of tomatoes":
//   1. The item picks the *group* ("домати" → 54) via the longest alias it
//      contains, so "кисело мляко" is yogurt (7), not milk (6).
//   2. Any extra words the person typed narrow the products: "домати на клонка"
//      only matches products whose name has "клонка"; "кисело мляко 2%" only 2%;
//      a brand ("Саяна") only that brand. Plain "домати" accepts every kind.

import { CONCEPTS, type Concept } from './groups';

export type ItemMatch = {
  groups: number[];
  /** A product name must contain one of these (empty = no check). */
  stems: string[];
  /** Extra words from the item that a product name must also contain. */
  refinements: string[];
};

// Words that carry no product meaning in a list item ("домати НА клонка").
const STOPWORDS = new Set([
  'на', 'за', 'с', 'със', 'и', 'от', 'в', 'във', 'по', 'без', 'или',
  'the', 'a', 'an', 'of', 'for', 'with', 'and',
]);

// Pack sizes and counts in an item ("Мляко 2 л", "яйца 10 бр") aren't refinements.
const UNIT_WORDS = new Set(['кг', 'г', 'гр', 'л', 'мл', 'бр', 'броя', 'пакет', 'пакета', 'kg', 'g', 'gr', 'l', 'ml', 'pcs', 'pack']);
const QUANTITY = /^\d+(?:\.\d+)?(?:кг|г|гр|л|мл|бр|kg|g|gr|l|ml|pcs|x)?$/;

// Bulgarian inflections (plural, definite article) folded to a shared stem, so
// "домати"/"доматите"/"домат" and "свинско"/"свински"/"свинска" compare equal.
const ENDINGS = ['ите', 'ата', 'ото', 'ета', 'ове', 'еве', 'ът', 'ят', 'та', 'то', 'те', 'и', 'а', 'я', 'о', 'е', 'у', 'ъ'];

/** Lowercase, unify decimals ("3,6" → "3.6") and percents, strip punctuation. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/(\d)\s+%/g, '$1%')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
    .replace(/[^a-zа-я0-9.%]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stem(word: string): string {
  if (word.length <= 3 || /[^а-я]/.test(word)) return word;
  for (const end of ENDINGS) {
    if (word.endsWith(end) && word.length - end.length >= 3) return word.slice(0, -end.length);
  }
  return word;
}

/** Meaningful word stems of a list item (stopwords and quantities dropped). */
export function itemStems(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((w) => w && !STOPWORDS.has(w) && !UNIT_WORDS.has(w) && !QUANTITY.test(w))
    .map(stem);
}

type Alias = { stems: string[]; concept: Concept };

const ALIASES: Alias[] = CONCEPTS.flatMap((concept) =>
  [...concept.bg, ...(concept.en ?? [])].map((phrase) => ({ stems: itemStems(phrase), concept }))
);

/**
 * The official group(s) a list item belongs to, or null if it isn't one of the
 * goods КЗП tracks. The most specific alias wins: the one with the most words,
 * so "паста за зъби" beats "паста" and "кисело мляко" beats "мляко".
 */
export function matchItem(name: string): ItemMatch | null {
  const words = itemStems(name);
  if (words.length === 0) return null;
  let best: Alias | null = null;
  for (const alias of ALIASES) {
    if (alias.stems.length === 0 || !alias.stems.every((s) => words.includes(s))) continue;
    if (!best || alias.stems.length > best.stems.length) best = alias;
  }
  if (!best) return null;
  const consumed = new Set(best.stems);
  return {
    groups: best.concept.groups,
    stems: best.concept.stems,
    refinements: words.filter((w) => !consumed.has(w)),
  };
}

/** Does this product (as a chain named it) count as the item? */
export function productMatches(match: ItemMatch, productName: string): boolean {
  const name = normalize(productName);
  if (match.stems.length > 0 && !match.stems.some((s) => name.includes(s))) return false;
  if (match.refinements.length === 0) return true;
  const words = name.split(' ').map(stem);
  return match.refinements.every((r) =>
    /\d/.test(r) ? words.includes(r) : words.some((w) => w === r || w.startsWith(r))
  );
}

export type Size = { amount: number; unit: 'kg' | 'l' | 'pc' };

const TO_BASE: Record<string, { factor: number; unit: Size['unit'] }> = {
  кг: { factor: 1, unit: 'kg' },
  kg: { factor: 1, unit: 'kg' },
  г: { factor: 0.001, unit: 'kg' },
  гр: { factor: 0.001, unit: 'kg' },
  gr: { factor: 0.001, unit: 'kg' },
  g: { factor: 0.001, unit: 'kg' },
  л: { factor: 1, unit: 'l' },
  l: { factor: 1, unit: 'l' },
  мл: { factor: 0.001, unit: 'l' },
  ml: { factor: 0.001, unit: 'l' },
};
const UNIT = '(кг|kg|гр|gr|г|g|мл|ml|л|l)';

/**
 * The pack size printed in a product name, for comparing per kg / l / piece:
 * "Кисело мляко 2% 400г" → 0.4 kg, "6 x 0.5 л" → 3 l, "Домати кг" → 1 kg,
 * "Яйца 10 бр" → 10 pc. Null when the name doesn't say.
 */
export function parseSize(productName: string): Size | null {
  const name = normalize(productName);
  // "около 2кг" is a weight hint on a per-kg price, not the pack size.
  if (/около \d/.test(name)) return { amount: 1, unit: 'kg' };
  const multi = name.match(new RegExp(`(\\d+) ?(?:бр )?[xх×] ?(\\d+(?:\\.\\d+)?) ?${UNIT}(?![a-zа-я])`));
  if (multi) {
    const base = TO_BASE[multi[3]];
    return { amount: Number(multi[1]) * Number(multi[2]) * base.factor, unit: base.unit };
  }
  const single = name.match(new RegExp(`(\\d+(?:\\.\\d+)?) ?${UNIT}(?![a-zа-я])`));
  if (single) {
    const base = TO_BASE[single[2]];
    const amount = Number(single[1]) * base.factor;
    return amount > 0 ? { amount, unit: base.unit } : null;
  }
  if (/(?:^| )(?:на )?кг(?: |$)/.test(name)) return { amount: 1, unit: 'kg' };
  const pieces = name.match(/(\d+) ?бр(?![a-zа-я])/);
  if (pieces && Number(pieces[1]) > 0) return { amount: Number(pieces[1]), unit: 'pc' };
  return null;
}
