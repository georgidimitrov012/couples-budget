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
