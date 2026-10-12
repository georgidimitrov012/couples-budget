import { COMMON_ITEMS, itemSlug } from '../../../lib/groceries';
import { translations } from '../../../lib/i18n';
import { isImportedGroup } from '@/features/deals/groups';
import { itemStems, matchItem, normalize, parseSize, productMatches, stem } from '@/features/deals/match';

describe('normalize / stem', () => {
  it('unifies decimals, percents and punctuation', () => {
    expect(normalize('Кисело мляко 3,6 %  400Г')).toBe('кисело мляко 3.6% 400г');
    expect(normalize('КИС.МЛЯКО')).toBe('кис мляко');
    expect(normalize('Coca-Cola 0.5л')).toBe('coca cola 0.5л');
  });

  it('folds Bulgarian plural/definite forms to one stem', () => {
    expect(stem('домати')).toBe(stem('доматите'));
    expect(stem('домати')).toBe(stem('домат'));
    expect(stem('яйца')).toBe(stem('яйце'));
    expect(stem('свинско')).toBe(stem('свински'));
    expect(stem('краставица')).toBe(stem('краставици'));
    // Different words stay different — "масло" (butter) is not "маслини" (olives).
    expect(stem('масло')).not.toBe(stem('маслини'));
  });

  it('drops stopwords and quantities from an item', () => {
    expect(itemStems('Домати на клонка 2 кг')).toEqual([stem('домати'), stem('клонка')]);
    expect(itemStems('Кисело мляко 2%')).toEqual([stem('кисело'), stem('мляко'), '2%']);
  });
});

describe('matchItem', () => {
  it('maps an item to its official group', () => {
    expect(matchItem('Домати')?.groups).toEqual([54]);
    expect(matchItem('доматите')?.groups).toEqual([54]);
    expect(matchItem('Tomatoes')?.groups).toEqual([54]);
  });

  it('prefers the most specific phrase', () => {
    expect(matchItem('Мляко')?.groups).toEqual([6]);
    expect(matchItem('Кисело мляко')?.groups).toEqual([7]);
    expect(matchItem('Паста за зъби')?.groups).toEqual([81]);
    expect(matchItem('Паста')?.groups).toEqual([36, 37]);
    expect(matchItem('olive oil')?.groups).toEqual([43]);
    expect(matchItem('Oil')?.groups).toEqual([42]);
    expect(matchItem('Свинска плешка')?.groups).toEqual([18]);
    expect(matchItem('консервирани домати')?.groups).toEqual([48]);
  });

  it('keeps the extra words as refinements and ignores quantities', () => {
    expect(matchItem('домати на клонка')?.refinements).toEqual([stem('клонка')]);
    expect(matchItem('Домати 2 кг')?.refinements).toEqual([]);
    expect(matchItem('кисело мляко 2%')?.refinements).toEqual(['2%']);
  });

  it('returns null for items the state data does not cover', () => {
    expect(matchItem('Чипс')).toBeNull();
    expect(matchItem('Кухненска хартия')).toBeNull();
    expect(matchItem('')).toBeNull();
    expect(matchItem('   ')).toBeNull();
  });

  it('never maps anything to tobacco or an unimported group', () => {
    expect(matchItem('Цигари')).toBeNull();
    for (const word of ['мляко', 'хляб', 'бира', 'вино', 'ракия', 'кафе', 'сапун']) {
      expect(matchItem(word)!.groups.every(isImportedGroup)).toBe(true);
    }
  });

  // The quick-add catalog is the most common way items get on the list, in
  // either language — every item it offers must land on the right group.
  const EXPECTED: Record<string, number[] | null> = {
    Milk: [6], Eggs: [31, 32], Butter: [12], Cheese: [8, 9], Yogurt: [7], Bread: [1, 2, 3, 4],
    Rolls: null, Bananas: [52], Apples: [53], Lemons: [50], Oranges: [51], Tomatoes: [54],
    Potatoes: [61], Onions: [55], Cucumber: [58], Carrots: [56], Peppers: null, Lettuce: null,
    Garlic: [59], Chicken: [15, 16, 17], 'Minced meat': [25], Fish: [29, 30], Ham: [27, 28],
    Rice: [35], Pasta: [36, 37], Flour: [40, 41], Sugar: [38], Salt: [39], Oil: [42],
    Coffee: [70, 71], Tea: [72], Water: [73], Juice: null, Chocolate: [69], Chips: null,
    Cookies: [66], 'Toilet paper': [85], 'Paper towels': null, 'Dish soap': [79],
    'Laundry detergent': null, 'Trash bags': null, Shampoo: [82], Toothpaste: [81], Soap: [83],
  };

  it.each(COMMON_ITEMS.map((c) => c.name))('catalog item "%s" maps in English and Bulgarian', (name) => {
    expect(name in EXPECTED).toBe(true);
    const bg = translations.bg[`item.${itemSlug(name)}`];
    expect(matchItem(name)?.groups ?? null).toEqual(EXPECTED[name]);
    expect(matchItem(bg)?.groups ?? null).toEqual(EXPECTED[name]);
  });
});

