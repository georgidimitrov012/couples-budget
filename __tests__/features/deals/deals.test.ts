import {
  allOffers,
  bestSale,
  compareOffers,
  cutoffDate,
  summarizeOffers,
  toOffer,
  type DealPriceRow,
} from '@/features/deals/deals';
import { matchItem } from '@/features/deals/match';

function row(over: Partial<DealPriceRow> = {}): DealPriceRow {
  return {
    chain: 'kaufland',
    product_name: 'Домати кг',
    group_code: 54,
    retail_price: 2.35,
    promo_price: null,
    promo_share: 0,
    price_date: '2026-10-11',
    ...over,
  };
}

const CUTOFF = '2026-10-10';
const tomatoes = matchItem('Домати')!;

describe('cutoffDate', () => {
  it('is MAX_AGE_DAYS (2) before today', () => {
    expect(cutoffDate(new Date(2026, 9, 12, 15, 30))).toBe('2026-10-10');
  });

  it('crosses month and year boundaries', () => {
    expect(cutoffDate(new Date(2026, 2, 1))).toBe('2026-02-27');
    expect(cutoffDate(new Date(2027, 0, 1))).toBe('2026-12-30');
  });
});

describe('toOffer', () => {
  it('a chain-wide promo is a sale with a discount', () => {
    const o = toOffer(row({ promo_price: 1.29, promo_share: 1 }));
    expect(o).toMatchObject({ onSale: true, price: 1.29, retailPrice: 2.35, discountPct: 45, someStoresOnly: false });
  });

  it('a promo in only a few stores is not "on sale at the chain"', () => {
    // Billa's red tomatoes: on promo in 4 of 144 stores.
    const o = toOffer(row({ chain: 'billa', retail_price: 1.99, promo_price: 1.49, promo_share: 4 / 144 }));
    expect(o).toMatchObject({ onSale: false, someStoresOnly: true, price: 1.99, discountPct: null });
  });

  it('ignores a "promo" that is not below the regular price', () => {
    expect(toOffer(row({ promo_price: 2.35, promo_share: 1 }))).toMatchObject({ onSale: false, someStoresOnly: false });
  });
});

describe('compareOffers', () => {
  it('compares per kg when both sizes are known', () => {
    const pack = toOffer(row({ product_name: 'Домати 500г', retail_price: 1.0 })); // 2.00/kg
    const loose = toOffer(row({ product_name: 'Домати кг', retail_price: 1.5 })); // 1.50/kg
    expect([pack, loose].sort(compareOffers)[0]).toBe(loose);
  });

  it('falls back to the pack price when a size is unknown', () => {
    const known = toOffer(row({ product_name: 'Домати кг', retail_price: 1.5 }));
    const unknown = toOffer(row({ product_name: 'Домати', retail_price: 1.2 }));
    expect([known, unknown].sort(compareOffers)[0]).toBe(unknown);
  });
});

