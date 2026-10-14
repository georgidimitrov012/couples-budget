import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

const mockFrom = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));

import { DealBadge } from '@/features/deals';
import { toOffer, type DealPriceRow } from '@/features/deals/deals';
import { matchItem } from '@/features/deals/match';
import type { ItemDeal } from '@/features/deals/useDeals';

// The first Modal open in a suite is slow (~1s alone, several under a parallel
// full run) — give these interaction tests headroom instead of flaking.
jest.setTimeout(20000);

type Result = { data: DealPriceRow[] | null; error: unknown };
let result: Result;
function makeQuery() {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'in', 'not', 'gte']) q[m] = () => q;
  q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej);
  return q;
}

const today = new Date();
const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

function row(over: Partial<DealPriceRow> = {}): DealPriceRow {
  return {
    chain: 'kaufland',
    product_name: 'Домати кг',
    group_code: 54,
    retail_price: 2.35,
    promo_price: 1.29,
    promo_share: 1,
    price_date: iso,
    ...over,
  };
}

const deal: ItemDeal = {
  itemName: 'Tomatoes',
  match: matchItem('Tomatoes')!,
  best: toOffer(row()),
  otherChains: 1,
};

beforeEach(() => {
  result = {
    data: [
      row(),
      row({ chain: 'lidl', product_name: 'Домати на кг', retail_price: 2.25, promo_price: null, promo_share: 0 }),
      row({ chain: 'billa', product_name: 'Домати червени', retail_price: 1.99, promo_price: 1.49, promo_share: 0.03 }),
    ],
    error: null,
  };
  mockFrom.mockImplementation(() => makeQuery());
});

describe('DealBadge', () => {
  it('shows the chain, sale price, discount and the exact product', async () => {
    await render(<DealBadge deal={deal} />);
    expect(screen.getByText(/Kaufland: 1\.29 € \(−45%\) · Домати кг/)).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.getByLabelText(/On sale at Kaufland: Домати кг for 1\.29 €, 45% off/)).toBeTruthy();
  });

  it('opens a comparison sheet with every chain, the source and a disclaimer', async () => {
    await render(<DealBadge deal={deal} />);
    await userEvent.setup().press(screen.getByRole('button', { name: /On sale at Kaufland/ }));

    expect(screen.getByText('Tomatoes: prices')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Lidl')).toBeTruthy());
    expect(screen.getByText('Billa')).toBeTruthy();
    expect(screen.getByText(/On sale −45%, usually 2\.35 €/)).toBeTruthy();
    expect(screen.getByText('On sale in some stores only')).toBeTruthy();
    expect(screen.getByText(/Source: КЗП/)).toBeTruthy();
    expect(screen.getByText(/check in store/)).toBeTruthy();
    expect(mockFrom).toHaveBeenCalledWith('deal_prices');
  });

  it('closes the sheet', async () => {
    const user = userEvent.setup();
    await render(<DealBadge deal={deal} />);
    await user.press(screen.getByRole('button', { name: /On sale at Kaufland/ }));
    await waitFor(() => expect(screen.getByText('Lidl')).toBeTruthy());
    await user.press(screen.getAllByRole('button', { name: 'Close' })[1]);
    expect(screen.queryByText('Tomatoes: prices')).toBeNull();
  });

  it('has an error state that retries, and an empty state', async () => {
    const user = userEvent.setup();
    result = { data: null, error: { message: 'offline' } };
    await render(<DealBadge deal={deal} />);
    await user.press(screen.getByRole('button', { name: /On sale at Kaufland/ }));
    await waitFor(() => expect(screen.getByText(/Couldn't load prices/)).toBeTruthy());

    result = { data: [], error: null };
    await user.press(screen.getByText(/Couldn't load prices/));
    await waitFor(() => expect(screen.getByText('No current prices for this item.')).toBeTruthy());
  });

  // Regression: "bread" listed 280+ products, all from the cheapest chain.
  it('shows one row per chain with a way into that chain’s full list', async () => {
    const user = userEvent.setup();
    result = {
      data: [
        row(),
        ...Array.from({ length: 40 }, (_, i) =>
          row({ chain: 'lidl', product_name: `Домати ${i}`, retail_price: 1 + i / 100, promo_price: null, promo_share: 0 })
        ),
      ],
      error: null,
    };
    await render(<DealBadge deal={deal} />);
    await user.press(screen.getByRole('button', { name: /On sale at Kaufland/ }));
    await waitFor(() => expect(screen.getByText('Best at each store')).toBeTruthy());

    expect(screen.getAllByText('Lidl')).toHaveLength(1);
    expect(screen.queryByText('Домати 5')).toBeNull();

    await user.press(screen.getByLabelText('Show all 40 products at Lidl'));
    expect(screen.getByText('Lidl · 40 products')).toBeTruthy();
    expect(screen.getByText('Домати 5')).toBeTruthy();
    expect(screen.getByText('+ 10 more')).toBeTruthy();

    await user.press(screen.getByText('‹ All stores'));
    expect(screen.getByText('Best at each store')).toBeTruthy();
  });
});
