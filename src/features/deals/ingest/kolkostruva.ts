// Parser for the КЗП "Колко струва" open data (https://www.kolkostruva.bg/opendata):
// a daily archive with one CSV per retail chain, one row per product per store.
//
// Kept free of imports and non-erasable TypeScript so Node can run it directly
// (type stripping) from the ingest job, while Jest tests it like any module.

export type CollapsedProduct = {
  product_code: string;
  product_name: string;
  group_code: number;
  retail_price: number;
  promo_price: number | null;
  /** Share of the chain's stores carrying the product that report the promo. */
  promo_share: number;
};

// Matched by name, not position, so a column reorder can't silently shift
// prices into the wrong field — a renamed column fails loudly instead.
const COLUMNS = {
  name: 'Наименование на продукта',
  code: 'Код на продукта',
  group: 'Категория',
  retail: 'Цена на дребно',
  promo: 'Цена в промоция',
} as const;

/** RFC 4180-style CSV: quoted fields, "" escapes, CRLF, BOM, newlines in quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

/** "1,29" / "1.29" → 1.29. Empty, zero (Kaufland's "no promo") or junk → null. */
export function parsePrice(raw: string | undefined): number | null {
  const n = Number(String(raw ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/**
 * Tidy a chain's raw product name for display: drop Billa's leading
 * department code ("053 ПУЕШКО ФИЛЕ") and turn ALL-CAPS Cyrillic into sentence
 * case while keeping Latin brand names as written ("КИСЕЛО МЛЯКО BILLA" →
 * "Кисело мляко BILLA").
 */
export function cleanName(raw: string): string {
  let name = raw.trim().replace(/\s+/g, ' ');
  if (!/[а-я]/.test(name) && /[А-Я]/.test(name)) {
    name = name.replace(/^\d{3} (?=\S)/, '');
    name = name.replace(/[А-Я]/g, (ch) => ch.toLowerCase());
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  return name;
}

/** Most common value; ties go to the lowest. */
function mode(counts: Map<number, number>): number {
  let best = 0;
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && value < best)) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

type Tally = {
  name: string;
  group: number;
  stores: number;
  promoStores: number;
  retail: Map<number, number>;
  promo: Map<number, number>;
};

const bump = (m: Map<number, number>, v: number) => m.set(v, (m.get(v) ?? 0) + 1);

/**
 * Collapse one chain's per-store rows into one row per product: the most common
 * regular price, the most common promo price, and how many of the chain's stores
 * carrying it report that promo. Only groups `keepGroup` accepts are kept.
 */
export function collapseChain(
  table: string[][],
  keepGroup: (code: number) => boolean
): CollapsedProduct[] {
  if (table.length === 0) return [];
  const header = table[0].map((h) => h.trim());
  const idx = {} as Record<keyof typeof COLUMNS, number>;
  for (const key of Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]) {
    const i = header.indexOf(COLUMNS[key]);
    if (i < 0) throw new Error(`Missing column "${COLUMNS[key]}" — the КЗП file format changed.`);
    idx[key] = i;
  }

  const tallies = new Map<string, Tally>();
  for (const row of table.slice(1)) {
    const group = Number.parseInt(row[idx.group] ?? '', 10);
    if (!keepGroup(group)) continue;
    const retail = parsePrice(row[idx.retail]);
    const rawName = (row[idx.name] ?? '').trim();
    if (retail == null || !rawName) continue;
    const key = (row[idx.code] ?? '').trim() || rawName;
    let t = tallies.get(key);
    if (!t) {
      t = { name: cleanName(rawName), group, stores: 0, promoStores: 0, retail: new Map(), promo: new Map() };
      tallies.set(key, t);
    }
    t.stores++;
    bump(t.retail, retail);
    const promo = parsePrice(row[idx.promo]);
    // A promo must be below the regular price; >90% off is a data-entry error.
    if (promo != null && promo < retail && promo >= retail * 0.1) {
      t.promoStores++;
      bump(t.promo, promo);
    }
  }

  const out: CollapsedProduct[] = [];
  for (const [code, t] of tallies) {
    const retail = mode(t.retail);
    const promo = t.promoStores > 0 ? mode(t.promo) : null;
    out.push({
      product_code: code,
      product_name: t.name,
      group_code: t.group,
      retail_price: retail,
      promo_price: promo != null && promo < retail ? promo : null,
      promo_share: promo != null && promo < retail ? Math.round((t.promoStores / t.stores) * 1000) / 1000 : 0,
    });
  }
  return out;
}
