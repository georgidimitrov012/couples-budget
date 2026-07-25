// Pure statistics helpers over the transactions the client already has loaded.
// Kept framework-free so they can be unit-tested directly; the Stats screen maps
// the results onto category names/colours and localized labels.

type TxLike = {
  amount: number;
  scope: 'private' | 'shared';
  occurred_on: string; // 'YYYY-MM-DD'
  category_id: string | null;
};

/** 'YYYY-MM' for a Date, in local time. */
export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** The 'YYYY-MM' one month before the given key (handles year rollover). */
export function previousMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  // `month` is 1-based; (month - 1) is the current 0-based index, minus 1 = prev.
  return monthKeyOf(new Date(year, month - 2, 1));
}

export type MonthTotals = { ours: number; mine: number; total: number; count: number };

/** Ours (shared) / Mine (private) / total spend and expense count for a month. */
export function monthTotals(txs: TxLike[], monthKey: string): MonthTotals {
  let ours = 0;
  let mine = 0;
  let count = 0;
  for (const t of txs) {
    if (!t.occurred_on.startsWith(monthKey)) continue;
    count += 1;
    if (t.scope === 'shared') ours += Number(t.amount);
    else mine += Number(t.amount);
  }
  return { ours, mine, total: ours + mine, count };
}

/** Total spend (both scopes) for a month. */
export function monthTotal(txs: TxLike[], monthKey: string): number {
  return monthTotals(txs, monthKey).total;
}

export type CategorySlice = {
  id: string | null; // null = uncategorized
  amount: number;
  share: number; // 0..1 of the month total
};

/** Per-category spend for a month, largest first, each with its share of the total. */
export function categoryBreakdown(txs: TxLike[], monthKey: string): CategorySlice[] {
  const byCategory = new Map<string | null, number>();
  let total = 0;
  for (const t of txs) {
    if (!t.occurred_on.startsWith(monthKey)) continue;
    const key = t.category_id ?? null;
    const amount = Number(t.amount);
    byCategory.set(key, (byCategory.get(key) ?? 0) + amount);
    total += amount;
  }
  return [...byCategory.entries()]
    .map(([id, amount]) => ({ id, amount, share: total > 0 ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

/** The single largest expense in a month (or null if there were none). */
export function biggestExpense<T extends TxLike>(txs: T[], monthKey: string): T | null {
  let biggest: T | null = null;
  for (const t of txs) {
    if (!t.occurred_on.startsWith(monthKey)) continue;
    if (!biggest || Number(t.amount) > Number(biggest.amount)) biggest = t;
  }
  return biggest;
}

/**
 * Fractional change from `previous` to `current` (e.g. 0.2 = +20%), or null when
 * there's no positive baseline to compare against.
 */
export function deltaFraction(current: number, previous: number): number | null {
  if (!(previous > 0)) return null;
  return (current - previous) / previous;
}
