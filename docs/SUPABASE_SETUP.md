# Supabase setup & operations

Steps that live in the Supabase **dashboard / SQL editor**, not in code. Keep this in
sync when the schema or auth config changes.

> The app uses the **anon / publishable key only**. The `service_role` key is **test-only**
> (see below) and must never appear in app code or in any `EXPO_PUBLIC_*` variable — it
> bypasses Row-Level Security.

---

## 1. Realtime for the shared shopping list

Live sync (an item appearing on the partner's phone) requires `list_items` and
`shopping_lists` to be in the `supabase_realtime` publication. `schema.sql` already adds
them, but a project provisioned before that line existed may be missing them.

**Check what's published** — SQL Editor:

```sql
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;
```

Expected to include: `household_members`, `list_items`, `settlements`, `shopping_lists`,
`transactions`.

**Add whichever are missing** (adding one that already exists throws
"already member of publication", so run only the missing lines):

```sql
alter publication supabase_realtime add table public.list_items;
alter publication supabase_realtime add table public.shopping_lists;
```

**Smoke-test:** open the **List** tab in two sessions of the same household (two
devices/emulators, or one device + the web build), add an item on one — it should appear
on the other within ~1s. Checking and removing should mirror too.

- If **adds** sync but **deletes** don't, run
  `alter table public.list_items replica identity full;`. The client only needs the row id
  on delete, so the default replica identity is normally enough — this is just a fallback.

---

## 2. Service-role key → self-cleaning security tests

`pnpm test:security` runs the live RLS/penetration suite against the real project. With the
`service_role` key present it creates its test users/households via the admin API and
**fully deletes them afterwards**. Without it, the suite falls back to anon sign-ups and
leaves test data behind.

1. Dashboard → **Project Settings → API** → **Project API keys** → reveal & copy the
   **`service_role`** (`secret`) key. (New key system: use a **Secret key** `sb_secret_…`
   instead — same admin privileges.)
2. Add it to `.env` (already gitignored; stubbed in `.env.example`):
   ```
   SUPABASE_SERVICE_ROLE_KEY=<paste here>
   ```
3. Verify:
   ```
   pnpm test:security
   ```
   The header should read `(service-role, self-cleaning)` and end with
   `Cleaned up all test data (service role).`

⚠️ Never prefix this key with `EXPO_PUBLIC_` and never import it in `lib/` or `src/`.

---

## 3. First-time project provisioning

When pointing the app at a **fresh** Supabase project:

1. **Schema** — run all of `schema.sql` in the SQL Editor. It creates the tables, RLS
   policies, RPCs (`create_household` / `join_household`), triggers, and the realtime
   publication (§1). It also defines `generate_invite_code()` using `gen_random_uuid()`
   (not pgcrypto's `gen_random_bytes`, which isn't on the search_path inside the
   `SECURITY DEFINER` RPCs — using it makes `create_household()` throw).
2. **Email confirmation OFF** — Authentication → Providers → **Email** → turn off
   **Confirm email** (`mailer_autoconfirm`). MVP decision: users are signed in immediately
   after sign-up; the client still tolerates the confirmation-required case.
3. **Client env** — set `EXPO_PUBLIC_SUPABASE_URL` and
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env` from Project Settings → API.
4. **Realtime** — confirm §1 (the publication lines in `schema.sql` cover it, but verify).

---

## 4. Migration: `settlements` (settle-up feature)

Projects provisioned **before** the settle-up feature need this applied once in the SQL
Editor (fresh projects get it from `schema.sql`). Idempotence note: `create table` /
`create policy` will error if already applied — that just means you're done.

```sql
create table public.settlements (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  from_user    uuid not null references auth.users(id),
  to_user      uuid not null references auth.users(id),
  amount       numeric(12,2) not null check (amount > 0),
  created_at   timestamptz not null default now(),
  check (from_user <> to_user)
);

alter table public.settlements enable row level security;

create policy "settlements_select" on public.settlements
  for select using (public.is_household_member(household_id));
create policy "settlements_insert" on public.settlements
  for insert with check (
    public.is_household_member(household_id)
    and exists (select 1 from public.household_members hm
                where hm.household_id = settlements.household_id and hm.user_id = from_user)
    and exists (select 1 from public.household_members hm
                where hm.household_id = settlements.household_id and hm.user_id = to_user)
  );
create policy "settlements_delete" on public.settlements
  for delete using (public.is_household_member(household_id));

alter publication supabase_realtime add table public.settlements;
```

**Verify:** `pnpm test:security` — the settlement checks should pass. **Smoke-test:** with
a shared expense on the books, the Budget tab shows "X owes Y …"; tapping **Mark as
settled** flips it to "You're all square" on both partners' devices.

---

## 5. Migration: list → budget price wiring

Checking off a priced list item records a shared transaction (owned by whoever checked
it, so it feeds settle-up); unchecking removes it. Projects provisioned **before** this
feature need the following applied once in the SQL Editor (fresh projects get it from
`schema.sql`).

```sql
-- Link a transaction to the list item that produced it. Unique (partial) so an
-- item can never feed the budget twice, even if both partners check it at once.
alter table public.transactions
  add column list_item_id uuid references public.list_items(id) on delete set null;
create unique index transactions_list_item_uniq
  on public.transactions (list_item_id) where list_item_id is not null;

-- Either partner may delete a shared expense (e.g. unchecking a list item the
-- other partner checked); private stays owner-only. Also fixes the silent no-op
-- when deleting the partner's shared expense from the Budget tab.
drop policy "transactions_delete" on public.transactions;
create policy "transactions_delete" on public.transactions
  for delete using (
    owner_id = auth.uid()
    or (scope = 'shared' and public.is_household_member(household_id))
  );
```

**Verify:** `pnpm test:security` — the list→budget wiring checks should pass.
**Smoke-test:** add a list item with a price, check it off → it appears as an "Ours"
expense on the Budget tab (and moves the settle-up balance); uncheck → it disappears.

---

## 6. Receipt scanning (Claude vision Edge Function)

Scanning a paper receipt extracts its line items, the user reviews/edits them, and on
submit each applied line becomes a shared expense (matched items are also checked off the
shopping list). Three pieces of infrastructure back this: a DB migration, a private
Storage bucket, and an Edge Function holding the Anthropic key.

### 6a. Database migration

Fresh projects get this from `schema.sql`; existing projects apply it once in the SQL
Editor:

```sql
create table public.receipts (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  uploaded_by  uuid not null references auth.users(id),
  image_path   text,
  merchant     text,
  purchased_on date,
  currency     text,
  total        numeric(12,2),
  created_at   timestamptz not null default now()
);
alter table public.transactions
  add column receipt_id uuid references public.receipts(id) on delete set null;

alter table public.receipts enable row level security;
create policy "receipts_select" on public.receipts
  for select using (public.is_household_member(household_id));
create policy "receipts_insert" on public.receipts
  for insert with check (public.is_household_member(household_id) and uploaded_by = auth.uid());
create policy "receipts_delete" on public.receipts
  for delete using (public.is_household_member(household_id));
```

Then create the `apply_receipt` RPC — copy the full `create or replace function
public.apply_receipt(...)` block (and its `grant execute`) from `schema.sql`.

### 6b. Private Storage bucket + RLS

Dashboard → **Storage** → **New bucket** → name `receipts`, **Private** (uncheck public).
Then in the SQL Editor add policies scoping objects to the household in the first path
segment (`<household_id>/<receipt_id>.jpg`):

```sql
create policy "receipts_read" on storage.objects
  for select to authenticated using (
    bucket_id = 'receipts'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );
create policy "receipts_write" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'receipts'
    and public.is_household_member(((storage.foldername(name))[1])::uuid)
  );
