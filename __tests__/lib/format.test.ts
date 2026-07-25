import { CURRENCY_SYMBOL, formatAmount, parseAmount } from '../../lib/format';

// The amount and symbol are joined by a non-breaking space (U+00A0).
const money = (n: string) => `${n}${String.fromCharCode(0xa0)}${CURRENCY_SYMBOL}`;

describe('formatAmount', () => {
  it('always shows two decimals with the euro symbol after the amount', () => {
    expect(formatAmount(12.5)).toBe(money('12.50'));
    expect(formatAmount(3)).toBe(money('3.00'));
    expect(formatAmount(0)).toBe(money('0.00'));
  });

  it('rounds to two decimal places', () => {
    expect(formatAmount(2.567)).toBe(money('2.57'));
  });

  it('separates the amount from the symbol with a non-breaking space', () => {
    expect(formatAmount(5)).toContain(String.fromCharCode(0xa0));
    expect(formatAmount(5).endsWith(CURRENCY_SYMBOL)).toBe(true);
  });
});

describe('parseAmount', () => {
  it('accepts comma or dot as the decimal separator', () => {
    expect(parseAmount('3,50')).toBe(3.5);
    expect(parseAmount('3.50')).toBe(3.5);
  });

  it('rejects empty, zero, negative and junk input', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});
