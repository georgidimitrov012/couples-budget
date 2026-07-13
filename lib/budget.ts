type TxLike = { category_id: string | null; amount: number; occurred_on: string };

/**
 * Sum of this-month spending per category, from the transactions the client
 * already has loaded. `monthKey` is 'YYYY-MM'; only rows whose occurred_on falls
 * in that month and that carry a category are counted.
 */
export function monthlySpendByCategory(
  transactions: TxLike[],
  monthKey: string
): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (!t.category_id || !t.occurred_on.startsWith(monthKey)) continue;
    map.set(t.category_id, (map.get(t.category_id) ?? 0) + Number(t.amount));
  }
  return map;
}

/** spent / limit, 0 when the limit isn't a positive number. Not capped at 1. */
export function progressRatio(spent: number, limit: number | null): number {
  if (limit == null || !(limit > 0)) return 0;
  return spent / limit;
}
