import { monthLong, monthShort } from '../../lib/month';

describe('monthShort', () => {
  it('gives the localized short month name', () => {
    expect(monthShort('2026-07', 'en')).toBe('Jul');
    expect(monthShort('2026-07', 'bg')).toBe('юли');
    expect(monthShort('2026-01', 'en')).toBe('Jan');
    expect(monthShort('2026-12', 'bg')).toBe('дек');
  });
});

describe('monthLong', () => {
  it('gives the localized full month name with the year', () => {
    expect(monthLong('2026-07', 'en')).toBe('July 2026');
    expect(monthLong('2026-07', 'bg')).toBe('юли 2026');
    expect(monthLong('2025-12', 'en')).toBe('December 2025');
  });
});
