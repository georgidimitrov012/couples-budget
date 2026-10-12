# Supermarket deals

When someone adds an item to the shopping list that a big chain has **on sale**, the List tab
shows it under the item:

```
☐ Домати
   🏷 Kaufland: 1,29 € (−45%) · Домати кг  +1
```

Tapping the badge opens every current price for that item across **Lidl, Kaufland, Billa,
Fantastico and T Market**, with the date, the source and a "check in store" note.

The feature is **self-contained and removable**: one folder, one hook-in on the List tab, a
remote on/off switch, and the removal steps at the bottom of this page.

---

## Checklist

### Build (in the PR)
- [x] Database: `feature_flags` switch, `deal_prices` table, read-only RLS gated by the switch,
      `replace_deal_prices()` for the job only — `schema.sql` + [`SUPABASE_SETUP.md` §15](SUPABASE_SETUP.md)
- [x] Price job: КЗП archive → five chains → one row per product → Supabase
      (`src/features/deals/ingest/`), manual-only GitHub workflow, obeys the switch
- [x] Matching: list item → official product group, extra words narrow the kind, misfiled
      products rejected, per-kg/l/piece comparison, tobacco never imported
- [x] App: badge on the List tab + comparison sheet (loading / error / empty states), BG + EN
- [x] Tests: matching, prices, parser, hook, badge, List tab, containment; live security checks
- [x] Docs: this page

