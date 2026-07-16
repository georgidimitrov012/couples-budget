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

  // A adds a private ("Mine") and a shared ("Ours") transaction.
  const { data: privTx } = await clientA
    .from('transactions')
    .insert({ household_id: hh.id, owner_id: a.id, amount: 9.99, description: 'secret', scope: 'private' })
    .select()
    .single();
  const { data: sharedTx } = await clientA
    .from('transactions')
    .insert({ household_id: hh.id, owner_id: a.id, amount: 5, description: 'groceries', scope: 'shared' })
    .select()
    .single();

  // --- Assertions ---
  check('invite code matches the strong 8-char format', /^[A-Z2-9]{8}$/.test(hh.invite_code || ''), hh.invite_code);

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

  const bPrivTx = await clientB.from('transactions').select('id').eq('id', privTx.id);
  check("co-member (B) cannot see A's private transaction (Yours stays hidden)", (bPrivTx.data?.length ?? 0) === 0);

  const bSharedTx = await clientB.from('transactions').select('id').eq('id', sharedTx.id);
  check("co-member (B) can see A's shared transaction (Ours)", (bSharedTx.data?.length ?? 0) === 1);

  const bShared = await clientB.from('categories').select('id').eq('id', sharedCat.id);
  check("co-member (B) can see A's shared category", (bShared.data?.length ?? 0) === 1);

  const cInsertCat = await clientC
    .from('categories')
    .insert({ household_id: hh.id, owner_id: c.id, name: 'sneaky cat', scope: 'shared' });
  check('non-member (C) cannot create a category', cInsertCat.error != null, cInsertCat.error?.message ?? 'NO ERROR');

  const catSpoof = await clientA
    .from('categories')
    .insert({ household_id: hh.id, owner_id: b.id, name: 'spoof', scope: 'shared' });
  check('category owner spoofing is rejected (owner_id must equal auth.uid)', catSpoof.error != null, catSpoof.error?.message ?? 'NO ERROR');

  const aSetLimit = await clientA
    .from('categories')
    .update({ monthly_limit: 100 })
    .eq('id', sharedCat.id)
    .select();
  check('owner (A) can set a category monthly limit', (aSetLimit.data?.length ?? 0) === 1, aSetLimit.error?.message ?? '');

  const bSetLimit = await clientB
    .from('categories')
    .update({ monthly_limit: 5 })
    .eq('id', sharedCat.id)
    .select();
  check("co-member (B) cannot edit A's category (owner-only update)", (bSetLimit.data?.length ?? 0) === 0);

  // Settle-up: A records that B paid back 2.50 (half of the shared 5.00).
  const settleIns = await clientA
    .from('settlements')
    .insert({ household_id: hh.id, from_user: b.id, to_user: a.id, amount: 2.5 })
    .select()
    .single();
  check('member (A) can record a settlement between the partners', settleIns.error == null, settleIns.error?.message ?? '');

  const bReadSettle = await clientB.from('settlements').select('id').eq('household_id', hh.id);
  check('co-member (B) can read settlements', (bReadSettle.data?.length ?? 0) >= 1);

  const cReadSettle = await clientC.from('settlements').select('id').eq('household_id', hh.id);
  check('outsider (C) cannot read settlements', (cReadSettle.data?.length ?? 0) === 0);

  const cInsertSettle = await clientC
    .from('settlements')
    .insert({ household_id: hh.id, from_user: c.id, to_user: a.id, amount: 1 });
  check('non-member (C) cannot record a settlement', cInsertSettle.error != null, cInsertSettle.error?.message ?? 'NO ERROR');

  const settleOutsider = await clientA
    .from('settlements')
    .insert({ household_id: hh.id, from_user: c.id, to_user: a.id, amount: 1 });
  check('settlement parties must both be household members', settleOutsider.error != null, settleOutsider.error?.message ?? 'NO ERROR');

  // List → budget wiring: a priced item feeds the budget exactly once.
  const { data: pricedItem } = await clientA
    .from('list_items')
    .insert({ list_id: list.id, name: 'Milk', price: 3.5, added_by: a.id })
    .select()
    .single();
  const linkTx = await clientA
    .from('transactions')
    .insert({ household_id: hh.id, owner_id: a.id, amount: 3.5, description: 'Milk', scope: 'shared', list_item_id: pricedItem.id })
    .select()
    .single();
  check('checking off a priced item can record a linked transaction', linkTx.error == null, linkTx.error?.message ?? '');

  const dupTx = await clientB
    .from('transactions')
    .insert({ household_id: hh.id, owner_id: b.id, amount: 3.5, description: 'Milk', scope: 'shared', list_item_id: pricedItem.id });
  check('an item cannot feed the budget twice (unique link)', dupTx.error != null, dupTx.error?.message ?? 'NO ERROR');

  // Widened delete policy: shared expenses are deletable by either partner
  // (unchecking an item the other partner checked); private stays owner-only.
  const bDelShared = await clientB.from('transactions').delete().eq('id', sharedTx.id).select();
  check("co-member (B) can delete A's shared transaction", (bDelShared.data?.length ?? 0) === 1, bDelShared.error?.message ?? '');

  const bDelPriv = await clientB.from('transactions').delete().eq('id', privTx.id).select();
  check("co-member (B) cannot delete A's private transaction", (bDelPriv.data?.length ?? 0) === 0);

  // Receipts: household-scoped, uploader records their own.
  const { data: receipt, error: rcErr } = await clientA
    .from('receipts')
    .insert({ household_id: hh.id, uploaded_by: a.id, merchant: 'Kaufland' })
    .select()
    .single();
  check('member (A) can record a receipt', rcErr == null, rcErr?.message ?? '');

  const bReadReceipt = await clientB.from('receipts').select('id').eq('id', receipt?.id);
  check('co-member (B) can read receipts', (bReadReceipt.data?.length ?? 0) === 1);

  const cReadReceipt = await clientC.from('receipts').select('id').eq('id', receipt?.id);
  check('outsider (C) cannot read receipts', (cReadReceipt.data?.length ?? 0) === 0);

  const cInsertReceipt = await clientC
    .from('receipts')
    .insert({ household_id: hh.id, uploaded_by: c.id });
  check('non-member (C) cannot record a receipt', cInsertReceipt.error != null, cInsertReceipt.error?.message ?? 'NO ERROR');

  const receiptSpoof = await clientA
    .from('receipts')
    .insert({ household_id: hh.id, uploaded_by: b.id });
  check('receipt uploader spoofing is rejected (uploaded_by must equal auth.uid)', receiptSpoof.error != null, receiptSpoof.error?.message ?? 'NO ERROR');

  const cApply = await clientC.rpc('apply_receipt', {
    p_household_id: hh.id,
    p_image_path: null,
    p_merchant: null,
    p_purchased_on: null,
    p_currency: null,
    p_lines: [],
  });
  check('non-member (C) cannot apply a receipt (RPC guard)', cApply.error != null, cApply.error?.message ?? 'NO ERROR');

  const applied = await clientA.rpc('apply_receipt', {
    p_household_id: hh.id,
    p_image_path: `${hh.id}/apply-test.jpg`,
    p_merchant: 'Coffee Shop',
    p_purchased_on: '2026-07-11',
    p_currency: 'BGN',
    p_lines: [{ name: 'Coffee', amount: 4, scope: 'shared', action: 'add', list_item_id: null }],
  });
  const appliedTx = applied.data
    ? await clientA.from('transactions').select('id').eq('receipt_id', applied.data.id)
    : { data: [] };
  check('member (A) apply_receipt records the reviewed expense', (appliedTx.data?.length ?? 0) === 1, applied.error?.message ?? '');

  const fullJoin = await clientC.rpc('join_household', { p_code: hh.invite_code });
  check('cannot join a full (2-member) household', fullJoin.error != null, fullJoin.error?.message ?? 'NO ERROR');

  const badJoin = await clientC.rpc('join_household', { p_code: 'ZZZZZZ' });
  check('cannot join with an invalid code', badJoin.error != null, badJoin.error?.message ?? 'NO ERROR');

  const anonRpc = await anon.rpc('create_household', { p_name: 'x' });
  check('unauthenticated cannot call create_household', anonRpc.error != null, anonRpc.error?.message ?? 'NO ERROR');

  const anonRead = await anon.from('households').select('id').eq('id', hh.id);
  check('unauthenticated cannot read households', (anonRead.data?.length ?? 0) === 0);

  // --- invite-code regeneration (owner-only) -----------------------------
  const oldCode = hh.invite_code;
  const aRegen = await clientA.rpc('regenerate_invite_code');
  check(
    'owner (A) can regenerate the invite code (and it changes)',
    aRegen.error == null && !!aRegen.data?.invite_code && aRegen.data.invite_code !== oldCode,
    aRegen.error?.message ?? aRegen.data?.invite_code
  );
  check('the regenerated code matches the strong 8-char format', /^[A-Z2-9]{8}$/.test(aRegen.data?.invite_code || ''), aRegen.data?.invite_code);

  const bRegen = await clientB.rpc('regenerate_invite_code');
  check('co-member (B, not owner) cannot regenerate the code', bRegen.error != null, bRegen.error?.message ?? 'NO ERROR');

  const cRegen = await clientC.rpc('regenerate_invite_code');
  check('outsider (C) cannot regenerate a code', cRegen.error != null, cRegen.error?.message ?? 'NO ERROR');

  // --- leave-household / account deletion --------------------------------
  // These are destructive, so they run last against their own fresh households.

  // The internal cleanup helper must NOT be callable directly — otherwise any
  // signed-in user could pass another user's id and wipe their data.
  const detachDirect = await clientA.rpc('_detach_user_from_households', { p_user: b.id });
  check('internal _detach helper is not callable by clients', detachDirect.error != null, detachDirect.error?.message ?? 'NO ERROR');

  // D creates a household, E joins; D then leaves while E remains.
  const d = await createUser('d', 'Dave');
  const e = await createUser('e', 'Erin');
  userIds.push(d.id, e.id);
  const [clientD, clientE] = await Promise.all([authed(d.email), authed(e.email)]);
  const { data: hhDE, error: deErr } = await clientD.rpc('create_household', { p_name: 'Leavers' });
  if (deErr) throw new Error('create_household (D): ' + deErr.message);
  householdIds.push(hhDE.id);
  await clientE.rpc('join_household', { p_code: hhDE.invite_code });

  const { data: dList } = await clientD.from('shopping_lists').insert({ household_id: hhDE.id, name: 'L' }).select().single();
  const { data: dItem } = await clientD.from('list_items').insert({ list_id: dList.id, name: 'Bread', added_by: d.id }).select().single();
  const { data: dTx } = await clientD
    .from('transactions')
    .insert({ household_id: hhDE.id, owner_id: d.id, amount: 8, description: 'D shared', scope: 'shared' })
    .select()
    .single();
  const { data: eTx } = await clientE
    .from('transactions')
    .insert({ household_id: hhDE.id, owner_id: e.id, amount: 4, description: 'E shared', scope: 'shared' })
    .select()
    .single();

  const dLeave = await clientD.rpc('leave_household');
  check('member (D) can leave a household with a partner', dLeave.error == null, dLeave.error?.message ?? '');

  const eMembers = await clientE.from('household_members').select('user_id').eq('household_id', hhDE.id);
  check(
    'leaver (D) is removed from membership; partner (E) remains',
    (eMembers.data?.length ?? 0) === 1 && eMembers.data[0].user_id === e.id
  );

  const eSeesDTx = await clientE.from('transactions').select('id').eq('id', dTx.id);
  check("the leaver's shared expenses are deleted", (eSeesDTx.data?.length ?? 0) === 0);

  const eSeesOwnTx = await clientE.from('transactions').select('id').eq('id', eTx.id);
  check("the partner's own expenses survive the leave", (eSeesOwnTx.data?.length ?? 0) === 1);

  const eHh = await clientE.from('households').select('created_by').eq('id', hhDE.id);
  check(
    'household survives and ownership transfers to the partner',
    (eHh.data?.length ?? 0) === 1 && eHh.data[0].created_by === e.id
  );

  const eItem = await clientE.from('list_items').select('added_by').eq('id', dItem.id);
  check(
    "the leaver's shared list items transfer to the partner",
    (eItem.data?.length ?? 0) === 1 && eItem.data[0].added_by === e.id
  );

  // F is a solo household owner who deletes their entire account.
  const f = await createUser('f', 'Fin');
  userIds.push(f.id);
  const clientF = await authed(f.email);
  const { data: hhF, error: fErr } = await clientF.rpc('create_household', { p_name: 'Solo' });
  if (fErr) throw new Error('create_household (F): ' + fErr.message);
  householdIds.push(hhF.id);

  const fDelete = await clientF.rpc('delete_account');
  check('solo member can delete their account', fDelete.error == null, fDelete.error?.message ?? '');

  const reSign = await mkClient(anonKey).auth.signInWithPassword({ email: f.email, password: pw });
  check('a deleted account can no longer sign in', reSign.error != null, reSign.error?.message ?? 'NO ERROR');

  if (admin) {
    const hhFGone = await admin.from('households').select('id').eq('id', hhF.id);
    check('delete_account dissolved the solo household', (hhFGone.data?.length ?? 0) === 0);
  }
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
