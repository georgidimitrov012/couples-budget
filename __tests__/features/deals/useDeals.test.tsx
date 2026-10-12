import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockFrom = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));

import { useDeals, useItemOffers } from '@/features/deals/useDeals';
import { cutoffDate, type DealPriceRow } from '@/features/deals/deals';
import { matchItem } from '@/features/deals/match';

type Result = { data: DealPriceRow[] | null; error: unknown };
let result: Result;
const calls: { method: string; args: unknown[] }[] = [];

// A thenable query builder that records every filter it was given.
function makeQuery() {
  const q: Record<string, unknown> = {};
  for (const method of ['select', 'in', 'not', 'gte']) {
    q[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return q;
    };
  }
  q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej);
  return q;
}

function row(over: Partial<DealPriceRow> = {}): DealPriceRow {
  return {
    chain: 'kaufland',
    product_name: 'Домати кг',
    group_code: 54,
    retail_price: 2.35,
    promo_price: 1.29,
    promo_share: 1,
    price_date: cutoffDate(new Date(), 0), // today
    ...over,
  };
}

const item = (name: string, is_checked = false) => ({ name, is_checked });

beforeEach(() => {
  calls.length = 0;
  result = { data: [row()], error: null };
  mockFrom.mockImplementation(() => makeQuery());
});

describe('useDeals', () => {
  it('fetches chain-wide promos for the groups on the list and exposes the best sale', async () => {
    const items = [item('Домати'), item('Чипс')];
    const { result: hook } = await renderHook(() => useDeals(items));
    await waitFor(() => expect(hook.current.saleFor('Домати')).not.toBeNull());

    expect(mockFrom).toHaveBeenCalledWith('deal_prices');
    expect(calls).toContainEqual({ method: 'in', args: ['group_code', [54]] });
    expect(calls).toContainEqual({ method: 'not', args: ['promo_price', 'is', null] });
    expect(calls).toContainEqual({ method: 'gte', args: ['promo_share', 0.8] });
    expect(calls).toContainEqual({ method: 'gte', args: ['price_date', cutoffDate(new Date())] });

    const deal = hook.current.saleFor('Домати')!;
    expect(deal.itemName).toBe('Домати');
    expect(deal.best).toMatchObject({ chain: 'kaufland', price: 1.29, discountPct: 45 });
    expect(hook.current.saleFor('Чипс')).toBeNull();
  });

  it('makes no request when nothing on the list is a tracked product', async () => {
    const items = [item('Чипс'), item('Домати', true)];
    await renderHook(() => useDeals(items));
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('shows nothing when the switch is off (the database returns no rows)', async () => {
    result = { data: [], error: null };
    const items = [item('Домати')];
    const { result: hook } = await renderHook(() => useDeals(items));
    await waitFor(() => expect(mockFrom).toHaveBeenCalled());
    expect(hook.current.saleFor('Домати')).toBeNull();
  });

  it('swallows errors — the list never breaks because of deals', async () => {
    result = { data: null, error: { message: 'relation "deal_prices" does not exist' } };
    const items = [item('Домати')];
    const { result: hook } = await renderHook(() => useDeals(items));
    await waitFor(() => expect(mockFrom).toHaveBeenCalled());
    expect(hook.current.saleFor('Домати')).toBeNull();
  });
});

describe('useItemOffers', () => {
  const tomatoes = matchItem('Домати')!;

  it('loads every price for the item, cheapest first', async () => {
    result = {
      data: [row({ chain: 'lidl', product_name: 'Домати на кг', promo_price: null, promo_share: 0, retail_price: 2.25 }), row()],
      error: null,
    };
    const { result: hook } = await renderHook(() => useItemOffers(tomatoes));
    await waitFor(() => expect(hook.current.loading).toBe(false));
    expect(hook.current.offers.map((o) => o.chain)).toEqual(['kaufland', 'lidl']);
    // The sheet wants regular prices too — no promo filter on this query.
    expect(calls.some((c) => c.method === 'not')).toBe(false);
  });

  it('reports an error and retries', async () => {
    result = { data: null, error: { message: 'offline' } };
    const { result: hook } = await renderHook(() => useItemOffers(tomatoes));
    await waitFor(() => expect(hook.current.error).toBe(true));

    result = { data: [row()], error: null };
    await act(async () => hook.current.retry());
    await waitFor(() => expect(hook.current.offers).toHaveLength(1));
    expect(hook.current.error).toBe(false);
  });
});
