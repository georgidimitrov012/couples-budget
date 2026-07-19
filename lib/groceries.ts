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
// set. Names are English; Phase 4 will localize them.
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
