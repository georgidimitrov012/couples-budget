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

export type BudgetLevel = 'ok' | 'near' | 'over';

/** A category is "nearing" its limit once spending crosses this fraction of it. */
export const NEAR_LIMIT_RATIO = 0.9;

/** Classifies a spend/limit ratio: over budget (> 1), nearing (>= threshold), or ok. */
export function budgetLevel(ratio: number, nearRatio: number = NEAR_LIMIT_RATIO): BudgetLevel {
  if (ratio > 1) return 'over';
  if (ratio >= nearRatio) return 'near';
  return 'ok';
}

export type BudgetAlert = {
  categoryId: string;
  name: string;
  spent: number;
  limit: number;
  ratio: number;
  level: 'near' | 'over';
};

type BudgetCategory = { id: string; name: string; monthly_limit: number | null };

/**
 * Categories whose this-month spend has reached the near-limit threshold or gone
 * over. Over-budget first, then by ratio descending (most urgent first). Only
 * categories with a positive limit are considered.
 */
export function budgetAlerts(
  budgets: BudgetCategory[],
  spendByCategory: Map<string, number>,
  nearRatio: number = NEAR_LIMIT_RATIO
): BudgetAlert[] {
  const alerts: BudgetAlert[] = [];
  for (const c of budgets) {
    const limit = c.monthly_limit ?? 0;
    if (!(limit > 0)) continue;
    const spent = spendByCategory.get(c.id) ?? 0;
    const ratio = progressRatio(spent, limit);
    const level = budgetLevel(ratio, nearRatio);
    if (level === 'ok') continue;
    alerts.push({ categoryId: c.id, name: c.name, spent, limit, ratio, level });
  }
  alerts.sort((a, b) =>
    a.level !== b.level ? (a.level === 'over' ? -1 : 1) : b.ratio - a.ratio
  );
  return alerts;
}
