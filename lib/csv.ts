// Pure CSV generation for exporting transactions. Kept free of any native/Expo
// imports so it's unit-testable and safe to import anywhere.

export type CsvRow = {
  occurred_on: string; // 'YYYY-MM-DD'
  description: string | null;
  categoryName: string | null;
  scope: string; // 'shared' | 'private'
  amount: number;
};

export type CsvHeaders = {
  date: string;
  description: string;
  category: string;
  scope: string;
  amount: string;
};

/**
 * RFC-4180 field escaping: wrap in quotes when the value contains a comma,
 * double-quote, CR or LF, doubling any embedded quotes.
 */
export function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Builds an RFC-4180 CSV (header row + one row per transaction, CRLF line
 * endings). Amounts are rendered with two decimals; missing description/category
 * become empty cells.
 */
export function transactionsToCsv(rows: CsvRow[], headers: CsvHeaders): string {
  const table: string[][] = [
    [headers.date, headers.description, headers.category, headers.scope, headers.amount],
  ];
  for (const r of rows) {
    table.push([
      r.occurred_on,
      r.description ?? '',
      r.categoryName ?? '',
      r.scope,
      r.amount.toFixed(2),
    ]);
  }
  return table.map((cols) => cols.map((c) => escapeCsvField(String(c))).join(',')).join('\r\n');
}
