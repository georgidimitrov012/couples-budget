-- ============================================================
-- Couples Budget + Shared Shopping List — Supabase schema
-- Model: "Yours / Mine / Ours" (private + shared scope)
-- Run in the Supabase SQL editor (or as a migration).
-- ============================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------

-- Short, human-friendly invite code (6 hex chars, uppercased).
-- Uses gen_random_uuid() (core, in pg_catalog) rather than pgcrypto's
-- gen_random_bytes, which isn't on the search_path inside our SECURITY DEFINER
-- RPCs (Supabase installs pgcrypto in the `extensions` schema).
create or replace function public.generate_invite_code()
returns text language sql volatile as $$
  select upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));
$$;

-- ----------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ----------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- Auto-create a profile when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------
-- households + membership
-- ----------------------------------------------------------------
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Our Home',
  invite_code text not null unique default public.generate_invite_code(),
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member',
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- SECURITY DEFINER membership checks bypass RLS, which avoids recursive-policy errors.
create or replace function public.is_household_member(h_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.household_members
    where household_id = h_id and user_id = auth.uid()
  );
$$;

create or replace function public.shares_household_with(other uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.household_members me
    join public.household_members them on them.household_id = me.household_id
    where me.user_id = auth.uid() and them.user_id = other
  );
$$;

-- NOTE: can_access_list() is defined further down, after shopping_lists exists.
-- Postgres validates `language sql` function bodies at creation time.

-- ----------------------------------------------------------------
-- budget categories
-- ----------------------------------------------------------------
create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  owner_id      uuid not null references auth.users(id),
  name          text not null,
  icon          text,
  color         text,
  monthly_limit numeric(12,2),
  scope         text not null default 'shared' check (scope in ('private','shared')),
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- transactions
-- ----------------------------------------------------------------
create table public.transactions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id  uuid references public.categories(id) on delete set null,
  owner_id     uuid not null references auth.users(id),
  amount       numeric(12,2) not null,
  description  text,
  occurred_on  date not null default current_date,
  scope        text not null default 'shared' check (scope in ('private','shared')),
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- settlements ("who owes whom" settle-up)
-- Shared expenses are split 50/50; whoever paid is owed half by their
-- partner. A settlement records a payback (from_user paid to_user) and
-- cancels that debt. Insert-only from the app; no scope column — always
-- visible to both members.
-- ----------------------------------------------------------------
create table public.settlements (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  from_user    uuid not null references auth.users(id),
  to_user      uuid not null references auth.users(id),
  amount       numeric(12,2) not null check (amount > 0),
  created_at   timestamptz not null default now(),
  check (from_user <> to_user)
);

-- ----------------------------------------------------------------
-- shopping lists (always shared within a household)
-- ----------------------------------------------------------------
create table public.shopping_lists (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null default 'Shopping List',
  created_at   timestamptz not null default now()
);

