# Couples Budget + Shared Shopping List

Conventions for AI coding agents working in this repo. Read before generating code.

## What we're building
A mobile app for couples with two core features:
1. A shared budget with a **"Yours / Mine / Ours"** model.
2. A **real-time shared shopping list** that updates live on both partners' phones.

A "household" is a couple (max 2 members). One partner creates it; the other joins
with a 6-character invite code.

## Stack
- **Expo SDK 57** + **Expo Router** (file-based routing), **TypeScript strict**
- **Supabase**: Postgres, Auth, Row-Level Security, Realtime (websockets)
- `expo-secure-store` for tokens/sensitive data
- Realtime + optimistic UI for the shopping list (no offline sync engine in the MVP)
- **EAS Build / EAS Submit** for shipping
- Package manager: **pnpm ONLY**. Never run `npm` or `yarn`. Use `pnpm`, `pnpm dlx`, `pnpm expo …`.
- `.npmrc` sets `node-linker=hoisted` — required for Metro to resolve pnpm's modules. Don't remove it.

## The data model (see schema.sql)
- `profiles` — 1:1 with auth.users
- `households` + `household_members` — the couple unit
- `categories`, `transactions` — carry `scope` ('private' | 'shared')
- `shopping_lists`, `list_items` — always shared within the household
- Household create/join happen via the RPCs `create_household()` and `join_household()`.

## Scope rule (important)
- `scope = 'shared'` → visible to both household members.
- `scope = 'private'` → visible only to `owner_id`.
- This is enforced in the DB by RLS. The client must still respect it in the UI
  (e.g. don't show private totals on shared summary screens).

## Conventions
- Screens live in **`src/app/`** using Expo Router file-based routing.
- Supabase client in `lib/supabase.ts`; generated DB types in `lib/database.types.ts`
  (regenerate with `pnpm dlx supabase gen types typescript`).
- Realtime subscriptions live in hooks (e.g. `hooks/useListItems.ts`); always
  unsubscribe on unmount.
- Optimistic updates for list add/check/delete; reconcile against Realtime events.
- `useColorScheme()` for dark mode; apply safe-area insets on every screen.
- Always handle the three permission states (not asked / denied / granted) and the
  offline state gracefully (banner + retry).
- Every list/data screen needs explicit empty, loading, and error states.

## Don'ts
- Don't eject from the Expo managed workflow.
- Don't put sensitive data in AsyncStorage — use `expo-secure-store`.
- Don't hardcode pixel dimensions — use flex layouts.
- Don't bypass RLS by using the service-role key in the app. The app uses the anon key only.
- Don't `npm install` anything. pnpm only.
- Don't commit `.env`.

## Workflow
- Use **Explore → Plan → Code → Commit**: propose a short plan before writing code.
- Build one vertical feature end-to-end before starting the next (see BUILD_PLAN.md).
- When changing the schema, update `schema.sql`, run the migration, then regenerate types.
- Dashboard / ops steps (realtime publication, the test-only service-role key, email
  confirmation, fresh-project provisioning) live in `docs/SUPABASE_SETUP.md`.

## Testing (project rule)
- Two suites: **`pnpm test`** — deterministic Jest unit/component/regression tests
  (jest-expo + Testing Library, no network) under `__tests__/`; and
  **`pnpm test:security`** — the live RLS/penetration suite (`tests/security/`) that
  exercises the real Supabase security boundary. `pnpm test:all` runs both.
- **Run the entire collection (`pnpm test:all`) before every merge to `main`.** Do not
  merge with a red suite.
- **Whenever you add or change code, add or update tests to match** — new screens/hooks
  get tests; changed behavior updates the existing test; fixed bugs get a regression test.
- Test-writing notes for this stack: RTL-RN `render`/`renderHook`/`unmount` are **async
  (await them)**; use `userEvent` (not `fireEvent`) for typing so state flushes; keep
  mocked context values (e.g. `useAuth`) referentially **stable**; `test/setup.ts` sets
  `IS_REACT_ACT_ENVIRONMENT` and mocks safe-area-context + expo-router.
- The security suite self-cleans when `SUPABASE_SERVICE_ROLE_KEY` is in `.env` (test-only,
  never in app code); without it, it runs in anon-fallback mode and leaves test data.
- Test dirs are excluded from the app `tsconfig` (Jest transpiles them via Babel).