import { addDays, dayLabel, lastDayOfMonth, monthLong, monthShort } from '../../lib/month';

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

describe('calendar days', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('finds the last day of a month', () => {
    expect(lastDayOfMonth('2026-02')).toBe('2026-02-28');
    expect(lastDayOfMonth('2024-02')).toBe('2024-02-29');
    expect(lastDayOfMonth('2026-10')).toBe('2026-10-31');
  });

  it('labels today, yesterday, and older days', () => {
    expect(dayLabel('2026-10-13', '2026-10-13', 'bg')).toBe('Днес');
    expect(dayLabel('2026-10-12', '2026-10-13', 'en')).toBe('Yesterday');
    expect(dayLabel('2026-09-05', '2026-10-13', 'bg')).toBe('5 сеп 2026');
  });
});