create table public.list_items (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.shopping_lists(id) on delete cascade,
  name        text not null,
  quantity    int not null default 1,
  price       numeric(12,2),                                  -- optional: feeds budget on check-off
  category_id uuid references public.categories(id) on delete set null,
  is_checked  boolean not null default false,
  added_by    uuid not null references auth.users(id),
  checked_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger list_items_touch
  before update on public.list_items
  for each row execute function public.touch_updated_at();

-- Budget wiring: checking off a priced list item records a shared transaction.
-- The link column lives on transactions but is added here because list_items is
-- created after transactions. Unique (partial) so an item can never feed the
-- budget twice, even if both partners check it simultaneously.
alter table public.transactions
  add column list_item_id uuid references public.list_items(id) on delete set null;
create unique index transactions_list_item_uniq
  on public.transactions (list_item_id) where list_item_id is not null;

-- Now that shopping_lists exists, define the list access helper.
create or replace function public.can_access_list(p_list_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.shopping_lists sl
    join public.household_members hm on hm.household_id = sl.household_id
    where sl.id = p_list_id and hm.user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------
-- Row-Level Security
-- ----------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.households         enable row level security;
alter table public.household_members  enable row level security;
alter table public.categories         enable row level security;
alter table public.transactions       enable row level security;
alter table public.settlements        enable row level security;
alter table public.shopping_lists     enable row level security;
alter table public.list_items         enable row level security;

-- profiles: read self or a co-member; update only self
create policy "profiles_select" on public.profiles
  for select using (id = auth.uid() or public.shares_household_with(id));
create policy "profiles_update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- households: members can read
create policy "households_select" on public.households
  for select using (public.is_household_member(id));

-- household_members: read membership of your own households
create policy "members_select" on public.household_members
  for select using (public.is_household_member(household_id));

-- categories: shared OR owned; write only your own
create policy "categories_select" on public.categories
  for select using (
    public.is_household_member(household_id)
    and (scope = 'shared' or owner_id = auth.uid())
  );
create policy "categories_insert" on public.categories
  for insert with check (public.is_household_member(household_id) and owner_id = auth.uid());
create policy "categories_update" on public.categories
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "categories_delete" on public.categories
  for delete using (owner_id = auth.uid());

-- transactions: same visibility logic as categories
create policy "transactions_select" on public.transactions
  for select using (
    public.is_household_member(household_id)
    and (scope = 'shared' or owner_id = auth.uid())
  );
create policy "transactions_insert" on public.transactions
  for insert with check (public.is_household_member(household_id) and owner_id = auth.uid());
create policy "transactions_update" on public.transactions
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- Either partner may delete a shared expense (e.g. unchecking a list item the
-- other partner checked); private stays owner-only.
create policy "transactions_delete" on public.transactions
  for delete using (
    owner_id = auth.uid()
    or (scope = 'shared' and public.is_household_member(household_id))
  );

-- settlements: visible to both members; either member may record one (a payback
-- is agreed between partners), but both parties must belong to that household.
-- Members may delete (undo a mis-recorded settlement).
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

-- shopping_lists: any household member (shared)
create policy "lists_select" on public.shopping_lists
  for select using (public.is_household_member(household_id));
create policy "lists_insert" on public.shopping_lists
  for insert with check (public.is_household_member(household_id));
create policy "lists_update" on public.shopping_lists
  for update using (public.is_household_member(household_id));
create policy "lists_delete" on public.shopping_lists
  for delete using (public.is_household_member(household_id));

-- list_items: any household member of the list's household (shared)
create policy "items_select" on public.list_items
  for select using (public.can_access_list(list_id));
create policy "items_insert" on public.list_items
  for insert with check (public.can_access_list(list_id) and added_by = auth.uid());
create policy "items_update" on public.list_items
  for update using (public.can_access_list(list_id));
create policy "items_delete" on public.list_items
  for delete using (public.can_access_list(list_id));

-- ----------------------------------------------------------------
-- RPCs: create / join a household (run as definer so the creator
-- is added as a member atomically and RLS RETURNING issues are avoided)
-- ----------------------------------------------------------------
create or replace function public.create_household(p_name text default 'Our Home')
returns public.households
language plpgsql security definer set search_path = public as $$
declare h public.households;
begin
  insert into public.households (name, created_by)
  values (coalesce(nullif(p_name, ''), 'Our Home'), auth.uid())
  returning * into h;

  insert into public.household_members (household_id, user_id, role)
  values (h.id, auth.uid(), 'owner');

  return h;
end;
$$;

create or replace function public.join_household(p_code text)
returns public.households
language plpgsql security definer set search_path = public as $$
declare
  h public.households;
  member_count int;
begin
  select * into h from public.households where invite_code = upper(p_code);
  if h.id is null then
    raise exception 'Invalid invite code';
  end if;

  select count(*) into member_count
  from public.household_members where household_id = h.id;

  if member_count >= 2 then
    raise exception 'This household is already full';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (h.id, auth.uid(), 'member')
  on conflict do nothing;

  return h;
end;
$$;

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text)   to authenticated;

-- ----------------------------------------------------------------
-- Realtime: broadcast changes for the live shopping list (+ budget)
-- (If a table is already in the publication, skip that line.)
-- ----------------------------------------------------------------
alter publication supabase_realtime add table public.list_items;
alter publication supabase_realtime add table public.shopping_lists;
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.settlements;
-- Lets the household creator see their partner appear live during onboarding.
alter publication supabase_realtime add table public.household_members;
