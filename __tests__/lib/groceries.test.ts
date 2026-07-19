import { categorize, categoryFor, CATEGORY_BY_KEY } from '../../lib/groceries';

describe('categorize', () => {
  it('matches a known catalog item exactly (case-insensitive)', () => {
    expect(categorize('Milk')).toBe('dairy');
    expect(categorize('bread')).toBe('bakery');
    expect(categorize('CHICKEN')).toBe('meat');
  });

  it('matches on a substring when there is no exact hit', () => {
    expect(categorize('almond milk')).toBe('dairy');
    expect(categorize('sourdough bread')).toBe('bakery');
  });

  it('falls back to "other" for unknown items', () => {
    expect(categorize('spaceship')).toBe('other');
    expect(categorize('')).toBe('other');
  });
});

describe('categoryFor', () => {
  it('resolves a known key to its category', () => {
    expect(categoryFor('bakery')).toBe(CATEGORY_BY_KEY.bakery);
  });

  it('falls back to "other" for null/unknown keys', () => {
    expect(categoryFor(null)).toBe(CATEGORY_BY_KEY.other);
    expect(categoryFor('nope')).toBe(CATEGORY_BY_KEY.other);
  });
});
