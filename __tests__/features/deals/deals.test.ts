import {
  allOffers,
  bestSale,
  compareOffers,
  cutoffDate,
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
