import { monthlySpendByCategory, progressRatio } from '../../lib/budget';

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
