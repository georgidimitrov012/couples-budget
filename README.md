# Couples Budget + Shared Shopping List

A mobile app for couples: a shared budget with a **"Yours / Mine / Ours"** model and a
**real-time shared shopping list** that updates live on both partners' phones.

A *household* is a couple (max 2 members). One partner creates it; the other joins with a
6-character invite code.

## How "Yours / Mine / Ours" works

Every transaction and category has a `scope`:

- `shared` ("Ours") — visible to both partners.
- `private` ("Mine") — visible only to its owner. Your partner's private spending ("Yours")
  is never sent to your device: Postgres Row-Level Security filters it out server-side, and
  the client defensively re-applies the same rule to realtime events.

The shopping list is always shared within the household.

## Stack

- [Expo SDK 57](https://docs.expo.dev) + Expo Router (file-based routing), TypeScript strict
- [Supabase](https://supabase.com): Postgres, Auth, Row-Level Security, Realtime
- `expo-secure-store` (keychain) for the session token — never AsyncStorage
- Optimistic UI reconciled against Realtime events (no offline sync engine in the MVP)
- EAS Build / EAS Submit for shipping

## Getting started

Package manager is **pnpm only** (`.npmrc` uses `node-linker=hoisted` so Metro can resolve
pnpm's modules — don't remove it).

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create a Supabase project and apply `schema.sql` (tables, RLS policies, RPCs, realtime
   publication). Full provisioning steps live in [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

3. Configure the environment:

   ```bash
   cp .env.example .env   # then fill in your Supabase URL + publishable/anon key
   ```

   The app uses the anon key only; RLS is the security boundary. The optional
   `SUPABASE_SERVICE_ROLE_KEY` is used exclusively by the security test suite.

4. Run it:

   ```bash
   pnpm start        # Expo dev server (press i / a / w)
   ```

## Testing

| Command | What it runs |
| --- | --- |
| `pnpm test` | Deterministic Jest suite (units, hooks, screens, regressions) — no network |
| `pnpm test:security` | Live RLS/penetration suite against the real Supabase project |
| `pnpm test:all` | Both — **required before every merge to `main`** |

The security suite self-cleans its test users/households when `SUPABASE_SERVICE_ROLE_KEY`
is set in `.env`; without it, it runs in anon-fallback mode and prints leftovers to delete.

## Project layout

```
src/app/            Expo Router routes: (auth) sign-in/up, (app) → (onboarding) + (tabs)
src/components/     Shared UI (themed primitives, tab bars, scope toggle)
hooks/              Data hooks: auth, household, shopping list, transactions, categories
lib/                Supabase client + secure-storage adapter
schema.sql          Full database schema (tables, RLS, RPCs, realtime publication)
docs/               Supabase dashboard/ops runbook
__tests__/          Deterministic Jest suite     tests/security/  live RLS suite
```

Conventions for contributors (and AI agents) are in [AGENTS.md](AGENTS.md).
