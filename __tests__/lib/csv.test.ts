import { escapeCsvField, transactionsToCsv, type CsvRow } from '../../lib/csv';

const HEADERS = {
  date: 'Date',
  description: 'Description',
  category: 'Category',
  scope: 'Scope',
  amount: 'Amount',
};

describe('escapeCsvField', () => {
  it('leaves plain values untouched', () => {
    expect(escapeCsvField('Rent')).toBe('Rent');
    expect(escapeCsvField('123.45')).toBe('123.45');
  });
  it('quotes and escapes values with commas, quotes, or newlines', () => {
    expect(escapeCsvField('Milk, eggs')).toBe('"Milk, eggs"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });
});

describe('transactionsToCsv', () => {
  const row = (over: Partial<CsvRow> = {}): CsvRow => ({
    occurred_on: '2026-07-01',
    description: 'Rent',
    categoryName: 'Housing',
    scope: 'shared',
    amount: 900,
    ...over,
  });

  it('emits a header row then one row per transaction, CRLF-separated', () => {
    const csv = transactionsToCsv([row()], HEADERS);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Date,Description,Category,Scope,Amount');
    expect(lines[1]).toBe('2026-07-01,Rent,Housing,shared,900.00');
    expect(lines).toHaveLength(2);
  });

  it('renders amounts with two decimals and empty cells for missing fields', () => {
    const csv = transactionsToCsv(
      [row({ description: null, categoryName: null, amount: 5 })],
      HEADERS
    );
    expect(csv.split('\r\n')[1]).toBe('2026-07-01,,,shared,5.00');
  });

  it('escapes a description containing a comma', () => {
    const csv = transactionsToCsv([row({ description: 'Milk, eggs' })], HEADERS);
    expect(csv.split('\r\n')[1]).toContain('"Milk, eggs"');
  });

  it('produces just the header for an empty list', () => {
    expect(transactionsToCsv([], HEADERS)).toBe('Date,Description,Category,Scope,Amount');
  });
});
