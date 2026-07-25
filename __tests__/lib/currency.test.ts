import {
  CURRENCIES,
  CURRENCY_LABEL,
  CURRENCY_SYMBOL,
  formatMoney,
  isCurrency,
} from '../../lib/currency';

const NBSP = String.fromCharCode(0xa0);

describe('formatMoney', () => {
  it('defaults to the euro and always shows two decimals after the amount', () => {
    expect(formatMoney(12.5)).toBe(`12.50${NBSP}€`);
    expect(formatMoney(0)).toBe(`0.00${NBSP}€`);
  });

  it('renders the chosen currency symbol', () => {
    expect(formatMoney(12.5, 'EUR')).toBe(`12.50${NBSP}€`);
    expect(formatMoney(12.5, 'BGN')).toBe(`12.50${NBSP}лв.`);
    expect(formatMoney(12.5, 'USD')).toBe(`12.50${NBSP}$`);
  });

  it('rounds to two decimal places', () => {
    expect(formatMoney(2.567, 'EUR')).toBe(`2.57${NBSP}€`);
  });
});

describe('isCurrency', () => {
  it('recognises the known currencies and rejects anything else', () => {
    for (const c of CURRENCIES) expect(isCurrency(c)).toBe(true);
    expect(isCurrency('GBP')).toBe(false);
    expect(isCurrency(null)).toBe(false);
    expect(isCurrency(42)).toBe(false);
  });
});

describe('currency metadata', () => {
  it('has a symbol and label for every currency', () => {
    for (const c of CURRENCIES) {
      expect(CURRENCY_SYMBOL[c]).toBeTruthy();
      expect(CURRENCY_LABEL[c]).toBeTruthy();
    }
  });
});