```

### 6c. Edge Function + Anthropic key

Requires the Supabase CLI (`pnpm dlx supabase --version`) linked to the project
(`supabase link`). The function source is in `supabase/functions/scan-receipt/`.

```bash
# Set the secret (never goes in .env or the app bundle):
pnpm dlx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# Optional — override the default model (claude-haiku-4-5-20251001):
pnpm dlx supabase secrets set ANTHROPIC_MODEL=claude-sonnet-5

# Deploy:
pnpm dlx supabase functions deploy scan-receipt
```

The function authenticates the caller (rejects anonymous requests), so it needs the
default JWT verification left on. `SUPABASE_URL` / `SUPABASE_ANON_KEY` are injected
automatically.

**Smoke-test:** on the List tab tap **Scan receipt**, take/pick a photo of a receipt →
the review screen shows editable line items → adjust and **Submit** → the expenses land
on the Budget tab (matched items get checked off), and the image + record appear under
Storage → `receipts`. If extraction is weak on your receipts, bump `ANTHROPIC_MODEL` to a
larger model and redeploy is **not** needed (secrets apply on next invocation).

---

## 7. Migration: leave-household + account deletion

Adds the `leave_household()` and `delete_account()` RPCs (Apple requires in-app account
deletion for App Store approval). Fresh projects get these from `schema.sql`; existing
projects apply the block once in the SQL Editor — copy the three
`create or replace function` blocks plus the `revoke` and `grant` lines from `schema.sql`,
specifically:

- `public._detach_user_from_households(uuid)` — internal cleanup helper, **immediately
  followed by** `revoke all on function public._detach_user_from_households(uuid) from
  public, anon, authenticated;` (critical: without the revoke, any signed-in user could call
  it with another user's id and wipe their data — and it must name `anon, authenticated`
  explicitly, because Supabase's default privileges grant EXECUTE to those roles directly,
  so `from public` alone is not enough).
- `public.leave_household()` + its `grant execute … to authenticated`.
- `public.delete_account()` + its `grant execute … to authenticated`.

Why an RPC and not a client `DELETE`: the app holds the **anon key only** and several
tables reference `auth.users(id)` without on-delete cascade, so the rows must be removed
in order. The functions are `SECURITY DEFINER` (they run as the `postgres` owner), which is
what lets `delete_account()` remove the row from `auth.users`. Run the block in the SQL
Editor as the project owner so the functions are owned by `postgres`.

> If `delete_account()` ever errors with a permission problem on `auth.users`, the
> fallback is an Edge Function using the service-role admin API (`auth.admin.deleteUser`);
> not needed on a standard Supabase project where the SQL Editor runs as `postgres`.

**Semantics** (a household is a couple, max 2): leaving as the **last** member deletes the
whole household (cascade wipes its data); leaving while a **partner remains** deletes only
*your* transactions/settlements/receipts/categories, transfers shared shopping-list items
and household ownership to your partner, and removes your membership. `delete_account()`
does the same cleanup, then deletes your auth user.

**Smoke-test:** Home → **Settings** → **Leave household** returns you to the create/join
onboarding screen (your partner keeps the household). **Delete account** signs you out to
the auth screen and the account no longer exists (a re-sign-in fails). Then run
`pnpm test:security` — the leave/delete isolation checks should pass.

---

## 8. Migration: stronger invite codes + regenerate

Hardens the invite code. Fresh projects get this from `schema.sql`; existing projects apply
it once in the SQL Editor — copy the two `create or replace function` blocks (plus the
`grant`) from `schema.sql`:

- `public.generate_invite_code()` — now **8 chars from a 31-char unambiguous alphabet**
  (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`, no `0/O/1/I/L`) → ~8.5e11 combinations, up from the
  old 6 hex chars (~16.7M). Only *newly generated* codes change; existing households keep
  their current code (it still works for joining).