describe('bestSale', () => {
  const rows = [
    row({ chain: 'kaufland', product_name: 'Домати кг', promo_price: 1.29, promo_share: 1 }),
    row({ chain: 'billa', product_name: 'Домати на клонка', retail_price: 2.69, promo_price: 1.89, promo_share: 1 }),
    row({ chain: 'billa', product_name: 'Домати червени', retail_price: 1.99, promo_price: 1.49, promo_share: 0.03 }),
    row({ chain: 'lidl', product_name: 'Домати на кг', retail_price: 2.25 }),
    row({ chain: 'kaufland', product_name: 'Краставици', group_code: 58, promo_price: 0.5, promo_share: 1 }),
  ];

  it('picks the cheapest chain-wide sale and counts the other chains on sale', () => {
    const sale = bestSale(tomatoes, rows, CUTOFF)!;
    expect(sale.best).toMatchObject({ chain: 'kaufland', productName: 'Домати кг', price: 1.29, discountPct: 45 });
    expect(sale.otherChains).toBe(1);
  });

  it('respects what the person typed', () => {
    const sale = bestSale(matchItem('домати на клонка')!, rows, CUTOFF)!;
    expect(sale.best).toMatchObject({ chain: 'billa', productName: 'Домати на клонка' });
    expect(sale.otherChains).toBe(0);
  });

  it('ignores token discounts (under 10%) for the badge', () => {
    const garlic = (promo: number) =>
      row({ chain: 'lidl', product_name: 'Чесън на кг', group_code: 59, retail_price: 5.32, promo_price: promo, promo_share: 1 });
    expect(bestSale(matchItem('Чесън')!, [garlic(5.11)], CUTOFF)).toBeNull(); // −4%
    expect(bestSale(matchItem('Чесън')!, [garlic(4.5)], CUTOFF)?.best.discountPct).toBe(15);
  });

  it('is null when only some stores have a promo', () => {
    expect(bestSale(matchItem('червени домати')!, rows, CUTOFF)).toBeNull();
  });

  it('hides prices older than the cutoff', () => {
    const stale = rows.map((r) => ({ ...r, price_date: '2026-10-01' }));
    expect(bestSale(tomatoes, stale, CUTOFF)).toBeNull();
  });
});

describe('allOffers', () => {
  it('lists every matching product, cheapest first, sales and regular prices alike', () => {
    const offers = allOffers(
      tomatoes,
      [
        row({ chain: 'lidl', product_name: 'Домати на кг', retail_price: 2.25 }),
        row({ chain: 'kaufland', product_name: 'Домати кг', promo_price: 1.29, promo_share: 1 }),
        row({ chain: 'kaufland', product_name: 'Краставици', group_code: 58, retail_price: 0.5 }),
      ],
      CUTOFF
    );
    expect(offers.map((o) => [o.chain, o.price, o.onSale])).toEqual([
      ['kaufland', 1.29, true],
      ['lidl', 2.25, false],
    ]);
  });
});

describe('summarizeOffers', () => {
  const offer = (chain: string, name: string, retail: number, promo: number | null = null) =>
    toOffer({
      chain,
      product_name: name,
      group_code: 1,
      retail_price: retail,
      promo_price: promo,
      promo_share: promo == null ? 0 : 1,
      price_date: '2026-10-12',
    });

  // Regression: "bread" listed ~280 products, all from the cheapest chain.
  it('gives one row per chain — its sale if it has one, else its cheapest — sales first', () => {
    const offers = [
      ...Array.from({ length: 50 }, (_, i) => offer('lidl', `Хляб ${i}`, 0.5 + i / 100)),
      offer('kaufland', 'Хляб Добруджа', 1.2, 0.9),
      offer('kaufland', 'Хляб типов', 0.8),
      offer('billa', 'Хляб бял', 1.1),
    ];
    const { chains } = summarizeOffers(offers);
    expect(chains.map((c) => c.chain)).toEqual(['kaufland', 'lidl', 'billa']);
    expect(chains[0].best.productName).toBe('Хляб Добруджа');
    expect(chains[1].best.productName).toBe('Хляб 0');
    expect(chains[1].offers).toHaveLength(50);
  });

  it('lists the biggest other discounts, at most two per chain, never repeating a chain row', () => {
    const offers = [
      offer('lidl', 'A', 2, 1), // 50% — lidl's best
      offer('lidl', 'B', 2, 1.2), // 40%
      offer('lidl', 'C', 2, 1.4), // 30%
      offer('lidl', 'D', 2, 1.6), // 20% — third from lidl, dropped
      offer('billa', 'E', 2, 1.5), // billa's best
      offer('billa', 'F', 10, 9), // 10%
    ];
    const { topDeals } = summarizeOffers(offers);
    expect(topDeals.map((o) => o.productName)).toEqual(['B', 'C', 'F']);
  });

  it('is empty for no offers', () => {
    expect(summarizeOffers([])).toEqual({ chains: [], topDeals: [] });
  });
});
