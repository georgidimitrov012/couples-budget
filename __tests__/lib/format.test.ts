import { parseAmount } from '../../lib/format';

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