describe('productMatches', () => {
  const tomatoes = matchItem('Домати')!;

  it('accepts every kind for a plain item', () => {
    expect(productMatches(tomatoes, 'Домати кг')).toBe(true);
    expect(productMatches(tomatoes, 'ДОМАТИ НА КЛОНКА')).toBe(true);
    expect(productMatches(tomatoes, 'Домати Консервни кг')).toBe(true);
  });

  it('rejects a product a chain misfiled into the group', () => {
    expect(productMatches(tomatoes, 'Краставици')).toBe(false);
  });

  it('narrows to the kind the person typed', () => {
    const vine = matchItem('домати на клонка')!;
    expect(productMatches(vine, 'Домати на клонка кг')).toBe(true);
    expect(productMatches(vine, 'Домати кг')).toBe(false);

    const twoPercent = matchItem('кисело мляко 2%')!;
    expect(productMatches(twoPercent, 'Кисело мляко 2% 400г')).toBe(true);
    expect(productMatches(twoPercent, 'Кисело мляко 3,2%')).toBe(false);

    const brand = matchItem('кисело мляко саяна')!;
    expect(productMatches(brand, 'САЯНА Кисело мляко 2% 400г')).toBe(true);
    expect(productMatches(brand, 'Балкан Кисело мляко 2% 400г')).toBe(false);
  });

  it('shows nothing rather than a wrong kind for words it cannot check', () => {
    expect(productMatches(matchItem('cherry tomatoes')!, 'Домати кг')).toBe(false);
  });
});

describe('parseSize', () => {
  it.each([
    ['Кисело мляко 2% 400г', { amount: 0.4, unit: 'kg' }],
    ['Прясно мляко 3% 1 л', { amount: 1, unit: 'l' }],
    ['Бира 6 x 0,5 л', { amount: 3, unit: 'l' }],
    ['Вода 4 бр. x 500 мл', { amount: 2, unit: 'l' }],
    ['Домати кг', { amount: 1, unit: 'kg' }],
    ['Банани на кг', { amount: 1, unit: 'kg' }],
    ['Яйца размер М 10 бр', { amount: 10, unit: 'pc' }],
    ['Пилешко филе около 2кг', { amount: 1, unit: 'kg' }],
  ])('%s', (name, size) => {
    const got = parseSize(name)!;
    expect(got.unit).toBe(size.unit);
    expect(got.amount).toBeCloseTo(size.amount);
  });

  it('returns null when the name has no pack size', () => {
    expect(parseSize('Кисело мляко 3,6%')).toBeNull();
    expect(parseSize('Тоалетна хартия 2пл 8x200 листа')).toBeNull();
  });
});
