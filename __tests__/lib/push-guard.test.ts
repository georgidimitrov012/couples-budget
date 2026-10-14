import {
  candidateFrom,
  clip,
  isAuthorized,
  isRecent,
  isUuid,
  MAX_EVENT_AGE_MS,
} from '../../supabase/functions/_shared/push-guard';

const ID = '3f2b8c1e-9a4d-4c6b-8e2f-1a2b3c4d5e6f';
const ID2 = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';

// The push function runs with JWT verification off; these guards are the only
// thing between its public URL and every user's lock screen.
describe('isAuthorized', () => {
  it('accepts exactly the shared secret', () => {
    expect(isAuthorized('Bearer s3cret-value', 's3cret-value')).toBe(true);
  });

  it.each([
    [null, 's3cret'],
    [undefined, 's3cret'],
    ['', 's3cret'],
    ['s3cret', 's3cret'], // missing "Bearer "
    ['Bearer s3cret ', 's3cret'],
    ['Bearer S3CRET', 's3cret'],
    ['Bearer s3cre', 's3cret'],
    ['bearer s3cret', 's3cret'],
  ])('refuses %j', (header, secret) => {
    expect(isAuthorized(header, secret)).toBe(false);
  });

  it('fails closed when no secret is configured', () => {
    expect(isAuthorized('Bearer ', '')).toBe(false);
    expect(isAuthorized('Bearer anything', '')).toBe(false);
  });
});

describe('isUuid', () => {
  it('accepts UUIDs and nothing else', () => {
    expect(isUuid(ID)).toBe(true);
    expect(isUuid(ID.toUpperCase())).toBe(true);
    for (const bad of [
      '',
      'abc',
      `${ID}&select=*`, // query injection
      `${ID},or=(id.neq.0)`,
      `x${ID}`,
      123,
      null,
      undefined,
      {},
    ]) {
      expect(isUuid(bad)).toBe(false);
    }
  });
});

describe('candidateFrom', () => {
  it('turns the four real events into id lookups', () => {
    expect(candidateFrom({ type: 'INSERT', table: 'list_items', record: { id: ID, is_checked: false } })).toEqual({
      kind: 'listAdd',
      itemId: ID,
    });
    expect(
      candidateFrom({
        type: 'UPDATE',
        table: 'list_items',
        record: { id: ID, is_checked: true },
        old_record: { id: ID, is_checked: false },
      })
    ).toEqual({ kind: 'listCheck', itemId: ID });
    expect(candidateFrom({ type: 'INSERT', table: 'transactions', record: { id: ID } })).toEqual({
      kind: 'expense',
      transactionId: ID,
    });
    expect(
      candidateFrom({ type: 'INSERT', table: 'household_members', record: { household_id: ID, user_id: ID2 } })
    ).toEqual({ kind: 'memberJoin', householdId: ID, userId: ID2 });
  });

  it('carries only ids — never the payload’s text, names or amounts', () => {
    const c = candidateFrom({
      type: 'INSERT',
      table: 'list_items',
      record: { id: ID, is_checked: false, name: 'Click http://evil.example', added_by: ID2 },
    });
    expect(c).toEqual({ kind: 'listAdd', itemId: ID });
  });

  it.each([
    ['no record', { type: 'INSERT', table: 'list_items' }],
    ['non-UUID item id', { type: 'INSERT', table: 'list_items', record: { id: '1 or 1=1', is_checked: false } }],
    ['already-checked insert', { type: 'INSERT', table: 'list_items', record: { id: ID, is_checked: true } }],
    ['uncheck', { type: 'UPDATE', table: 'list_items', record: { id: ID, is_checked: false }, old_record: { is_checked: true } }],
    ['re-save of a checked item', { type: 'UPDATE', table: 'list_items', record: { id: ID, is_checked: true }, old_record: { is_checked: true } }],
    ['update without old_record', { type: 'UPDATE', table: 'list_items', record: { id: ID, is_checked: true } }],
    ['delete', { type: 'DELETE', table: 'list_items', record: { id: ID } }],
    ['transaction update', { type: 'UPDATE', table: 'transactions', record: { id: ID } }],
    ['member with injected id', { type: 'INSERT', table: 'household_members', record: { household_id: `${ID}&x=1`, user_id: ID2 } }],
    ['another table', { type: 'INSERT', table: 'profiles', record: { id: ID } }],
  ])('ignores %s', (_label, payload) => {
    expect(candidateFrom(payload as never)).toBeNull();
  });

  it('survives garbage', () => {
    expect(candidateFrom(null as never)).toBeNull();
    expect(candidateFrom({ record: 'x' as never })).toBeNull();
  });
});

describe('isRecent', () => {
  const now = Date.parse('2026-10-14T12:00:00Z');
  it('accepts a change from the last two minutes', () => {
    expect(isRecent('2026-10-14T11:59:30Z', now)).toBe(true);
    expect(isRecent(new Date(now - MAX_EVENT_AGE_MS).toISOString(), now)).toBe(true);
  });
  it('refuses old rows (replays), far-future times and junk', () => {
    expect(isRecent(new Date(now - MAX_EVENT_AGE_MS - 1).toISOString(), now)).toBe(false);
    expect(isRecent('2026-10-13T12:00:00Z', now)).toBe(false);
    expect(isRecent('2026-10-14T12:05:00Z', now)).toBe(false);
    expect(isRecent('yesterday', now)).toBe(false);
    expect(isRecent(undefined, now)).toBe(false);
  });
});

describe('clip', () => {
  it('collapses whitespace and shortens long text', () => {
    expect(clip('  Мляко \n  2% ')).toBe('Мляко 2%');
    expect(clip('x'.repeat(100))).toHaveLength(60);
    expect(clip('x'.repeat(100)).endsWith('…')).toBe(true);
    expect(clip('short', 40)).toBe('short');
  });
});
