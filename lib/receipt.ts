import { parseAmount } from './format';

export type ScannedItem = { name: string; quantity: number; price: number | null };
export type ScanResult = {
  merchant: string | null;
  purchased_on: string | null;
  currency: string | null;
  items: ScannedItem[];
};

export type LineAction = 'add' | 'check' | 'skip';

/** One editable row in the review screen. `price` is raw input text. */
export type ReviewLine = {
  key: string;
  name: string;
  price: string;
  quantity: number;
  scope: 'shared' | 'private';
  action: LineAction;
  listItemId: string | null; // the matched shopping-list item, when action === 'check'
  matchName: string | null; // its name, for the UI label
};

/** Shape sent to the apply_receipt RPC (one element per non-skipped line). */
export type LinePayload = {
  name: string;
  amount: number;
  scope: 'shared' | 'private';
  action: LineAction;
  list_item_id: string | null;
};

type ListItemLike = { id: string; name: string; is_checked: boolean };

// Lowercase, strip accents/punctuation, collapse whitespace. Unicode-aware so
// Cyrillic (and other non-Latin) product names normalize sensibly too.
export function normalizeName(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Jaccard token overlap, with a boost when one name contains the other
// (e.g. "milk" vs "semi-skimmed milk"). 0..1.
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = new Set(na.split(' '));
  const tb = new Set(nb.split(' '));
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const jaccard = inter / (ta.size + tb.size - inter);
  const contains = (na.includes(nb) || nb.includes(na)) && Math.min(na.length, nb.length) >= 3;
  return contains ? Math.max(jaccard, 0.8) : jaccard;
}

const MATCH_THRESHOLD = 0.5;

/** Best still-unchecked list item for a scanned name, or null if none is close. */
export function matchListItem(
  name: string,
  items: ListItemLike[]
): { id: string; name: string } | null {
  let best: { id: string; name: string } | null = null;
  let bestScore = 0;
  for (const item of items) {
    if (item.is_checked) continue; // already accounted for in the budget
    const score = nameSimilarity(name, item.name);
    if (score > bestScore) {
      bestScore = score;
      best = { id: item.id, name: item.name };
    }
  }
  return bestScore >= MATCH_THRESHOLD ? best : null;
}

let keySeq = 0;

/** Turn a scan result into editable review rows, pre-matching against the list. */
export function buildReviewLines(scan: ScanResult, listItems: ListItemLike[]): ReviewLine[] {
  return scan.items.map((it) => {
    const match = matchListItem(it.name, listItems);
    return {
      key: `line-${keySeq++}`,
      name: it.name,
      price: it.price != null ? String(it.price) : '',
      quantity: it.quantity,
      scope: 'shared',
      action: match ? 'check' : 'add',
      listItemId: match?.id ?? null,
      matchName: match?.name ?? null,
    };
  });
}

/** Sum of the parsed amounts of every non-skipped line (0 for invalid/empty). */
export function reviewTotal(lines: ReviewLine[]): number {
  return lines.reduce((sum, l) => {
    if (l.action === 'skip') return sum;
    return sum + (parseAmount(l.price) ?? 0);
  }, 0);
}

/**
 * Map review rows to the RPC payload. `valid` is false when an applied line has
 * no positive amount — the screen blocks submit until each applied line has one.
 */
export function buildPayload(lines: ReviewLine[]): { valid: boolean; lines: LinePayload[] } {
  const applied = lines.filter((l) => l.action !== 'skip');
  const payload: LinePayload[] = [];
  let valid = applied.length > 0;
  for (const l of applied) {
    const amount = parseAmount(l.price);
    if (amount == null) {
      valid = false;
      continue;
    }
    payload.push({
      name: l.name.trim(),
      amount,
      scope: l.scope,
      action: l.action,
      list_item_id: l.action === 'check' ? l.listItemId : null,
    });
  }
  return { valid, lines: payload };
}
