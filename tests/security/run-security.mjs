// RLS / penetration test suite — runs against the live Supabase project.
//
// Verifies the security boundary (Row-Level Security + RPC guards) that the
// whole "Yours / Mine / Ours" + household-isolation model depends on.
//
// Setup/teardown: if SUPABASE_SERVICE_ROLE_KEY is in .env, users + households are
// created via the admin API and fully deleted afterwards (clean + repeatable).
// Otherwise it falls back to anon sign-ups (email confirmation must be OFF) and
// prints the leftover test data to delete by hand.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL / key in .env');
  process.exit(2);
}

const ts = Date.now();
const pw = `sec-pw-${ts}`;
const mkClient = (key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = serviceKey ? mkClient(serviceKey) : null;

const results = [];
const check = (name, passed, detail = '') => {
  results.push({ name, passed });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? '  | ' + detail : ''}`);
};

const emails = [];
async function createUser(tag, name) {
  const email = `sec-${tag}-${ts}@example.com`;
  emails.push(email);
  if (admin) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: pw,
      email_confirm: true,
      user_metadata: { display_name: name },
    });
    if (error) throw new Error(`admin.createUser ${email}: ${error.message}`);
    return { id: data.user.id, email };
  }
  const c = mkClient(anonKey);
  const { data, error } = await c.auth.signUp({ email, password: pw, options: { data: { display_name: name } } });
  if (error) throw new Error(`signUp ${email} (is email confirmation OFF?): ${error.message}`);
  return { id: data.user.id, email };
}
async function authed(email) {
  const c = mkClient(anonKey);
  const { error } = await c.auth.signInWithPassword({ email, password: pw });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return c;
}

const householdIds = [];
const userIds = [];

async function main() {
  console.log(`=== RLS / penetration suite (${admin ? 'service-role, self-cleaning' : 'anon fallback, leaves data'}) ===`);

  const a = await createUser('a', 'Alice');
  const b = await createUser('b', 'Bob');
  const c = await createUser('c', 'Carol');
  userIds.push(a.id, b.id, c.id);
  const [clientA, clientB, clientC] = await Promise.all([authed(a.email), authed(b.email), authed(c.email)]);
  const anon = mkClient(anonKey); // never signs in

  // A creates a household; B joins it; C stays an outsider.
  const { data: hh, error: hhErr } = await clientA.rpc('create_household', { p_name: 'Sec Test' });
  if (hhErr) throw new Error('create_household: ' + hhErr.message);
  householdIds.push(hh.id);
  await clientB.rpc('join_household', { p_code: hh.invite_code });

  // A adds a shopping list + a private and a shared category.
  const { data: list } = await clientA.from('shopping_lists').insert({ household_id: hh.id, name: 'L' }).select().single();
  const { data: privCat } = await clientA
    .from('categories')
    .insert({ household_id: hh.id, owner_id: a.id, name: 'Private', scope: 'private' })
    .select()
    .single();
  const { data: sharedCat } = await clientA
    .from('categories')
    .insert({ household_id: hh.id, owner_id: a.id, name: 'Shared', scope: 'shared' })
    .select()
    .single();

  // --- Assertions ---
  check('invite code matches 6-char A-Z0-9 format', /^[A-Z0-9]{6}$/.test(hh.invite_code || ''), hh.invite_code);

  const bReadHh = await clientB.from('households').select('id').eq('id', hh.id);
  check('member (B) can read the shared household', (bReadHh.data?.length ?? 0) === 1);

  const cReadHh = await clientC.from('households').select('id').eq('id', hh.id);
  check('outsider (C) cannot read the household', (cReadHh.data?.length ?? 0) === 0);

  const cReadMembers = await clientC.from('household_members').select('user_id').eq('household_id', hh.id);
  check('outsider (C) cannot read household members', (cReadMembers.data?.length ?? 0) === 0);

  const cReadList = await clientC.from('shopping_lists').select('id').eq('id', list.id);
  check('outsider (C) cannot read the shopping list', (cReadList.data?.length ?? 0) === 0);

  const cInsertList = await clientC.from('shopping_lists').insert({ household_id: hh.id, name: 'sneaky list' });
  check('non-member (C) cannot create a list in the household', cInsertList.error != null, cInsertList.error?.message ?? 'NO ERROR');

  const cInsert = await clientC.from('list_items').insert({ list_id: list.id, name: 'sneaky', added_by: c.id });
  check('non-member (C) cannot insert into the list', cInsert.error != null, cInsert.error?.message ?? 'NO ERROR');

  const spoof = await clientA.from('list_items').insert({ list_id: list.id, name: 'x', added_by: c.id });
  check('added_by spoofing is rejected (must equal auth.uid)', spoof.error != null, spoof.error?.message ?? 'NO ERROR');

  const bPriv = await clientB.from('categories').select('id').eq('id', privCat.id);
  check("co-member (B) cannot see A's private category", (bPriv.data?.length ?? 0) === 0);

  const bShared = await clientB.from('categories').select('id').eq('id', sharedCat.id);
  check("co-member (B) can see A's shared category", (bShared.data?.length ?? 0) === 1);

  const fullJoin = await clientC.rpc('join_household', { p_code: hh.invite_code });
  check('cannot join a full (2-member) household', fullJoin.error != null, fullJoin.error?.message ?? 'NO ERROR');

  const badJoin = await clientC.rpc('join_household', { p_code: 'ZZZZZZ' });
  check('cannot join with an invalid code', badJoin.error != null, badJoin.error?.message ?? 'NO ERROR');

  const anonRpc = await anon.rpc('create_household', { p_name: 'x' });
  check('unauthenticated cannot call create_household', anonRpc.error != null, anonRpc.error?.message ?? 'NO ERROR');

  const anonRead = await anon.from('households').select('id').eq('id', hh.id);
  check('unauthenticated cannot read households', (anonRead.data?.length ?? 0) === 0);
}

async function teardown() {
  if (admin) {
    for (const id of householdIds) await admin.from('households').delete().eq('id', id);
    for (const uid of userIds) await admin.auth.admin.deleteUser(uid).catch(() => {});
    console.log('\nCleaned up all test data (service role).');
  } else if (emails.length) {
    console.log('\n No SUPABASE_SERVICE_ROLE_KEY set — delete test data manually:');
    console.log('  households:', householdIds.join(', ') || '(none)');
    console.log('  users (Auth -> Users, search "sec-"):', emails.join(', '));
  }
}

main()
  .catch((e) => {
    console.error('\nSUITE ERROR:', e.message);
    results.push({ name: 'suite executed without error', passed: false });
  })
  .finally(async () => {
    await teardown().catch((e) => console.error('teardown error:', e.message));
    const failed = results.filter((r) => !r.passed).length;
    console.log(`\n=== ${results.length - failed}/${results.length} security checks passed ===`);
    process.exit(failed > 0 ? 1 : 0);
  });
