import {
  buildPayload,
  buildReviewLines,
  matchListItem,
  nameSimilarity,
  normalizeName,
  reviewTotal,
  type ReviewLine,
  type ScanResult,
} from '../../lib/receipt';

const listItems = [
  { id: 'li1', name: 'Milk', is_checked: false },
  { id: 'li2', name: 'Free-range Eggs', is_checked: false },
  { id: 'li3', name: 'Bananas', is_checked: true }, // already checked
];

function scan(items: ScanResult['items']): ScanResult {
  return { merchant: 'Kaufland', purchased_on: '2026-07-11', currency: 'BGN', items };
}

describe('normalizeName', () => {
  it('lowercases, strips punctuation/accents, collapses whitespace', () => {
    expect(normalizeName('  Café—Latté! ')).toBe('cafe latte');
    expect(normalizeName('MILK 2%')).toBe('milk 2');
  });
});

describe('nameSimilarity', () => {
  it('is 1 for the same name ignoring case/space', () => {
    expect(nameSimilarity('Milk', ' milk ')).toBe(1);
  });
  it('boosts when one name contains the other', () => {
    expect(nameSimilarity('milk', 'semi skimmed milk')).toBeGreaterThanOrEqual(0.8);
  });
  it('is 0 for unrelated names', () => {
    expect(nameSimilarity('Bread', 'Milk')).toBe(0);
  });
});

describe('matchListItem', () => {
  it('matches on a close name', () => {
    expect(matchListItem('MILK', listItems)?.id).toBe('li1');
    expect(matchListItem('eggs', listItems)?.id).toBe('li2');
  });
  it('returns null when nothing is close', () => {
    expect(matchListItem('Dish soap', listItems)).toBeNull();
  });
  it('ignores already-checked list items', () => {
    expect(matchListItem('bananas', listItems)).toBeNull();
  });
});

describe('buildReviewLines', () => {
  it('defaults matched items to "check" and unmatched to "add"', () => {
    const lines = buildReviewLines(
      scan([
        { name: 'Milk', quantity: 1, price: 2.5 },
        { name: 'Dish soap', quantity: 1, price: 4 },
      ]),
      listItems
    );
    expect(lines[0]).toMatchObject({ action: 'check', listItemId: 'li1', matchName: 'Milk', price: '2.5' });
    expect(lines[1]).toMatchObject({ action: 'add', listItemId: null });
  });

  it('leaves the price blank when the scan had no price', () => {
    const lines = buildReviewLines(scan([{ name: 'Milk', quantity: 1, price: null }]), []);
    expect(lines[0].price).toBe('');
    expect(lines[0].action).toBe('add');
  });
});

function line(over: Partial<ReviewLine> = {}): ReviewLine {
  return {
    key: 'k',
    name: 'Milk',
    price: '2.50',
    quantity: 1,
    scope: 'shared',
    action: 'add',
    listItemId: null,
    matchName: null,
    ...over,
  };
}

describe('reviewTotal', () => {
  it('sums applied lines and ignores skipped/invalid ones', () => {
    const total = reviewTotal([
      line({ key: 'a', price: '2.50' }),
      line({ key: 'b', price: '1,20' }),
      line({ key: 'c', price: '9.99', action: 'skip' }),
      line({ key: 'd', price: '' }),
    ]);
    expect(total).toBeCloseTo(3.7);
  });
});

describe('buildPayload', () => {
  it('maps applied lines and drops skipped ones', () => {
    const { valid, lines } = buildPayload([
      line({ key: 'a', name: 'Milk', price: '2.50', action: 'check', listItemId: 'li1' }),
      line({ key: 'b', name: 'Soap', price: '4.00', action: 'add' }),
      line({ key: 'c', name: 'X', price: '9.99', action: 'skip' }),
    ]);
    expect(valid).toBe(true);
    expect(lines).toEqual([
      { name: 'Milk', amount: 2.5, scope: 'shared', action: 'check', list_item_id: 'li1' },
      { name: 'Soap', amount: 4, scope: 'shared', action: 'add', list_item_id: null },
    ]);
  });

  it('clears list_item_id when the action is not "check"', () => {
    const { lines } = buildPayload([line({ action: 'add', listItemId: 'li1' })]);
    expect(lines[0].list_item_id).toBeNull();
  });

  it('is invalid when an applied line has no positive amount', () => {
    expect(buildPayload([line({ price: '' })]).valid).toBe(false);
    expect(buildPayload([line({ price: '0' })]).valid).toBe(false);
  });

  it('is invalid when every line is skipped', () => {
    expect(buildPayload([line({ action: 'skip' })]).valid).toBe(false);
  });
});
