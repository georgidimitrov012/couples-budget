// Security guards for the push-notify Edge Function. Pure (no Deno APIs) so the
// function and its Jest tests share them.
//
// The function is deployed with JWT verification OFF (Database Webhooks don't
// send a user JWT), so without these anyone who learns its URL could POST a forged
// "event" and push arbitrary text to any user's phone. Defences:
//   1. A shared secret only the webhooks know (PUSH_WEBHOOK_SECRET).
//   2. The payload is only a pointer: the function re-reads the row from the
//      database by id and builds the message from that, and only for a row that
//      changed in the last couple of minutes (no replays of old rows).
//   3. Ids are checked to be UUIDs before they go anywhere near a query URL.

/** How long after a change a push is still sent (covers webhook retries/latency). */
export const MAX_EVENT_AGE_MS = 2 * 60 * 1000;
/** Longest item name put in a notification. */
export const MAX_ITEM_CHARS = 60;

/** Constant-time check of `Authorization: Bearer <secret>`. Fails closed on an empty secret. */
export function isAuthorized(header: string | null | undefined, secret: string): boolean {
  if (!secret || !header) return false;
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

type Row = Record<string, unknown>;
export type WebhookPayload = { type?: unknown; table?: unknown; record?: Row | null; old_record?: Row | null };

/** What the payload claims happened, reduced to ids the function will look up itself. */
export type Candidate =
  | { kind: 'listAdd'; itemId: string }
  | { kind: 'listCheck'; itemId: string }
  | { kind: 'expense'; transactionId: string }
  | { kind: 'memberJoin'; householdId: string; userId: string };

/** Turn a webhook payload into a lookup, or null if it's nothing we notify about. */
export function candidateFrom(payload: WebhookPayload): Candidate | null {
  const { type, table, record, old_record } = payload ?? {};
  if (!record || typeof record !== 'object') return null;
  if (table === 'list_items') {
    if (!isUuid(record.id)) return null;
    if (type === 'INSERT' && !record.is_checked) return { kind: 'listAdd', itemId: record.id };
    if (type === 'UPDATE' && old_record && !old_record.is_checked && record.is_checked) {
      return { kind: 'listCheck', itemId: record.id };
    }
    return null;
  }
  if (table === 'transactions') {
    if (type === 'INSERT' && isUuid(record.id)) return { kind: 'expense', transactionId: record.id };
    return null;
  }
  if (table === 'household_members') {
    if (type === 'INSERT' && isUuid(record.household_id) && isUuid(record.user_id)) {
      return { kind: 'memberJoin', householdId: record.household_id, userId: record.user_id };
    }
    return null;
  }
  return null;
}

/** Did this happen recently enough to be the event the webhook is reporting? */
export function isRecent(timestamp: unknown, now: number, maxAgeMs = MAX_EVENT_AGE_MS): boolean {
  if (typeof timestamp !== 'string') return false;
  const t = Date.parse(timestamp);
  if (Number.isNaN(t)) return false;
  // Allow a little clock skew into the future.
  return now - t <= maxAgeMs && t - now <= 30_000;
}

/** Shorten user text for a notification. */
export function clip(text: string, max = MAX_ITEM_CHARS): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
