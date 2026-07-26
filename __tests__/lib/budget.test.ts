import {
  budgetAlerts,
  budgetLevel,
  monthlySpendByCategory,
  progressRatio,
} from '../../lib/budget';

function tx(over: { category_id?: string | null; amount?: number; occurred_on?: string } = {}) {
  return {
    category_id: 'c1',
    amount: 10,
    occurred_on: '2026-07-15',
    ...over,
  };
}

describe('monthlySpendByCategory', () => {
  it('sums this-month amounts per category, ignoring other months and uncategorized', () => {
    const map = monthlySpendByCategory(
      [
        tx({ category_id: 'c1', amount: 12 }),
        tx({ category_id: 'c1', amount: 8 }),
        tx({ category_id: 'c2', amount: 5 }),
        tx({ category_id: 'c1', amount: 99, occurred_on: '2026-06-30' }), // last month
        tx({ category_id: null, amount: 100 }), // uncategorized
      ],
      '2026-07'
    );
    expect(map.get('c1')).toBe(20);
    expect(map.get('c2')).toBe(5);
    expect(map.size).toBe(2);
  });

  it('is empty when nothing falls in the month', () => {
    expect(monthlySpendByCategory([tx({ occurred_on: '2025-01-01' })], '2026-07').size).toBe(0);
  });
});

describe('progressRatio', () => {
  it('is spent / limit', () => {
    expect(progressRatio(25, 50)).toBe(0.5);
    expect(progressRatio(60, 50)).toBeCloseTo(1.2);
  });
  it('is 0 for a missing or non-positive limit', () => {
    expect(progressRatio(10, null)).toBe(0);
    expect(progressRatio(10, 0)).toBe(0);
  });
});

describe('budgetLevel', () => {
  it('is "over" above the limit, "near" at/above the threshold, else "ok"', () => {
    expect(budgetLevel(1.2)).toBe('over');
    expect(budgetLevel(1)).toBe('near'); // exactly at the limit is not yet over
    expect(budgetLevel(0.9)).toBe('near'); // exactly at the 90% threshold
    expect(budgetLevel(0.89)).toBe('ok');
    expect(budgetLevel(0)).toBe('ok');
  });
  it('respects a custom near-ratio', () => {
    expect(budgetLevel(0.75, 0.8)).toBe('ok');
    expect(budgetLevel(0.8, 0.8)).toBe('near');
  });
});

describe('budgetAlerts', () => {
  const cat = (id: string, name: string, monthly_limit: number | null) => ({ id, name, monthly_limit });

  it('flags nearing and over categories, over first then by ratio desc', () => {
    const budgets = [
      cat('c1', 'Food', 100), // 95 → near
      cat('c2', 'Fun', 50), // 60 → over (1.2)
      cat('c3', 'Rent', 200), // 100 → ok (0.5)
      cat('c4', 'Cafe', 20), // 40 → over (2.0)
    ];
    const spend = new Map([
      ['c1', 95],
      ['c2', 60],
      ['c3', 100],
      ['c4', 40],
    ]);
    const alerts = budgetAlerts(budgets, spend);
    expect(alerts.map((a) => a.categoryId)).toEqual(['c4', 'c2', 'c1']);
    expect(alerts.map((a) => a.level)).toEqual(['over', 'over', 'near']);
  });

  it('ignores categories with no positive limit and those under threshold', () => {
    const budgets = [cat('c1', 'A', null), cat('c2', 'B', 0), cat('c3', 'C', 100)];
    const spend = new Map([['c3', 10]]); // 10% → ok
    expect(budgetAlerts(budgets, spend)).toEqual([]);
  });

  it('treats a category with no spend as ok', () => {
    expect(budgetAlerts([cat('c1', 'A', 100)], new Map())).toEqual([]);
  });
});
