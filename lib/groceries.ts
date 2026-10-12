// Grocery taxonomy + a catalog of common items.
//
// Categories are app-defined constants (not per-household DB rows): a fixed,
// curated set of shopping aisles with emoji icons. `list_items.category` stores
// the key. The `label`/`name` fields here are the English source strings and act
// as fallbacks; the UI shows the localized value via i18n keys `grocery.<key>`
// and `item.<slug>` (see lib/i18n.ts). itemSlug() maps a catalog name to its key.

import { translations } from './i18n';

export type GroceryCategoryKey =
  | 'produce'
  | 'fruit'
  | 'dairy'
  | 'bakery'
  | 'meat'
  | 'frozen'
  | 'pantry'
  | 'snacks'
  | 'beverages'
  | 'household'
  | 'personal'
  | 'baby'
  | 'pets'
  | 'other';

export type GroceryCategory = { key: GroceryCategoryKey; emoji: string; label: string };

// Display order for grouping the list.
export const GROCERY_CATEGORIES: GroceryCategory[] = [
  { key: 'produce', emoji: '🥦', label: 'Vegetables' },
  { key: 'fruit', emoji: '🍎', label: 'Fruit' },
  { key: 'dairy', emoji: '🥛', label: 'Dairy & Eggs' },
  { key: 'bakery', emoji: '🥖', label: 'Bakery' },
  { key: 'meat', emoji: '🥩', label: 'Meat & Fish' },
  { key: 'frozen', emoji: '🧊', label: 'Frozen' },
  { key: 'pantry', emoji: '🥫', label: 'Pantry' },
  { key: 'snacks', emoji: '🍪', label: 'Snacks & Sweets' },
  { key: 'beverages', emoji: '🥤', label: 'Beverages' },
  { key: 'household', emoji: '🧻', label: 'Household' },
  { key: 'personal', emoji: '🧴', label: 'Personal Care' },
  { key: 'baby', emoji: '🍼', label: 'Baby' },
  { key: 'pets', emoji: '🐾', label: 'Pets' },
  { key: 'other', emoji: '🛒', label: 'Other' },
];

export const CATEGORY_BY_KEY: Record<GroceryCategoryKey, GroceryCategory> =
  GROCERY_CATEGORIES.reduce(
    (acc, c) => ({ ...acc, [c.key]: c }),
    {} as Record<GroceryCategoryKey, GroceryCategory>
  );

export function isGroceryCategoryKey(v: string | null | undefined): v is GroceryCategoryKey {
  return v != null && v in CATEGORY_BY_KEY;
}

// Resolve a stored category value to a category, tolerating null/unknown keys
// (older rows, or a key removed from the taxonomy) by falling back to "Other".
export function categoryFor(key: string | null | undefined): GroceryCategory {
  return isGroceryCategoryKey(key) ? CATEGORY_BY_KEY[key] : CATEGORY_BY_KEY.other;
}

export type CommonItem = { name: string; category: GroceryCategoryKey };

// A catalog of everyday items, tappable to add with the right category already
// set. `name` is the English source; the label shown is `item.<slug>` in the
// viewer's language (see displayItemName below).
export const COMMON_ITEMS: CommonItem[] = [
  // Dairy & eggs
  { name: 'Milk', category: 'dairy' },
  { name: 'Eggs', category: 'dairy' },
  { name: 'Butter', category: 'dairy' },
  { name: 'Cheese', category: 'dairy' },
  { name: 'Yogurt', category: 'dairy' },
  // Bakery
  { name: 'Bread', category: 'bakery' },
  { name: 'Rolls', category: 'bakery' },
  // Fruit
  { name: 'Bananas', category: 'fruit' },
  { name: 'Apples', category: 'fruit' },
  { name: 'Lemons', category: 'fruit' },
  { name: 'Oranges', category: 'fruit' },
  // Vegetables
  { name: 'Tomatoes', category: 'produce' },
  { name: 'Potatoes', category: 'produce' },
  { name: 'Onions', category: 'produce' },
  { name: 'Cucumber', category: 'produce' },
  { name: 'Carrots', category: 'produce' },
  { name: 'Peppers', category: 'produce' },
  { name: 'Lettuce', category: 'produce' },
  { name: 'Garlic', category: 'produce' },
  // Meat & fish
  { name: 'Chicken', category: 'meat' },
  { name: 'Minced meat', category: 'meat' },
  { name: 'Fish', category: 'meat' },
  { name: 'Ham', category: 'meat' },
  // Pantry
  { name: 'Rice', category: 'pantry' },
  { name: 'Pasta', category: 'pantry' },
  { name: 'Flour', category: 'pantry' },
  { name: 'Sugar', category: 'pantry' },
  { name: 'Salt', category: 'pantry' },
  { name: 'Oil', category: 'pantry' },
  { name: 'Coffee', category: 'beverages' },
  { name: 'Tea', category: 'beverages' },
  // Beverages
  { name: 'Water', category: 'beverages' },
  { name: 'Juice', category: 'beverages' },
  // Snacks
  { name: 'Chocolate', category: 'snacks' },
  { name: 'Chips', category: 'snacks' },
  { name: 'Cookies', category: 'snacks' },
  // Household
  { name: 'Toilet paper', category: 'household' },
  { name: 'Paper towels', category: 'household' },
  { name: 'Dish soap', category: 'household' },
  { name: 'Laundry detergent', category: 'household' },
  { name: 'Trash bags', category: 'household' },
  // Personal care
  { name: 'Shampoo', category: 'personal' },
  { name: 'Toothpaste', category: 'personal' },
  { name: 'Soap', category: 'personal' },
];

