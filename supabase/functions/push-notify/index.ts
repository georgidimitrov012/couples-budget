// Supabase Edge Function: push-notify
//
// Fired by Database Webhooks on INSERT/UPDATE of list_items, transactions and
// household_members. It works out who acted, finds the OTHER household member,
// and sends them an Expo push in their language — so a partner hears about a new
// list item / purchase / expense / join even with the app closed.
//
// Uses SUPABASE_SERVICE_ROLE_KEY (auto-provided to Edge Functions) to read the
// recipient's push token; that key never ships to the app. Deno runtime.
//
// JWT verification is off (webhooks don't carry a user JWT), so the function
// guards itself: shared secret + re-reading every row it reports on
// (_shared/push-guard.ts). Never trust the payload's contents.
//
// Deploy:   supabase functions deploy push-notify --no-verify-jwt --use-api
// Webhooks: configured in the dashboard — see docs/SUPABASE_SETUP.md §13.

import { buildPushMessage, type PushEvent, type PushLocale, type PushOpts } from '../_shared/push-messages.ts';
import { candidateFrom, clip, isAuthorized, isRecent, isUuid, type WebhookPayload } from '../_shared/push-guard.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
// Shared with the Database Webhooks (their Authorization header). Set with
// `supabase secrets set PUSH_WEBHOOK_SECRET=…` — see docs/SUPABASE_SETUP.md §13.
const WEBHOOK_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Read from PostgREST with the service role (bypasses RLS).
async function rest<T>(path: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) return [];
  return (await res.json()) as T[];
}

async function householdOfList(listId: string): Promise<string | null> {
  if (!isUuid(listId)) return null;
  const rows = await rest<{ household_id: string }>(
    `shopping_lists?id=eq.${listId}&select=household_id`
  );
  return rows[0]?.household_id ?? null;
}

async function categoryName(categoryId: string | null): Promise<string | null> {
  if (!isUuid(categoryId)) return null;
  const rows = await rest<{ name: string }>(`categories?id=eq.${categoryId}&select=name`);
  return rows[0]?.name ?? null;
}

async function sendExpoPush(token: string, message: ReturnType<typeof buildPushMessage>): Promise<void> {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ to: token, sound: 'default', ...message }),
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY || !WEBHOOK_SECRET) return json({ error: 'Not configured' }, 500);
  // Only our Database Webhooks know the secret (docs/SUPABASE_SETUP.md §13).
  if (!isAuthorized(req.headers.get('authorization'), WEBHOOK_SECRET)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }

  const candidate = candidateFrom(payload);
  if (!candidate) return json({ skipped: 'no match' });

  // The payload only says *which* row; everything in the message comes from the
  // database, and only for a change from the last couple of minutes.
  const now = Date.now();
  let event: PushEvent;
  let actorId: string | null = null;
  let householdId: string | null = null;
  let opts: PushOpts = {};

  if (candidate.kind === 'listAdd' || candidate.kind === 'listCheck') {
    const [item] = await rest<{
      name: string;
      is_checked: boolean;
      added_by: string;
      checked_by: string | null;
      list_id: string;
      created_at: string;
      updated_at: string;
    }>(`list_items?id=eq.${candidate.itemId}&select=name,is_checked,added_by,checked_by,list_id,created_at,updated_at`);
    if (!item) return json({ skipped: 'not found' });
    if (candidate.kind === 'listAdd') {
      if (item.is_checked || !isRecent(item.created_at, now)) return json({ skipped: 'stale' });
      event = 'listAdd';
      actorId = item.added_by;
    } else {
      if (!item.is_checked || !isRecent(item.updated_at, now)) return json({ skipped: 'stale' });
      event = 'listCheck';
      actorId = item.checked_by ?? item.added_by;
    }
    opts = { itemName: clip(item.name) };
    householdId = await householdOfList(item.list_id);
  } else if (candidate.kind === 'expense') {
    const [tx] = await rest<{
      scope: string;
      owner_id: string;
      household_id: string;
      amount: number;
      category_id: string | null;
      created_at: string;
    }>(`transactions?id=eq.${candidate.transactionId}&select=scope,owner_id,household_id,amount,category_id,created_at`);
    if (!tx || tx.scope !== 'shared' || !isRecent(tx.created_at, now)) return json({ skipped: 'stale' });
    event = 'expense';
    actorId = tx.owner_id;
    householdId = tx.household_id;
    const category = await categoryName(tx.category_id);
    opts = { amount: `${Number(tx.amount).toFixed(2)} €`, category: category ? clip(category) : null };
  } else {
    const [member] = await rest<{ joined_at: string }>(
      `household_members?household_id=eq.${candidate.householdId}&user_id=eq.${candidate.userId}&select=joined_at`
    );
    if (!member || !isRecent(member.joined_at, now)) return json({ skipped: 'stale' });
    event = 'memberJoin';
    actorId = candidate.userId;
    householdId = candidate.householdId;
  }

  if (!actorId || !isUuid(householdId)) return json({ skipped: 'no match' });

  // Recipient = the other member (a solo household has no one to notify).
  const members = await rest<{ user_id: string }>(
    `household_members?household_id=eq.${householdId}&select=user_id`
  );
  const recipientId = members.map((m) => m.user_id).find((id) => id !== actorId);
  if (!isUuid(recipientId)) return json({ skipped: 'solo' });

  const recipients = await rest<{ push_token: string | null; locale: string | null }>(
    `profiles?id=eq.${recipientId}&select=push_token,locale`
  );
  const recipient = recipients[0];
  if (!recipient?.push_token) return json({ skipped: 'no token' });

  const actors = await rest<{ display_name: string | null }>(
    `profiles?id=eq.${actorId}&select=display_name`
  );
  const locale: PushLocale = recipient.locale === 'en' ? 'en' : 'bg';
  const actorName = clip(actors[0]?.display_name ?? (locale === 'en' ? 'Your partner' : 'Партньорът ти'), 40);

  await sendExpoPush(recipient.push_token, buildPushMessage(event, actorName, locale, opts));
  return json({ sent: true });
});
