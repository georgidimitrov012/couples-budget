import {
  biggestExpense,
  categoryBreakdown,
  deltaFraction,
  monthKeyOf,
  monthTotal,
  monthTotals,
  previousMonthKey,
} from '../../lib/stats';

type Tx = {
  amount: number;
  scope: 'private' | 'shared';
  occurred_on: string;
  category_id: string | null;
};
function tx(over: Partial<Tx> = {}): Tx {
  return { amount: 10, scope: 'shared', occurred_on: '2026-07-15', category_id: null, ...over };
}

describe('month keys', () => {
  it('monthKeyOf formats YYYY-MM in local time', () => {
    expect(monthKeyOf(new Date(2026, 0, 3))).toBe('2026-01');
    expect(monthKeyOf(new Date(2026, 11, 31))).toBe('2026-12');
  });

  it('previousMonthKey rolls back over year boundaries', () => {
    expect(previousMonthKey('2026-07')).toBe('2026-06');
    expect(previousMonthKey('2026-01')).toBe('2025-12');
  });
});

describe('monthTotals', () => {
  it('splits Ours/Mine and counts only the given month', () => {
    const txs = [
      tx({ scope: 'shared', amount: 12 }),
      tx({ scope: 'shared', amount: 8 }),
      tx({ scope: 'private', amount: 5 }),
      tx({ scope: 'shared', amount: 99, occurred_on: '2026-06-30' }), // other month
    ];
    expect(monthTotals(txs, '2026-07')).toEqual({ ours: 20, mine: 5, total: 25, count: 3 });
    expect(monthTotal(txs, '2026-07')).toBe(25);
    expect(monthTotals(txs, '2026-06')).toEqual({ ours: 99, mine: 0, total: 99, count: 1 });
  });

  it('is empty for a month with no spend', () => {
    expect(monthTotals([tx()], '2000-01')).toEqual({ ours: 0, mine: 0, total: 0, count: 0 });
  });
});

describe('categoryBreakdown', () => {
  it('sums per category, sorts largest first, and computes shares', () => {
    const txs = [
      tx({ category_id: 'c1', amount: 30 }),
      tx({ category_id: 'c2', amount: 10 }),
      tx({ category_id: 'c1', amount: 10 }),
      tx({ category_id: null, amount: 50 }),
    ];
    const slices = categoryBreakdown(txs, '2026-07');
    expect(slices.map((s) => s.id)).toEqual([null, 'c1', 'c2']); // 50, 40, 10
    expect(slices[0]).toMatchObject({ id: null, amount: 50, share: 0.5 });
    expect(slices[1].share).toBeCloseTo(0.4);
  });

  it('returns [] for an empty month', () => {
    expect(categoryBreakdown([tx()], '2000-01')).toEqual([]);
  });
});

describe('biggestExpense', () => {
  it('finds the largest expense in the month', () => {
    const txs = [tx({ amount: 5 }), tx({ amount: 42 }), tx({ amount: 12 })];
    expect(biggestExpense(txs, '2026-07')?.amount).toBe(42);
  });

  it('returns null when the month has no expenses', () => {
    expect(biggestExpense([tx()], '2000-01')).toBeNull();
  });
});

describe('deltaFraction', () => {
  it('computes the fractional change vs a positive baseline', () => {
    expect(deltaFraction(120, 100)).toBeCloseTo(0.2);
    expect(deltaFraction(80, 100)).toBeCloseTo(-0.2);
  });

  it('is null when there is no positive baseline', () => {
    expect(deltaFraction(50, 0)).toBeNull();
  });
});