/** The i18n key slug for a catalog item name (see `item.<slug>` in lib/i18n). */
export function itemSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Reverse lookup name -> aisle, in BOTH languages: the English catalog name plus
// its Bulgarian translation, so a free-typed item categorizes correctly whatever
// language the user is in.
const COMMON_BY_NAME: Record<string, GroceryCategoryKey> = (() => {
  const map: Record<string, GroceryCategoryKey> = {};
  for (const item of COMMON_ITEMS) {
    map[item.name.toLowerCase()] = item.category;
    const bg = translations.bg[`item.${itemSlug(item.name)}`];
    if (bg) map[bg.toLowerCase()] = item.category;
  }
  return map;
})();

// ---------------------------------------------------------------------------
// Catalog identity across languages.
//
// A list item is stored as plain text, in whatever language its author used
// ("Моркови" or "Carrots"). Names are never translated in the database; instead
// the UI recognises a catalog item in EITHER language and shows it in the
// viewer's language, and comparisons ("is this already on the list?", "which
// list item did this expense buy?") go by catalog key, not by text. That keeps
// old rows, rows from a partner using the other language, and older app
// versions all working without a migration.

type Lang = keyof typeof translations;

function normalizeItemName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

// Plural / definite-article endings, so "Домат"/"Домати"/"Доматите" and
// "Tomato"/"Tomatoes" fold together. Only used for matching, never displayed.
const BG_ENDINGS = ['ите', 'ата', 'ото', 'ове', 'ета', 'ът', 'ят', 'и', 'а', 'я', 'е', 'о'];

function stemWord(word: string): string {
  if (/^[a-z]+$/.test(word)) {
    if (word.length > 4 && word.endsWith('oes')) return word.slice(0, -2);
    if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    return word;
  }
  for (const end of BG_ENDINGS) {
    if (word.endsWith(end) && word.length - end.length >= 3) return word.slice(0, -end.length);
  }
  return word;
}

function looseForm(name: string): string {
  return normalizeItemName(name).split(' ').map(stemWord).join(' ');
}

const SLUG_BY_EXACT = new Map<string, string>();
const SLUG_BY_LOOSE = new Map<string, string>();
for (const item of COMMON_ITEMS) {
  const slug = itemSlug(item.name);
  for (const lang of Object.keys(translations) as Lang[]) {
    const label = translations[lang][`item.${slug}`];
    if (!label) continue;
    SLUG_BY_EXACT.set(normalizeItemName(label), slug);
    SLUG_BY_LOOSE.set(looseForm(label), slug);
  }
  SLUG_BY_EXACT.set(normalizeItemName(item.name), slug);
  SLUG_BY_LOOSE.set(looseForm(item.name), slug);
}

/**
 * The catalog item a name refers to, in either language, or null for free text.
 * `exact` only accepts the catalog spelling itself (any case); otherwise
 * singular/plural/article forms count too ("Домат" → tomatoes).
 */
export function catalogSlugOf(name: string, { exact = false } = {}): string | null {
  const hit = SLUG_BY_EXACT.get(normalizeItemName(name));
  if (hit || exact) return hit ?? null;
  return SLUG_BY_LOOSE.get(looseForm(name)) ?? null;
}

/**
 * How to show a stored item name to someone using `lang`: a catalog item is shown
 * in their language ("Carrots" reads "Моркови" in Bulgarian); anything else is
 * the user's own text and is shown exactly as typed.
 */
export function displayItemName(name: string, lang: Lang): string {
  const slug = catalogSlugOf(name, { exact: true });
  return (slug && translations[lang][`item.${slug}`]) || name;
}

/** Do two names mean the same item? Same catalog item in any language, or the same text. */
export function sameItem(a: string, b: string): boolean {
  const ka = catalogSlugOf(a);
  if (ka && ka === catalogSlugOf(b)) return true;
  const na = looseForm(a);
  return na.length > 0 && na === looseForm(b);
}

/**
 * The still-needed list item an expense description is about, or null. Exact
 * item first ("Carrots" ↔ "Моркови"), then a description that contains the
 * item's words ("Моркови 2кг", "морков от пазара") or a catalog word that is the
 * item ("2 kg carrots" ↔ "Моркови"). Ambiguous hits (two items) return null —
 * the user can still pick by hand.
 */
export function findListMatch<T extends { name: string; is_checked: boolean }>(
  description: string,
  items: T[]
): T | null {
  const active = items.filter((i) => !i.is_checked);
  if (!normalizeItemName(description)) return null;
  const exact = active.filter((i) => sameItem(i.name, description));
  if (exact.length > 0) return exact.length === 1 ? exact[0] : null;

  // A description that is itself a catalog item only ever means that item
  // ("Кисело мляко" is yogurt, never the listed "Мляко").
  if (catalogSlugOf(description)) return null;

  const words = looseForm(description).split(' ');
  const wordSlugs = new Set(
    normalizeItemName(description)
      .split(' ')
      .map((w) => catalogSlugOf(w))
      .filter((s): s is string => !!s)
  );
  const hits = active.filter((i) => {
    const itemWords = looseForm(i.name).split(' ');
    if (itemWords.length > 0 && itemWords.every((w) => words.includes(w))) return true;
    const slug = catalogSlugOf(i.name);
    return !!slug && wordSlugs.has(slug);
  });
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Best-effort category for a free-typed item: an exact catalog match first,
 * then a word/substring match, else "Other". Keeps grouping sensible without
 * making the user pick a category for every item. Matches English and Bulgarian.
 */
export function categorize(name: string): GroceryCategoryKey {
  const n = name.trim().toLowerCase();
  if (!n) return 'other';
  if (COMMON_BY_NAME[n]) return COMMON_BY_NAME[n];
  for (const [item, category] of Object.entries(COMMON_BY_NAME)) {
    if (n.includes(item) || item.includes(n)) return category;
  }
  return 'other';
}
