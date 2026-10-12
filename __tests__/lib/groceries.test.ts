import {
  catalogSlugOf,
  categorize,
  categoryFor,
  CATEGORY_BY_KEY,
  COMMON_ITEMS,
  displayItemName,
  findListMatch,
  itemSlug,
  sameItem,
} from '../../lib/groceries';
import { translations } from '../../lib/i18n';

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

  it('matches Bulgarian catalog names too', () => {
    expect(categorize('Мляко')).toBe('dairy');
    expect(categorize('хляб')).toBe('bakery');
    expect(categorize('прясно мляко')).toBe('dairy');
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

describe('catalog identity across languages', () => {
  const langs = Object.keys(translations) as (keyof typeof translations)[];

  it('every catalog item resolves to its own key from every language — no two items collide', () => {
    for (const item of COMMON_ITEMS) {
      const slug = itemSlug(item.name);
      for (const lang of langs) {
        const label = translations[lang][`item.${slug}`];
        expect(label).toBeTruthy();
        expect(catalogSlugOf(label, { exact: true })).toBe(slug);
        expect(catalogSlugOf(label)).toBe(slug);
      }
      expect(catalogSlugOf(item.name)).toBe(slug);
    }
  });

  it('shows a catalog item in the viewer’s language, whatever language stored it', () => {
    expect(displayItemName('Моркови', 'en')).toBe('Carrots');
    expect(displayItemName('Carrots', 'bg')).toBe('Моркови');
    expect(displayItemName('carrots', 'en')).toBe('Carrots');
    expect(displayItemName('Моркови', 'bg')).toBe('Моркови');
  });

  it('leaves the user’s own text exactly as typed', () => {
    expect(displayItemName('Домат', 'en')).toBe('Домат'); // not the catalog spelling
    expect(displayItemName('Моркови за супата', 'en')).toBe('Моркови за супата');
    expect(displayItemName('Бира Загорка', 'en')).toBe('Бира Загорка');
  });

  it('treats the same item in either language, singular or plural, as the same item', () => {
    expect(sameItem('Моркови', 'Carrots')).toBe(true);
    expect(sameItem('Домат', 'Домати')).toBe(true);
    expect(sameItem('tomato', 'Домати')).toBe(true);
    expect(sameItem('Бира', 'бира')).toBe(true);
    expect(sameItem('Моркови', 'Картофи')).toBe(false);
    expect(sameItem('Мляко', 'Кисело мляко')).toBe(false);
    expect(sameItem('', '')).toBe(false);
  });
});

describe('findListMatch', () => {
  const list = (names: string[], checked: string[] = []) =>
    names.map((name) => ({ name, is_checked: checked.includes(name) }));

  it('finds the listed item an expense names, in either language', () => {
    expect(findListMatch('Carrots', list(['Моркови', 'Мляко']))?.name).toBe('Моркови');
    expect(findListMatch('Домат', list(['Домати']))?.name).toBe('Домати');
  });

  it('finds it inside a longer description', () => {
    expect(findListMatch('Моркови 2кг', list(['Моркови']))?.name).toBe('Моркови');
    expect(findListMatch('2 kg carrots', list(['Моркови']))?.name).toBe('Моркови');
    expect(findListMatch('Бира Загорка за мача', list(['бира']))?.name).toBe('бира');
  });

  it('never matches a different catalog item that shares a word', () => {
    expect(findListMatch('Кисело мляко', list(['Мляко']))).toBeNull();
  });

  it('ignores ticked-off items, unrelated text and ambiguous hits', () => {
    expect(findListMatch('Carrots', list(['Моркови'], ['Моркови']))).toBeNull();
    expect(findListMatch('Rent', list(['Моркови']))).toBeNull();
    expect(findListMatch('', list(['Моркови']))).toBeNull();
    expect(findListMatch('бира', list(['Бира', 'бира']))).toBeNull();
  });
});
