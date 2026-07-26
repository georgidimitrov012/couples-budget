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
// Deploy:   supabase functions deploy push-notify
// Webhooks: configured in the dashboard — see docs/SUPABASE_SETUP.md §13.

import { buildPushMessage, type PushEvent, type PushLocale, type PushOpts } from '../_shared/push-messages.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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
  const rows = await rest<{ household_id: string }>(
    `shopping_lists?id=eq.${listId}&select=household_id`
  );
  return rows[0]?.household_id ?? null;
}

async function categoryName(categoryId: string | null): Promise<string | null> {
  if (!categoryId) return null;
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

type Row = Record<string, unknown>;
type WebhookPayload = { type?: string; table?: string; record?: Row; old_record?: Row | null };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'Not configured' }, 500);

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }

  const { type, table, record, old_record } = payload;
  if (!record) return json({ skipped: 'no record' });

  let event: PushEvent | null = null;
  let actorId: string | null = null;
  let householdId: string | null = null;
  let opts: PushOpts = {};

  if (table === 'list_items') {
    if (type === 'INSERT' && !record.is_checked) {
      event = 'listAdd';
      actorId = (record.added_by as string) ?? null;
      opts = { itemName: record.name as string };
    } else if (type === 'UPDATE' && !old_record?.is_checked && record.is_checked) {
      event = 'listCheck';
      actorId = ((record.checked_by as string) ?? (record.added_by as string)) ?? null;
      opts = { itemName: record.name as string };
    }
    if (event) householdId = await householdOfList(record.list_id as string);
  } else if (table === 'transactions') {
    if (type === 'INSERT' && record.scope === 'shared') {
      event = 'expense';
      actorId = (record.owner_id as string) ?? null;
      householdId = (record.household_id as string) ?? null;
      opts = {
        amount: `${Number(record.amount).toFixed(2)} €`,
        category: await categoryName((record.category_id as string) ?? null),
      };
    }
  } else if (table === 'household_members') {
    if (type === 'INSERT') {
      event = 'memberJoin';
      actorId = (record.user_id as string) ?? null;
      householdId = (record.household_id as string) ?? null;
    }
  }

  if (!event || !actorId || !householdId) return json({ skipped: 'no match' });

  // Recipient = the other member (a solo household has no one to notify).
  const members = await rest<{ user_id: string }>(
    `household_members?household_id=eq.${householdId}&select=user_id`
  );
  const recipientId = members.map((m) => m.user_id).find((id) => id !== actorId);
  if (!recipientId) return json({ skipped: 'solo' });

  const recipients = await rest<{ push_token: string | null; locale: string | null }>(
    `profiles?id=eq.${recipientId}&select=push_token,locale`
  );
  const recipient = recipients[0];
  if (!recipient?.push_token) return json({ skipped: 'no token' });

  const actors = await rest<{ display_name: string | null }>(
    `profiles?id=eq.${actorId}&select=display_name`
  );
  const actorName = actors[0]?.display_name ?? 'Your partner';
  const locale: PushLocale = recipient.locale === 'en' ? 'en' : 'bg';

  await sendExpoPush(recipient.push_token, buildPushMessage(event, actorName, locale, opts));
  return json({ sent: true });
});
