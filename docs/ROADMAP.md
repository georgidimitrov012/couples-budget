# Roadmap

The shared plan: what's being worked on, what's next, what's decided, and what's waiting on
whom. Update it in the same PR whenever a priority, status or decision changes.

**Owner** — product decisions, device testing, accounts and dashboards (Supabase, Google Play,
Firebase, GitHub). **Claude** — planning, design mockups, code, tests, docs.

## How we work

Roles are checkpoints in one pipeline, not separate teams:

| Step | Who | What happens |
|---|---|---|
| **Plan** (PM) | Claude | This file. Priorities and status; decisions logged with dates |
| **Design** | Claude → Owner approves | Any new screen is mocked up on a design canvas first; code starts after approval |
| **Build** | Claude | One feature branch and PR at a time. Extra developer agents only for features that don't touch the same files, each in its own worktree (`lib/i18n.ts` is shared by almost everything) |
| **Review** (QA) | Fresh reviewer agent | Reads every PR before merge — security/RLS, edge cases, both languages. Findings get fixed or answered in the PR |
| **Verify** | Claude + Owner | `pnpm test:all`; UI changes also get [`DEVICE_CHECKLIST.md`](DEVICE_CHECKLIST.md) on a phone |
| **Research** | Background research agent | Market, legal and pricing questions, with sources; summarised here |

## Now

| Item | Status | Waiting on |
|---|---|---|
| **Push notifications** — PR #48 | Security fix + setup steps done; QA review running | Owner: Firebase, deploy, webhooks ([`SUPABASE_SETUP.md` §13](SUPABASE_SETUP.md)) |
| **Premium design** | Model proposed; mockups on the design canvas | Owner: approve pricing, plans and hints |
| **Recipes** | Research: legally usable, verified recipe sources | Research agent |

## Next

1. **Premium** — Google Play subscriptions through RevenueCat; Premium stored per user/household in
   Supabase; deals, extra receipt scans and recipes gated on the **server** (RLS/functions), never
   only in the app. Starts after the mockups are approved.
2. **Recipes** — a verified collection (no AI call per request) matched to the list and this week's
   deals, plus each couple's own shared cookbook. Starts after the research.
3. **Legal and launch** — its shape follows from Premium:
   - Business form (individual or ЕООД) and an accountant's view on VAT (чл. 97а ЗДДС)
   - Privacy policy and terms of use (subscriptions, price disclaimer); lawyer review
   - Google Play: account, 14-day closed test with 12 testers, Data safety form, account-deletion
     page, EU trader details
   - Real email provider (Resend) for reset codes — [`SUPABASE_SETUP.md` §16](SUPABASE_SETUP.md)
   - Turn on the daily deals price job; tick the steps in [`DEALS.md`](DEALS.md)

## Later

- One shared currency per household (needs a migration)
- Rate-limit invite-code guessing (`join_household`)
- Sentry crash reports (add the DSN, rebuild)
- Fix the `development` build profile (`expo-dev-client`)
- iOS (needs a Mac and an Apple developer account)
- Long-text test mode for layout checks

## Decisions

| Date | Decision |
|---|---|
| 2026-11-04 | Supermarket deals move to Premium |
| 2026-11-04 | Recipes: gather verified recipes; no AI generation per request (running cost) |
| 2026-11-04 | Team: roles as checkpoints (above) |
| 2026-10-14 | Priority order: push → monetisation → legal |
| 2026-10-14 | Server-side password policy (8+, letters and digits) and display-name limits |
| 2026-10-12 | Deals data: КЗП "Колко струва" open data; feature removable, remote on/off switch |
| MVP | Email confirmation stays off; turn it on together with a real email provider |

## Waiting on the owner

- Push: Firebase project + FCM key, `PUSH_WEBHOOK_SECRET`, deploy, 3 webhooks (§13)
- Premium: approve the pricing model and the mockups
- Deals testing: re-run the "Deals — refresh prices" workflow (prices hide after 2 days)