- `public.regenerate_invite_code()` + its `grant execute … to authenticated` — **owner-only**
  rotation (the `where created_by = auth.uid()` enforces it; a partner/outsider matches no
  row and gets an exception).

This changes no existing data — it redefines one function and adds another.

> Join throttling is intentionally deferred: real rate-limiting needs extra infrastructure,
> and the ~8.5e11 code space makes brute-forcing impractical. Noted in the roadmap.

**Smoke-test:** on Home while waiting for your partner, tap **Regenerate code** → the
displayed code changes to a new 8-char code. Then run `pnpm test:security` — the invite-code
format + regeneration checks should pass.

---

> §9 (DB check constraints — `amount > 0`, `quantity > 0`, `monthly_limit >= 0`) is built
> but parked on branch `feat/db-check-constraints`; apply it from there if/when that merges.

---

## 10. Migration: shopping-list category (v2 grocery rework)

Adds a `category` column to `list_items` so the shopping list can group items by grocery
aisle (Vegetables, Dairy, Bakery…). The categories themselves are app-defined constants in
`lib/groceries.ts` (with emoji icons) — this column just stores the key. Fresh projects get
it inline from `schema.sql`; existing projects apply it once in the SQL Editor:

```sql
alter table public.list_items add column category text;
```

Safe and instant: it adds one nullable column and touches no existing data (older items read
back as "Other" until re-categorized). After applying, regenerate types with `pnpm gen:types`.

**Smoke-test:** on the List tab, add "Bread" → it appears under a **🥖 Bakery** group; the
price field is gone and items carry a quantity stepper.