### Your steps (one-time, in this order)
- [ ] **1. Run the SQL** — Supabase → SQL Editor → paste [§15](SUPABASE_SETUP.md) → Run.
- [ ] **2. Add two GitHub secrets** — see [GitHub secrets](#github-secrets) below.
- [ ] **3. Merge the PR** (the job only appears under Actions once it's on `main`).
- [ ] **4. Turn the switch on** — see [The switch](#the-switch).
- [ ] **5. Run the job once** — see [Running the price job](#running-the-price-job).
- [ ] **6. Test on a phone** — build the app, add "Домати", "Мляко", "Яйца" to the list.
- [ ] **7. Turn the switch off** again when you're done testing (optional).

### Before launch
- [ ] Turn on the daily schedule (uncomment `schedule:` in `.github/workflows/deals-ingest.yml`
      and update the matching expectation in `__tests__/regression/deals-containment.test.ts`).
- [ ] App-wide legal items (privacy policy, terms with the price disclaimer, store forms) —
      tracked on the launch agenda, not specific to this feature.

---

## Where the data comes from

**КЗП** (Комисия за защита на потребителите) runs the "Колко струва" portal. Under the Euro
Introduction Act (чл. 55б), retailers with over 10 M лв turnover report their prices every
day, and КЗП publishes them as **open data**: <https://www.kolkostruva.bg/opendata> — one ZIP per
day, one CSV per chain, one row per product per store, with the regular and the promo price (€).

Each product is tagged with one of the state's 101 official product groups ("Домати, червени,
насипни 1кг", "Прясно мляко 1 л", …). We match list items to those groups — see
[`src/features/deals/groups.ts`](../src/features/deals/groups.ts).

### Legal notes (keep these true)
- **Why we may use it:** it's open data published by a public body for anyone to download and
  compare. КЗП's terms (<https://kzp.bg/bg/terms>) say its content "може да се използва
  свободно" and "изисква единствено цитиране". Bulgarian law on reusing public-sector
  information covers commercial and non-commercial reuse.
- **Always credit the source:** "Източник: КЗП · kolkostruva.bg" on the price sheet.
- **Never present prices as guaranteed:** show the date and "проверете в магазина".
  The data can be wrong (the press has reported errors on the portal).
- **Chain names as plain text only** — no logos (trademarks).
- **No endorsement wording** — we're not a partner of КЗП or of any chain.
- **Tobacco (group 78) is never imported** — tobacco advertising is banned. Medicines aren't
  imported either.
- If anyone objects, use [the switch](#the-switch) first and ask questions after.

This is not legal advice; the app-wide launch checklist (privacy policy, terms, store forms)
is tracked separately.

---

## How it works

```
GitHub Actions (manual for now)                     Supabase                       App
  deals-ingest.yml ─▶ run.mjs ─ download ZIP ─▶ replace_deal_prices() ─▶ deal_prices ─▶ useDeals ─▶ 🏷 badge
                     (skips if switch off)        (service role only)     (RLS: readable
                                                                           only while the
                                                                           switch is on)
```

- The job keeps one row per chain × product: the most common regular price across the chain's
  stores, the most common promo price, and the **share of stores** that report the promo.
- "On sale at Kaufland" means the promo is in **at least 80 %** of that chain's stores. A promo in
  only a few stores shows in the sheet as "само в някои магазини", never as the badge.
- Prices are reported for the previous day; anything older than **2 days** is hidden, so a job
  that stops running can never leave a stale "sale" on screen.

### Different kinds of the same item
- The badge always names the **exact product** ("Домати кг", "Домати на клонка").
- Extra words narrow it: "домати на клонка" → only vine tomatoes; "кисело мляко 2%" → only 2 %;
  a brand ("Саяна") → only that brand. Plain "домати" accepts every kind.
- A product must contain the item word (a tomato must say "домат"), so a product a chain filed
  in the wrong group can't show up.
- Items outside the official groups (chips, juice, detergent…) simply get no badge.

---

## The switch

One row in Supabase controls everything: `feature_flags` → `deals`.

| `enabled` | App | Price job |
|---|---|---|
| `false` (default) | No badges anywhere — the database returns no prices, even to old app versions | Exits immediately, downloads nothing |
| `true` | Badges + comparison sheet | Loads prices when run |

**Turn it on/off — Dashboard:** Supabase → **Table Editor** → `feature_flags` → row `deals` →
set `enabled` to `true`/`false` → **Save**.

**Or SQL Editor:**

```sql
update public.feature_flags set enabled = true,  updated_at = now() where key = 'deals'; -- on
update public.feature_flags set enabled = false, updated_at = now() where key = 'deals'; -- off
```

Apps pick the change up the next time the List tab loads. No new build is ever needed.

---

## Running the price job

During development the job **never runs by itself**.

- **GitHub:** repo → **Actions** → **Deals — refresh prices** → **Run workflow** → (optionally a
  date, `YYYY-MM-DD`) → **Run workflow**. Takes under a minute. The log lists each chain's
  product and promo counts.
- **Locally:** `pnpm deals:ingest` (uses `.env`; needs Node 22.18+).
  `pnpm deals:ingest --dry-run` downloads and parses without touching Supabase.

The switch must be **on**, or the job just prints "Deals are switched off" and stops.

### GitHub secrets
Repo on GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Name | Value |
|---|---|
| `SUPABASE_URL` | `https://tsmhvhhrluwupcyoiyoq.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → **Project Settings** → **API Keys** → the secret / `service_role` key (the same one as in your local `.env`) |

The service-role key stays on GitHub's servers and in your `.env` — never in the app.

---

## Removing the feature

### Level 1 — switch off (seconds, no app update)
Set `deals` to `false` ([The switch](#the-switch)). Every app stops showing prices; the job stops.

### Level 2 — wipe (minutes, no app update)
1. Level 1.
2. SQL Editor: `truncate public.deal_prices;`
3. GitHub → **Actions** → **Deals — refresh prices** → **⋯** → **Disable workflow**.
4. Delete the two GitHub secrets (nothing else uses them).

### Level 3 — remove the code (one PR + next build)
1. Delete:
   - `src/features/deals/`
   - `__tests__/features/deals/`
   - `__tests__/regression/deals-containment.test.ts`
   - `.github/workflows/deals-ingest.yml`
   - `docs/DEALS.md`
2. Edit (every spot is tagged `[deals]` or names deals):
   - `src/app/(app)/(tabs)/list.tsx` — the import, `useDeals`, `extraData`, the `saleFor` line
     and the `footer` prop (the generic `footer` slot on `ListRow` can stay).
   - `__tests__/screens/list.test.tsx` — the `@/features/deals` mock and the deal-badge test.
   - `tests/security/run-security.mjs` — the "supermarket deals" block and `dealSentinel`.
   - `schema.sql` — the `[deals]` section.
   - `docs/SUPABASE_SETUP.md` — §15 and the deals mention in the service-role note.
   - `package.json` — the `deals:ingest` script.
   - `AGENTS.md` — the deals line.
3. SQL Editor:
   ```sql
   drop function if exists public.replace_deal_prices(text, date, jsonb);
   drop table if exists public.deal_prices;
   drop table if exists public.feature_flags; -- only if nothing else uses flags
   ```
4. `pnpm gen:types`, then `pnpm test:all`, then ship a build.
