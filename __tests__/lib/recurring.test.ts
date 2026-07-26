import { clampDay, parseDayOfMonth, MAX_DAY_OF_MONTH } from '../../lib/recurring';

describe('clampDay', () => {
  it('keeps a valid day unchanged', () => {
    expect(clampDay(1)).toBe(1);
    expect(clampDay(15)).toBe(15);
    expect(clampDay(28)).toBe(28);
  });
  it('clamps out-of-range values into [1, 28] and floors fractions', () => {
    expect(clampDay(0)).toBe(1);
    expect(clampDay(-5)).toBe(1);
    expect(clampDay(31)).toBe(MAX_DAY_OF_MONTH);
    expect(clampDay(12.9)).toBe(12);
  });
  it('falls back to 1 for non-finite input', () => {
    expect(clampDay(NaN)).toBe(1);
    expect(clampDay(Infinity)).toBe(1);
  });
});

describe('parseDayOfMonth', () => {
  it('parses a numeric string into a valid day', () => {
    expect(parseDayOfMonth('1')).toBe(1);
    expect(parseDayOfMonth('15')).toBe(15);
    expect(parseDayOfMonth('30')).toBe(28); // clamped
  });
  it('defaults to 1 for empty or non-numeric text', () => {
    expect(parseDayOfMonth('')).toBe(1);
    expect(parseDayOfMonth('abc')).toBe(1);
  });
});
