// Turning imported price rows into what the list shows: the best current sale
// for an item (the badge) and every matching offer (the comparison sheet).

import type { ChainId } from './chains';
import { parseSize, productMatches, type ItemMatch, type Size } from './match';

export type DealPriceRow = {
  chain: ChainId | string;
  product_name: string;
  group_code: number;
  retail_price: number;
  promo_price: number | null;
  /** Share of the chain's stores reporting the promo price (0–1). */
  promo_share: number;
  /** The day the chain reported these prices (YYYY-MM-DD). */
  price_date: string;
};

/** A promo counts as "on sale at <chain>" only if most of its stores have it. */
export const CHAIN_WIDE_SHARE = 0.8;
/** A badge needs at least this discount — "−4%" on garlic isn't worth a flag. */
export const MIN_BADGE_DISCOUNT_PCT = 10;
/** Prices older than this many days are hidden rather than shown as current. */
export const MAX_AGE_DAYS = 2;

export type Offer = {
  chain: string;
  productName: string;
  /** What you'd pay: the chain-wide promo price, else the regular price. */
  price: number;
  retailPrice: number;
  onSale: boolean;
  /** A promo exists, but only in some of the chain's stores. */
  someStoresOnly: boolean;
  discountPct: number | null;
  size: Size | null;
  priceDate: string;
};

export type ItemSale = {
  best: Offer;
  /** How many *other* chains also have this item on sale chain-wide. */
  otherChains: number;
};

/** Oldest price_date still shown, as YYYY-MM-DD in the device's local time. */
export function cutoffDate(today: Date, maxAgeDays = MAX_AGE_DAYS): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - maxAgeDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toOffer(row: DealPriceRow): Offer {
  const hasPromo = row.promo_price != null && row.promo_price < row.retail_price;
  const onSale = hasPromo && row.promo_share >= CHAIN_WIDE_SHARE;
  const price = onSale ? row.promo_price! : row.retail_price;
  return {
    chain: row.chain,
    productName: row.product_name,
    price,
    retailPrice: row.retail_price,
    onSale,
    someStoresOnly: hasPromo && !onSale,
    discountPct: onSale ? Math.round((1 - price / row.retail_price) * 100) : null,
    size: parseSize(row.product_name),
    priceDate: row.price_date,
  };
}

/** Price per kg / l / piece when the pack size is known. */
export function unitPrice(offer: Offer): number | null {
  return offer.size ? offer.price / offer.size.amount : null;
}

/** Cheapest first — per unit when both sizes are known in the same unit. */
export function compareOffers(a: Offer, b: Offer): number {
  const ua = unitPrice(a);
  const ub = unitPrice(b);
  if (ua != null && ub != null && a.size!.unit === b.size!.unit) return ua - ub;
  return a.price - b.price;
}

function matchingOffers(match: ItemMatch, rows: DealPriceRow[], cutoff: string): Offer[] {
  return rows
    .filter(
      (r) =>
        match.groups.includes(r.group_code) &&
        r.price_date >= cutoff &&
        productMatches(match, r.product_name)
    )
    .map(toOffer);
}

/**
 * The best chain-wide sale for an item, or null if nothing matching is on sale by
 * at least MIN_BADGE_DISCOUNT_PCT (smaller cuts still show in the sheet).
 */
export function bestSale(match: ItemMatch, rows: DealPriceRow[], cutoff: string): ItemSale | null {
  const sales = matchingOffers(match, rows, cutoff)
    .filter((o) => o.onSale && (o.discountPct ?? 0) >= MIN_BADGE_DISCOUNT_PCT)
    .sort(compareOffers);
  if (sales.length === 0) return null;
  const best = sales[0];
  const otherChains = new Set(sales.map((o) => o.chain).filter((c) => c !== best.chain)).size;
  return { best, otherChains };
}

/** Every matching product across chains, cheapest first. */
export function allOffers(match: ItemMatch, rows: DealPriceRow[], cutoff: string): Offer[] {
  return matchingOffers(match, rows, cutoff).sort(compareOffers);
}

export type ChainSummary = {
  chain: string;
  /** The chain's best sale for the item, else its cheapest product. */
  best: Offer;
  /** Every matching product at this chain, sales first, then cheapest. */
  offers: Offer[];
};

export type OfferSummary = {
  /** One row per chain: chains with a sale first, then by price. */
  chains: ChainSummary[];
  /** The biggest chain-wide discounts not already shown above, ≤ perChain each. */
  topDeals: Offer[];
};

const salesFirst = (a: Offer, b: Offer) => Number(b.onSale) - Number(a.onSale) || compareOffers(a, b);

/**
 * Shapes a long offer list for the sheet. A broad item ("bread" spans several
 * groups, ~300 products) sorted only by price filled the sheet with one chain's
 * cheapest loaves — no comparison at all. So: the best per chain, then the
 * biggest discounts capped per chain, and each chain's full list on demand.
 */
export function summarizeOffers(offers: Offer[], { topLimit = 6, perChain = 2 } = {}): OfferSummary {
  const byChain = new Map<string, Offer[]>();
  for (const o of offers) (byChain.get(o.chain) ?? byChain.set(o.chain, []).get(o.chain)!).push(o);

  const chains: ChainSummary[] = [...byChain].map(([chain, list]) => {
    const sorted = [...list].sort(salesFirst);
    return { chain, best: sorted[0], offers: sorted };
  });
  chains.sort((a, b) => salesFirst(a.best, b.best));

  const shown = new Set(chains.map((c) => c.best));
  const taken = new Map<string, number>();
  const topDeals = offers
    .filter((o) => o.onSale && !shown.has(o))
    .sort((a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0) || compareOffers(a, b))
    .filter((o) => {
      const n = taken.get(o.chain) ?? 0;
      if (n >= perChain) return false;
      taken.set(o.chain, n + 1);
      return true;
    })
    .slice(0, topLimit);

  return { chains, topDeals };
}
